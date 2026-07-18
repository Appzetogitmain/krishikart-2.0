import express from "express";
import {
  registerDelivery,
  sendDeliveryOTP,
  verifyDeliveryOTP,
  getDeliveryMe,
  forgotDeliveryPassword,
  resetDeliveryPassword,
  updateDeliveryProfile,
  submitDocumentUpdate,
  deleteDeliveryAccount,
} from "../controllers/delivery.auth.js";


import { protectDelivery, requireApproval } from "../middlewares/delivery.auth.js";
import {
  protectFranchise,
  requireFranchiseAccountVerified,
} from "../middlewares/franchise.auth.js";
import upload from "../middlewares/upload.js";
import {
  getAllDeliveryPartners,
  getMyCodSummary,
  submitCodRemittance,
  // createCodRazorpayOrder, // Razorpay COD UPI — temporarily disabled
  // verifyCodUpiPayment,
  getMyCodRemittances,
  updateAvailability,
  saveFCMToken,
  testPushByToken
} from "../controllers/delivery.controller.js";

const router = express.Router();
router.post("/register", upload.fields([
  { name: "aadharImage", maxCount: 1 },
  { name: "panImage", maxCount: 1 },
  { name: "licenseImage", maxCount: 1 }
]), registerDelivery);


router.post("/send-otp", sendDeliveryOTP);
router.post("/verify-otp", verifyDeliveryOTP);

router.get("/me", protectDelivery, getDeliveryMe);

router.post("/forgot-password", forgotDeliveryPassword);
router.post("/reset-password", resetDeliveryPassword);
router.put("/profile", protectDelivery, updateDeliveryProfile);
router.delete("/delete-account", protectDelivery, deleteDeliveryAccount);
router.put("/profile/documents", protectDelivery, upload.fields([
  { name: "aadharImage", maxCount: 1 },
  { name: "panImage", maxCount: 1 },
  { name: "licenseImage", maxCount: 1 }
]), submitDocumentUpdate);

// Public/Franchise access to partners list
router.get(
  "/partners",
  protectFranchise,
  requireFranchiseAccountVerified,
  getAllDeliveryPartners,
);
router.get("/cod/summary", protectDelivery, requireApproval, getMyCodSummary);
router.get("/cod/remittances", protectDelivery, requireApproval, getMyCodRemittances);
router.post("/cod/remittance", protectDelivery, requireApproval, submitCodRemittance);
// Razorpay COD UPI — temporarily disabled
// router.post("/cod/razorpay-order", protectDelivery, requireApproval, createCodRazorpayOrder);
// router.post("/cod/verify-upi", protectDelivery, requireApproval, verifyCodUpiPayment);
router.put("/availability", protectDelivery, requireApproval, updateAvailability);
router.post("/fcm-token", protectDelivery, saveFCMToken);
router.post("/test-notification", protectDelivery, testPushByToken);

export default router;
