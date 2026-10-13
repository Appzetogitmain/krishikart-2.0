import express from "express";
import { protectMasterAdmin, requirePermission } from "../middlewares/masteradmin.auth.js";
import { protectFranchise, requireFranchiseAccountVerified } from "../middlewares/franchise.auth.js";
import { protectVendor } from "../middlewares/vendor.auth.js";
import { protectDelivery } from "../middlewares/delivery.auth.js";
import {
    getAdminReport, exportAdminReport,
    getFranchiseReport, exportFranchiseReport,
    getVendorReport, exportVendorReport,
    getDeliveryReport, exportDeliveryReport,
} from "../controllers/panelReports.controller.js";

// Reports for each panel. Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST days, defaults to this month)
const router = express.Router();

router.get("/admin", protectMasterAdmin, requirePermission("analytics"), getAdminReport);
router.get("/admin/export", protectMasterAdmin, requirePermission("analytics"), exportAdminReport);

router.get("/franchise", protectFranchise, requireFranchiseAccountVerified, getFranchiseReport);
router.get("/franchise/export", protectFranchise, requireFranchiseAccountVerified, exportFranchiseReport);

router.get("/vendor", protectVendor, getVendorReport);
router.get("/vendor/export", protectVendor, exportVendorReport);

router.get("/delivery", protectDelivery, getDeliveryReport);
router.get("/delivery/export", protectDelivery, exportDeliveryReport);

export default router;
