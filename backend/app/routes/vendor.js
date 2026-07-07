import express from "express";
import {
    registerVendor,
    loginVendor,
    sendVendorOTP,
    verifyVendorOTP,
    getVendorMe,
    updateVendorProfile,
    forgotVendorPassword,
    resetVendorPassword,
    changeVendorPassword,
    saveFCMToken,
    testPushByToken,
    deleteVendorAccount
} from "../controllers/vendor.auth.js";
import {
    getVendorInventory,
    updateVendorStock,
    toggleProductAvailability
} from "../controllers/vendor.inventory.controller.js";
import { protectVendor } from "../middlewares/vendor.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

router.post("/register", upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "aadharFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
    { name: "shopProofFile", maxCount: 1 }
]), registerVendor);

router.post("/login", loginVendor);
router.post("/send-otp", sendVendorOTP);
router.post("/verify-otp", verifyVendorOTP);
router.get("/me", protectVendor, getVendorMe);

router.put("/update", protectVendor, upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "aadharFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
    { name: "shopProofFile", maxCount: 1 }
]), updateVendorProfile);

router.post("/forgot-password", forgotVendorPassword);
router.post("/reset-password", resetVendorPassword);
router.post("/change-password", protectVendor, changeVendorPassword);
router.post("/fcm-token", protectVendor, saveFCMToken);
router.post("/test-notification", protectVendor, testPushByToken);
router.delete("/delete-account", protectVendor, deleteVendorAccount);

/* 📦 Inventory Management */
router.get("/inventory", protectVendor, getVendorInventory);
router.put("/inventory/stock", protectVendor, updateVendorStock);
router.put("/inventory/toggle-availability", protectVendor, toggleProductAvailability);

export default router;
