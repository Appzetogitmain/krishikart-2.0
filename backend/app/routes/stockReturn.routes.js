import express from "express";
import {
    getReturnOptions,
    createStockReturn,
    getMyStockReturns,
    cancelStockReturn,
    markStockReturnSent,
    motherReceiveStockReturn,
    getVendorStockReturns,
    vendorReceiveStockReturn,
    vendorReviewStockReturn,
    uploadReturnPhotos,
    adminListStockReturns,
    adminReturnDestinations,
    adminApproveStockReturn,
    adminRejectStockReturn,
} from "../controllers/stockReturn.controller.js";
import { protectFranchise, requireFranchiseAccountVerified } from "../middlewares/franchise.auth.js";
import { protectMasterAdmin, requireAnyPermission } from "../middlewares/masteradmin.auth.js";
import { protectVendor } from "../middlewares/vendor.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();
const franchise = [protectFranchise, requireFranchiseAccountVerified];
const admin = [protectMasterAdmin, requireAnyPermission("assignment", "vendor-reports")];

// Franchise (and mother franchise)
router.get("/franchise/options", ...franchise, getReturnOptions);
router.get("/franchise", ...franchise, getMyStockReturns);
router.post("/franchise", ...franchise, createStockReturn);
router.post("/franchise/photos", ...franchise, upload.array("photos", 3), uploadReturnPhotos);
router.put("/franchise/:id/cancel", ...franchise, cancelStockReturn);
router.put("/franchise/:id/sent", ...franchise, markStockReturnSent);
router.put("/franchise/:id/received", ...franchise, motherReceiveStockReturn);

// Vendor
router.get("/vendor", protectVendor, getVendorStockReturns);
router.put("/vendor/:id/received", protectVendor, vendorReceiveStockReturn);
router.put("/vendor/:id/review", protectVendor, vendorReviewStockReturn);

// Admin
router.get("/admin", ...admin, adminListStockReturns);
router.get("/admin/destinations", ...admin, adminReturnDestinations);
router.put("/admin/:id/approve", ...admin, adminApproveStockReturn);
router.put("/admin/:id/reject", ...admin, adminRejectStockReturn);

export default router;
