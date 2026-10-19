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
    getAdminFinanceReport, exportAdminFinanceReport,
    getFranchiseFinanceReport, exportFranchiseFinanceReport,
    getVendorFinanceReport, exportVendorFinanceReport,
} from "../controllers/panelReports.controller.js";

// Reports for each panel. Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST days, defaults to this month)
const router = express.Router();

router.get("/admin", protectMasterAdmin, requirePermission("analytics"), getAdminReport);
router.get("/admin/export", protectMasterAdmin, requirePermission("analytics"), exportAdminReport);
// Profit & margin (under /reports/admin so city admins are limited to their cities)
router.get("/admin/finance", protectMasterAdmin, requirePermission("analytics"), getAdminFinanceReport);
router.get("/admin/finance/export", protectMasterAdmin, requirePermission("analytics"), exportAdminFinanceReport);

router.get("/franchise", protectFranchise, requireFranchiseAccountVerified, getFranchiseReport);
router.get("/franchise/export", protectFranchise, requireFranchiseAccountVerified, exportFranchiseReport);
router.get("/franchise/finance", protectFranchise, requireFranchiseAccountVerified, getFranchiseFinanceReport);
router.get("/franchise/finance/export", protectFranchise, requireFranchiseAccountVerified, exportFranchiseFinanceReport);

router.get("/vendor", protectVendor, getVendorReport);
router.get("/vendor/export", protectVendor, exportVendorReport);
router.get("/vendor/finance", protectVendor, getVendorFinanceReport);
router.get("/vendor/finance/export", protectVendor, exportVendorFinanceReport);

router.get("/delivery", protectDelivery, getDeliveryReport);
router.get("/delivery/export", protectDelivery, exportDeliveryReport);

export default router;
