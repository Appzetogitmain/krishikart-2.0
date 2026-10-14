import jwt from "jsonwebtoken";
import MasterAdmin from "../models/masteradmin.js";
import SubAdmin from "../models/subAdmin.js";
import handleResponse from "../utils/helper.js";

export const protectMasterAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token)
      return handleResponse(res, 401, "Token required");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let admin = await MasterAdmin.findById(decoded.id);
    if (!admin) {
      admin = await SubAdmin.findById(decoded.id);
    }

    if (!admin)
      return handleResponse(res, 401, "Unauthorized");

    if (admin.status === "blocked") {
      return handleResponse(res, 403, "Your account has been blocked");
    }

    req.masteradmin = admin;
    next();
  } catch (err) {
    return handleResponse(res, 401, "Invalid token");
  }
};

const isRootAdmin = (admin) => {
  const role = admin?.role?.toLowerCase();
  return role === "superadmin" || role === "masteradmin";
};

/** Allows the main/super admin, or a sub-admin who has at least one of the given permissions. */
export const requireAnyPermission = (...permissionKeys) => {
  return (req, res, next) => {
    const admin = req.masteradmin;
    if (!admin) return handleResponse(res, 401, "Authentication required");
    if (isRootAdmin(admin)) return next();
    const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
    if (admin.role === "subadmin" && permissionKeys.some((k) => perms.includes(k))) return next();
    return handleResponse(res, 403, "Permission denied: your account does not have access to this section");
  };
};

/** Only the main/super admin (e.g. managing team members and their access). */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.masteradmin) return handleResponse(res, 401, "Authentication required");
  if (isRootAdmin(req.masteradmin)) return next();
  return handleResponse(res, 403, "Only the main admin can do this");
};

export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    const admin = req.masteradmin;

    if (!admin) {
      return handleResponse(res, 401, "Authentication required");
    }

    // Root Admin bypass (SuperAdmin or MasterAdmin)
    const role = admin.role?.toLowerCase();
    if (role === "superadmin" || role === "masteradmin") {
      return next();
    }

    // SubAdmin check
    if (admin.role === "subadmin" && admin.permissions && admin.permissions.includes(permissionKey)) {
      return next();
    }

    return handleResponse(res, 403, `Permission denied: ${permissionKey} access required`);
  };
};
