import razorpay from "../utils/razorpay.js";
import crypto from "crypto";
import handleResponse from "../utils/helper.js";
import Order from "../models/order.js";
import Cart from "../models/cart.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import {
    computeSplitCheckoutPayload,
    resolveCheckoutCoordinates,
} from "../utils/checkoutOrderSplit.js";
import { assignOrderToFranchise } from "../utils/assignment.js";
import { resolveDeliverySchedule, getDeliveryOffDays } from "../utils/deliverySchedule.js";
import { CREDIT_BLOCKED_MESSAGE } from "../constants/credit.js";
import { acquireUserLock, releaseUserLock } from "../utils/userLock.js";
import { emitToAdmin } from "../lib/socket.js";
import { createUserNotification } from "../utils/userNotification.js";
import { createAdminNotification } from "../utils/adminNotification.js";

const ONLINE_METHODS = ["UPI", "Card", "Wallet + Online", "Credit + Online"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fail = (status, message) => ({ ok: false, status, message });

/**
 * Works out, on the server, how much of the order is paid online. Used both when the
 * Razorpay order is created and again when the payment is verified, so the amount the
 * customer pays can't be changed from the browser.
 */
async function computeOnlineCheckout(userId, orderData) {
    if (!orderData || !orderData.shippingAddress || !orderData.paymentMethod || !orderData.deliveryShift) {
        return fail(400, "Missing shipping address, payment method, or delivery shift");
    }
    const { shippingAddress, shippingLocation, paymentMethod } = orderData;
    if (!ONLINE_METHODS.includes(paymentMethod)) {
        return fail(400, "This payment method does not use online payment");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
        return fail(400, "Your cart is empty. Please add items and try again.");
    }

    const user = await User.findById(userId);
    if (!user) return fail(404, "User not found");
    if (user.usedCredit > 0 && user.creditOverdueDate && new Date() > new Date(user.creditOverdueDate)) {
        return fail(403, "Payment Overdue: Please clear your KK Credit balance to continue shopping.");
    }
    // Checked again at verification; if the admin blocks credit mid-payment, that step refunds
    if (paymentMethod === "Credit + Online" && user.creditBlocked) {
        return fail(403, CREDIT_BLOCKED_MESSAGE);
    }

    const resolvedLocation = await resolveCheckoutCoordinates(shippingAddress, shippingLocation);
    if (!resolvedLocation) {
        return fail(400, "Valid delivery location is required. Please pick your location on the map and try again.");
    }

    const split = await computeSplitCheckoutPayload({
        cart,
        userId,
        couponCode: orderData.couponCode || "",
        resolvedLocation,
    });
    if (!split.ok) return fail(split.status, split.message);

    const grandTotal = Number(split.payload.grandTotal || 0);
    const requestedWallet = Number(orderData.walletAmountUsed || 0);
    const requestedCredit = Number(orderData.creditAmountUsed || 0);
    const walletAmountUsed = paymentMethod === "Wallet + Online"
        ? round2(Math.min(Number.isFinite(requestedWallet) ? requestedWallet : 0, Number(user.walletBalance || 0), grandTotal))
        : 0;
    const availableCredit = Math.max(0, Number(user.creditLimit || 0) - Number(user.usedCredit || 0));
    const creditAmountUsed = paymentMethod === "Credit + Online"
        ? round2(Math.min(Number.isFinite(requestedCredit) ? requestedCredit : 0, availableCredit, grandTotal))
        : 0;
    const onlineAmountPaid = round2(grandTotal - walletAmountUsed - creditAmountUsed);

    if (paymentMethod === "Wallet + Online" && walletAmountUsed <= 0) {
        return fail(400, "Wallet amount is required for split payment");
    }
    if (paymentMethod === "Credit + Online" && creditAmountUsed <= 0) {
        return fail(400, "Credit amount is required for split payment");
    }
    if (onlineAmountPaid < 1) {
        return fail(400, "Online payment amount must be at least ₹1");
    }

    return { ok: true, cart, user, split: split.payload, grandTotal, walletAmountUsed, creditAmountUsed, onlineAmountPaid };
}

/** Best-effort automatic refund when a captured payment can't be turned into an order. */
async function refundRazorpayPayment(paymentId, reason) {
    try {
        await razorpay.payments.refund(paymentId, { notes: { reason: String(reason).slice(0, 250) } });
        console.warn(`[Payment] Refunded payment ${paymentId}: ${reason}`);
        return true;
    } catch (err) {
        console.error(`[Payment] AUTO-REFUND FAILED for ${paymentId} (${reason}) — refund manually in Razorpay:`, err?.error || err?.message);
        try {
            await createAdminNotification({
                type: "payment_refund_needed",
                title: "Manual refund needed",
                message: `Payment ${paymentId} could not be turned into an order and the automatic refund failed. Please refund it from the Razorpay dashboard. Reason: ${reason}`,
                link: "/masteradmin/orders",
                meta: { paymentId, reason },
            });
        } catch {}
        return false;
    }
}

export const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        let amount;
        let notes = { type: "order_checkout", userId: String(userId) };

        if (req.body.orderData) {
            // Check the delivery day before taking money: an order for a closed day (holiday,
            // weekly off) must be stopped here, not after the customer has paid.
            const schedule = resolveDeliverySchedule(
                req.body.orderData.scheduledDate,
                req.body.orderData.deliveryShift,
                new Date(),
                await getDeliveryOffDays(),
            );
            if (!schedule.ok) return handleResponse(res, schedule.status, schedule.message);

            // Amount decided by the server from the cart, never by the browser
            const checkout = await computeOnlineCheckout(userId, req.body.orderData);
            if (!checkout.ok) return handleResponse(res, checkout.status, checkout.message);
            amount = checkout.onlineAmountPaid;
            notes = { ...notes, expectedAmount: String(amount) };
        } else {
            // Older app versions send only an amount; it is still checked during verification
            amount = Number(req.body.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                return handleResponse(res, 400, "A valid payment amount is required");
            }
            if (amount < 1) {
                return handleResponse(res, 400, "Online payment amount must be at least ₹1");
            }
        }

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,
            notes,
        });

        return handleResponse(res, 200, "Razorpay order created", order);
    } catch (error) {
        console.error("Razorpay create order error:", error?.error || error);
        const gatewayMessage = error?.error?.description;
        if (error?.statusCode === 401) {
            return handleResponse(res, 502, "Payment gateway is not configured correctly. Please contact support.");
        }
        return handleResponse(
            res,
            502,
            gatewayMessage ? `Payment gateway error: ${gatewayMessage}` : "Payment initialization failed",
        );
    }
};

const orderPayload = (orders, orderGroupId, grandTotal) =>
    orders.length === 1
        ? { order: orders[0], orders, orderGroupId, grandTotal }
        : { orders, orderGroupId, grandTotal };

export const verifyPayment = async (req, res) => {
    const userId = req.user.id;
    // Shares the checkout lock with wallet/credit/COD orders: one checkout at a time per customer
    const lockKey = `checkout:${userId}`;
    if (!acquireUserLock(lockKey)) {
        return handleResponse(res, 409, "Your payment is already being processed. Please wait a moment.");
    }
    try {
        return await processVerifiedPayment(req, res, userId);
    } finally {
        releaseUserLock(lockKey);
    }
};

async function processVerifiedPayment(req, res, userId) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = req.body;
    try {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return handleResponse(res, 400, "Missing payment credentials");
        }
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error("[VerifyPayment] RAZORPAY_KEY_SECRET is not set");
            return handleResponse(res, 500, "Payment verification is not configured");
        }

        // 1. Signature (constant-time compare; never log the expected value)
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        const given = Buffer.from(String(razorpay_signature));
        const expected = Buffer.from(expectedSign);
        if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
            console.warn(`[VerifyPayment] Invalid signature for user ${userId}, order ${razorpay_order_id}`);
            return handleResponse(res, 400, "Invalid payment signature");
        }

        // 2. Idempotency: the same payment never creates orders twice (retries, double taps)
        const existing = await Order.find({ razorpayOrderId: razorpay_order_id });
        if (existing.length) {
            if (String(existing[0].userId) !== String(userId)) {
                return handleResponse(res, 403, "This payment belongs to another account");
            }
            const total = existing.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
            return handleResponse(res, 200, "Order already placed for this payment", orderPayload(existing, existing[0].orderGroupId || null, round2(total)));
        }

        // 3. Ask Razorpay what was actually paid, and for which order
        let payment;
        let rzOrder;
        try {
            [payment, rzOrder] = await Promise.all([
                razorpay.payments.fetch(razorpay_payment_id),
                razorpay.orders.fetch(razorpay_order_id),
            ]);
        } catch (err) {
            console.error("[VerifyPayment] Could not fetch payment from Razorpay:", err?.error || err?.message);
            return handleResponse(res, 502, "We couldn't confirm your payment with the bank yet. If money was deducted, please contact support with your payment ID: " + razorpay_payment_id);
        }
        if (payment.order_id !== razorpay_order_id || !["captured", "authorized"].includes(payment.status)) {
            return handleResponse(res, 400, "This payment is not complete. Please try again.");
        }
        if (rzOrder?.notes?.userId && String(rzOrder.notes.userId) !== String(userId)) {
            return handleResponse(res, 403, "This payment belongs to another account");
        }

        // 4. Recalculate the order on the server and compare with the amount paid
        const checkout = await computeOnlineCheckout(userId, orderData);
        if (!checkout.ok) {
            await refundRazorpayPayment(razorpay_payment_id, `Order could not be placed: ${checkout.message}`);
            return handleResponse(res, checkout.status, `${checkout.message} Your payment will be refunded automatically.`);
        }
        const expectedPaise = Math.round(checkout.onlineAmountPaid * 100);
        if (Math.abs(Number(payment.amount) - expectedPaise) > 100) {
            console.error(`[VerifyPayment] Amount mismatch for user ${userId}: paid ${payment.amount} paise, expected ${expectedPaise} paise`);
            await refundRazorpayPayment(razorpay_payment_id, `Amount mismatch: paid ${payment.amount / 100}, order needs ${checkout.onlineAmountPaid}`);
            return handleResponse(res, 400, `The amount paid (₹${payment.amount / 100}) doesn't match your order total (₹${checkout.onlineAmountPaid}). Your payment will be refunded automatically. Please place the order again.`);
        }

        const { cart, user, split, grandTotal, walletAmountUsed, creditAmountUsed, onlineAmountPaid } = checkout;
        const { userCoords, computedGroups, appliedCouponCode, couponToIncrement, orderGroupId } = split;
        const { shippingAddress, paymentMethod, deliveryShift, scheduledDate } = orderData;
        const couponNote = appliedCouponCode ? ` (Coupon: ${appliedCouponCode})` : "";

        // Delivery date (IST). The customer has already paid, so an out-of-range date (e.g. payment
        // finished just after midnight) falls back to today instead of rejecting the payment.
        let schedule = resolveDeliverySchedule(scheduledDate, null);
        if (!schedule.ok) schedule = resolveDeliverySchedule(null, null);

        // 5. Take the wallet / credit part atomically (balance can't be spent twice)
        if (walletAmountUsed > 0) {
            const updated = await User.findOneAndUpdate(
                { _id: userId, walletBalance: { $gte: walletAmountUsed } },
                {
                    $inc: { walletBalance: -walletAmountUsed },
                    $push: { walletTransactions: { $each: [{ txnId: `WAL-${Date.now()}`, type: "Paid", amount: walletAmountUsed, status: "Success", note: `Wallet part of order payment${couponNote}`, createdAt: new Date() }], $position: 0 } },
                },
                { new: true },
            );
            if (!updated) {
                await refundRazorpayPayment(razorpay_payment_id, "Wallet balance changed during payment");
                return handleResponse(res, 400, "Your wallet balance changed during payment. Your online payment will be refunded automatically; please try again.");
            }
        }
        if (creditAmountUsed > 0) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            const updated = await User.findOneAndUpdate(
                { _id: userId, $expr: { $gte: [{ $subtract: [{ $ifNull: ["$creditLimit", 0] }, { $ifNull: ["$usedCredit", 0] }] }, creditAmountUsed] } },
                [{
                    $set: {
                        creditOverdueDate: { $cond: [{ $lte: [{ $ifNull: ["$usedCredit", 0] }, 0] }, dueDate, "$creditOverdueDate"] },
                        usedCredit: { $round: [{ $add: [{ $ifNull: ["$usedCredit", 0] }, creditAmountUsed] }, 2] },
                        walletTransactions: { $concatArrays: [{ $literal: [{ txnId: `CRD-${Date.now()}`, type: "Credit Used", amount: creditAmountUsed, status: "Success", note: `Credit part of order payment${couponNote}`, createdAt: new Date() }] }, { $ifNull: ["$walletTransactions", []] }] },
                    },
                }],
                { new: true, updatePipeline: true },
            );
            if (!updated) {
                await refundRazorpayPayment(razorpay_payment_id, "Credit limit changed during payment");
                return handleResponse(res, 400, "Your available credit changed during payment. Your online payment will be refunded automatically; please try again.");
            }
        }

        // 6. Create the orders (one per category)
        const createdOrders = [];
        for (const g of computedGroups) {
            let fulfillmentCategoryId = null;
            try {
                fulfillmentCategoryId = new mongoose.Types.ObjectId(g.categoryId);
            } catch {
                fulfillmentCategoryId = null;
            }
            const share = grandTotal > 0 ? g.totalAmount / grandTotal : 0;
            const newOrder = new Order({
                userId,
                franchiseId: null,
                items: g.items,
                subtotal: g.subtotal,
                deliveryFee: g.deliveryFee,
                tax: g.tax,
                totalAmount: g.totalAmount,
                paymentMethod,
                couponCode: appliedCouponCode,
                discountAmount: g.discountAmount,
                paymentStatus: "Completed",
                walletAmountUsed: round2(share * walletAmountUsed),
                creditAmountUsed: round2(share * creditAmountUsed),
                onlineAmountPaid: ["Wallet + Online", "Credit + Online"].includes(paymentMethod) ? round2(share * onlineAmountPaid) : g.totalAmount,
                orderStatus: "Placed",
                shippingAddress,
                shippingLocation: userCoords,
                deliveryShift,
                orderGroupId,
                fulfillmentCategoryId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                scheduledDate: schedule.scheduledDate,
                isPreOrder: schedule.isPreOrder,
            });
            await newOrder.save();
            createdOrders.push(newOrder);

            try {
                await createUserNotification({
                    userId,
                    type: "order",
                    title: "Order Placed",
                    message: `Your order #${newOrder._id.toString().slice(-6)} has been placed and paid successfully.`,
                    link: `/order-detail/${newOrder._id}`,
                    meta: { orderId: newOrder._id.toString(), amount: newOrder.totalAmount, paymentMethod },
                });
            } catch (e) {
                console.error("[VerifyPayment] User notification failed:", e);
            }
            try {
                await assignOrderToFranchise(newOrder._id);
            } catch (assignErr) {
                console.error("[VerifyPayment] Auto-assignment failed:", assignErr);
            }
        }

        if (couponToIncrement) {
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
                message: `New order placed by ${user.fullName}: ₹${order.totalAmount} (paid online)`,
            });
        }

        return handleResponse(res, 201, "Order placed and payment verified", orderPayload(createdOrders, orderGroupId, grandTotal));
    } catch (error) {
        console.error("[VerifyPayment] Failed:", error);
        if (error.name === "ValidationError") {
            return handleResponse(res, 400, "Some order details are invalid. Please check your address and try again.");
        }
        return handleResponse(res, 500, "Payment verification failed");
    }
}
