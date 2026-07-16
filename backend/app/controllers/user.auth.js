import User from "../models/user.js";
import OTP from "../models/otp.js";
import WalletRecharge from "../models/walletRecharge.js";
import GlobalSetting from "../models/globalSetting.js";
import handleResponse from "../utils/helper.js";
import {
  generateOTP,
  hashOTP,
  verifyHashedOTP,
  matchesGlobalDefaultOtp,
  isGlobalDefaultOtpEnabled,
} from "../utils/otpHelper.js";
import { sendSMS } from "../utils/smsService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import admin from "../services/firebaseAdmin.js";
import razorpay from "../utils/razorpay.js";
import { createUserNotification } from "../utils/userNotification.js";


/**
 * SEND OTP
 */
export const sendOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validation
    if (!mobile) {
      return handleResponse(res, 400, "Mobile number is required");
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return handleResponse(res, 400, "Invalid mobile number");
    }

    let user = await User.findOne({ mobile });

    // Auto-register if user not exists
    if (!user) {
      user = await User.create({ mobile });
    }

    if (isGlobalDefaultOtpEnabled()) {
      return handleResponse(
        res,
        200,
        "Default OTP mode: SMS not sent. Use DEFAULT_OTP from server config to verify."
      );
    }

    const devPhone = process.env.USER_DEFAULT_PHONE?.trim();

    // Check if an OTP was recently sent (cooldown)
    const existingOTP = await OTP.findOne({ mobile, role: "user" });
    if (existingOTP && mobile !== devPhone) {
      const timeDiff = (new Date() - existingOTP.updatedAt) / 1000;
      if (timeDiff < 15) {
        return handleResponse(
          res,
          429,
          "Please wait 15 seconds before requesting another OTP"
        );
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    // Save/Update OTP in database
    await OTP.findOneAndUpdate(
      { mobile, role: "user" },
      {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
        verified: false,
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Send SMS via SMS India API
    const smsSent = await sendSMS(mobile, otp);

    if (!smsSent && mobile !== devPhone) {
      // Delete the OTP record if sending failed so they can retry immediately
      await OTP.deleteOne({ mobile, role: "user" });
      return handleResponse(res, 500, "Failed to send SMS. Please try again later.");
    }

    // ❌ No console.log(otp)

    return handleResponse(res, 200, "OTP sent successfully via SMS");
  } catch (error) {
    console.error(error);
    return handleResponse(res, 500, "Internal server error");
  }
};


export const verifyOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return handleResponse(res, 400, "Mobile & OTP are required");
    }

    /* ✅ DEV MODE LOGIN */
    const isDevMode =
      mobile === process.env.USER_DEFAULT_PHONE?.trim() &&
      otp.toString() === process.env.USER_DEFAULT_OTP?.trim();

    if (isDevMode) {
      let user = await User.findOne({ mobile });

      if (!user) {
        user = await User.create({
          mobile,
          fullName: "Guest User",
          isVerified: true,
        });
      }

      const token = jwt.sign(
        { id: user._id, role: "user" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Invalidate any existing OTP for this user
      await OTP.deleteOne({ mobile, role: "user" });

      return handleResponse(res, 200, "Login successful (DEV MODE)", {
        token,
        user: {
          id: user._id,
          mobile: user.mobile,
          fullName: user.fullName || "Guest User",
          role: "user",
          onboardingCompleted: user.onboardingCompleted || false,
          businessType: user.businessType || null,
          walletBalance: user.walletBalance || 0,
          creditLimit: user.creditLimit || 0,
          usedCredit: user.usedCredit || 0,
          loyaltyPoints: user.loyaltyPoints || 0,
          walletTransactions: user.walletTransactions || [],
        },
      });
    }

    /* ✅ GLOBAL DEFAULT OTP (USE_DEFALT_OTP / USE_DEFAULT_OTP + DEFAULT_OTP) — any valid mobile */
    if (matchesGlobalDefaultOtp(otp)) {
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return handleResponse(res, 400, "Invalid mobile number");
      }
      let user = await User.findOne({ mobile });

      if (!user) {
        user = await User.create({
          mobile,
          fullName: "Guest User",
          isVerified: true,
        });
      }

      const token = jwt.sign(
        { id: user._id, role: "user" },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      await OTP.deleteOne({ mobile, role: "user" });

      return handleResponse(res, 200, "Login successful (default OTP mode)", {
        token,
        user: {
          id: user._id,
          mobile: user.mobile,
          fullName: user.fullName || "Guest User",
          role: "user",
          onboardingCompleted: user.onboardingCompleted || false,
          businessType: user.businessType || null,
          walletBalance: user.walletBalance || 0,
          creditLimit: user.creditLimit || 0,
          usedCredit: user.usedCredit || 0,
          loyaltyPoints: user.loyaltyPoints || 0,
          walletTransactions: user.walletTransactions || [],
        },
      });
    }

    /* 🔽 NORMAL OTP FLOW */
    const otpRecord = await OTP.findOne({ mobile, role: "user" });

    if (!otpRecord) {
      return handleResponse(res, 404, "OTP not found or expired");
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ mobile, role: "user" });
      return handleResponse(res, 400, "OTP expired");
    }

    const isMatch = await verifyHashedOTP(otp, otpRecord.otp);

    if (!isMatch) {
      return handleResponse(res, 400, "Invalid OTP");
    }

    let user = await User.findOne({ mobile });

    if (!user) {
      return handleResponse(res, 404, "User not found");
    }

    user.isVerified = true;
    await user.save();

    // Delete OTP record after successful verification
    await OTP.deleteOne({ mobile, role: "user" });

    const token = jwt.sign(
      { id: user._id, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return handleResponse(res, 200, "Login successful", {
      token,
      user: {
        id: user._id,
        mobile: user.mobile,
        fullName: user.fullName,
        legalEntityName: user.legalEntityName,
        email: user.email,
        profileImage: user.profileImage,
        role: "user",
        onboardingCompleted: user.onboardingCompleted || false,
        businessType: user.businessType || null,
        walletBalance: user.walletBalance || 0,
        creditLimit: user.creditLimit || 0,
        usedCredit: user.usedCredit || 0,
        loyaltyPoints: user.loyaltyPoints || 0,
        walletTransactions: user.walletTransactions || [],
      },
    });
  } catch (error) {
    console.error(error);
    return handleResponse(res, 500, "Internal server error");
  }
};



// export const verifyOTP = async (req, res) => {
//   try {
//     const { mobile, otp } = req.body;

//     // Validation
//     if (!mobile || !otp) {
//       return handleResponse(res, 400, "Mobile & OTP are required");
//     }

//     if (!/^\d{6}$/.test(otp)) {
//       return handleResponse(res, 400, "OTP must be 6 digits");
//     }

//     const user = await User.findOne({ mobile });

//     if (!user) {
//       return handleResponse(res, 404, "User not found");
//     }

//     // OTP expired
//     if (user.otpExpiresAt < new Date()) {
//       return handleResponse(res, 400, "OTP expired");
//     }

//     // Too many attempts
//     if (user.otpAttempts >= 5) {
//       return handleResponse(
//         res,
//         429,
//         "Too many invalid attempts, request new OTP"
//       );
//     }

//     // OTP mismatch
//     if (user.otp !== otp) {
//       user.otpAttempts += 1;
//       await user.save();
//       return handleResponse(res, 400, "Invalid OTP");
//     }

//     // Success
//     user.isVerified = true;
//     user.otp = null;
//     user.otpExpiresAt = null;
//     user.otpAttempts = 0;

//     await user.save();

//     return handleResponse(res, 200, "Login successful", {
//       id: user._id,
//       mobile: user.mobile,
//     });
//   } catch (error) {
//     console.error(error);
//     return handleResponse(res, 500, "Internal server error");
//   }
// };
export const getMe = async (req, res) => {
  try {
    return handleResponse(res, 200, "User profile", req.user);
  } catch (error) {
    return handleResponse(res, 500, "Server error");
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile)
      return handleResponse(res, 400, "Mobile required");

    const user = await User.findOne({ mobile });
    if (!user)
      return handleResponse(res, 404, "User not found");

    if (isGlobalDefaultOtpEnabled()) {
      return handleResponse(
        res,
        200,
        "Default OTP mode: SMS not sent. Use DEFAULT_OTP to reset password."
      );
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    await OTP.findOneAndUpdate(
      { mobile, role: "user" },
      {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verified: false
      },
      { upsert: true }
    );

    await sendSMS(mobile, otp);

    return handleResponse(res, 200, "OTP sent for password reset");
  } catch (error) {
    return handleResponse(res, 500, "Server error");
  }
};


export const resetPassword = async (req, res) => {
  try {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword)
      return handleResponse(res, 400, "All fields required");

    const user = await User.findOne({ mobile });
    if (!user)
      return handleResponse(res, 404, "User not found");

    if (matchesGlobalDefaultOtp(otp)) {
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      await OTP.deleteOne({ mobile, role: "user" });
      return handleResponse(res, 200, "Password reset successful");
    }

    const otpRecord = await OTP.findOne({ mobile, role: "user" });
    if (!otpRecord)
      return handleResponse(res, 400, "OTP not found or expired");

    const isMatch = await verifyHashedOTP(otp, otpRecord.otp);
    if (!isMatch)
      return handleResponse(res, 400, "Invalid OTP");

    if (otpRecord.expiresAt < new Date())
      return handleResponse(res, 400, "OTP expired");

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await OTP.deleteOne({ mobile, role: "user" });

    return handleResponse(res, 200, "Password reset successful");
  } catch (error) {
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * UPDATE PROFILE
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      fullName,
      email,
      panNumber,
      legalEntityName,
      address,
      preferences,
      profileImage,
      businessType,
      gstNumber,
      fssaiNumber,
      onboardingCompleted,
      additionalNumbers,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return handleResponse(res, 404, "User not found");
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (panNumber !== undefined) user.panNumber = panNumber;
    if (legalEntityName !== undefined) user.legalEntityName = legalEntityName;
    if (address !== undefined) user.address = address;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (businessType !== undefined) user.businessType = businessType;
    if (gstNumber !== undefined) user.gstNumber = gstNumber;
    if (fssaiNumber !== undefined) user.fssaiNumber = fssaiNumber;
    if (onboardingCompleted !== undefined) user.onboardingCompleted = onboardingCompleted;
    if (additionalNumbers !== undefined) user.additionalNumbers = additionalNumbers;

    if (preferences) {
      user.preferences = {
        ...user.preferences.toObject(),
        ...preferences,
      };
    }

    await user.save();

    return handleResponse(res, 200, "Profile updated successfully", user);
  } catch (error) {
    console.error(error);
    return handleResponse(res, 500, "Internal server error");
  }
};

/**
 * CHANGE PASSWORD
 */
export const changeUserPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.password) {
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return handleResponse(res, 200, "Password set successfully");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return handleResponse(res, 400, "Invalid old password");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return handleResponse(res, 200, "Password changed successfully");
  } catch (error) {
    return handleResponse(res, 500, "Server error");
  }
};

export const createWalletRechargeOrder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) return handleResponse(res, 401, "User not authenticated");
    const amount = Number(req.body.amount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return handleResponse(res, 400, "Valid recharge amount is required");
    }

    if (amount > 100000) {
      return handleResponse(res, 400, "Recharge amount exceeds allowed limit");
    }

    const user = await User.findById(userId).select("_id");
    if (!user) return handleResponse(res, 404, "User not found");

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return handleResponse(res, 500, "Razorpay is not configured");
    }

    const shortUser = String(userId).slice(-6);
    const shortTs = Date.now().toString(36);
    const receipt = `wr_${shortUser}_${shortTs}`; // Razorpay receipt max length: 40

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
      notes: {
        type: "wallet_recharge",
        userId: userId.toString(),
      },
    });

    await WalletRecharge.findOneAndUpdate(
      { razorpayOrderId: order.id },
      {
        userId,
        amount: Number(amount.toFixed(2)),
        currency: "INR",
        status: "created",
        razorpayOrderId: order.id,
      },
      { upsert: true, new: true }
    );

    return handleResponse(res, 200, "Wallet recharge order created", {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    const reason =
      error?.error?.description ||
      error?.message ||
      "Unknown error";
    console.error("Create wallet recharge order error:", reason, error);
    return handleResponse(res, 500, `Failed to initialize wallet recharge: ${reason}`);
  }
};

export const verifyWalletRecharge = async (req, res) => {
  try {
    const userId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return handleResponse(res, 400, "Missing payment credentials");
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return handleResponse(res, 400, "Invalid payment signature");
    }

    const recharge = await WalletRecharge.findOne({
      userId,
      razorpayOrderId: razorpay_order_id,
    });

    if (!recharge) {
      return handleResponse(res, 404, "Recharge order not found");
    }

    // Idempotency: do not credit wallet twice for same Razorpay order.
    if (recharge.status === "paid") {
      const existingUser = await User.findById(userId);
      return handleResponse(res, 200, "Wallet already recharged", existingUser);
    }

    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");

    user.walletBalance = Number((Number(user.walletBalance || 0) + Number(recharge.amount || 0)).toFixed(2));
    user.walletTransactions = user.walletTransactions || [];
    user.walletTransactions.unshift({
      txnId: `WAL-RZP-${Date.now()}`,
      type: "Added",
      amount: Number(recharge.amount || 0),
      status: "Success",
      note: "Wallet recharge via Razorpay",
      createdAt: new Date(),
    });

    recharge.status = "paid";
    recharge.razorpayPaymentId = razorpay_payment_id;
    recharge.paidAt = new Date();

    await recharge.save();
    await user.save();

    await createUserNotification({
      userId,
      type: "wallet",
      title: "Wallet Recharged",
      message: `Rs${Number(recharge.amount || 0).toFixed(2)} has been added to your wallet successfully.`,
      link: "/wallet",
      meta: {
        amount: Number(recharge.amount || 0),
        transactionType: "wallet_recharge",
      },
    });

    return handleResponse(res, 200, "Wallet recharged successfully", user);
  } catch (error) {
    console.error("Wallet recharge error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * CREDIT REPAYMENT
 */
export const createCreditRepaymentOrder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id?.toString();
    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");

    const amount = Number(user.usedCredit || 0);
    if (amount <= 0) {
      return handleResponse(res, 400, "No outstanding credit balance to pay.");
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return handleResponse(res, 500, "Razorpay is not configured");
    }

    const receipt = `crd_${String(userId).slice(-6)}_${Date.now().toString(36)}`;

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
      notes: {
        type: "credit_repayment",
        userId: userId.toString(),
      },
    });

    await WalletRecharge.create({
      userId,
      amount: Number(amount.toFixed(2)),
      currency: "INR",
      type: "credit_repayment",
      status: "created",
      razorpayOrderId: order.id,
    });

    return handleResponse(res, 200, "Credit repayment order created", {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Create credit repayment order error:", error);
    return handleResponse(res, 500, "Failed to initialize payment");
  }
};

export const verifyCreditRepayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return handleResponse(res, 400, "Invalid payment signature");
    }

    const recharge = await WalletRecharge.findOne({
      userId,
      razorpayOrderId: razorpay_order_id,
      type: "credit_repayment"
    });

    if (!recharge) {
      return handleResponse(res, 404, "Payment record not found");
    }

    if (recharge.status === "paid") {
      const existingUser = await User.findById(userId);
      return handleResponse(res, 200, "Payment already processed", existingUser);
    }

    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");

    const paidAmount = recharge.amount;
    user.usedCredit = Math.max(0, user.usedCredit - paidAmount);

    // If credit is fully cleared, reset overdue date
    if (user.usedCredit === 0) {
      user.creditOverdueDate = null;
    }

    user.walletTransactions = user.walletTransactions || [];
    user.walletTransactions.unshift({
      txnId: `CRD-PAY-${Date.now()}`,
      type: "Paid", // Or add "Credit Repayment" to enum. I'll use "Paid" for consistency with existing walletTransactions enum or check schema
      amount: paidAmount,
      status: "Success",
      note: "KK Credit repayment via Razorpay",
      createdAt: new Date(),
    });

    recharge.status = "paid";
    recharge.razorpayPaymentId = razorpay_payment_id;
    recharge.paidAt = new Date();

    await recharge.save();
    await user.save();

    await createUserNotification({
      userId,
      type: "wallet",
      title: "Credit Repaid",
      message: `Your KK Credit repayment of Rs${Number(paidAmount || 0).toFixed(2)} was successful.`,
      link: "/wallet",
      meta: {
        amount: Number(paidAmount || 0),
        transactionType: "credit_repayment",
      },
    });

    return handleResponse(res, 200, "Credit balance cleared successfully", user);
  } catch (error) {
    console.error("Credit repayment verify error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const redeemLoyaltyPoints = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) return handleResponse(res, 401, "User not authenticated");

    const requestedPoints = Number(req.body.points || 0);
    if (!Number.isFinite(requestedPoints) || requestedPoints <= 0) {
      return handleResponse(res, 400, "Valid points are required");
    }

    const loyaltySetting = await GlobalSetting.findOne({ key: "loyalty_config" });
    const cfg = loyaltySetting?.value || {};
    const redemptionRate = Math.max(1, Number(cfg.redemptionRate || 10)); // points per ₹1
    const minRedeemPoints = Math.max(1, Number(cfg.minRedeemPoints || 100));

    if (requestedPoints < minRedeemPoints) {
      return handleResponse(res, 400, `Minimum ${minRedeemPoints} points required to redeem`);
    }

    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");

    const currentPoints = Number(user.loyaltyPoints || 0);
    if (currentPoints < requestedPoints) {
      return handleResponse(res, 400, "Insufficient loyalty points");
    }

    const redeemRupees = Math.floor(requestedPoints / redemptionRate);
    if (redeemRupees <= 0) {
      return handleResponse(res, 400, "Redeem points are below conversion threshold");
    }

    const pointsConsumed = redeemRupees * redemptionRate;
    user.loyaltyPoints = Math.max(0, currentPoints - pointsConsumed);
    user.walletBalance = Number((Number(user.walletBalance || 0) + redeemRupees).toFixed(2));
    user.walletTransactions = user.walletTransactions || [];
    user.walletTransactions.unshift({
      txnId: `RED-${Date.now()}`,
      type: "Redemption",
      amount: redeemRupees,
      status: "Success",
      note: `Redeemed ${pointsConsumed} points to wallet`,
      createdAt: new Date(),
    });

    await user.save();

    await createUserNotification({
      userId,
      type: "wallet",
      title: "Loyalty Redeemed",
      message: `You redeemed ${pointsConsumed} loyalty points and received Rs${redeemRupees} in your wallet.`,
      link: "/wallet",
      meta: {
        pointsConsumed,
        amount: redeemRupees,
        transactionType: "loyalty_redemption",
      },
    });

    return handleResponse(res, 200, "Loyalty points redeemed successfully", user);
  } catch (error) {
    console.error("Redeem loyalty points error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * @desc Save User FCM Token
 * @route POST /user/fcm-token
 * @access Private (User)
 */
export const saveFCMToken = async (req, res) => {
  try {
    const { token, fcm_token, plateform, platform } = req.body;
    const userId = req.user.id;
    const finalToken = fcm_token || token;
    const finalPlatform = plateform || platform || 'web';

    console.log(`[FCM-User] Incoming token for User ${userId} [Platform: ${finalPlatform}]:`, finalToken);

    if (!finalToken) return handleResponse(res, 400, "FCM Token is required");

    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");
    if (!user.fcmTokens) user.fcmTokens = [];
    if (!user.mobile_fcm) user.mobile_fcm = [];

    // Web goes to fcmTokens, everything else (android, ios, mobile) goes to mobile_fcm
    const isWeb = finalPlatform.toLowerCase() === 'web';
    const targetArrayName = isWeb ? 'fcmTokens' : 'mobile_fcm';
    const targetArray = user[targetArrayName];

    console.log(`[FCM-User] Targeted array for Platform "${finalPlatform}": ${targetArrayName}`);

    if (!targetArray.includes(finalToken)) {
      console.log(`[FCM-User] Registering new unique token for User ${userId} in ${targetArrayName}`);
      targetArray.push(finalToken);
      if (targetArray.length > 10) {
        console.log(`[FCM-User] Token limit (10) reached for ${targetArrayName} of User ${userId}. Slicing older tokens.`);
        user[targetArrayName] = targetArray.slice(-10);
      }
      await user.save();
    } else {
      console.log(`[FCM-User] Token already exists in ${targetArrayName} for User ${userId}.`);
    }

    return handleResponse(res, 200, "FCM token saved successfully");
  } catch (err) {
    console.error("Save User FCM Token Error:", err);
    return handleResponse(res, 500, "Internal server error");
  }
};

/**
 * @desc Test Push Notification by Token (Mobile Developer Helper)
 * @route POST /user/test-notification
 * @access Private (User)
 */
export const testPushByToken = async (req, res) => {
  try {
    const { fcm_token, plateform } = req.body;
    if (!fcm_token) return handleResponse(res, 400, "fcm_token is required");

    console.log(`[FCM-Test-User] Sending test ping to ${plateform || 'mobile'}:`, fcm_token);

    const message = {
      notification: {
        title: "Kisaankart User App Test",
        body: `Success! Your ${plateform || 'device'} is correctly integrated with Kisaankart FCM.`
      },
      token: fcm_token
    };

    const bodyToken = fcm_token || token;
    const response = await admin.messaging().send(message);
    return handleResponse(res, 200, "Test notification sent successfully!", response);
  } catch (error) {
    console.error("Test Notification Error:", error);

    // Specific handling for stale/invalid tokens
    if (error.code === 'messaging/registration-token-not-registered') {
      const userId = req.user?.id;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          $pull: {
            fcmTokens: bodyToken,
            mobile_fcm: bodyToken
          }
        });
        console.log(`[FCM-User-Cleanup] Removed stale token from all possible fields for User ${userId}: ${bodyToken}`);
      }

      return handleResponse(res, 410, "FCM Token is no longer valid (NotRegistered). Please generate a fresh token from the mobile app.", {
        code: error.code,
        error_message: error.message,
        suggestion: "Refresh the token on the mobile device and try again."
      });
    }

    return handleResponse(res, 500, "Failed to send test notification", {
      code: error.code,
      error_message: error.message
    });
  }
};

/**
 * FOR TESTING ONLY: Manually make account overdue
 */
export const makeOverdueTest = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");

    user.usedCredit = 500;
    // Set due date to 8 days ago
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 8);
    user.creditOverdueDate = overdueDate;

    await user.save();
    return handleResponse(res, 200, "Success! Your account is now OVERDUE by 8 days. Refresh your app to see the lock screen.");
  } catch (error) {
    console.error(error);
    return handleResponse(res, 500, "Test failed");
  }
};

/**
 * DELETE USER ACCOUNT
 */
export const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return handleResponse(res, 404, "User not found");
    }
    return handleResponse(res, 200, "Account deleted successfully");
  } catch (error) {
    console.error("Delete user account error:", error);
    return handleResponse(res, 500, "Internal server error");
  }
};

