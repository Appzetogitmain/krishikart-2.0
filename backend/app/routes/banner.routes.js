import express from "express";
import {
    getActiveBanners,
    getAllBanners,
    createBanner,
    updateBanner,
    reorderBanners,
    deleteBanner,
} from "../controllers/offerBanner.controller.js";
import { protectMasterAdmin, requirePermission } from "../middlewares/masteradmin.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();
const admin = [protectMasterAdmin, requirePermission("campaigns")];

// Customer home page carousel (public)
router.get("/", getActiveBanners);

// Admin: offer banners (same permission as coupons)
router.get("/admin", ...admin, getAllBanners);
router.post("/admin", ...admin, upload.single("image"), createBanner);
router.put("/admin/reorder", ...admin, reorderBanners);
router.put("/admin/:id", ...admin, upload.single("image"), updateBanner);
router.delete("/admin/:id", ...admin, deleteBanner);

export default router;
