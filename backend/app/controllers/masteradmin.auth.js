import MasterAdmin from "../models/masteradmin.js";
import SubAdmin from "../models/subAdmin.js";
import handleResponse from "../utils/helper.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/* 🔐 JWT */
const generateToken = (id) =>
  jwt.sign(
    { id, role: "masteradmin" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
export const createMasterAdmin = async (req, res) => {
  try {
    const { email, password, secretKey, fullName, mobile, operationalZone } = req.body;

    /* 🔐 SECURITY CHECK */
    if (secretKey !== process.env.MASTERADMIN_SECRET) {
      return handleResponse(res, 403, "Unauthorized");
    }

    /* ❌ ALLOW ONLY ONE */
    const alreadyExists = await MasterAdmin.findOne({});
    if (alreadyExists) {
      return handleResponse(res, 400, "MasterAdmin already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await MasterAdmin.create({
      fullName: fullName || "Kisaankart Global Root",
      email,
      mobile: mobile || "+91 80000 00001",
      operationalZone: operationalZone || "ASIA-SOUTH-IND-01",
      password: hashedPassword,
      role: "superadmin",
      status: "active",
    });

    return handleResponse(res, 201, "MasterAdmin created", {
      id: admin._id,
      email: admin.email,
    });
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= LOGIN ================= */
export const loginMasterAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return handleResponse(res, 400, "Email & password required");

    const trimmedEmail = email.trim().toLowerCase();
    console.log(`[MasterAdmin Login] Attempt for: ${trimmedEmail}`);

    let admin = await MasterAdmin.findOne({ email: trimmedEmail });
    if (!admin) {
      admin = await SubAdmin.findOne({ email: trimmedEmail });
    }

    if (!admin) {
      console.log(`[MasterAdmin Login] User not found: ${trimmedEmail}`);
      return handleResponse(res, 404, "Admin not found");
    }

    if (admin.status === "blocked")
      return handleResponse(res, 403, "Account blocked");

    const match = await bcrypt.compare(password, admin.password);
    if (!match)
      return handleResponse(res, 400, "Invalid credentials");

    const token = generateToken(admin._id);

    return handleResponse(res, 200, "Login successful", {
      token,
      result: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions || [],
      }
    });
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= GET ME ================= */
export const getMasterAdminMe = async (req, res) => {
  const admin = req.masteradmin;

  return handleResponse(res, 200, "MasterAdmin profile", {
    id: admin._id,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    permissions: admin.permissions || [],
  });
};

/* ================= UPDATE PROFILE ================= */
export const updateMasterAdminProfile = async (req, res) => {
  try {
    const { fullName, email, mobile, operationalZone, password } = req.body;

    let admin = await MasterAdmin.findById(req.masteradmin._id);
    let Model = MasterAdmin;
    if (!admin) {
      admin = await SubAdmin.findById(req.masteradmin._id);
      Model = SubAdmin;
    }

    if (!admin) return handleResponse(res, 404, "Admin profile not found");

    if (fullName) admin.fullName = fullName;
    if (email) {
      const trimmedEmail = email.trim().toLowerCase();
      const existingMaster = await MasterAdmin.findOne({ email: trimmedEmail, _id: { $ne: admin._id } });
      const existingSub = await SubAdmin.findOne({ email: trimmedEmail, _id: { $ne: admin._id } });
      if (existingMaster || existingSub) {
        return handleResponse(res, 400, "Email already in use");
      }
      admin.email = trimmedEmail;
    }
    if (mobile) admin.mobile = mobile;
    if (operationalZone && Model === MasterAdmin) {
      admin.operationalZone = operationalZone;
    }

    if (password) {
      admin.password = await bcrypt.hash(password, 10);
    }

    await admin.save();

    return handleResponse(res, 200, "Profile updated successfully", {
      id: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      mobile: admin.mobile,
      role: admin.role,
      permissions: admin.permissions || [],
    });
  } catch (err) {
    console.error("Update Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= CHANGE PASSWORD ================= */
export const changeMasterAdminPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return handleResponse(res, 400, "Old and new password required");
    }

    let admin = await MasterAdmin.findById(req.masteradmin._id);
    if (!admin) {
      admin = await SubAdmin.findById(req.masteradmin._id);
    }

    if (!admin) return handleResponse(res, 404, "Admin profile not found");

    const match = await bcrypt.compare(oldPassword, admin.password);
    if (!match) return handleResponse(res, 400, "Incorrect old password");

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return handleResponse(res, 200, "Password changed successfully");
  } catch (err) {
    console.error("Change Password Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= FORGOT PASSWORD ================= */
export const forgotMasterAdminPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return handleResponse(res, 400, "Email required");

    const trimmedEmail = email.trim().toLowerCase();
    
    let admin = await MasterAdmin.findOne({ email: trimmedEmail });
    if (!admin) {
      admin = await SubAdmin.findOne({ email: trimmedEmail });
    }

    if (!admin)
      return handleResponse(res, 404, "Admin not found with this email");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    admin.otp = otp;
    admin.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await admin.save();

    console.log(`[MasterAdmin/SubAdmin] Reset OTP for ${trimmedEmail}:`, otp);
    // 📧 Email service integrate here

    return handleResponse(res, 200, "OTP sent to email");
  } catch (err) {
    console.error("[Forgot Password Error]:", err);
    return handleResponse(res, 500, "Server error", { error: err.message });
  }
};

/**
 * SUB-ADMIN CRUD (SUPERADMIN ONLY)
 */

export const createSubAdmin = async (req, res) => {
  try {
    const { email, password, fullName, mobile, permissions } = req.body;

    if (!email || !password || !fullName) {
      return handleResponse(res, 400, "Required fields missing");
    }

    const existingMaster = await MasterAdmin.findOne({ email });
    const existingSub = await SubAdmin.findOne({ email });

    if (existingMaster || existingSub) {
      return handleResponse(res, 400, "Email already in use");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const subAdmin = new SubAdmin({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      fullName,
      mobile,
      role: "subadmin",
      status: "active",
      permissions: permissions || [],
      createdBy: req.masteradmin._id
    });

    await subAdmin.save();

    return handleResponse(res, 201, "Sub-admin created successfully", {
      id: subAdmin._id,
      email: subAdmin.email,
      fullName: subAdmin.fullName
    });
  } catch (error) {
    console.error(error);
    return handleResponse(res, 500, "Server error");
  }
};

export const listSubAdmins = async (req, res) => {
  try {
    const subAdmins = await SubAdmin.find().select("-password").sort({ createdAt: -1 });
    return handleResponse(res, 200, "Sub-admins list fetched", subAdmins);
  } catch (error) {
    return handleResponse(res, 500, "Server error");
  }
};

export const updateSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, fullName, mobile, permissions, status } = req.body;

    const subAdmin = await SubAdmin.findById(id);
    if (!subAdmin) return handleResponse(res, 404, "Sub-admin not found");

    if (email) subAdmin.email = email;
    if (fullName) subAdmin.fullName = fullName;
    if (mobile) subAdmin.mobile = mobile;
    if (permissions) subAdmin.permissions = permissions;
    if (status) subAdmin.status = status;

    if (password) {
      subAdmin.password = await bcrypt.hash(password, 10);
    }

    await subAdmin.save();

    return handleResponse(res, 200, "Sub-admin updated successfully");
  } catch (error) {
    console.error(error);
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteSubAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    await SubAdmin.findByIdAndDelete(id);
    return handleResponse(res, 200, "Sub-admin deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= RESET PASSWORD ================= */
export const resetMasterAdminPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return handleResponse(res, 400, "All fields required");

    const trimmedEmail = email.trim().toLowerCase();

    let admin = await MasterAdmin.findOne({ email: trimmedEmail });
    if (!admin) {
      admin = await SubAdmin.findOne({ email: trimmedEmail });
    }

    if (!admin)
      return handleResponse(res, 404, "Admin profile not found");

    if (admin.otp !== otp)
      return handleResponse(res, 400, "Invalid OTP");

    if (admin.otpExpiresAt < new Date())
      return handleResponse(res, 400, "OTP expired");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    admin.otp = null;
    admin.otpExpiresAt = null;

    await admin.save();

    return handleResponse(res, 200, "Password reset successful");
  } catch (err) {
    console.error("[Reset Password Error]:", err);
    return handleResponse(res, 500, "Server error", { error: err.message });
  }
};
/**
 * @desc Save Master Admin & Sub Admin FCM Token
 * @route POST /masteradmin/fcm-token
 * @access Private (Admin/SubAdmin)
 */
export const saveFCMToken = async (req, res) => {
  try {
    const { token, fcm_token, plateform, platform } = req.body;
    const adminId = req.masteradmin?._id;
    const role = req.masteradmin?.role;
    const finalToken = (fcm_token || token || "").trim();
    const finalPlatform = plateform || platform || "web";

    if (!finalToken) return handleResponse(res, 400, "FCM Token is required");
    if (!adminId) return handleResponse(res, 401, "Admin context missing");

    const Model = (await MasterAdmin.findById(adminId).select("_id").lean())
      ? MasterAdmin
      : SubAdmin;

    const doc = await Model.findById(adminId).select("fcmTokens").lean();
    if (!doc) return handleResponse(res, 404, "Admin profile not found");

    const tokens = Array.isArray(doc.fcmTokens) ? [...doc.fcmTokens] : [];
    if (!tokens.includes(finalToken)) {
      tokens.push(finalToken);
      const trimmed = tokens.slice(-10);
      await Model.findByIdAndUpdate(adminId, { $set: { fcmTokens: trimmed } });
    }

    return handleResponse(res, 200, "FCM token saved successfully");
  } catch (err) {
    console.error("Save Admin FCM Token Error:", err);
    return handleResponse(res, 500, "Internal server error", { error: err?.message || "Unknown error" });
  }
};
