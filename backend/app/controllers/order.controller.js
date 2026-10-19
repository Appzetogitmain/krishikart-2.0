import fs from "fs";
import mongoose from "mongoose";
import Order from "../models/order.js";
import { handleResponse } from "../utils/helper.js";
import {
  emitToAdmin,
  emitToOrderRoom,
  emitToDelivery,
  emitToFranchise,
} from "../lib/socket.js";
import { sendNotificationToUser } from "../utils/pushNotificationHelper.js";
import Product from "../models/product.js";
import Cart from "../models/cart.js";
import User from "../models/user.js";
import Franchise from "../models/franchise.js";
import Delivery from "../models/delivery.js";
import GlobalSetting from "../models/globalSetting.js";
import Inventory from "../models/inventory.js";
import ProcurementRequest from "../models/procurementRequest.js";
import { geocodeAddress, getDistance } from "../utils/geo.js";
import {
  assignOrderToFranchise,
  assignDeliveryToOrder,
} from "../utils/assignment.js";
import {
  computeSplitCheckoutPayload,
  resolveCheckoutCoordinates,
} from "../utils/checkoutOrderSplit.js";
import { createAdminNotification } from "../utils/adminNotification.js";
import { createUserNotification } from "../utils/userNotification.js";
import { resolveDeliverySchedule, getDeliveryOffDays } from "../utils/deliverySchedule.js";
import { CREDIT_BLOCKED_MESSAGE } from "../constants/credit.js";
import { refundCancelledOrder } from "../utils/orderRefund.js";
import { createDeliveryOtps, otpsOf, verifyDeliveryOtp } from "../utils/deliveryOtp.js";

const OUT_FOR_DELIVERY = ["Dispatched", "Out for Delivery"];

/** Adds the customer's delivery code to their own orders that are on the way. */
const withCustomerCode = async (plainOrders) => {
  const open = plainOrders.filter((o) => OUT_FOR_DELIVERY.includes(o.orderStatus));
  if (!open.length) return plainOrders;
  const codes = await otpsOf(open.map((o) => o._id));
  return plainOrders.map((o) =>
    OUT_FOR_DELIVERY.includes(o.orderStatus) && codes[String(o._id)]?.customerCode
      ? { ...o, deliveryOtpCode: codes[String(o._id)].customerCode }
      : o,
  );
};
import { acquireUserLock, releaseUserLock } from "../utils/userLock.js";
import { takeStock, takeStockUpTo, addStock } from "../utils/stock.js";

/**
 * Helper to calculate price based on quantity and bulk pricing rules
 */
const calculateItemPrice = (product, quantity) => {
  let price = product.price; // Standard price
  let isBulkRate = false;

  if (product.bulkPricing && product.bulkPricing.length > 0) {
    // Sort bulk pricing by minQty descending to find the best match
    const sortedBulk = [...product.bulkPricing].sort(
      (a, b) => b.minQty - a.minQty,
    );
    const applicableBulk = sortedBulk.find((bp) => quantity >= bp.minQty);

    if (applicableBulk) {
      price = applicableBulk.price;
      isBulkRate = true;
    }
  }

  return { price, isBulkRate };
};

/**
 * Helper to calculate distance between two points using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Stock shortage only matters while an order is still waiting for stock. Once it is packed, out for
// delivery, delivered or cancelled, its stock was already taken (or it is gone), so it is never "short".
const AWAITING_STOCK = ["Placed", "Assigned", "Accepted", "Procuring", "pending"];

/**
 * Products of each order that an open stock request (not yet received or rejected) already covers,
 * as Map(orderId -> Set(productId)). Lets one order's shortages be split across several vendors.
 */
const openProcurementByOrder = async (orderIds) => {
  const map = new Map();
  if (!orderIds.length) return map;
  const open = await ProcurementRequest.find({
    orderId: { $in: orderIds },
    status: { $nin: ["completed", "rejected"] },
  }).select("orderId items.productId").lean();
  for (const r of open) {
    const key = String(r.orderId);
    if (!map.has(key)) map.set(key, new Set());
    for (const i of r.items || []) map.get(key).add(String(i.productId));
  }
  return map;
};

const applyFranchiseStockShortageFlags = async (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) {
    return orders;
  }

  const waiting = orders.filter((o) => AWAITING_STOCK.includes(o.orderStatus));
  const franchiseIds = [
    ...new Set(
      waiting
        .map((order) => order.franchiseId?._id || order.franchiseId)
        .filter(Boolean)
        .map((id) => id.toString()),
    ),
  ];

  const [inventories, requested] = await Promise.all([
    franchiseIds.length ? Inventory.find({ franchiseId: { $in: franchiseIds } }).lean() : [],
    openProcurementByOrder(waiting.map((o) => o._id)),
  ]);

  const inventoryByFranchise = new Map(
    inventories.map((inventory) => [
      inventory.franchiseId.toString(),
      inventory,
    ]),
  );

  return orders.map((order) => {
    if (!AWAITING_STOCK.includes(order.orderStatus)) {
      const plain = order.toObject ? order.toObject() : { ...order };
      plain.items = (plain.items || []).map((item) => ({ ...item, isShortage: false, shortageQty: 0, procurementRequested: false }));
      return plain;
    }
    const franchiseId = order.franchiseId?._id || order.franchiseId;
    if (!franchiseId) {
      return order;
    }
    const requestedHere = requested.get(String(order._id)) || new Set();

    const inventory = inventoryByFranchise.get(franchiseId.toString());
    const orderObject = order.toObject ? order.toObject() : { ...order };
    const inventoryItems = inventory?.items || [];

    orderObject.items = (orderObject.items || []).map((item) => {
      const productId = item.productId?._id || item.productId;
      const invItem = inventoryItems.find(
        (inventoryItem) =>
          inventoryItem.productId?.toString() === productId?.toString(),
      );
      const availableStock = Number(invItem?.currentStock || 0);
      const orderedQty = Number(item.quantity || 0);
      const shortageQty = Math.max(0, orderedQty - availableStock);

      return {
        ...item,
        isShortage: shortageQty > 0,
        shortageQty,
        // Already asked from a vendor / mother franchise for this order
        procurementRequested: shortageQty > 0 && requestedHere.has(String(productId)),
      };
    });

    return orderObject;
  });
};

export const createOrder = async (req, res) => {
  const lockKey = `checkout:${req.user.id}`;
  if (!acquireUserLock(lockKey)) {
    return handleResponse(res, 409, "Your order is already being placed. Please wait a moment.");
  }
  try {
    return await placeOrder(req, res);
  } finally {
    releaseUserLock(lockKey);
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shippingAddress, shippingLocation, paymentMethod, deliveryShift, scheduledDate } =
      req.body;

    if (!shippingAddress || !paymentMethod || !deliveryShift) {
      return handleResponse(
        res,
        400,
        "Shipping address, payment method, and delivery shift are required",
      );
    }

    // Delivery date / slot validation (evaluated in IST)
    const schedule = resolveDeliverySchedule(scheduledDate, deliveryShift, new Date(), await getDeliveryOffDays());
    if (!schedule.ok) {
      return handleResponse(res, schedule.status, schedule.message);
    }
    const preOrderDate = schedule.scheduledDate;
    const isPreOrder = schedule.isPreOrder;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return handleResponse(res, 400, "Your cart is empty");
    }

    const user = await User.findById(userId);
    if (!user) return handleResponse(res, 404, "User not found");

    const resolvedLocation = await resolveCheckoutCoordinates(
      shippingAddress,
      shippingLocation,
    );

    if (!resolvedLocation) {
      return handleResponse(
        res,
        400,
        "Valid delivery location is required. Please pick your location on map and try again.",
      );
    }

    const split = await computeSplitCheckoutPayload({
      cart,
      userId,
      couponCode: req.body.couponCode,
      resolvedLocation,
    });

    if (!split.ok) {
      return handleResponse(res, split.status, split.message);
    }

    const {
      userCoords,
      computedGroups,
      grandTotal,
      appliedCouponCode,
      couponToIncrement,
      orderGroupId,
    } = split.payload;

    if (
      user.usedCredit > 0 &&
      user.creditOverdueDate &&
      new Date() > new Date(user.creditOverdueDate)
    ) {
      return handleResponse(
        res,
        403,
        "Payment Overdue: Please clear your KK Credit balance to continue shopping.",
      );
    }

    // Charge wallet / credit atomically BEFORE creating orders: the balance check and the
    // deduction happen in one database operation, so two checkouts can't spend the same money.
    const couponNote = appliedCouponCode ? ` (Coupon: ${appliedCouponCode})` : "";
    let charged = 0;
    if (paymentMethod === "Wallet") {
      const updated = await User.findOneAndUpdate(
        { _id: userId, walletBalance: { $gte: grandTotal } },
        {
          $inc: { walletBalance: -grandTotal },
          $push: {
            walletTransactions: {
              $each: [{ txnId: `WAL-${Date.now()}`, type: "Paid", amount: grandTotal, status: "Success", note: `Order paid via wallet${couponNote}`, createdAt: new Date() }],
              $position: 0,
            },
          },
        },
        { new: true },
      );
      if (!updated) return handleResponse(res, 400, "Insufficient wallet balance");
      charged = grandTotal;
    } else if (paymentMethod === "Credit") {
      if (user.creditBlocked) {
        return handleResponse(res, 403, CREDIT_BLOCKED_MESSAGE);
      }
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const updated = await User.findOneAndUpdate(
        // creditBlocked in the filter too, in case the admin blocks during this checkout
        { _id: userId, creditBlocked: { $ne: true }, $expr: { $gte: [{ $subtract: [{ $ifNull: ["$creditLimit", 0] }, { $ifNull: ["$usedCredit", 0] }] }, grandTotal] } },
        [
          {
            $set: {
              // Start the 7-day repayment clock only when this is the first unpaid credit
              creditOverdueDate: { $cond: [{ $lte: [{ $ifNull: ["$usedCredit", 0] }, 0] }, dueDate, "$creditOverdueDate"] },
              usedCredit: { $round: [{ $add: [{ $ifNull: ["$usedCredit", 0] }, grandTotal] }, 2] },
              walletTransactions: {
                $concatArrays: [
                  { $literal: [{ txnId: `CRD-${Date.now()}`, type: "Credit Used", amount: grandTotal, status: "Success", note: `Order paid via business credit${couponNote}`, createdAt: new Date() }] },
                  { $ifNull: ["$walletTransactions", []] },
                ],
              },
            },
          },
        ],
        { new: true, updatePipeline: true },
      );
      if (!updated) return handleResponse(res, 400, "Insufficient credit limit");
      charged = grandTotal;
    }

    const createdOrders = [];
    try {
    for (const g of computedGroups) {
      let fulfillmentCategoryId = null;
      try {
        fulfillmentCategoryId = g.categoryId ? new mongoose.Types.ObjectId(g.categoryId) : null;
      } catch {
        fulfillmentCategoryId = null;
      }

      const order = new Order({
        userId,
        items: g.items,
        subtotal: g.subtotal,
        deliveryFee: g.deliveryFee,
        tax: g.tax,
        totalAmount: g.totalAmount,
        paymentMethod,
        couponCode: appliedCouponCode,
        discountAmount: g.discountAmount,
        paymentStatus:
          paymentMethod === "Wallet" || paymentMethod === "Credit"
            ? "Completed"
            : "Pending",
        orderStatus: "Placed",
        shippingAddress,
        shippingLocation: userCoords,
        deliveryShift,
        orderGroupId,
        fulfillmentCategoryId,
        scheduledDate: preOrderDate,
        isPreOrder,
      });

      await order.save();
      createdOrders.push(order);

      if (paymentMethod === "Credit") {
        await createAdminNotification({
          type: "new_order",
          title: "New Order Placed",
          message: `${user.fullName} placed order #${order._id.toString().slice(-6)} for ₹${Number(order.totalAmount || 0).toFixed(2)}.`,
          link: "/masteradmin/orders",
          meta: {
            orderId: order._id.toString(),
            orderGroupId: orderGroupId || null,
            amount: order.totalAmount,
            customerName: user.fullName,
          },
        });
      }

      await createUserNotification({
        userId,
        type: "order",
        title: "Order Placed",
        message: `Your order #${order._id.toString().slice(-6)} has been placed successfully.`,
        link: `/order-detail/${order._id}`,
        meta: {
          orderId: order._id.toString(),
          amount: order.totalAmount,
          paymentMethod,
        },
      });

      try {
        await assignOrderToFranchise(order._id);
      } catch (assignErr) {
        console.error("[CreateOrder] Auto-assignment failed:", assignErr);
      }
    }
    } catch (createErr) {
      // Order creation failed part-way: cancel what was created and give the money back
      console.error("[CreateOrder] Failed while creating orders, rolling back:", createErr);
      let refundedViaOrders = 0;
      for (const o of createdOrders) {
        try {
          await Order.updateOne({ _id: o._id }, { $set: { orderStatus: "Cancelled" } });
          const r = await refundCancelledOrder(o._id, "order could not be completed");
          refundedViaOrders += r.walletRefund + r.creditRestore;
        } catch (e) {
          console.error("[CreateOrder] Rollback of order failed:", o._id, e);
        }
      }
      const remainder = Math.round((charged - refundedViaOrders) * 100) / 100;
      if (remainder > 0) {
        const field = paymentMethod === "Credit" ? { usedCredit: -remainder } : { walletBalance: remainder };
        await User.updateOne({ _id: userId }, { $inc: field });
      }
      return handleResponse(res, 500, "Order failed");
    }

    if (couponToIncrement) {
      // Atomic increment so concurrent orders don't lose a count
      await couponToIncrement.constructor.updateOne({ _id: couponToIncrement._id }, { $inc: { timesUsed: 1 } });
    }

    cart.items = [];
    await cart.save();

    for (const order of createdOrders) {
      emitToAdmin("new_order_placed", {
        orderId: order._id,
        orderGroupId,
        customerName: user.fullName,
        amount: order.totalAmount,
        isPreOrder: order.isPreOrder,
        scheduledDate: order.scheduledDate,
        message: order.isPreOrder 
          ? `Advance Booking by ${user.fullName}: ₹${order.totalAmount} for ${new Date(order.scheduledDate).toLocaleDateString()}`
          : `New order placed by ${user.fullName}: ₹${order.totalAmount}`,
      });
    }

    const payload =
      createdOrders.length === 1
        ? {
            order: createdOrders[0],
            orders: createdOrders,
            orderGroupId,
            grandTotal,
          }
        : { orders: createdOrders, orderGroupId, grandTotal };

    return handleResponse(res, 201, "Order placed successfully", payload);
  } catch (error) {
    console.error("Create order error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ userId })
      .populate("items.productId")
      .populate("franchiseId", "storeName franchiseName ownerName mobile")
      .populate("deliveryPartnerId", "fullName mobile vehicleNumber vehicleType")
      .sort({ createdAt: -1 });

    // Group orders by orderGroupId for split orders
    const groupedOrders = [];
    const processedGroupIds = new Set();
    const standaloneOrders = [];

    for (const order of orders) {
      if (order.orderGroupId) {
        // This is a split order
        if (!processedGroupIds.has(order.orderGroupId)) {
          // Find all orders in this group
          const groupOrders = orders.filter(
            (o) => o.orderGroupId === order.orderGroupId
          );

          groupedOrders.push({
            _groupDocs: true,
            orderGroupId: order.orderGroupId,
            isSplitOrder: true,
            totalOrders: groupOrders.length,
            grandTotal: groupOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            createdAt: order.createdAt,
            paymentMethod: order.paymentMethod,
            shippingAddress: order.shippingAddress,
            allDelivered: groupOrders.every((o) =>
              ["Delivered", "Received"].includes(o.orderStatus)
            ),
            anyInProgress: groupOrders.some((o) =>
              ["Placed", "Assigned", "Accepted", "Packed", "Procuring", "Ready", "Dispatched", "Out for Delivery"].includes(o.orderStatus)
            ),
            anyCancelled: groupOrders.some((o) => o.orderStatus === "Cancelled"),
            orders: groupOrders,
          });

          processedGroupIds.add(order.orderGroupId);
        }
      } else {
        // Standalone order (not split)
        standaloneOrders.push({
          ...order.toObject(),
          isSplitOrder: false,
        });
      }
    }

    // Orders on the way carry the customer's delivery code (shown only to the customer)
    for (const g of groupedOrders) {
      delete g._groupDocs;
      g.orders = await withCustomerCode(g.orders.map((o) => o.toObject()));
    }
    const standaloneWithCodes = await withCustomerCode(standaloneOrders);

    // Combine grouped and standalone orders, sorted by creation date
    const allOrders = [...groupedOrders, ...standaloneWithCodes].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return handleResponse(res, 200, "Orders fetched successfully", allOrders);
  } catch (error) {
    console.error("Get my orders error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * @desc Get all orders in a split order group by orderGroupId
 * @route GET /api/orders/group/:orderGroupId
 * @access Private (User must own at least one order in the group)
 */
export const getOrdersByGroupId = async (req, res) => {
  try {
    const { orderGroupId } = req.params;
    const userId = req.user.id;

    if (!orderGroupId) {
      return handleResponse(res, 400, "Order group ID is required");
    }

    // Find all orders with this orderGroupId
    const orders = await Order.find({ orderGroupId })
      .populate("items.productId")
      .populate("franchiseId", "storeName franchiseName ownerName mobile address location")
      .populate("deliveryPartnerId", "fullName mobile vehicleNumber vehicleType")
      .sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return handleResponse(res, 404, "No orders found for this group");
    }

    // Verify that at least one order belongs to the requesting user
    const userOwnsOrder = orders.some(
      (order) => order.userId && order.userId.toString() === userId.toString()
    );

    if (!userOwnsOrder) {
      return handleResponse(res, 403, "Unauthorized access to this order group");
    }

    // Apply stock shortage flags
    const enrichedOrders = await applyFranchiseStockShortageFlags(orders);

    // Calculate group summary
    const groupSummary = {
      orderGroupId,
      totalOrders: enrichedOrders.length,
      grandTotal: enrichedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
      allDelivered: enrichedOrders.every((order) => 
        ["Delivered", "Received"].includes(order.orderStatus)
      ),
      anyInProgress: enrichedOrders.some((order) => 
        ["Placed", "Assigned", "Accepted", "Packed", "Procuring", "Ready", "Dispatched", "Out for Delivery"].includes(order.orderStatus)
      ),
      anyCancelled: enrichedOrders.some((order) => order.orderStatus === "Cancelled"),
      orders: await withCustomerCode(enrichedOrders.map((o) => (o.toObject ? o.toObject() : o))),
    };

    return handleResponse(
      res,
      200,
      "Split orders fetched successfully",
      groupSummary
    );
  } catch (error) {
    console.error("Get orders by group ID error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.productId")
      .populate("userId", "fullName mobile address")
      .populate("franchiseId", "storeName franchiseName ownerName mobile")
      .populate(
        "deliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      );
    if (!order) return handleResponse(res, 404, "Order not found");

    // Authorization logic
    const userId = req.user?.id || req.user?._id;
    const franchiseId = req.franchise?._id;
    const isMasterAdmin = !!req.masteradmin;

    const isOwner = userId && order.userId._id.toString() === userId.toString();
    const isAssignedFranchise =
      franchiseId && order.franchiseId?.toString() === franchiseId.toString();

    if (!isMasterAdmin && !isOwner && !isAssignedFranchise) {
      return handleResponse(res, 403, "Unauthorized access");
    }

    let [enrichedOrder] = await applyFranchiseStockShortageFlags([order]);
    // Only the customer sees their own delivery code
    if (isOwner) [enrichedOrder] = await withCustomerCode([enrichedOrder.toObject ? enrichedOrder.toObject() : enrichedOrder]);

    return handleResponse(res, 200, "Order details fetched", enrichedOrder);
  } catch (error) {
    console.error("Get order by id error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const createReturnRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const { items, reason } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return handleResponse(res, 400, "At least one return item is required");
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return handleResponse(
        res,
        400,
        "Please provide a valid return reason (minimum 10 characters)",
      );
    }

    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");

    if (!order.userId || order.userId.toString() !== userId.toString()) {
      return handleResponse(res, 403, "You can only return your own order");
    }

    if ((order.returnRequests || []).length > 0) {
      return handleResponse(
        res,
        400,
        "Return request already submitted for this order",
      );
    }

    const eligibleStatuses = ["Delivered", "Received"];
    if (!eligibleStatuses.includes(order.orderStatus)) {
      return handleResponse(
        res,
        400,
        "Returns are allowed only for delivered/received orders",
      );
    }

    const deliveredOrReceivedHistory = (order.statusHistory || [])
      .filter((entry) => eligibleStatuses.includes(entry.status))
      .map((entry) => new Date(entry.updatedAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const referenceDate =
      (order.deliveredAt ? new Date(order.deliveredAt) : null) ||
      deliveredOrReceivedHistory[0] ||
      new Date(order.updatedAt);

    const returnWindowMs = 2 * 24 * 60 * 60 * 1000;
    if (Date.now() - referenceDate.getTime() > returnWindowMs) {
      return handleResponse(
        res,
        400,
        "Return window has expired. You can request return within 2 days only.",
      );
    }

    const orderedQtyByProduct = new Map();
    for (const item of order.items || []) {
      if (!item.productId) continue;
      const pid = item.productId.toString();
      orderedQtyByProduct.set(
        pid,
        (orderedQtyByProduct.get(pid) || 0) + Number(item.quantity || 0),
      );
    }

    const alreadyRequestedByProduct = new Map();
    for (const request of order.returnRequests || []) {
      // Rejected requests should not block fresh requests.
      if (request.status === "rejected") continue;
      for (const item of request.items || []) {
        const pid = item.productId?.toString?.();
        if (!pid) continue;
        alreadyRequestedByProduct.set(
          pid,
          (alreadyRequestedByProduct.get(pid) || 0) +
            Number(item.quantity || 0),
        );
      }
    }

    const validatedItems = [];
    for (const item of items) {
      const productId = item?.productId?.toString?.();
      const quantity = Number(item?.quantity || 0);

      if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
      if (!orderedQtyByProduct.has(productId)) continue;

      const orderedQty = orderedQtyByProduct.get(productId) || 0;
      const alreadyRequestedQty = alreadyRequestedByProduct.get(productId) || 0;
      const maxReturnable = Math.max(0, orderedQty - alreadyRequestedQty);

      if (maxReturnable <= 0 || quantity > maxReturnable) {
        return handleResponse(
          res,
          400,
          `Return quantity for one or more items exceeds allowed quantity`,
        );
      }

      const orderItem = (order.items || []).find(
        (o) => o.productId?.toString?.() === productId,
      );
      validatedItems.push({
        productId,
        name: orderItem?.name || item?.name || "",
        quantity,
        unit: orderItem?.unit || item?.unit || "",
      });
    }

    if (validatedItems.length === 0) {
      return handleResponse(res, 400, "No valid return items found");
    }

    order.returnRequests.push({
      items: validatedItems,
      reason: reason.trim(),
      status: "pending",
      requestedAt: new Date(),
    });

    await order.save();

    await createUserNotification({
      userId: order.userId,
      type: "return",
      title: "Return Request Submitted",
      message: `We have received your return request for order #${order._id.toString().slice(-6)}.`,
      link: `/order-detail/${order._id}`,
      meta: {
        orderId: order._id.toString(),
        requestStatus: "pending",
      },
    });

    return handleResponse(
      res,
      201,
      "Return request submitted successfully",
      order,
    );
  } catch (error) {
    console.error("Create return request error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

const getReturnRequestByIndex = (order, indexParam) => {
  const requestIndex = Number(indexParam);
  if (!Number.isInteger(requestIndex) || requestIndex < 0)
    return { request: null, requestIndex: -1 };
  const request = order?.returnRequests?.[requestIndex] || null;
  return { request, requestIndex };
};

export const reviewReturnRequestByFranchise = async (req, res) => {
  try {
    const { id, requestIndex } = req.params;
    const franchiseId = req.franchise?._id;
    const { action, reason } = req.body;
    const cleanedReason = typeof reason === "string" ? reason.trim() : "";

    if (!["approve", "reject"].includes(action)) {
      return handleResponse(res, 400, "Action must be approve or reject");
    }

    if (action === "reject" && cleanedReason.length < 5) {
      return handleResponse(
        res,
        400,
        "Please provide a valid review reason (minimum 5 characters)",
      );
    }

    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");

    if (
      !order.franchiseId ||
      order.franchiseId.toString() !== franchiseId.toString()
    ) {
      return handleResponse(
        res,
        403,
        "This return request does not belong to your franchise",
      );
    }

    const { request } = getReturnRequestByIndex(order, requestIndex);
    if (!request) return handleResponse(res, 404, "Return request not found");

    if (request.status !== "pending") {
      return handleResponse(
        res,
        400,
        `Return request is already ${request.status}`,
      );
    }

    request.status = action === "approve" ? "approved" : "rejected";
    request.reviewedByFranchiseId = franchiseId;
    request.franchiseReviewReason = cleanedReason;
    request.reviewedAt = new Date();

    await order.save();
    emitToOrderRoom(order._id, "return_request_reviewed", {
      orderId: order._id,
      requestIndex: Number(requestIndex),
      action,
      status: request.status,
      reason: request.franchiseReviewReason,
      reviewedAt: request.reviewedAt,
      message:
        action === "reject"
          ? "Your return request was rejected by franchise."
          : "Your return request was approved by franchise.",
    });

    return handleResponse(
      res,
      200,
      `Return request ${action}d successfully`,
      order,
    );
  } catch (error) {
    console.error("Review return request error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const assignReturnPickupDelivery = async (req, res) => {
  try {
    const { id, requestIndex } = req.params;
    const { deliveryPartnerId } = req.body;
    const franchiseId = req.franchise?._id;

    if (!deliveryPartnerId) {
      return handleResponse(res, 400, "Delivery partner ID is required");
    }

    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");

    if (
      !order.franchiseId ||
      order.franchiseId.toString() !== franchiseId.toString()
    ) {
      return handleResponse(
        res,
        403,
        "This return request does not belong to your franchise",
      );
    }

    const { request } = getReturnRequestByIndex(order, requestIndex);
    if (!request) return handleResponse(res, 404, "Return request not found");

    if (!["approved", "pickup_assigned"].includes(request.status)) {
      return handleResponse(
        res,
        400,
        "Only approved return requests can be assigned for pickup",
      );
    }

    request.pickupDeliveryPartnerId = deliveryPartnerId;
    request.pickupAssignedAt = new Date();
    request.status = "pickup_assigned";

    await order.save();

    // Send Real-time Notification
    emitToDelivery(deliveryPartnerId, "new_task", {
      orderId: order._id,
      requestIndex,
      type: "RETURN",
      message: `New return pickup task assigned: #${order._id.toString().slice(-6)}`,
    });

    // Send Push Notification
    sendNotificationToUser(
      deliveryPartnerId,
      {
        title: "New Return Pickup Task",
        body: `You have been assigned a new return pickup task for order #${order._id.toString().slice(-6)}.`,
        data: {
          type: "return_pickup",
          orderId: order._id.toString(),
          link: "/delivery/returns",
        },
      },
      "delivery",
    );

    return handleResponse(
      res,
      200,
      "Pickup assigned to delivery partner",
      order,
    );
  } catch (error) {
    console.error("Assign return pickup error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const getFranchiseReturnRequests = async (req, res) => {
  try {
    const franchiseId = req.franchise?._id;

    const orders = await Order.find({
      franchiseId,
      "returnRequests.0": { $exists: true },
    })
      .populate("userId", "fullName mobile")
      .populate(
        "returnRequests.pickupDeliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      )
      .sort({ updatedAt: -1 });

    return handleResponse(
      res,
      200,
      "Franchise return requests fetched",
      orders,
    );
  } catch (error) {
    console.error("Get franchise return requests error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const getDeliveryReturnPickups = async (req, res) => {
  try {
    const partnerId = req.delivery?._id?.toString();
    if (!partnerId)
      return handleResponse(res, 401, "Delivery partner not identified");

    const orders = await Order.find({
      returnRequests: {
        $elemMatch: {
          pickupDeliveryPartnerId: req.delivery._id,
          status: { $in: ["pickup_assigned", "picked_up"] },
        },
      },
    })
      .populate("userId", "fullName mobile address")
      .populate("franchiseId", "franchiseName address location")
      .sort({ updatedAt: -1 });

    const pickups = [];
    for (const order of orders) {
      (order.returnRequests || []).forEach((rr, idx) => {
        if (!rr.pickupDeliveryPartnerId) return;
        if (rr.pickupDeliveryPartnerId.toString() !== partnerId) return;
        if (!["pickup_assigned", "picked_up"].includes(rr.status)) return;

        pickups.push({
          orderId: order._id,
          requestIndex: idx,
          status: rr.status,
          requestedAt: rr.requestedAt,
          items: rr.items || [],
          customerName: order.userId?.fullName || "Customer",
          customerMobile: order.userId?.mobile || "",
          pickupAddress: order.shippingAddress,
          franchiseName: order.franchiseId?.franchiseName || "Franchise",
          franchiseAddress: order.franchiseId?.address || "",
          franchiseId: order.franchiseId,
          userId: order.userId,
        });
      });
    }

    return handleResponse(res, 200, "Assigned return pickups fetched", pickups);
  } catch (error) {
    console.error("Get delivery return pickups error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateReturnPickupStatus = async (req, res) => {
  try {
    const { id, requestIndex } = req.params;
    const { status } = req.body;
    const partnerId = req.delivery?._id?.toString();

    if (!["picked_up", "completed"].includes(status)) {
      return handleResponse(res, 400, "Invalid return pickup status");
    }

    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");

    const { request } = getReturnRequestByIndex(order, requestIndex);
    if (!request) return handleResponse(res, 404, "Return request not found");

    if (
      !request.pickupDeliveryPartnerId ||
      request.pickupDeliveryPartnerId.toString() !== partnerId
    ) {
      return handleResponse(res, 403, "This pickup is not assigned to you");
    }

    if (status === "picked_up" && request.status !== "pickup_assigned") {
      return handleResponse(
        res,
        400,
        "Only assigned pickups can be marked picked up",
      );
    }

    if (
      status === "completed" &&
      !["pickup_assigned", "picked_up"].includes(request.status)
    ) {
      return handleResponse(res, 400, "Pickup is not in a completable state");
    }

    request.status = status;
    if (status === "picked_up") request.pickupPickedAt = new Date();
    if (status === "completed") {
      request.pickupCompletedAt = new Date();

      const priceByProduct = new Map();
      for (const item of order.items || []) {
        const pid = item.productId?.toString?.();
        if (!pid) continue;
        priceByProduct.set(pid, Number(item.price || 0));
      }

      const refundAmount = (request.items || []).reduce((sum, item) => {
        const pid = item.productId?.toString?.();
        const price = pid ? priceByProduct.get(pid) || 0 : 0;
        return sum + price * Number(item.quantity || 0);
      }, 0);

      if (refundAmount > 0) {
        const user = await User.findById(order.userId);
        if (user) {
          user.walletBalance = Number(
            (Number(user.walletBalance || 0) + refundAmount).toFixed(2),
          );
          user.walletTransactions = user.walletTransactions || [];
          user.walletTransactions.unshift({
            txnId: `RFD-${Date.now()}`,
            type: "Refund",
            amount: refundAmount,
            status: "Success",
            note: `Return refund for order ${order._id}`,
            referenceOrderId: order._id,
            createdAt: new Date(),
          });
          await user.save();
        }
      }

      // 2. Replenish inventory for returned items
      try {
        const inventory = await Inventory.findOne({
          franchiseId: order.franchiseId,
        });
        if (inventory) {
          for (const item of request.items || []) {
            const pid = item.productId?.toString?.();
            if (!pid) continue;

            const existingItem = inventory.items.find(
              (i) => i.productId.toString() === pid,
            );
            if (existingItem) {
              existingItem.currentStock += Number(item.quantity || 0);
              existingItem.lastUpdated = new Date();
            } else {
              inventory.items.push({
                productId: pid,
                currentStock: Number(item.quantity || 0),
                lastUpdated: new Date(),
              });
            }
          }
          await inventory.save();
          console.log(
            `[Inventory] Replenished stock for return pickup in order ${order._id}`,
          );
        }
      } catch (invErr) {
        console.error("Failed to replenish inventory for return:", invErr);
      }
    }

    await order.save();

    await createUserNotification({
      userId: order.userId,
      type: "return",
      title:
        status === "completed"
          ? "Return Completed"
          : "Return Pickup Updated",
      message:
        status === "completed"
          ? `Your return for order #${order._id.toString().slice(-6)} has been completed.${request.items?.length ? " Refund processed to wallet if applicable." : ""}`
          : `Return pickup for order #${order._id.toString().slice(-6)} is now ${status.replace("_", " ")}.`,
      link: `/order-detail/${order._id}`,
      meta: {
        orderId: order._id.toString(),
        requestIndex: Number(requestIndex),
        status,
      },
    });

    // Socket Notifications
    emitToOrderRoom(order._id, "return_pickup_status_updated", {
      orderId: order._id,
      requestIndex: Number(requestIndex),
      status: status,
      message: `Return pickup is now ${status.replace("_", " ")}`,
    });

    if (order.franchiseId) {
      emitToFranchise(order.franchiseId, "return_status_changed", {
        orderId: order._id,
        requestIndex: Number(requestIndex),
        status: status,
      });
    }

    return handleResponse(res, 200, "Return pickup status updated", order);
  } catch (error) {
    console.error("Update return pickup status error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, allowPartialFulfillment, collectionMode } = req.body;

    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");

    const isMasterAdmin = !!req.masteradmin;
    const isFranchise = !!req.franchise;
    const isDelivery = !!req.delivery || req.user?.role === "delivery";
    const isUser = !!req.user && !isMasterAdmin && !isDelivery;

    if (
      isMasterAdmin &&
      typeof allowPartialFulfillment === "boolean" &&
      !status
    ) {
      order.allowPartialFulfillment = allowPartialFulfillment;
      order.partialFulfillmentApprovedAt = allowPartialFulfillment
        ? new Date()
        : null;
      order.statusHistory.push({
        status: order.orderStatus,
        updatedAt: new Date(),
        updatedBy: "masteradmin",
        message: allowPartialFulfillment
          ? "Master Admin approved delivery with currently available franchise stock."
          : "Master Admin revoked partial delivery approval.",
      });
      await order.save();

      // Notify franchise when admin allows partial fulfillment
      if (allowPartialFulfillment && order.franchiseId) {
        const franchiseId = order.franchiseId.toString();

        // Socket notification to franchise
        emitToFranchise(franchiseId, 'partial_fulfillment_approved', {
          orderId: order._id,
          message: `Admin has allowed delivery with available stock for Order #${order._id.toString().slice(-6)}. You can now proceed with packing and delivery.`,
          allowPartialFulfillment: true
        });

        // Create in-app notification for franchise
        try {
          const FranchiseNotification = (await import('../models/franchiseNotification.js')).default;
          await FranchiseNotification.create({
            franchiseId: order.franchiseId,
            type: 'partial_fulfillment_approved',
            title: 'Delivery Approved with Available Stock',
            message: `Admin has approved delivery with available stock for Order #${order._id.toString().slice(-6)}. You can now proceed with packing.`,
            relatedOrderId: order._id,
            isRead: false
          });
        } catch (notifErr) {
          console.error('Failed to create franchise notification:', notifErr);
        }
      }

      return handleResponse(
        res,
        200,
        allowPartialFulfillment
          ? "Partial delivery approval enabled"
          : "Partial delivery approval removed",
        order,
      );
    }

    const currentStatus = order.orderStatus;
    const allowedStatuses = [
      "Placed",
      "Assigned",
      "Accepted",
      "Packed",
      "Procuring",
      "Ready",
      "Dispatched",
      "Out for Delivery",
      "Delivered",
      "Received",
      "Cancelled",
      "pending",
    ];

    console.log(
      `[DEBUG] MasterAdmin: ${!!req.masteradmin}, Order: ${id}, Status: ${status}`,
    );

    if (!allowedStatuses.includes(status)) {
      return handleResponse(res, 400, `Invalid status value: ${status}`);
    }

    // Role-based validation

    // Transitions logic (Master Admin can bypass)
    // We normalize to ensure case-insensitivity during check
    const statusFlow = {
      placed: ["assigned", "accepted", "packed", "cancelled", "procuring"],
      pending: ["assigned", "accepted", "packed", "cancelled", "procuring"], // Treated like placed
      assigned: ["accepted", "packed", "cancelled", "procuring"],
      accepted: ["packed", "procuring", "cancelled"],
      procuring: ["packed", "cancelled", "accepted"],
      packed: ["ready", "dispatched", "out for delivery", "cancelled"],
      ready: ["dispatched", "out for delivery", "cancelled"],
      dispatched: ["delivered", "received", "cancelled"],
      "out for delivery": ["delivered", "received", "cancelled"],
      delivered: ["received"],
      received: [],
      cancelled: [],
    };

    const normalizedCurrent = (currentStatus || "").toLowerCase();
    const normalizedNew = (status || "").toLowerCase();

    // Cancelling twice would run the wallet/credit refund twice
    if (status === "Cancelled" && currentStatus === "Cancelled") {
      return handleResponse(res, 400, "This order is already cancelled");
    }
    if (
      !isMasterAdmin &&
      status === "Cancelled" &&
      ["Delivered", "Received"].includes(currentStatus)
    ) {
      return handleResponse(
        res,
        400,
        "A delivered order cannot be cancelled. Please raise a return request instead.",
      );
    }

    // Each role may only make the changes its app actually needs
    if (isUser) {
      const userCancellable = ["Placed", "pending", "Assigned", "Accepted", "Procuring"];
      if (!["Received", "Cancelled"].includes(status)) {
        return handleResponse(res, 403, "You can't change the order to this status");
      }
      if (status === "Cancelled" && !userCancellable.includes(currentStatus)) {
        return handleResponse(res, 400, "This order can no longer be cancelled because it is already packed");
      }
    }
    if (isDelivery) {
      if (!["Out for Delivery", "Delivered"].includes(status)) {
        return handleResponse(res, 403, "Delivery partners can only mark orders out for delivery or delivered");
      }
      const partnerId = req.delivery?._id || req.user?.id;
      if (!partnerId || !order.deliveryPartnerId || order.deliveryPartnerId.toString() !== partnerId.toString()) {
        return handleResponse(res, 403, "This order is not assigned to you");
      }
      // A repeat of the partner's own update (double tap, retry after a slow network) is not an
      // error: the order is already where they wanted it. Return early so side effects don't rerun.
      if (currentStatus === status) {
        return handleResponse(res, 200, `Order is already ${status}`, order);
      }
    }

    if (
      !isMasterAdmin &&
      status !== "Cancelled" &&
      (!statusFlow[normalizedCurrent] ||
        !statusFlow[normalizedCurrent].includes(normalizedNew))
    ) {
      console.warn(
        `[TRANSITION_ERROR] ${currentStatus} -> ${status} (Normalized: ${normalizedCurrent} -> ${normalizedNew})`,
      );
      return handleResponse(
        res,
        400,
        `Transition Error: Cannot move from ${currentStatus} to ${status}`,
      );
    }

    // Authorization checks
    if (!isMasterAdmin) {
      if (isFranchise) {
        // If order has a franchise assigned, verify it's the current one
        if (
          order.franchiseId &&
          order.franchiseId.toString() !== req.franchise._id.toString()
        ) {
          return handleResponse(
            res,
            403,
            "This order is assigned to another franchise",
          );
        }
        // If unassigned but franchise is acting on it, claim ownership (manual — not auto-accepted)
        if (!order.franchiseId) {
          order.franchiseId = req.franchise._id;
          order.franchiseAutoAccepted = false;
        }

        if (["Packed", "Out for Delivery"].includes(status) && !isFranchise) {
          return handleResponse(
            res,
            403,
            "Only franchise can update to Packed/Out for Delivery",
          );
        }
      }

      if (status === "Delivered" && !isDelivery && !isFranchise) {
        return handleResponse(
          res,
          403,
          "Only delivery partner or franchise can update to Delivered",
        );
      }

      // Delivery Specific: Check if this order is assigned to this partner
      if (isDelivery && status === "Delivered") {
        const partnerId = req.delivery?._id || req.user?.id;
        if (
          !partnerId ||
          !order.deliveryPartnerId ||
          order.deliveryPartnerId.toString() !== partnerId.toString()
        ) {
          return handleResponse(res, 403, "This order is not assigned to you");
        }
      }
      // Delivered needs the customer's code (orders dispatched before codes existed have none)
      if (status === "Delivered" && (isDelivery || isFranchise)) {
        const check = await verifyDeliveryOtp(order._id, "customer", req.body?.otp);
        if (!check.ok) return handleResponse(res, check.status, check.message);
      }
      // User Specific: Check if user owns the order
      if (isUser) {
        if (order.userId.toString() !== req.user.id.toString()) {
          return handleResponse(
            res,
            403,
            "You can only update your own orders",
          );
        }
      }
    }

    // Stock validation for franchise
    if (status === "Packed" && isFranchise) {
      const franchiseId = req.franchise._id;
      const inventory = await Inventory.findOne({ franchiseId });

      if (!inventory) {
        return handleResponse(
          res,
          400,
          "Stock shortage. Ask admin to procure it.",
        );
      }

      const insufficientItems = [];
      for (const item of order.items) {
        const inventoryItem = inventory.items.find(
          (i) => i.productId.toString() === item.productId.toString(),
        );
        const availableStock = inventoryItem ? inventoryItem.currentStock : 0;
        if (availableStock < item.quantity) {
          insufficientItems.push(item.name || item.productId);
        }
      }

      if (insufficientItems.length > 0 && !order.allowPartialFulfillment) {
        return handleResponse(
          res,
          400,
          `Stock shortage for ${insufficientItems.join(", ")}. Ask admin to procure it.`,
        );
      }
    }

    // Accept number of packages when marking as packed
    if (status === "Packed" && req.body.numberOfPackages) {
      const packages = Number(req.body.numberOfPackages);
      if (!Number.isInteger(packages) || packages < 1) {
        return handleResponse(res, 400, "Please enter the number of packages as a whole number.");
      }
      if (isFranchise && packages > maxPackagesFor(order)) {
        return handleResponse(res, 400, `This order has ${maxPackagesFor(order)} units in total, so it cannot be packed in ${packages} packages.`);
      }
      order.numberOfPackages = packages;
    }

    // A COD customer may pay by UPI to the franchise's QR instead of giving cash
    const paidByFranchiseQr =
      status === "Delivered" && order.paymentMethod === "COD" && collectionMode === "upi_franchise_qr";
    if (paidByFranchiseQr) {
      const store = order.franchiseId ? await Franchise.findById(order.franchiseId).select("storeQRCode") : null;
      if (!store?.storeQRCode) {
        return handleResponse(res, 400, "This franchise has not uploaded a payment QR code, so the customer cannot pay by UPI. Please collect cash.");
      }
    }

    order.orderStatus = status;

    // Push to history
    let updatedBy = "system";
    if (isMasterAdmin) updatedBy = "masteradmin";
    else if (isFranchise) updatedBy = "franchise";
    else if (isDelivery) updatedBy = "delivery";
    else if (isUser) updatedBy = "user";

    order.statusHistory.push({
      status,
      updatedAt: new Date(),
      updatedBy,
    });

    if (status === "Delivered") {
      order.deliveredAt = new Date();

      if (order.paymentMethod === "COD") {
        const collectorId =
          req.delivery?._id || order.deliveryPartnerId || null;
        order.codTracking = order.codTracking || {};
        order.codTracking.isCollected = true;
        order.codTracking.collectedAmount = Number(order.totalAmount || 0);
        order.codTracking.collectedAt = new Date();
        order.codTracking.collectedByDeliveryId = collectorId;
        if (paidByFranchiseQr) {
          // The money went straight to the franchise, so the delivery partner holds no cash to hand over
          order.codTracking.collectionMode = "upi_franchise_qr";
          order.codTracking.remittanceStatus = "verified";
          order.codTracking.verifiedAt = new Date();
        } else {
          order.codTracking.collectionMode = "cash";
          order.codTracking.remittanceStatus = "pending";
        }
      }
    }

    // Auto-complete payment for COD/others if order is Delivered
    if (status === "Delivered") {
      if (order.paymentStatus === "Pending") {
        order.paymentStatus = "Completed";
      }
    }
    // Award loyalty points once when order is confirmed Delivered.
    if (status === "Delivered") {
      try {
        const user = await User.findById(order.userId);
        if (user) {
          user.walletTransactions = user.walletTransactions || [];
          const alreadyAwarded = user.walletTransactions.some(
            (txn) =>
              txn.type === "Loyalty Bonus" &&
              txn.referenceOrderId &&
              txn.referenceOrderId.toString() === order._id.toString(),
          );

          if (!alreadyAwarded) {
            const loyaltySetting = await GlobalSetting.findOne({
              key: "loyalty_config",
            });
            const cfg = loyaltySetting?.value || {};
            const awardRate = Math.max(0, Number(cfg.awardRate ?? 5));
            const points = Math.max(
              0,
              Math.floor((Number(order.totalAmount || 0) * awardRate) / 100),
            );

            if (points > 0) {
              user.loyaltyPoints = Number(user.loyaltyPoints || 0) + points;
              user.walletTransactions.unshift({
                txnId: `LYT-${Date.now()}`,
                type: "Loyalty Bonus",
                amount: points,
                status: "Success",
                note: `Loyalty bonus for order ${order._id}`,
                referenceOrderId: order._id,
                createdAt: new Date(),
              });
              await user.save();
              await createUserNotification({
                userId: user._id,
                type: "wallet",
                title: "Loyalty Bonus Added",
                message: `${points} loyalty points were added to your account for order #${order._id.toString().slice(-6)}.`,
                link: "/wallet",
                meta: {
                  orderId: order._id.toString(),
                  points,
                  transactionType: "loyalty_bonus",
                },
              });
            }
          }
        }
      } catch (loyaltyErr) {
        console.error("Loyalty award error during status update:", loyaltyErr);
      }
    }

    // Generate Bilty when order is out for delivery
    if (status === "Out for Delivery") {
      try {
        const fullOrder = await Order.findById(order._id)
          .populate("userId", "fullName mobile legalEntityName address")
          .populate(
            "deliveryPartnerId",
            "fullName mobile vehicleNumber vehicleType",
          )
          .populate("franchiseId", "franchiseName ownerName city");

        const biltyNumber = `BLT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        order.bilty = {
          biltyNumber,
          generatedAt: new Date(),
          numberOfPackages: order.numberOfPackages || 0,
          items: order.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          })),
          totalWeight: `${order.items.reduce((acc, i) => acc + (i.quantity || 0), 0)} Units`,
          fromFranchise:
            fullOrder.franchiseId?.franchiseName || "Kisaankart Franchise",
          toCustomer:
            fullOrder.userId?.legalEntityName ||
            fullOrder.userId?.fullName ||
            "Valued Customer",
          toAddress:
            order.shippingAddress ||
            fullOrder.userId?.address ||
            "Delivery Address",
          deliveryPartner:
            fullOrder.deliveryPartnerId?.fullName || "Not Assigned",
          vehicleNumber: fullOrder.deliveryPartnerId?.vehicleNumber || "N/A",
          vehicleType: fullOrder.deliveryPartnerId?.vehicleType || "N/A",
        };
      } catch (biltyErr) {
        console.error("Bilty generation error:", biltyErr);
      }
    }

    await order.save();

    // Deduct stock when the franchise packs the order. Compare with the status *before* this
    // update (order.orderStatus is already "Packed" here). Each item is taken atomically, so two
    // orders packed at the same time can't overwrite each other's stock change.
    if (status === "Packed" && isFranchise && currentStatus !== "Packed") {
      try {
        const franchiseId = req.franchise._id;
        for (const item of order.items) {
          const wanted = Number(item.quantity || 0);
          let packed = 0;
          if (!order.allowPartialFulfillment && (await takeStock(franchiseId, item.productId, wanted))) {
            packed = wanted;
          } else {
            packed = await takeStockUpTo(franchiseId, item.productId, wanted);
          }
          item.packedQuantity = packed;
        }
        await order.save();
      } catch (stockErr) {
        console.error("Stock deduction error during status update:", stockErr);
      }
    }

    // Put stock back when an order is cancelled after it was packed (by any role)
    if (
      status === "Cancelled" &&
      ["Packed", "Ready", "Dispatched", "Out for Delivery"].includes(currentStatus) &&
      order.franchiseId
    ) {
      try {
        for (const item of order.items) {
          const returnedQty = Number(item.packedQuantity || 0);
          if (returnedQty > 0) await addStock(order.franchiseId, item.productId, returnedQty);
        }
      } catch (stockErr) {
        console.error("Stock return error during status update:", stockErr);
      }
    }

    // Refund wallet/credit exactly once (shared with franchise rejection)
    if (status === "Cancelled") {
      try {
        await refundCancelledOrder(order._id, `cancelled by ${updatedBy}`);
      } catch (refundErr) {
        console.error("Refund error during status update:", refundErr);
      }
    }

    // Socket Broadcasts
    const populatedOrder = await Order.findById(order._id)
      .populate("userId", "fullName mobile")
      .populate(
        "deliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      )
      .populate("franchiseId", "franchiseName ownerName city");

    emitToAdmin("order_status_updated", populatedOrder);
    await createAdminNotification({
      type: "order_status_updated",
      title: "Order Status Updated",
      message: `Order #${order._id.toString().slice(-6)} moved to ${status}.`,
      link: "/masteradmin/orders",
      meta: {
        orderId: order._id.toString(),
        status,
      },
    });
    emitToOrderRoom(order._id, "order_status_changed", {
      orderId: order._id,
      status: status,
      updatedAt: new Date(),
    });

    if (order.franchiseId) {
      emitToFranchise(order.franchiseId, "order_status_changed", {
        orderId: order._id,
        status: status,
        updatedAt: new Date(),
      });
    }

    await createUserNotification({
      userId: order.userId,
      type: "order_update",
      title: "Order Status Updated",
      message: `Your order #${order._id.toString().slice(-6)} is now ${status}.`,
      link: `/order-detail/${order._id}`,
      meta: {
        orderId: order._id.toString(),
        status,
      },
    });

    return handleResponse(res, 200, `Order status updated to ${status}`, order);
  } catch (error) {
    console.error("Update order status error details:", error);
    return handleResponse(res, 500, "Server error: " + error.message);
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.productId")
      .populate("userId", "fullName mobile")
      .populate("franchiseId", "franchiseName ownerName mobile city")
      .populate("deliveryPartnerId", "fullName mobile")
      .sort({ createdAt: -1 });

    const enrichedOrders = await applyFranchiseStockShortageFlags(orders);

    const formattedOrders = enrichedOrders.map((order) => {
      const dateObj = new Date(order.createdAt);
      return {
        ...(order.toObject ? order.toObject() : order),
        date: dateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        }),
        time: dateObj.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }),
        scheduledDateFormatted: order.scheduledDate 
          ? new Date(order.scheduledDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              weekday: "short",
              timeZone: "Asia/Kolkata"
            })
          : null
      };
    });

    return handleResponse(res, 200, "All orders fetched", formattedOrders);
  } catch (error) {
    console.error("Get all orders error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * @desc Get detailed delivery tracking data for admin
 * @route GET /orders/admin/delivery-tracking
 * @access Private/Admin
 */
export const getAdminDeliveryTracking = async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ["Packed", "Dispatched", "Delivered", "Received"] },
    })
      .populate("userId", "fullName mobile")
      .populate("franchiseId", "shopName ownerName mobile cityArea address")
      .populate(
        "deliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      )
      .sort({ updatedAt: -1 });

    const trackingData = orders.map((order) => ({
      _id: order._id,
      status: order.orderStatus,
      amount: order.totalAmount,
      payment: order.paymentMethod,
      customer: {
        id: order.userId?._id,
        name: order.userId?.fullName || "Guest User",
        mobile: order.userId?.mobile,
        address: order.shippingAddress,
      },
      franchise: {
        id: order.franchiseId?._id,
        name: order.franchiseId?.shopName || "Main Hub",
        location: order.franchiseId?.cityArea,
        mobile: order.franchiseId?.mobile,
      },
      rider: {
        id: order.deliveryPartnerId?._id,
        name: order.deliveryPartnerId?.fullName || "Self/Not Assigned",
        mobile: order.deliveryPartnerId?.mobile,
        vehicle: order.deliveryPartnerId?.vehicleNumber,
      },
      timestamp: {
        created: order.createdAt,
        updated: order.updatedAt,
        delivered: order.deliveredAt,
      },
    }));

    return handleResponse(
      res,
      200,
      "Delivery tracking data fetched",
      trackingData,
    );
  } catch (error) {
    console.error("Get delivery tracking error:", error);
    return handleResponse(res, 500, "Internal server error: " + error.message);
  }
};

export const getFranchiseOrders = async (req, res) => {
  try {
    const franchise = req.franchise;
    const franchiseId = new mongoose.Types.ObjectId(franchise._id);
    const { date, includeOpen } = req.query;

    // Strict isolation: franchises see their assigned orders only. Optional open pool for legacy/manual
    // claim flows — pass ?includeOpen=true if you still need unassigned orders in the list.
    const shouldIncludeOpen = includeOpen === "true";

    // 1. Fetch orders explicitly assigned to this franchise
    const assignedQuery = { franchiseId };
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      assignedQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    let orders = await Order.find(assignedQuery)
      .populate("userId", "fullName mobile legalEntityName")
      .populate("user", "fullName mobile legalEntityName")
      .populate("items.productId")
      .populate(
        "deliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      )
      .sort({ createdAt: -1 });

    // 2. Fetch unassigned orders within proximity and served categories (Open Pool)
    if (shouldIncludeOpen) {
      const coords = franchise.location?.coordinates;
      const hasValidCoords = coords && coords[0] !== 0 && coords[1] !== 0;

      const openQuery = {
        franchiseId: null,
        orderStatus: { $in: ["Placed", "Assigned", "pending"] },
      };

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        openQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }

      // If franchise has a valid location, only show unassigned orders within 25km
      if (hasValidCoords) {
        openQuery.shippingLocation = {
          $near: {
            $geometry: { type: "Point", coordinates: coords },
            $maxDistance: 25000, // 25km radius
          },
        };
      }

      let openOrders = await Order.find(openQuery)
        .populate("userId", "fullName mobile legalEntityName")
        .populate("user", "fullName mobile legalEntityName")
        .populate("items.productId")
        .populate(
          "deliveryPartnerId",
          "fullName mobile vehicleNumber vehicleType",
        )
        .limit(50); // Sanity limit for open pool

      // 3. Filter open orders by category compatibility and rejections
      const servedCategoryIds = (franchise.servedCategories || []).map((id) =>
        id.toString(),
      );

      openOrders = openOrders.filter((order) => {
        // Skip if already attempted/rejected by this franchise
        const alreadyAttempted = (order.assignmentAttempts || []).some(
          (a) => a.franchiseId?.toString() === franchiseId.toString(),
        );
        if (alreadyAttempted) return false;

        // An order is compatible if EVERY item's category is in servedCategoryIds
        // If franchise has NO categories defined, assume they serve all (legacy support)
        if (servedCategoryIds.length === 0) return true;

        return order.items.every((item) => {
          const catId = item.productId?.category?.toString();
          return !catId || servedCategoryIds.includes(catId);
        });
      });

      // Merge results
      const existingIds = new Set(orders.map((o) => o._id.toString()));
      openOrders.forEach((o) => {
        if (!existingIds.has(o._id.toString())) {
          orders.push(o);
        }
      });

      // Re-sort combined list by createdAt descending
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (process.env.DEBUG_LOG_TO_FILE === "true") {
      const debugInfo = `\n[${new Date().toISOString()}] Fetching Orders for ${franchiseId}\nAssigned: ${orders.length} orders\n`;
      fs.appendFileSync("debug_log.txt", debugInfo);
    }

    // The franchise's return code is shown only while refused goods are on their way back
    const comingBack = orders.filter((o) => o.deliveryRefusal?.goodsStatus === "with_delivery" && !o.deliveryRefusal?.handedBackAt);
    const returnCodes = await otpsOf(comingBack.map((o) => o._id));

    const formattedOrders = orders.map((order) => {
      const dateObj = new Date(order.createdAt || Date.now());
      const isValidDate = !isNaN(dateObj.getTime());

      return {
        ...order.toObject(),
        returnOtpCode: returnCodes[String(order._id)]?.franchiseCode || null,
        date: isValidDate
          ? dateObj.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            })
          : "N/A",
        time: isValidDate
          ? dateObj.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "N/A",
        scheduledDateFormatted: order.scheduledDate 
          ? new Date(order.scheduledDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              weekday: "short",
              timeZone: "Asia/Kolkata"
            })
          : null
      };
    });

    return handleResponse(
      res,
      200,
      "Franchise orders fetched",
      formattedOrders,
    );
  } catch (error) {
    if (process.env.DEBUG_LOG_TO_FILE === "true") {
      const errInfo = `\n[${new Date().toISOString()}] ERROR in getFranchiseOrders: ${error.message}\nStack: ${error.stack}\n`;
      fs.appendFileSync("debug_log.txt", errInfo);
    }
    console.error("Fetch franchise orders error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

// Get franchise order by ID (only if it belongs to this franchise)
export const getFranchiseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const franchiseId = req.franchise._id;

    const order = await Order.findById(id)
      .populate("userId", "fullName mobile address legalEntityName")
      .populate(
        "deliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      )
      .populate(
        "returnRequests.pickupDeliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      );

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (
      !order.franchiseId ||
      order.franchiseId.toString() !== franchiseId.toString()
    ) {
      return handleResponse(res, 403, "Not authorized to view this order");
    }

    return handleResponse(res, 200, "Order details fetched", order);
  } catch (error) {
    console.error("Get franchise order error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

// Accept assigned order (Franchise acknowledgment)
export const acceptFranchiseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const franchiseId = req.franchise._id;

    const order = await Order.findById(id);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (
      order.orderStatus === "Accepted" &&
      order.franchiseId?.toString() === franchiseId.toString()
    ) {
      return handleResponse(res, 200, "Order already accepted", order);
    }

    // Allow status transition from Assigned OR Placed/pending (for open pool orders)
    const validStates = ["Assigned", "Placed", "pending", "new"];
    if (!validStates.includes(order.orderStatus)) {
      return handleResponse(
        res,
        400,
        "Order is not in a valid state for acceptance",
      );
    }

    // If it's already assigned to someone else
    if (
      order.franchiseId &&
      order.franchiseId.toString() !== franchiseId.toString()
    ) {
      return handleResponse(
        res,
        403,
        "This order is already assigned to another franchise",
      );
    }

    // If it's an open order (franchiseId is null), claim it
    if (!order.franchiseId) {
      order.franchiseId = franchiseId;
      order.franchiseAutoAccepted = false;
    }

    // Change status to Accepted
    order.orderStatus = "Accepted";

    // INVENTORY CHECK: Flag shortages for Admin Procurement
    const inventory = await Inventory.findOne({ franchiseId });
    if (inventory) {
      order.items = order.items.map((item) => {
        const invItem = inventory.items.find(
          (i) => i.productId.toString() === item.productId.toString(),
        );
        const availableStock = invItem ? invItem.currentStock : 0;

        if (availableStock < item.quantity) {
          item.isShortage = true;
          item.shortageQty = item.quantity - availableStock;
        } else {
          item.isShortage = false;
          item.shortageQty = 0;
        }
        return item;
      });
    }

    order.statusHistory.push({
      status: "Accepted",
      updatedAt: new Date(),
      updatedBy: "franchise",
    });

    await order.save();

    // Trigger Delivery Assignment logic
    assignDeliveryToOrder(order._id);

    return handleResponse(res, 200, "Order accepted successfully", order);
  } catch (error) {
    console.error("Accept order error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * Franchise rejects an auto-assigned order → unassign and try next nearest franchise (same category rules).
 */
export const rejectFranchiseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const franchiseId = req.franchise._id;
    const reason = String(req.body?.reason || "").trim();

    const order = await Order.findById(id);
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    if (!order.franchiseId || order.franchiseId.toString() !== franchiseId.toString()) {
      return handleResponse(
        res,
        403,
        "This order is not assigned to your franchise",
      );
    }

    const allowed = ["Accepted", "Placed", "Assigned"];
    if (!allowed.includes(order.orderStatus)) {
      return handleResponse(
        res,
        400,
        "Order cannot be rejected in its current state",
      );
    }

    order.assignmentAttempts.push({
      franchiseId,
      attemptedAt: new Date(),
      reason: "rejected",
    });

    // Permanent rejection logic (no reassignment as per request)
    order.orderStatus = "Cancelled";
    order.statusHistory.push({
      status: "Cancelled",
      updatedAt: new Date(),
      updatedBy: reason ? `franchise_reject:${reason.slice(0, 80)}` : "franchise_reject",
    });

    await order.save();

    // Refund exactly once (also covers Wallet + Online and the online part of Credit + Online)
    let refundResult = { refunded: false, walletRefund: 0, creditRestore: 0 };
    try {
      refundResult = await refundCancelledOrder(order._id, "rejected by franchise");
    } catch (refundErr) {
      console.error("[rejectFranchiseOrder] Refund error:", refundErr);
    }
    const refundText = refundResult.walletRefund > 0 && refundResult.creditRestore > 0
      ? ` ₹${refundResult.walletRefund} has been added back to your wallet and ₹${refundResult.creditRestore} to your KK Credit.`
      : refundResult.walletRefund > 0
        ? ` ₹${refundResult.walletRefund} has been added back to your wallet.`
        : refundResult.creditRestore > 0
          ? ` ₹${refundResult.creditRestore} has been added back to your KK Credit.`
          : "";
    try {
      await createUserNotification({
        userId: order.userId,
        type: "order_update",
        title: "Order Cancelled",
        message: `Sorry, the assigned store cannot fulfil your order #${order._id.toString().slice(-6)}, so it has been cancelled.${refundText}`,
        link: `/order-detail/${order._id}`,
        meta: { orderId: order._id.toString(), status: "Cancelled" },
      });
    } catch (notifyErr) {
      console.error("[rejectFranchiseOrder] Notification error:", notifyErr);
    }

    const updated = await Order.findById(order._id)
      .populate("userId", "fullName mobile")
      .populate("franchiseId", "franchiseName ownerName");

    const franchiseName = updated?.franchiseId?.franchiseName || updated?.franchiseId?.ownerName || "Unknown Franchise";
    const userName = updated?.userId?.fullName || "Guest User";
    const userMobile = updated?.userId?.mobile || "N/A";

    emitToAdmin("order_franchise_rejected", {
      orderId: order._id,
      rejectedByFranchiseId: franchiseId,
      franchiseName,
      userName,
      reason: reason || null,
    });

    await createAdminNotification({
      type: "order_franchise_rejected",
      title: "Order Cancelled by Franchise",
      message: `Order #${order._id.toString().slice(-6)} from ${userName} (${userMobile}) was cancelled by ${franchiseName}${reason ? `: ${reason}` : "."}`,
      link: "/masteradmin/orders",
      meta: {
        orderId: order._id.toString(),
        rejectedByFranchiseId: franchiseId.toString(),
        franchiseName,
        userName,
        reason: reason || "",
      },
    });

    // Real-time update for the user module
    emitToOrderRoom(order._id, "order_rejected_by_store", {
      orderId: order._id,
      status: "Cancelled",
      message: `The assigned store could not fulfil your order, so it has been cancelled.${refundText}`
    });
    
    emitToOrderRoom(order._id, "order_status_changed", {
      orderId: order._id,
      status: "Cancelled",
      message: "Order cancelled by store." 
    });

    await createUserNotification({
      userId: order.userId,
      type: "order_update",
      title: "Order Cancelled",
      message: "The assigned store is currently unavailable; your order has been cancelled and refunded.",
      link: `/order-detail/${order._id}`,
      meta: {
          orderId: order._id.toString(),
          status: "Cancelled",
      },
    });

    await sendNotificationToUser(order.userId, {
      title: "Order Cancelled",
      body: "The assigned store is currently unavailable; your order has been cancelled and refunded.",
      data: {
          type: "order_update",
          orderId: order._id.toString(),
          status: "Cancelled"
      }
    }, "user");

    return handleResponse(res, 200, "Order rejected and cancelled successfully", updated);
  } catch (error) {
    console.error("Reject franchise order error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

// Assign delivery partner to order
// A customer's order is packed exactly as ordered, so the number of boxes/bags cannot be more than the
// number of units ordered (e.g. 41 kg can be at most 41 packages).
const maxPackagesFor = (order) => {
  const units = (order.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  return Math.min(500, Math.max(1, Math.ceil(units)));
};

/**
 * PUT /orders/franchise/:id/packages  { numberOfPackages }
 * Lets the franchise enter (or fix) how many boxes/bags an order is packed in. Needed for orders the
 * system packed automatically after vendor stock arrived, which have no count yet.
 */
export const setOrderPackageCount = async (req, res) => {
  try {
    const { id } = req.params;
    const count = Number(req.body?.numberOfPackages);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      return handleResponse(res, 400, "Please enter the number of packages (a whole number from 1 to 500).");
    }
    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");
    if (!order.franchiseId || order.franchiseId.toString() !== req.franchise._id.toString()) {
      return handleResponse(res, 403, "Not authorized to manage this order");
    }
    if (count > maxPackagesFor(order)) {
      return handleResponse(res, 400, `This order has ${maxPackagesFor(order)} units in total, so it cannot be packed in ${count} packages.`);
    }
    if (!["Packed", "Ready"].includes(order.orderStatus)) {
      return handleResponse(res, 400, "The package count can only be set while the order is packed and waiting for dispatch.");
    }
    order.numberOfPackages = count;
    order.statusHistory.push({
      status: order.orderStatus,
      updatedAt: new Date(),
      updatedBy: "franchise",
      message: `Package count entered: ${count}`,
    });
    await order.save();
    return handleResponse(res, 200, "Package count saved", { _id: order._id, numberOfPackages: order.numberOfPackages });
  } catch (error) {
    console.error("setOrderPackageCount:", error);
    return handleResponse(res, 500, "Could not save the package count");
  }
};

export const assignDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryPartnerId } = req.body;
    const franchiseId = req.franchise._id;

    const order = await Order.findById(id);

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    // Authorization check
    if (!order.franchiseId) {
      // Auto-assign broadcast order to this franchise when dispatching
      order.franchiseId = franchiseId;
      order.franchiseAutoAccepted = false;
    } else if (order.franchiseId.toString() !== franchiseId.toString()) {
      return handleResponse(res, 403, "Not authorized to manage this order");
    }

    if (!deliveryPartnerId) {
      return handleResponse(res, 400, "Delivery partner ID is required");
    }

    // Dispatch only packed orders (packing is where stock is deducted); allow re-assigning
    // the partner of an order that is already dispatched but not yet picked up.
    if (!["Packed", "Ready", "Dispatched"].includes(order.orderStatus)) {
      return handleResponse(
        res,
        400,
        order.orderStatus === "Accepted" || order.orderStatus === "Placed" || order.orderStatus === "Procuring"
          ? "Please pack this order before assigning a delivery partner."
          : `This order is already "${order.orderStatus}" and can't be assigned for delivery.`,
      );
    }

    // The delivery slip prints the package count, so it must be known before dispatch
    if (order.orderStatus !== "Dispatched" && !(Number(order.numberOfPackages) > 0)) {
      return handleResponse(res, 400, "Please enter how many packages this order is packed in before assigning a delivery partner.");
    }

    const partner = await Delivery.findById(deliveryPartnerId).select("isApproved status fullName");
    if (!partner || !partner.isApproved || partner.status === "blocked") {
      return handleResponse(res, 400, "This delivery partner is not available. Please choose another partner.");
    }

    // Check for stock shortages before allowing dispatch
    const hasShortage = order.items.some(i => i.isShortage);
    if (hasShortage && !order.allowPartialFulfillment) {
      return handleResponse(
        res,
        400,
        "Cannot dispatch order with stock shortages. Please request procurement or wait for Admin permission to 'Allow Available' stock delivery."
      );
    }

    order.deliveryPartnerId = deliveryPartnerId;
    order.orderStatus = "Dispatched";
    order.statusHistory.push({
      status: "Dispatched",
      updatedAt: new Date(),
      updatedBy: "franchise",
    });

    await order.save();

    // Fresh delivery codes for this hand-over; the customer gets theirs now
    const { customerCode } = await createDeliveryOtps(order._id);
    emitToOrderRoom(order._id, "order_status_changed", { orderId: order._id, status: "Dispatched", updatedAt: new Date() });
    try {
      await createUserNotification({
        userId: order.userId,
        type: "order_update",
        title: "Order on the way",
        message: `Your order #${order._id.toString().slice(-6)} is out for delivery. Your delivery code is ${customerCode}. Share it with the delivery partner only when you receive your order.`,
        link: `/order-detail/${order._id}`,
        meta: { orderId: order._id.toString(), status: "Dispatched" },
      });
    } catch (notifyErr) {
      console.error("[assignDeliveryPartner] OTP notification error:", notifyErr);
    }

    console.log(
      "[AssignDeliveryPartner] Order dispatched with delivery partner",
      {
        orderId: order._id.toString(),
        deliveryPartnerId: deliveryPartnerId.toString(),
      },
    );

    // Note: Stock deduction is now handled in updateOrderStatus when status changes to "Packed"
    // So we don't need to deduct it again here.

    console.log(
      `🚚 Order ${id} dispatched by franchise ${franchiseId} via partner ${deliveryPartnerId}`,
    );

    // Send Real-time Notification
    emitToDelivery(deliveryPartnerId, "new_task", {
      orderId: order._id,
      type: "DELIVERY",
      message: `New delivery task assigned: #${order._id.toString().slice(-6)}`,
    });

    // Send Push Notification (standardized payload for delivery assignment)
    sendNotificationToUser(
      deliveryPartnerId,
      {
        title: "New Delivery Task",
        body: `You have been assigned a new delivery task for order #${order._id.toString().slice(-6)}.`,
        data: {
          type: "new_delivery",
          notificationCategory: "assignment",
          source: "franchise",
          orderId: order._id.toString(),
          link: `/delivery/assignments/${order._id}`,
        },
      },
      "delivery",
    );

    return handleResponse(res, 200, "Order dispatched successfully", order);
  } catch (error) {
    console.error("Assign delivery partner error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

// Get dispatched orders for delivery partner
export const getDispatchedOrders = async (req, res) => {
  try {
    const partnerId = req.delivery?._id;
    const orders = await Order.find({
      orderStatus: "Dispatched",
      deliveryPartnerId: partnerId,
    })
      .populate("userId", "fullName mobile address")
      .populate("franchiseId", "franchiseName city area mobile location formattedAddress storeQRCode")
      .sort({ updatedAt: -1 });

    // Map to format delivery app expects
    const formatted = orders.map((order) => {
      let distance = "N/A";

      // Calculate real distance if coords available (GeoJSON uses [lng, lat])
      const fLoc = order.franchiseId?.location?.coordinates;
      const sLoc = order.shippingLocation?.coordinates;

      if (
        Array.isArray(fLoc) &&
        fLoc.length === 2 &&
        Array.isArray(sLoc) &&
        sLoc.length === 2
      ) {
        const d = getDistance(
          fLoc[1], // latitude
          fLoc[0], // longitude
          sLoc[1], // latitude
          sLoc[0], // longitude
        );
        distance = d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
      }

      const franchiseAddr = order.franchiseId?.formattedAddress ||
        [order.franchiseId?.area, order.franchiseId?.city].filter(Boolean).join(', ') ||
        "N/A";

      // The customer's pinned drop point; [0, 0] is the "not set" default, so treat it as missing
      const sLng = Number(sLoc?.[0]);
      const sLat = Number(sLoc?.[1]);
      const customerLocation =
        Number.isFinite(sLat) && Number.isFinite(sLng) && (sLat !== 0 || sLng !== 0)
          ? { lat: sLat, lng: sLng }
          : null;

      return {
        id: order._id,
        _id: order._id,
        customerLocation,
        franchise: order.franchiseId?.franchiseName || "Kisaankart Store",
        franchiseAddress: franchiseAddr,
        franchiseQrCode: order.franchiseId?.storeQRCode || null,
        needsDeliveryCode: !!order.deliveryOtp?.generatedAt,
        customerName: order.userId?.fullName || "Customer",
        customerAddress: order.shippingAddress,
        distance: distance,
        itemsCount: order.items.reduce((acc, item) => acc + item.quantity, 0),
        numberOfPackages: order.numberOfPackages || 0,
        items: order.items,
        timeWindow: "20-30 mins",
        priority: "medium",
        amount: 50, // Delivery earnings per order
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        status: order.orderStatus,
        orderStatus: order.orderStatus,
        scheduledDate: order.scheduledDate,
        scheduledDateFormatted: order.scheduledDate
          ? new Date(order.scheduledDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              timeZone: "Asia/Kolkata",
            })
          : null,
        deliveryShift: order.deliveryShift,
        isPreOrder: order.isPreOrder,
        franchiseId: order.franchiseId,
        userId: order.userId,
        shippingAddress: order.shippingAddress,
        codTracking: order.codTracking || {},
      };
    });

    return handleResponse(res, 200, "Dispatched orders fetched", formatted);
  } catch (error) {
    console.error("Get dispatched orders error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

const REFUSAL_REASONS = {
  customer_refused: "Customer refused to take the order",
  product_damaged: "Product is damaged or spoiled",
  wrong_item: "Wrong or missing item",
  quality_not_ok: "Customer not happy with the quality",
  customer_unavailable: "Customer not available / not reachable",
  other: "Other",
};

/**
 * PUT /orders/delivery/:id/refused-at-door  { reason, note }
 * The delivery partner is at the customer's door and the customer does not take the order (or the
 * goods are not acceptable). The order is cancelled, any prepaid money goes back to the customer,
 * and the goods are tracked as coming back to the franchise (see confirmRefusedGoodsReturned).
 */
export const refuseOrderAtDoor = async (req, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.delivery?._id;
    if (!partnerId) return handleResponse(res, 401, "Unauthorized");

    const reason = String(req.body?.reason || "");
    const note = String(req.body?.note || "").trim().slice(0, 300);
    if (!REFUSAL_REASONS[reason]) return handleResponse(res, 400, "Please choose why the order was not accepted.");
    if (reason === "other" && !note) return handleResponse(res, 400, "Please write a short note about what happened.");

    const label = REFUSAL_REASONS[reason];
    const now = new Date();
    // One atomic claim, so a double tap (or a second device) cannot cancel and refund twice
    const order = await Order.findOneAndUpdate(
      { _id: id, deliveryPartnerId: partnerId, orderStatus: { $in: ["Dispatched", "Out for Delivery"] } },
      {
        $set: {
          orderStatus: "Cancelled",
          deliveryRefusal: {
            reason,
            reasonLabel: label,
            note,
            refusedAt: now,
            deliveryPartnerId: partnerId,
            goodsStatus: "with_delivery",
            handedBackAt: null,
            resolvedAt: null,
          },
        },
        $push: {
          statusHistory: {
            status: "Cancelled",
            updatedAt: now,
            updatedBy: `delivery_refused:${label.slice(0, 60)}`,
          },
        },
      },
      { new: true },
    );

    if (!order) {
      const existing = await Order.findById(id).select("deliveryPartnerId orderStatus");
      if (!existing) return handleResponse(res, 404, "Order not found");
      if (!existing.deliveryPartnerId || existing.deliveryPartnerId.toString() !== partnerId.toString()) {
        return handleResponse(res, 403, "This order is not assigned to you");
      }
      return handleResponse(res, 400, "This order is no longer out for delivery");
    }

    let refundResult = { refunded: false, walletRefund: 0, creditRestore: 0 };
    try {
      refundResult = await refundCancelledOrder(order._id, "not accepted at delivery");
    } catch (refundErr) {
      console.error("[refuseOrderAtDoor] Refund error:", refundErr);
    }

    const shortId = order._id.toString().slice(-6);
    const refundText = refundResult.walletRefund > 0 && refundResult.creditRestore > 0
      ? ` ₹${refundResult.walletRefund} has been added back to your wallet and ₹${refundResult.creditRestore} to your KK Credit.`
      : refundResult.walletRefund > 0
        ? ` ₹${refundResult.walletRefund} has been added back to your wallet.`
        : refundResult.creditRestore > 0
          ? ` ₹${refundResult.creditRestore} has been added back to your KK Credit.`
          : "";

    try {
      await createUserNotification({
        userId: order.userId,
        type: "order_update",
        title: "Order not delivered",
        message: `Your order #${shortId} was not accepted at delivery (${label}), so it has been cancelled.${refundText}`,
        link: `/order-detail/${order._id}`,
        meta: { orderId: order._id.toString(), status: "Cancelled" },
      });
    } catch (notifyErr) {
      console.error("[refuseOrderAtDoor] Notification error:", notifyErr);
    }

    const payload = {
      orderId: order._id,
      status: "Cancelled",
      reason: label,
      note,
      deliveryPartnerName: req.delivery?.fullName || "",
      updatedAt: now,
    };
    emitToOrderRoom(order._id, "order_status_changed", { orderId: order._id, status: "Cancelled", updatedAt: now });
    if (order.franchiseId) {
      emitToFranchise(order.franchiseId, "order_refused_at_door", payload);
      emitToFranchise(order.franchiseId, "order_status_changed", { orderId: order._id, status: "Cancelled", updatedAt: now });
    }
    emitToAdmin("order_refused_at_door", payload);
    try {
      await createAdminNotification({
        type: "order_refused_at_door",
        title: "Order not accepted at delivery",
        message: `Order #${shortId} was not accepted by the customer (${label}).${note ? ` Note: ${note}` : ""}`,
        link: "/masteradmin/orders",
        meta: { orderId: order._id.toString(), status: "Cancelled" },
      });
    } catch (notifyErr) {
      console.error("[refuseOrderAtDoor] Admin notification error:", notifyErr);
    }

    return handleResponse(res, 200, "Order marked as not accepted by the customer", {
      _id: order._id,
      orderStatus: order.orderStatus,
      refundedToWallet: refundResult.walletRefund,
      creditRestored: refundResult.creditRestore,
    });
  } catch (error) {
    console.error("refuseOrderAtDoor error:", error);
    return handleResponse(res, 500, "Could not mark the order as not accepted");
  }
};

/**
 * PUT /orders/franchise/:id/refused-goods  { action: "restock" | "write_off" }
 * The delivery partner brought the refused goods back. Good goods go back into the franchise's
 * stock; spoiled or damaged goods are written off and do not.
 */
export const confirmRefusedGoodsReturned = async (req, res) => {
  try {
    const { id } = req.params;
    const action = String(req.body?.action || "");
    if (!["restock", "write_off"].includes(action)) {
      return handleResponse(res, 400, "Action must be restock or write_off");
    }

    const existing = await Order.findById(id).select("+deliveryOtp.franchiseCode");
    if (!existing) return handleResponse(res, 404, "Order not found");
    if (!existing.franchiseId || existing.franchiseId.toString() !== req.franchise._id.toString()) {
      return handleResponse(res, 403, "Not authorized to manage this order");
    }
    if (existing.deliveryRefusal?.goodsStatus === "with_delivery" && existing.deliveryOtp?.franchiseCode && !existing.deliveryRefusal?.handedBackAt) {
      return handleResponse(res, 400, "The delivery partner has not handed the goods back yet. Give them your return code when they bring the goods.");
    }

    // Claim atomically so the stock can only be put back once
    const order = await Order.findOneAndUpdate(
      { _id: id, "deliveryRefusal.goodsStatus": "with_delivery" },
      {
        $set: {
          "deliveryRefusal.goodsStatus": action === "restock" ? "restocked" : "written_off",
          "deliveryRefusal.resolvedAt": new Date(),
        },
      },
      { new: true },
    );
    if (!order) return handleResponse(res, 400, "There are no returned goods waiting for this order");

    if (action === "restock") {
      for (const item of order.items) {
        const qty = Number(item.packedQuantity || 0);
        if (qty > 0) await addStock(order.franchiseId, item.productId, qty);
      }
    }

    return handleResponse(
      res,
      200,
      action === "restock" ? "Goods added back to your stock" : "Goods written off (not added to stock)",
      { _id: order._id, goodsStatus: order.deliveryRefusal.goodsStatus },
    );
  } catch (error) {
    console.error("confirmRefusedGoodsReturned error:", error);
    return handleResponse(res, 500, "Could not update the returned goods");
  }
};

/**
 * GET /orders/delivery/returns-to-franchise
 * Orders the customer did not take that this partner still has to bring back to the franchise.
 */
export const getReturnsToFranchise = async (req, res) => {
  try {
    const partnerId = req.delivery?._id;
    const orders = await Order.find({
      "deliveryRefusal.deliveryPartnerId": partnerId,
      "deliveryRefusal.goodsStatus": "with_delivery",
      "deliveryRefusal.handedBackAt": null,
    })
      .populate("franchiseId", "franchiseName mobile city area formattedAddress")
      .populate("userId", "fullName")
      .sort({ "deliveryRefusal.refusedAt": -1 })
      .lean();
    return handleResponse(res, 200, "Goods to return", orders.map((o) => ({
      _id: o._id,
      franchiseName: o.franchiseId?.franchiseName || "Franchise",
      franchiseMobile: o.franchiseId?.mobile || "",
      franchiseAddress: o.franchiseId?.formattedAddress || [o.franchiseId?.area, o.franchiseId?.city].filter(Boolean).join(", "),
      customerName: o.userId?.fullName || "Customer",
      reason: o.deliveryRefusal?.reasonLabel || "",
      refusedAt: o.deliveryRefusal?.refusedAt,
      numberOfPackages: o.numberOfPackages || 0,
      items: (o.items || []).map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
    })));
  } catch (error) {
    console.error("getReturnsToFranchise error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

/**
 * PUT /orders/delivery/:id/handed-back  { otp }
 * The partner hands refused goods back to the franchise; the franchise's code confirms it.
 */
export const handBackToFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.delivery?._id;
    const order = await Order.findById(id).select("deliveryRefusal franchiseId");
    if (!order) return handleResponse(res, 404, "Order not found");
    if (String(order.deliveryRefusal?.deliveryPartnerId) !== String(partnerId)) {
      return handleResponse(res, 403, "This order is not yours to return");
    }
    if (order.deliveryRefusal?.goodsStatus !== "with_delivery" || order.deliveryRefusal?.handedBackAt) {
      return handleResponse(res, 400, "These goods have already been handed back");
    }

    const check = await verifyDeliveryOtp(order._id, "franchise", req.body?.otp);
    if (!check.ok) return handleResponse(res, check.status, check.message);

    const updated = await Order.findOneAndUpdate(
      { _id: id, "deliveryRefusal.handedBackAt": null },
      { $set: { "deliveryRefusal.handedBackAt": new Date() } },
      { new: true },
    );
    if (!updated) return handleResponse(res, 400, "These goods have already been handed back");

    if (order.franchiseId) {
      emitToFranchise(order.franchiseId, "order_status_changed", {
        orderId: order._id,
        status: "Cancelled",
        message: `Goods of refused order #${order._id.toString().slice(-6)} are back. Add them to stock or write them off.`,
        updatedAt: new Date(),
      });
    }
    return handleResponse(res, 200, "Goods handed back to the franchise", { _id: updated._id, handedBackAt: updated.deliveryRefusal.handedBackAt });
  } catch (error) {
    console.error("handBackToFranchise error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

// Reject a delivery task (return back to Packed state)
export const rejectDeliveryTask = async (req, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.delivery?._id || req.user?.id;

    if (!partnerId) return handleResponse(res, 401, "Unauthorized");

    const order = await Order.findById(id);
    if (!order) return handleResponse(res, 404, "Order not found");

    // Only the partner the order is assigned to can hand it back, and only before pickup
    if (!order.deliveryPartnerId || order.deliveryPartnerId.toString() !== partnerId.toString()) {
      return handleResponse(res, 403, "This order is not assigned to you");
    }
    if (!["Dispatched", "Ready", "Packed"].includes(order.orderStatus)) {
      return handleResponse(res, 400, `This order is already "${order.orderStatus}" and can no longer be rejected.`);
    }

    // Clear partner and reset status
    order.deliveryPartnerId = null;
    order.orderStatus = "Packed";
    order.statusHistory.push({
      status: "Task Rejected",
      updatedAt: new Date(),
      updatedBy: "delivery",
    });

    await order.save();

    // Notify franchise/admin if needed
    if (order.franchiseId) {
      emitToFranchise(order.franchiseId, "ORDER_REJECTED", { orderId: id });
    }

    return handleResponse(res, 200, "Task rejected successfully");
  } catch (error) {
    console.error("Reject delivery task error:", error);
    return handleResponse(res, 500, "Server error");
  }
};

// Get completed orders for delivery partner (History)
export const getDeliveryOrderHistory = async (req, res) => {
  try {
    const partnerId = req.delivery?._id;
    // Find orders that are delivered or received and assigned to this partner
    const orders = await Order.find({
      orderStatus: { $in: ["Delivered", "Received"] },
      deliveryPartnerId: partnerId,
    })
      .populate("userId", "fullName")
      .populate("franchiseId", "franchiseName formattedAddress area city")
      .sort({ updatedAt: -1 });

    const formatted = orders.map((order) => {
      const dateObj = new Date(order.updatedAt);
      const franchiseAddr = order.franchiseId?.formattedAddress || 
        [order.franchiseId?.area, order.franchiseId?.city].filter(Boolean).join(', ') || 
        "N/A";
      return {
        id: order._id,
        customer: order.userId?.fullName || "Customer",
        franchiseName: order.franchiseId?.franchiseName || "Kisaankart Store",
        franchiseAddress: franchiseAddr,
        items: order.items,
        numberOfPackages: order.numberOfPackages || 0,
        status: "delivered",
        date: dateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        }),
        rawDate: dateObj.toISOString(),
        time: dateObj.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }),
      };
    });

    return handleResponse(res, 200, "Delivery history fetched", formatted);
  } catch (error) {
    console.error("Get delivery history error:", error);
    return handleResponse(res, 500, "Server error");
  }
};
