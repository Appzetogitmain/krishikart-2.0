import express from "express";
import {
    createProcurementRequest,
    getMyProcurementRequests,
    getAllProcurementRequests,
    adminUpdateProcurementRequest,
    getVendorAssignments,
    getVendorProcurementById,
    vendorSubmitQuotation,
    vendorAcceptOffer,
    vendorDeclineOffer,
    getVendorActiveDispatch,
    vendorUpdateStatus,
    getVendorReports,
    getVendorDashboardStats,
    getVendorReceivablesReport,
    franchiseConfirmReceipt,
    createProcurementFromOrder,
    getRejectedStockReport
} from "../controllers/procurement.controller.js";
import {
    listMotherFranchisesForRequest,
    assignMotherFranchise,
    getSupplyRequests,
    dispatchSupplyRequest,
    declineSupplyRequest,
} from "../controllers/motherSupply.controller.js";
import { getProcurementBoard, assignProductToVendor } from "../controllers/procurementBoard.controller.js";
import {
    protectFranchise,
    requireFranchiseAccountVerified,
} from "../middlewares/franchise.auth.js";
import { protectMasterAdmin, requireAnyPermission } from "../middlewares/masteradmin.auth.js";
import { protectVendor } from "../middlewares/vendor.auth.js";

const router = express.Router();

// Franchise Routes (Request)
router.post(
    "/franchise/create",
    protectFranchise,
    requireFranchiseAccountVerified,
    createProcurementRequest,
);
router.get(
    "/franchise/my-requests",
    protectFranchise,
    requireFranchiseAccountVerified,
    getMyProcurementRequests,
);
router.put(
    "/franchise/:requestId/receive",
    protectFranchise,
    requireFranchiseAccountVerified,
    franchiseConfirmReceipt,
);

// Mother franchise: stock it was asked to send to other franchises
router.get(
    "/franchise/supply-requests",
    protectFranchise,
    requireFranchiseAccountVerified,
    getSupplyRequests,
);
router.put(
    "/franchise/supply-requests/:requestId/dispatch",
    protectFranchise,
    requireFranchiseAccountVerified,
    dispatchSupplyRequest,
);
router.put(
    "/franchise/supply-requests/:requestId/decline",
    protectFranchise,
    requireFranchiseAccountVerified,
    declineSupplyRequest,
);

// Vendor Routes (View Assignment)
router.get("/vendor/my-assignments", protectVendor, getVendorAssignments);
router.get("/vendor/active-dispatch", protectVendor, getVendorActiveDispatch);
router.get("/vendor/dashboard-stats", protectVendor, getVendorDashboardStats);
router.get("/vendor/receivables-report", protectVendor, getVendorReceivablesReport);
router.get("/vendor/rejected-stock", protectVendor, getRejectedStockReport);
router.get("/vendor/:requestId", protectVendor, getVendorProcurementById);
router.post("/vendor/:requestId/quote", protectVendor, vendorSubmitQuotation);
router.post("/vendor/:requestId/offer/accept", protectVendor, vendorAcceptOffer);
router.post("/vendor/:requestId/offer/decline", protectVendor, vendorDeclineOffer);
router.put("/vendor/:requestId/status", protectVendor, vendorUpdateStatus);

// Admin Routes (Assign/View)
router.get("/admin/board", protectMasterAdmin, requireAnyPermission("assignment"), getProcurementBoard);
router.post("/admin/board/assign", protectMasterAdmin, requireAnyPermission("assignment"), assignProductToVendor);
router.get("/admin/all", protectMasterAdmin, requireAnyPermission("assignment", "quotations"), getAllProcurementRequests);
router.get("/admin/reports", protectMasterAdmin, requireAnyPermission("vendor-reports"), getVendorReports);
router.get("/admin/rejected-stock", protectMasterAdmin, requireAnyPermission("vendor-reports"), getRejectedStockReport);
router.get("/admin/mother-franchises", protectMasterAdmin, requireAnyPermission("assignment"), listMotherFranchisesForRequest);
router.put("/admin/:requestId/assign-mother", protectMasterAdmin, requireAnyPermission("assignment"), assignMotherFranchise);
router.put("/admin/:requestId/status", protectMasterAdmin, requireAnyPermission("assignment", "quotations"), adminUpdateProcurementRequest);
router.post("/admin/from-order/:orderId", protectMasterAdmin, requireAnyPermission("orders", "assignment"), createProcurementFromOrder);

export default router;
