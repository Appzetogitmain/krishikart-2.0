import Delivery from "../models/delivery.js";
import OTP from "../models/otp.js";
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
import { uploadToCloudinary } from "../utils/cloudinary.js";

/* 🔐 TOKEN */
const generateToken = (id) =>
  jwt.sign({ id, role: "delivery" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

/** Login payload must include profile fields used by the app (e.g. fullName on Dashboard). */
const buildDeliveryLoginResult = (delivery, token) => ({
  token,
  id: delivery._id,
  _id: delivery._id,
  mobile: delivery.mobile,
  fullName: delivery.fullName,
  vehicleNumber: delivery.vehicleNumber,
  vehicleType: delivery.vehicleType,
  role: "delivery",
  isApproved: delivery.isApproved,
  approvalStatus: delivery.approvalStatus,
  isOnline: delivery.isOnline,
  status: delivery.status,
});
/* ================= REGISTER DELIVERY ================= */
export const registerDelivery = async (req, res) => {
  try {
    const { fullName, mobile, vehicleNumber, vehicleType } = req.body;
    if (!fullName || !mobile || !vehicleNumber || !vehicleType) {
      return handleResponse(res, 400, "All fields (Name, Mobile, Vehicle) are required");
    }

    if (!/^[a-zA-Z\s]+$/.test(fullName))
      return handleResponse(res, 400, "Name should only contain alphabets");

    if (!/^[6-9]\d{9}$/.test(mobile))
      return handleResponse(res, 400, "Invalid mobile number. Must be 10 digits starting with 6-9.");

    if (!/^[a-zA-Z]{2}\d{2}[a-zA-Z]{2}\d{4}$/.test(vehicleNumber))
      return handleResponse(res, 400, "Vehicle number must be in format MP09CS1234");

    if (!["bike", "scooter"].includes(vehicleType))
      return handleResponse(res, 400, "Invalid vehicle type");

    if (!req.files?.aadharImage?.[0] || !req.files?.panImage?.[0] || !req.files?.licenseImage?.[0]) {
      return handleResponse(res, 400, "Aadhar, PAN and License images are required");
    }

    const aadharImageUrl = await uploadToCloudinary(req.files.aadharImage[0].buffer, "delivery/aadhar");
    const panImageUrl = await uploadToCloudinary(req.files.panImage[0].buffer, "delivery/pan");
    const licenseImageUrl = await uploadToCloudinary(req.files.licenseImage[0].buffer, "delivery/license");

    let delivery = await Delivery.findOne({ mobile });

    if (delivery && delivery.isVerified) {
      return handleResponse(res, 409, "Delivery partner already registered");
    }

    if (!delivery) {
      delivery = await Delivery.create({
        fullName,
        mobile,
        vehicleNumber,
        vehicleType,
        aadharImage: aadharImageUrl,
        panImage: panImageUrl,
        licenseImage: licenseImageUrl
      });
    }

    if (isGlobalDefaultOtpEnabled()) {
      return handleResponse(
        res,
        200,
        "Default OTP mode: SMS not sent. Use DEFAULT_OTP to verify registration.",
      );
    }

    const devPhone = process.env.DELIVERY_DEFAULT_PHONE?.trim();
    // Check if an OTP was recently sent (cooldown)
    const existingOTP = await OTP.findOne({ mobile, role: "delivery" });
    if (existingOTP && mobile !== devPhone) {
      const timeDiff = (new Date() - existingOTP.updatedAt) / 1000;
      if (timeDiff < 15) {
        return handleResponse(res, 429, "Wait 15 seconds before requesting another OTP");
      }
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    await OTP.findOneAndUpdate(
      { mobile, role: "delivery" },
      {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
      },
      { upsert: true, returnDocument: 'after' }
    );

    const smsSent = await sendSMS(mobile, otp);

    if (!smsSent && mobile !== devPhone) {
      // Delete the OTP record if sending failed so they can retry immediately
      await OTP.deleteOne({ mobile, role: "delivery" });
      return handleResponse(res, 500, "Failed to send SMS. Please try again later.");
    }

    return handleResponse(res, 200, "OTP sent for registration via SMS");
  } catch (err) {
    console.error("Delivery Register Error:", err);
    return handleResponse(res, 500, "Server error: " + err.message);
  }
};


/* ================= SEND OTP ================= */
export const sendDeliveryOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile)
      return handleResponse(res, 400, "Mobile number required");

    if (!/^[6-9]\d{9}$/.test(mobile))
      return handleResponse(res, 400, "Invalid mobile number");

    let delivery = await Delivery.findOne({ mobile });

    const devPhone = process.env.DELIVERY_DEFAULT_PHONE?.trim();

    if (!delivery) {
      // ✅ Allow Auto-Register for DEV MODE Number
      if (mobile === devPhone) {
        delivery = await Delivery.create({
          mobile,
          fullName: "Dev Partner",
          vehicleNumber: "MP09CS1234",
          vehicleType: "bike",
          isVerified: true,
          status: "active",
        });
      } else {
        // ❌ For other numbers, they must register first
        return handleResponse(res, 404, "Delivery partner not registered. Please register first.");
      }
    }

    if (delivery.status === "blocked")
      return handleResponse(res, 403, "Delivery partner blocked");

    if (isGlobalDefaultOtpEnabled()) {
      return handleResponse(
        res,
        200,
        "Default OTP mode: SMS not sent. Use DEFAULT_OTP to log in.",
      );
    }

    // Check if an OTP was recently sent (cooldown)
    const existingOTP = await OTP.findOne({ mobile, role: "delivery" });
    if (existingOTP && mobile !== devPhone) {
      const timeDiff = (new Date() - existingOTP.updatedAt) / 1000;
      if (timeDiff < 15) {
        return handleResponse(res, 429, "Wait 15 seconds before requesting another OTP");
      }
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    await OTP.findOneAndUpdate(
      { mobile, role: "delivery" },
      {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
      },
      { upsert: true }
    );

    await sendSMS(mobile, otp);

    return handleResponse(res, 200, "OTP sent via SMS");
  } catch (err) {
    // Cleanup OTP record on error if it was created
    await OTP.deleteOne({ mobile: req.body.mobile, role: "delivery" });
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= VERIFY DELIVERY OTP ================= */
export const verifyDeliveryOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return handleResponse(res, 400, "Mobile & OTP required");
    }

    /* ✅ DEV MODE DEFAULT LOGIN */
    const isDevMode =
      mobile === process.env.DELIVERY_DEFAULT_PHONE?.trim() &&
      otp.toString() === process.env.DELIVERY_DEFAULT_OTP?.trim();

    if (isDevMode) {
      let delivery = await Delivery.findOne({ mobile });

      if (!delivery) {
        delivery = await Delivery.create({
          mobile,
          fullName: "Dev Partner",
          vehicleNumber: "MP09CS1234",
          vehicleType: "bike",
          isVerified: true,
          status: "active",
        });
      }

      const token = generateToken(delivery._id);

      // Invalidate any existing OTP
      await OTP.deleteOne({ mobile, role: "delivery" });

      return handleResponse(
        res,
        200,
        "Delivery login successful (DEV MODE)",
        buildDeliveryLoginResult(delivery, token),
      );
    }

    /* ✅ GLOBAL DEFAULT OTP — any valid mobile + DEFAULT_OTP */
    if (matchesGlobalDefaultOtp(otp)) {
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return handleResponse(res, 400, "Invalid mobile number");
      }
      let delivery = await Delivery.findOne({ mobile });

      if (!delivery) {
        delivery = await Delivery.create({
          mobile,
          fullName: "Dev Partner",
          vehicleNumber: "MP09CS1234",
          vehicleType: "bike",
          isVerified: true,
          status: "active",
        });
      }

      if (delivery.status === "blocked")
        return handleResponse(res, 403, "Delivery partner blocked");

      delivery.isVerified = true;
      await delivery.save();

      const token = generateToken(delivery._id);

      await OTP.deleteOne({ mobile, role: "delivery" });

      return handleResponse(
        res,
        200,
        "Delivery login successful (default OTP mode)",
        buildDeliveryLoginResult(delivery, token),
      );
    }

    /* 🔽 NORMAL OTP FLOW */
    const otpRecord = await OTP.findOne({ mobile, role: "delivery" });

    if (!otpRecord)
      return handleResponse(res, 404, "OTP not found or expired");

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ mobile, role: "delivery" });
      return handleResponse(res, 400, "OTP expired");
    }

    const isMatch = await verifyHashedOTP(otp, otpRecord.otp);

    if (!isMatch) {
      return handleResponse(res, 400, "Invalid OTP");
    }

    const delivery = await Delivery.findOne({ mobile });

    if (!delivery)
      return handleResponse(res, 404, "Delivery user not found");

    if (delivery.status === "blocked")
      return handleResponse(res, 403, "Delivery partner blocked");

    delivery.isVerified = true;
    await delivery.save();

    // Delete OTP record after successful verification
    await OTP.deleteOne({ mobile, role: "delivery" });

    const token = generateToken(delivery._id);

    return handleResponse(
      res,
      200,
      "Delivery login successful",
      buildDeliveryLoginResult(delivery, token),
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error: " + err.message);
  }
};

/* ================= GET ME ================= */
export const getDeliveryMe = async (req, res) => {
  return handleResponse(res, 200, "Delivery profile", req.delivery);
};

/* ================= FORGOT PASSWORD ================= */
export const forgotDeliveryPassword = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile)
      return handleResponse(res, 400, "Mobile required");

    const delivery = await Delivery.findOne({ mobile });

    if (!delivery)
      return handleResponse(res, 404, "Delivery user not found");

    if (isGlobalDefaultOtpEnabled()) {
      return handleResponse(
        res,
        200,
        "Default OTP mode: SMS not sent. Use DEFAULT_OTP to reset password.",
      );
    }

    const otp = generateOTP();
    const hashedOtp = await hashOTP(otp);

    await OTP.findOneAndUpdate(
      { mobile, role: "delivery" },
      {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
      },
      { upsert: true }
    );

    await sendSMS(mobile, otp);

    return handleResponse(res, 200, "OTP sent for password reset via SMS");
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= RESET PASSWORD ================= */
export const resetDeliveryPassword = async (req, res) => {
  try {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword)
      return handleResponse(res, 400, "All fields required");

    const delivery = await Delivery.findOne({ mobile });

    if (!delivery)
      return handleResponse(res, 404, "Delivery user not found");

    if (matchesGlobalDefaultOtp(otp)) {
      delivery.password = await bcrypt.hash(newPassword, 10);
      await delivery.save();
      await OTP.deleteOne({ mobile, role: "delivery" });
      return handleResponse(res, 200, "Password reset successful");
    }

    const otpRecord = await OTP.findOne({ mobile, role: "delivery" });
    if (!otpRecord)
      return handleResponse(res, 400, "OTP not found or expired");

    const isMatch = await verifyHashedOTP(otp, otpRecord.otp);
    if (!isMatch)
      return handleResponse(res, 400, "Invalid OTP");

    if (otpRecord.expiresAt < new Date())
      return handleResponse(res, 400, "OTP expired");

    delivery.password = await bcrypt.hash(newPassword, 10);
    await delivery.save();

    await OTP.deleteOne({ mobile, role: "delivery" });

    return handleResponse(res, 200, "Password reset successful");
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};
/* ================= UPDATE PROFILE ================= */
export const updateDeliveryProfile = async (req, res) => {
  try {
    const { fullName, vehicleNumber, vehicleType } = req.body;
    const delivery = await Delivery.findById(req.delivery._id);

    if (!delivery) return handleResponse(res, 404, "Delivery partner not found");

    if (fullName) delivery.fullName = fullName;
    if (vehicleNumber) delivery.vehicleNumber = vehicleNumber;
    if (vehicleType) {
      if (!["bike", "scooter"].includes(vehicleType)) {
        return handleResponse(res, 400, "Invalid vehicle type");
      }
      delivery.vehicleType = vehicleType;
    }

    await delivery.save();

    return handleResponse(res, 200, "Profile updated successfully", delivery);
  } catch (err) {
    console.error("Update profile error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= SUBMIT DOCUMENT UPDATE ================= */
export const submitDocumentUpdate = async (req, res) => {
  try {
    const deliveryId = req.delivery._id;
    const { aadharNumber, panNumber, licenseNumber } = req.body;

    const updateData = {
      status: "pending",
      submittedAt: new Date()
    };

    if (aadharNumber) {
      const cleanAadhar = aadharNumber.toString().trim();
      if (!/^\d{12}$/.test(cleanAadhar)) {
        return handleResponse(res, 400, "Aadhaar card number must be exactly 12 numeric digits");
      }
      updateData.aadharNumber = cleanAadhar;
    }
    if (panNumber) {
      const cleanPan = panNumber.toString().trim().toUpperCase();
      if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(cleanPan)) {
        return handleResponse(res, 400, "PAN card number must be in the format: AAAAA9999A (e.g. ABCDE1234F)");
      }
      updateData.panNumber = cleanPan;
    }
    if (licenseNumber) {
      const cleanLicense = licenseNumber.toString().replace(/[\s.-]/g, '').toUpperCase();
      if (!/^[A-Z]{2}\d{13}$/.test(cleanLicense)) {
        return handleResponse(res, 400, "Driving License must start with a 2-letter state code followed by 13 digits (e.g., MH1220180004567)");
      }
      updateData.licenseNumber = cleanLicense;
    }

    if (req.files?.aadharImage?.[0]) {
      updateData.aadharImage = await uploadToCloudinary(req.files.aadharImage[0].buffer, "delivery/pending/aadhar");
    }
    if (req.files?.panImage?.[0]) {
      updateData.panImage = await uploadToCloudinary(req.files.panImage[0].buffer, "delivery/pending/pan");
    }
    if (req.files?.licenseImage?.[0]) {
      updateData.licenseImage = await uploadToCloudinary(req.files.licenseImage[0].buffer, "delivery/pending/license");
    }

    await Delivery.findByIdAndUpdate(deliveryId, {
      $set: { pendingDocs: updateData }
    });

    return handleResponse(res, 200, "Document update request submitted for admin approval");
  } catch (err) {
    console.error("Submit document update error:", err);
    return handleResponse(res, 500, "Server error: " + err.message);
  }
};

/**
 * DELETE DELIVERY ACCOUNT
 */
export const deleteDeliveryAccount = async (req, res) => {
  try {
    const deliveryId = req.delivery?._id;
    const delivery = await Delivery.findByIdAndDelete(deliveryId);
    if (!delivery) {
      return handleResponse(res, 404, "Delivery partner not found");
    }
    return handleResponse(res, 200, "Account deleted successfully");
  } catch (error) {
    console.error("Delete delivery account error:", error);
    return handleResponse(res, 500, "Internal server error");
  }
};
