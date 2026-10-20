import express from "express";
import {
  registerFranchise,
  verifyFranchiseOTP,
  getFranchiseMe,
  sendFranchiseOTP,
  updateFranchiseProfile,
  changeFranchisePassword,
  uploadFranchiseDocuments,
  loginFranchiseWithPassword,
  forgotFranchisePassword,
  resetFranchisePassword,
} from "../controllers/franchise.auth.js";
import {
  submitKYC,
  getKYCStatus,
  getFranchisePayoutReport,
  getFranchiseAdminPayoutsReceived,
  getInventory,
  updateStoreQRCode,
  getActiveFranchises,
  updateAvailability,
  saveFCMToken,
  testPushByToken
} from "../controllers/franchise.controller.js";
import {
  getFranchiseCodRemittances,
  reviewFranchiseCodRemittance,
} from "../controllers/franchise.cod.controller.js";
import { getMyEarnings, confirmPayout, disputePayout } from "../controllers/franchiseEarnings.controller.js";
import {
  createPOSSale,
  getPOSHistory
} from "../controllers/franchise.pos.controller.js";
import {
  protectFranchise,
  requireFranchiseAccountVerified,
} from "../middlewares/franchise.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

router.post("/register", registerFranchise);
router.post("/send-otp", sendFranchiseOTP);
router.post("/verify-otp", verifyFranchiseOTP);
router.post("/login", loginFranchiseWithPassword);
router.post("/forgot-password", forgotFranchisePassword);
router.post("/reset-password", resetFranchisePassword);
router.get("/me", protectFranchise, getFranchiseMe);
router.put(
  "/update",
  protectFranchise,
  requireFranchiseAccountVerified,
  updateFranchiseProfile,
);
router.post("/change-password", protectFranchise, changeFranchisePassword);
router.post("/upload-documents", protectFranchise, upload.array("documents", 5), uploadFranchiseDocuments);

router.post(
  "/kyc/submit",
  protectFranchise,
  upload.fields([
    { name: "aadhaarImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "fssaiCertificate", maxCount: 1 },
    { name: "shopEstablishmentCertificate", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
  ]),
  submitKYC,
);
router.get("/kyc/status", protectFranchise, getKYCStatus);
router.get(
  "/reports/payout-summary",
  protectFranchise,
  requireFranchiseAccountVerified,
  getFranchisePayoutReport,
);
router.get(
  "/reports/earnings",
  protectFranchise,
  requireFranchiseAccountVerified,
  getMyEarnings,
);
router.put(
  "/reports/admin-payouts/:id/confirm",
  protectFranchise,
  requireFranchiseAccountVerified,
  confirmPayout,
);
router.put(
  "/reports/admin-payouts/:id/dispute",
  protectFranchise,
  requireFranchiseAccountVerified,
  disputePayout,
);
router.get(
  "/reports/admin-payouts",
  protectFranchise,
  requireFranchiseAccountVerified,
  getFranchiseAdminPayoutsReceived,
);
router.get(
  "/inventory",
  protectFranchise,
  requireFranchiseAccountVerified,
  getInventory,
);
router.get("/active-stores", getActiveFranchises);

/* 🛒 POS Terminal */
router.post(
  "/pos/sale",
  protectFranchise,
  requireFranchiseAccountVerified,
  createPOSSale,
);
router.get(
  "/pos/history",
  protectFranchise,
  requireFranchiseAccountVerified,
  getPOSHistory,
);
router.put(
  "/qr-code",
  protectFranchise,
  requireFranchiseAccountVerified,
  upload.single("qrCode"),
  updateStoreQRCode,
);
router.post(
  "/availability",
  protectFranchise,
  requireFranchiseAccountVerified,
  updateAvailability,
);
router.get(
  "/cod/remittances",
  protectFranchise,
  requireFranchiseAccountVerified,
  getFranchiseCodRemittances,
);
router.put(
  "/cod/remittances/:remittanceId/review",
  protectFranchise,
  requireFranchiseAccountVerified,
  reviewFranchiseCodRemittance,
);
router.post("/fcm-token", protectFranchise, saveFCMToken);
router.post(
  "/test-notification",
  protectFranchise,
  requireFranchiseAccountVerified,
  testPushByToken,
);

// Franchise Notifications
router.get(
  "/notifications",
  protectFranchise,
  async (req, res) => {
    try {
      const FranchiseNotification = (await import('../models/franchiseNotification.js')).default;
      const notifications = await FranchiseNotification.find({ franchiseId: req.franchise._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.status(200).json({ success: true, results: notifications });
    } catch (error) {
      console.error("Get franchise notifications error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.put(
  "/notifications/:id/read",
  protectFranchise,
  async (req, res) => {
    try {
      const FranchiseNotification = (await import('../models/franchiseNotification.js')).default;
      const notification = await FranchiseNotification.findOneAndUpdate(
        { _id: req.params.id, franchiseId: req.franchise._id },
        { isRead: true },
        { new: true }
      );
      if (!notification) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }
      return res.status(200).json({ success: true, message: "Marked as read", notification });
    } catch (error) {
      console.error("Mark notification read error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
