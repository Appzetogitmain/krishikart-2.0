import express from "express";
import {
    createOrder,
    getMyOrders,
    getOrderById,
    getOrdersByGroupId,
    createReturnRequest,
    reviewReturnRequestByFranchise,
    assignReturnPickupDelivery,
    getFranchiseReturnRequests,
    getDeliveryReturnPickups,
    updateReturnPickupStatus,
    updateOrderStatus,
    getAllOrders,
    getFranchiseOrders,
    getFranchiseOrderById,
    acceptFranchiseOrder,
    rejectFranchiseOrder,
    assignDeliveryPartner,
    getDispatchedOrders,
    getDeliveryOrderHistory,
    rejectDeliveryTask,
    getAdminDeliveryTracking
} from "../controllers/order.controller.js";
import { protect } from "../middlewares/authmiddleware.js";
import { protectMasterAdmin, requireAnyPermission } from "../middlewares/masteradmin.auth.js";
import {
    protectFranchise,
    requireFranchiseAccountVerified,
} from "../middlewares/franchise.auth.js";
import { protectDelivery, requireApproval } from "../middlewares/delivery.auth.js";

const router = express.Router();

// User Routes
router.post("/place", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.get("/group/:orderGroupId", protect, getOrdersByGroupId);
router.put("/:id/status", protect, updateOrderStatus);
router.post("/:id/return-request", protect, createReturnRequest);

// Admin Routes
router.get("/admin/all", protectMasterAdmin, requireAnyPermission("orders"), getAllOrders);
router.get("/admin/delivery-tracking", protectMasterAdmin, requireAnyPermission("delivery"), getAdminDeliveryTracking);
router.get("/admin/:id", protectMasterAdmin, requireAnyPermission("orders", "delivery", "returns"), getOrderById);
router.put("/admin/:id/status", protectMasterAdmin, requireAnyPermission("orders", "delivery"), updateOrderStatus);

// Franchise Routes
router.get(
    "/franchise/all",
    protectFranchise,
    requireFranchiseAccountVerified,
    getFranchiseOrders,
);
router.get(
    "/franchise/:id",
    protectFranchise,
    requireFranchiseAccountVerified,
    getFranchiseOrderById,
);
router.put(
    "/franchise/:id/accept",
    protectFranchise,
    requireFranchiseAccountVerified,
    acceptFranchiseOrder,
);
router.put(
    "/franchise/:id/reject",
    protectFranchise,
    requireFranchiseAccountVerified,
    rejectFranchiseOrder,
);
router.put(
    "/franchise/:id/assign-delivery",
    protectFranchise,
    requireFranchiseAccountVerified,
    assignDeliveryPartner,
);
router.put(
    "/franchise/:id/status",
    protectFranchise,
    requireFranchiseAccountVerified,
    updateOrderStatus,
);
router.get(
    "/franchise/returns/all",
    protectFranchise,
    requireFranchiseAccountVerified,
    getFranchiseReturnRequests,
);
router.put(
    "/franchise/:id/returns/:requestIndex/review",
    protectFranchise,
    requireFranchiseAccountVerified,
    reviewReturnRequestByFranchise,
);
router.put(
    "/franchise/:id/returns/:requestIndex/assign-pickup",
    protectFranchise,
    requireFranchiseAccountVerified,
    assignReturnPickupDelivery,
);

// Delivery Routes
router.get("/delivery/dispatched", protectDelivery, requireApproval, getDispatchedOrders);
router.get("/delivery/history", protectDelivery, requireApproval, getDeliveryOrderHistory);
router.put("/delivery/:id/reject", protectDelivery, requireApproval, rejectDeliveryTask);
router.put("/delivery/:id/status", protectDelivery, requireApproval, updateOrderStatus);
router.get("/delivery/return-pickups", protectDelivery, requireApproval, getDeliveryReturnPickups);
router.put("/delivery/return-pickups/:id/:requestIndex/status", protectDelivery, requireApproval, updateReturnPickupStatus);

router.get("/:id", protect, getOrderById);

export default router;
