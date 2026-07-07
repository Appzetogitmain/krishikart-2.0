import Vendor from "../models/vendor.js";
import OTP from "../models/otp.js";
import handleResponse from "../utils/helper.js";
import { generateOTP, hashOTP, verifyHashedOTP, matchesGlobalDefaultOtp, isGlobalDefaultOtpEnabled } from "../utils/otpHelper.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { sendSMS } from "../utils/smsService.js";
import admin from "../services/firebaseAdmin.js";
import crypto from "crypto";
import Category from "../models/category.js";
import { createAdminNotification } from "../utils/adminNotification.js";

/* 🔐 TOKEN */
const generateToken = (id) =>
    jwt.sign({ id, role: "vendor" }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });

/* ================= REGISTER ================= */
/* ================= REGISTER ================= */

export const registerVendor = async (req, res) => {
    try {
        const { fullName, email, mobile, farmLocation, password, fssaiLicense, servedCategories } = req.body;

        if (!fullName || !email || !mobile || !farmLocation || !password) {
            return handleResponse(res, 400, "Full name, email, mobile, location and password are required");
        }

        if (!/^[6-9]\d{9}$/.test(mobile)) {
            return handleResponse(res, 400, "Invalid mobile number");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return handleResponse(res, 400, "Invalid email format");
        }

        // Parse nested bank details if present
        let bankDetails = {};
        if (req.body.bankDetails) {
            try {
                bankDetails = typeof req.body.bankDetails === 'string'
                    ? JSON.parse(req.body.bankDetails)
                    : req.body.bankDetails;
            } catch (e) {
                console.error("Bank Details parsing error", e);
            }
        } else {
            bankDetails = {
                accountHolderName: req.body['bankDetails[accountHolderName]'] || req.body.accountHolderName,
                accountNumber: req.body['bankDetails[accountNumber]'] || req.body.accountNumber,
                ifscCode: req.body['bankDetails[ifscCode]'] || req.body.ifscCode,
                bankName: req.body['bankDetails[bankName]'] || req.body.bankName
            };
        }

        // Parse served categories
        let categoryList = [];
        if (servedCategories) {
            try {
                categoryList = typeof servedCategories === 'string'
                    ? JSON.parse(servedCategories)
                    : (Array.isArray(servedCategories) ? servedCategories : []);
            } catch (e) {
                console.error("Error parsing servedCategories:", e);
            }
        }

        const existsByEmail = await Vendor.findOne({ email });
        if (existsByEmail) return handleResponse(res, 409, "Email already registered");

        const existsByMobile = await Vendor.findOne({ mobile });
        if (existsByMobile) return handleResponse(res, 409, "Mobile number already registered");

        if (!farmLocation || typeof farmLocation !== 'string') {
            return handleResponse(res, 400, "Farm / Business location is required");
        }
        const locationTrimmed = farmLocation.trim();
        if (!/^[A-Za-z\s]+,\s*[A-Za-z\s]+$/.test(locationTrimmed)) {
            return handleResponse(res, 400, "Business location must be in format: City, State");
        }

        // Handle File Uploads (all optional)
        let profilePictureUrl = "";
        let aadharCardUrl = "";
        let panCardUrl = "";
        let shopProofUrl = "";

        if (req.files) {
            if (req.files.profilePicture) profilePictureUrl = await uploadToCloudinary(req.files.profilePicture[0].buffer, "vendors/profiles");
            if (req.files.aadharFile) aadharCardUrl = await uploadToCloudinary(req.files.aadharFile[0].buffer, "vendors/aadhar");
            if (req.files.panFile) panCardUrl = await uploadToCloudinary(req.files.panFile[0].buffer, "vendors/pan");
            if (req.files.shopProofFile) shopProofUrl = await uploadToCloudinary(req.files.shopProofFile[0].buffer, "vendors/shop_proof");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const vendor = await Vendor.create({
            fullName,
            email,
            mobile,
            farmLocation: locationTrimmed,
            password: hashedPassword,
            profilePicture: profilePictureUrl,
            fssaiLicense: fssaiLicense || "",
            bankDetails,
            aadharCard: aadharCardUrl,
            panCard: panCardUrl,
            shopEstablishmentProof: shopProofUrl,
            requestedCategories: categoryList,
            servedCategories: []
        });

        // Notify Admin of new vendor signup
        try {
            const { emitToAdmin } = await import('../lib/socket.js');
            emitToAdmin("new_vendor_signup", {
                vendorId: vendor._id,
                message: `New Vendor signed up: ${vendor.fullName} (${vendor.farmLocation})`
            });
        } catch(e) {}

        return handleResponse(res, 201, "Vendor registered successfully", {
            id: vendor._id,
            email: vendor.email,
            mobile: vendor.mobile,
            status: vendor.status,
        });
    } catch (err) {
        console.error("Register Error:", err);
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

/* ================= LOGIN (Email + Password) ================= */
export const loginVendor = async (req, res) => {
    try {
        const { email, password } = req.body;

        const vendor = await Vendor.findOne({ email });
        if (!vendor) return handleResponse(res, 404, "Vendor not found");
        if (vendor.status === "pending") return handleResponse(res, 403, "Account pending approval");
        if (vendor.status === "blocked") return handleResponse(res, 403, "Account blocked");

        const match = await bcrypt.compare(password, vendor.password);
        if (!match) return handleResponse(res, 400, "Invalid credentials");

        const token = generateToken(vendor._id);
        return handleResponse(res, 200, "Login successful", {
            token, id: vendor._id, email: vendor.email,
            fullName: vendor.fullName, mobile: vendor.mobile,
            farmLocation: vendor.farmLocation, profilePicture: vendor.profilePicture,
            status: vendor.status, role: "vendor"
        });
    } catch (err) {
        console.error("[Vendor Login Error]:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/* ================= SEND OTP (Mobile Login) ================= */
export const sendVendorOTP = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || !/^[6-9]\d{9}$/.test(mobile))
            return handleResponse(res, 400, "Valid mobile number required");

        const vendor = await Vendor.findOne({ mobile });
        if (!vendor) return handleResponse(res, 404, "No vendor found with this mobile number");
        if (vendor.status === "blocked") return handleResponse(res, 403, "Account blocked");

        if (isGlobalDefaultOtpEnabled())
            return handleResponse(res, 200, "Default OTP mode active. Use DEFAULT_OTP to login.");

        const existing = await OTP.findOne({ mobile, role: "vendor" });
        if (existing) {
            const diff = (new Date() - existing.updatedAt) / 1000;
            if (diff < 15) return handleResponse(res, 429, "Wait 15 seconds before requesting another OTP");
        }

        const otp = generateOTP();
        const hashedOtp = await hashOTP(otp);
        await OTP.findOneAndUpdate(
            { mobile, role: "vendor" },
            { otp: hashedOtp, expiresAt: new Date(Date.now() + 5 * 60 * 1000), verified: false },
            { upsert: true }
        );

        const smsSent = await sendSMS(mobile, otp);
        if (!smsSent) {
            await OTP.deleteOne({ mobile, role: "vendor" });
            return handleResponse(res, 500, "Failed to send SMS. Please try again.");
        }

        return handleResponse(res, 200, "OTP sent successfully");
    } catch (err) {
        console.error("Send Vendor OTP error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/* ================= VERIFY OTP (Mobile Login) ================= */
export const verifyVendorOTP = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp) return handleResponse(res, 400, "Mobile and OTP are required");

        const vendor = await Vendor.findOne({ mobile });
        if (!vendor) return handleResponse(res, 404, "Vendor not found");
        if (vendor.status === "blocked") return handleResponse(res, 403, "Account blocked");

        // Global default OTP
        if (matchesGlobalDefaultOtp(otp)) {
            await OTP.deleteOne({ mobile, role: "vendor" });
            const token = generateToken(vendor._id);
            return handleResponse(res, 200, "Login successful", {
                token, id: vendor._id, email: vendor.email,
                fullName: vendor.fullName, mobile: vendor.mobile,
                farmLocation: vendor.farmLocation, profilePicture: vendor.profilePicture,
                status: vendor.status, role: "vendor"
            });
        }

        const otpRecord = await OTP.findOne({ mobile, role: "vendor" });
        if (!otpRecord) return handleResponse(res, 404, "OTP not found or expired");
        if (otpRecord.expiresAt < new Date()) {
            await OTP.deleteOne({ mobile, role: "vendor" });
            return handleResponse(res, 400, "OTP expired");
        }

        const isMatch = await verifyHashedOTP(otp, otpRecord.otp);
        if (!isMatch) return handleResponse(res, 400, "Invalid OTP");

        await OTP.deleteOne({ mobile, role: "vendor" });
        const token = generateToken(vendor._id);
        return handleResponse(res, 200, "Login successful", {
            token, id: vendor._id, email: vendor.email,
            fullName: vendor.fullName, mobile: vendor.mobile,
            farmLocation: vendor.farmLocation, profilePicture: vendor.profilePicture,
            status: vendor.status, role: "vendor"
        });
    } catch (err) {
        console.error("Verify Vendor OTP error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/* ================= GET ME ================= */
export const getVendorMe = async (req, res) => {
    const vendor = await Vendor.findById(req.vendor._id).populate("servedCategories requestedCategories", "name image");
    return handleResponse(res, 200, "Vendor profile", vendor);
};

/* ================= UPDATE VENDOR ================= */
export const updateVendorProfile = async (req, res) => {
    try {
        const { fullName, mobile, farmLocation, fssaiLicense } = req.body;

        const vendor = await Vendor.findById(req.vendor.id);
        if (!vendor) return handleResponse(res, 404, "Vendor not found");

        if (fullName) vendor.fullName = fullName;
        if (mobile) vendor.mobile = mobile;
        if (farmLocation !== undefined && farmLocation !== '') {
            const locationTrimmed = String(farmLocation).trim();
            if (!/^[A-Za-z\s]+,\s*[A-Za-z\s]+$/.test(locationTrimmed)) {
                return handleResponse(res, 400, "Business location must be in format: City, State (e.g. Indore, Madhya Pradesh)");
            }
            vendor.farmLocation = locationTrimmed;
        }
        if (fssaiLicense) vendor.fssaiLicense = fssaiLicense;

        if (req.body.servedCategories) {
            try {
                const normalized = typeof req.body.servedCategories === 'string'
                    ? JSON.parse(req.body.servedCategories)
                    : (Array.isArray(req.body.servedCategories) ? req.body.servedCategories : []);

                // Logic similar to Franchise:
                // 1. Categories already in vendor.servedCategories that are ALSO in normalized stay in servedCategories.
                // 2. Categories in vendor.servedCategories that are NOT in normalized are removed.
                // 3. Categories in normalized that are NOT in vendor.servedCategories are added to requestedCategories.
                
                const currentServed = (vendor.servedCategories || []).map(c => c.toString());
                const stayServed = normalized.filter(id => currentServed.includes(id));
                const currentRequested = (vendor.requestedCategories || []).map(c => c.toString());
                const desiredRequested = normalized.filter(id => !currentServed.includes(id));
                
                const addedRequests = desiredRequested.filter(id => !currentRequested.includes(id));
                const removedServed = currentServed.filter(id => !stayServed.includes(id));
                const removedRequested = currentRequested.filter(id => !desiredRequested.includes(id));
                
                if (addedRequests.length > 0 || removedServed.length > 0 || removedRequested.length > 0) {
                    try {
                        let msg = `Vendor "${vendor.fullName}" updated their category profile.`;
                        if (addedRequests.length > 0) msg += ` Requested ${addedRequests.length} new.`;
                        if (removedServed.length > 0) msg += ` Discontinued ${removedServed.length} active.`;
                        if (removedRequested.length > 0) msg += ` Cancelled ${removedRequested.length} pending requests.`;

                        // Send database notification
                        await createAdminNotification({
                            title: "Vendor Category Profile Update",
                            message: msg,
                            type: "approvals",
                            link: "/masteradmin/category-approvals",
                            meta: { vendorId: vendor._id, type: 'vendor_category_request' }
                        });

                        // Also emit dedicated socket event for immediate notification
                        const { emitToAdmin } = await import('../lib/socket.js');
                        emitToAdmin("new_vendor_category_request", {
                            vendorId: vendor._id,
                            vendorName: vendor.fullName,
                            requestedCategories: addedRequests, // Array of category IDs
                            requestedCount: addedRequests.length,
                            message: msg,
                            link: "/masteradmin/category-approvals"
                        });
                    } catch (err) {
                        console.error("Admin notification failed:", err);
                    }
                }
                
                vendor.servedCategories = stayServed;
                vendor.requestedCategories = desiredRequested;
            } catch (e) {
                console.error("Error parsing servedCategories:", e);
            }
        }

        if (req.body.bankDetails) {
            let bankDetails = {};
            try {
                bankDetails = typeof req.body.bankDetails === 'string'
                    ? JSON.parse(req.body.bankDetails)
                    : req.body.bankDetails;

                vendor.bankDetails = { ...vendor.bankDetails, ...bankDetails };
            } catch (e) {
                console.error("Bank Details parsing error", e);
            }
        }

        if (req.files) {
            if (req.files.profilePicture) {
                vendor.profilePicture = await uploadToCloudinary(req.files.profilePicture[0].buffer, "vendors/profiles");
            }
            if (req.files.aadharFile) {
                vendor.aadharCard = await uploadToCloudinary(req.files.aadharFile[0].buffer, "vendors/aadhar");
            }
            if (req.files.panFile) {
                vendor.panCard = await uploadToCloudinary(req.files.panFile[0].buffer, "vendors/pan");
            }
            if (req.files.shopProofFile) {
                vendor.shopEstablishmentProof = await uploadToCloudinary(req.files.shopProofFile[0].buffer, "vendors/shop_proof");
            }
        }

        await vendor.save();

        const populatedVendor = await Vendor.findById(vendor._id).populate("servedCategories requestedCategories", "name image");
        return handleResponse(res, 200, "Profile updated successfully", populatedVendor);

    } catch (err) {
        console.error("Update Error:", err);
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

/* ================= CHANGE PASSWORD ================= */
export const changeVendorPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword)
            return handleResponse(res, 400, "All fields are required");

        if (newPassword !== confirmPassword)
            return handleResponse(res, 400, "New passwords do not match");

        const vendor = await Vendor.findById(req.vendor.id);
        if (!vendor) return handleResponse(res, 404, "Vendor not found");

        const isMatch = await bcrypt.compare(currentPassword, vendor.password);
        if (!isMatch) return handleResponse(res, 400, "Incorrect current password");

        vendor.password = await bcrypt.hash(newPassword, 10);
        await vendor.save();

        return handleResponse(res, 200, "Password changed successfully");

    } catch (err) {
        console.error("Change Password Error:", err);
        return handleResponse(res, 500, "Server error");
    }
};


/* ================= FORGOT PASSWORD ================= */
export const forgotVendorPassword = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile)
            return handleResponse(res, 400, "Mobile number is required");

        const vendor = await Vendor.findOne({ mobile });

        if (!vendor)
            return handleResponse(res, 404, "Vendor not found");

        if (vendor.status === "blocked")
            return handleResponse(res, 403, "Account blocked");

        if (isGlobalDefaultOtpEnabled()) {
            return handleResponse(
                res,
                200,
                "Default OTP mode: SMS not sent. Use DEFAULT_OTP to reset password.",
            );
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);

        await OTP.findOneAndUpdate(
            { mobile, role: "vendor" },
            {
                otp: hashedOtp,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
                verified: false
            },
            { upsert: true }
        );

        const smsSent = await sendSMS(mobile, otp);

        if (!smsSent) {
            await OTP.deleteOne({ mobile, role: "vendor" });
            return handleResponse(res, 500, "Failed to send SMS. Please try again.");
        }

        return handleResponse(res, 200, "Reset OTP sent to your mobile number");
    } catch (err) {
        console.error(err);
        return handleResponse(res, 500, "Server error");
    }
};
/* ================= RESET PASSWORD ================= */
export const resetVendorPassword = async (req, res) => {
    try {
        const { mobile, otp, newPassword, confirmPassword } = req.body;

        if (!mobile || !otp || !newPassword || !confirmPassword)
            return handleResponse(res, 400, "All fields required");

        if (newPassword !== confirmPassword)
            return handleResponse(res, 400, "Passwords do not match");

        if (newPassword.length < 8)
            return handleResponse(res, 400, "Password must be at least 8 characters");

        const vendor = await Vendor.findOne({ mobile });

        if (!vendor) return handleResponse(res, 404, "Vendor not found");

        if (matchesGlobalDefaultOtp(otp)) {
            vendor.password = await bcrypt.hash(newPassword, 10);
            await vendor.save();
            await OTP.deleteOne({ mobile: mobile, role: "vendor" });
            return handleResponse(res, 200, "Password reset successful");
        }

        const otpRecord = await OTP.findOne({ mobile, role: "vendor" });
        if (!otpRecord)
            return handleResponse(res, 400, "OTP not found or expired");

        if (otpRecord.expiresAt < new Date()) {
            await OTP.deleteOne({ mobile: mobile, role: "vendor" });
            return handleResponse(res, 400, "OTP expired");
        }

        const isMatch = await bcrypt.compare(otp, otpRecord.otp);
        if (!isMatch)
            return handleResponse(res, 400, "Invalid OTP");

        vendor.password = await bcrypt.hash(newPassword, 10);
        await vendor.save();

        await OTP.deleteOne({ mobile: mobile, role: "vendor" });

        return handleResponse(res, 200, "Password reset successful");
    } catch (err) {
        console.error(err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * @desc Save Vendor FCM Token
 * @route POST /vendor/fcm-token
 * @access Private (Vendor)
 */
export const saveFCMToken = async (req, res) => {
    try {
        const { token, fcm_token, plateform, platform } = req.body;
        const vendorId = req.vendor?._id;
        const finalToken = fcm_token || token;
        const finalPlatform = plateform || platform || 'web';

        console.log(`[FCM-Vendor] Incoming token for Vendor ${vendorId} [Platform: ${finalPlatform}]:`, finalToken);

        if (!finalToken) return handleResponse(res, 400, "FCM Token is required");

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) return handleResponse(res, 404, "Vendor not found");

        if (!vendor.fcmTokens) vendor.fcmTokens = [];

        if (!vendor.fcmTokens.includes(finalToken)) {
            console.log(`[FCM-Vendor] Registering new unique token for Vendor ${vendorId}`);
            vendor.fcmTokens.push(finalToken);
            // Limit to 10 tokens to prevent bloat
            if (vendor.fcmTokens.length > 10) {
                console.log(`[FCM-Vendor] Token limit (10) reached for Vendor ${vendorId}. Slicing older tokens.`);
                vendor.fcmTokens = vendor.fcmTokens.slice(-10);
            }
            await vendor.save();
        } else {
            console.log(`[FCM-Vendor] Token already exists for Vendor ${vendorId}.`);
        }

        return handleResponse(res, 200, "FCM token saved successfully");
    } catch (err) {
        console.error("Save Vendor FCM Token Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Test Push Notification by Token (Vendor App Developer Helper)
 * @route POST /vendor/test-notification
 * @access Private (Vendor)
 */
export const testPushByToken = async (req, res) => {
    try {
        const { fcm_token, plateform } = req.body;
        if (!fcm_token) return handleResponse(res, 400, "fcm_token is required");

        console.log(`[FCM-Test-Vendor] Sending test ping to ${plateform || 'mobile'}:`, fcm_token);

        const message = {
            notification: {
                title: "Kisaankart Vendor Test",
                body: `Success! Your ${plateform || 'device'} is correctly integrated with Kisaankart FCM.`
            },
            token: fcm_token
        };

        const response = await admin.messaging().send(message);
        return handleResponse(res, 200, "Test notification sent successfully!", response);
    } catch (error) {
        console.error("Test Notification Error:", error);

        if (error.code === 'messaging/registration-token-not-registered') {
            const vendorId = req.vendor?._id;
            if (vendorId) {
                await Vendor.findByIdAndUpdate(vendorId, { $pull: { fcmTokens: fcm_token } });
                console.log(`[FCM-Vendor-Cleanup] Removed stale token for Vendor ${vendorId}: ${fcm_token}`);
            }
            return handleResponse(res, 410, "FCM Token is no longer valid.", { code: error.code });
        }

        return handleResponse(res, 500, "Failed to send test notification", {
            code: error.code,
            error_message: error.message
        });
    }
};

/**
 * DELETE VENDOR ACCOUNT
 */
export const deleteVendorAccount = async (req, res) => {
    try {
        const vendorId = req.vendor?._id;
        const vendor = await Vendor.findByIdAndDelete(vendorId);
        if (!vendor) {
            return handleResponse(res, 404, "Vendor not found");
        }
        return handleResponse(res, 200, "Account deleted successfully");
    } catch (error) {
        console.error("Delete vendor account error:", error);
        return handleResponse(res, 500, "Internal server error");
    }
};
