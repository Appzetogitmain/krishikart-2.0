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
import { resolveDeliverySchedule } from "../utils/deliverySchedule.js";

export const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount } = req.body; // Amount in INR

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return handleResponse(res, 400, "A valid payment amount is required");
        }
        // Razorpay rejects orders below ₹1
        if (numericAmount < 1) {
            return handleResponse(res, 400, "Online payment amount must be at least ₹1");
        }

        const options = {
            amount: Math.round(numericAmount * 100), // Convert to paise
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

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

export const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderData
        } = req.body;

        const userId = req.user.id;

        // 0. Diagnostic Logging
        console.log("--- Payment Verification Start ---");
        console.log("User ID:", userId);
        console.log("Rzp Order ID:", razorpay_order_id);
        console.log("Rzp Payment ID:", razorpay_payment_id);
        console.log("Rzp Signature:", !!razorpay_signature);
        console.log("Order Data:", JSON.stringify(orderData, null, 2));

        // Input Validation
        console.log("Validating request fields...");
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.error("Missing payment credentials:", {
                hasOrderId: !!razorpay_order_id,
                hasPaymentId: !!razorpay_payment_id,
                hasSignature: !!razorpay_signature
            });
            return handleResponse(res, 400, "Missing payment credentials");
        }

        if (!orderData) {
            console.error("Missing orderData object");
            return handleResponse(res, 400, "Missing order information");
        }

        if (!orderData.shippingAddress || !orderData.paymentMethod || !orderData.deliveryShift) {
            console.error("Incomplete orderData:", {
                hasShippingAddress: !!orderData.shippingAddress,
                hasPaymentMethod: !!orderData.paymentMethod,
                hasDeliveryShift: !!orderData.deliveryShift,
                orderData
            });
            return handleResponse(res, 400, "Missing shipping address, payment method, or delivery shift");
        }

        console.log("All fields validated successfully");

        // 1. Verify Signature
        console.log("Verifying payment signature...");
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.error("Signature mismatch:", {
                received: razorpay_signature,
                expected: expectedSign
            });
            return handleResponse(res, 400, "Invalid payment signature");
        }

        console.log("Signature verified successfully");

        // 2. Original Order Logic (Create the order in DB after payment)
        const { shippingAddress, shippingLocation, paymentMethod, deliveryShift, scheduledDate } = orderData;

        // Delivery date (evaluated in IST). The customer has already paid at this point, so an
        // out-of-range date (e.g. payment finished just after midnight) falls back to today
        // instead of rejecting a captured payment.
        let schedule = resolveDeliverySchedule(scheduledDate, null);
        if (!schedule.ok) {
            console.warn("[VerifyPayment] Invalid scheduled date, defaulting to today:", schedule.message);
            schedule = resolveDeliverySchedule(null, null);
        }
        const preOrderDate = schedule.scheduledDate;
        const isPreOrder = schedule.isPreOrder;

        // Get User Cart
        console.log("Fetching user cart for userId:", userId);
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            console.error("Cart not found for userId:", userId);
            return handleResponse(res, 400, "Cart not found. Please add items to cart and try again.");
        }

        if (cart.items.length === 0) {
            console.error("Cart is empty for userId:", userId);
            return handleResponse(res, 400, "Your cart is empty. Items may have been removed during payment.");
        }

        console.log(`Cart found with ${cart.items.length} items`);

        const resolvedLocation = await resolveCheckoutCoordinates(
            shippingAddress,
            shippingLocation,
        );

        if (!resolvedLocation) {
            return handleResponse(
                res,
                400,
                "Valid delivery location is required. Please pick your location on the map and try again.",
            );
        }

        const split = await computeSplitCheckoutPayload({
            cart,
            userId,
            couponCode: orderData.couponCode || "",
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

        console.log("Split checkout totals:", { slices: computedGroups.length, grandTotal });

        const user = await User.findById(userId);
        if (!user) {
            return handleResponse(res, 404, "User not found");
        }

        const requestedWalletAmount = Number(orderData.walletAmountUsed || 0);
        const requestedCreditAmount = Number(orderData.creditAmountUsed || 0);
        const walletAmountUsed = Math.min(
            Number.isFinite(requestedWalletAmount) ? requestedWalletAmount : 0,
            Number(user.walletBalance || 0),
            Number(grandTotal || 0),
        );
        const availableCredit = Math.max(0, Number(user.creditLimit || 0) - Number(user.usedCredit || 0));
        const creditAmountUsed = Math.min(
            Number.isFinite(requestedCreditAmount) ? requestedCreditAmount : 0,
            availableCredit,
            Number(grandTotal || 0),
        );
        const onlineAmountPaid = paymentMethod === "Wallet + Online"
            ? Number((Number(grandTotal || 0) - walletAmountUsed).toFixed(2))
            : paymentMethod === "Credit + Online"
                ? Number((Number(grandTotal || 0) - creditAmountUsed).toFixed(2))
                : Number(grandTotal || 0);

        if (paymentMethod === "Wallet + Online") {
            if (walletAmountUsed <= 0) {
                return handleResponse(res, 400, "Wallet amount is required for split payment");
            }

            if (onlineAmountPaid <= 0) {
                return handleResponse(res, 400, "Online payment amount must be greater than zero");
            }

            user.walletBalance = Number((Number(user.walletBalance || 0) - walletAmountUsed).toFixed(2));
            user.walletTransactions = user.walletTransactions || [];
            user.walletTransactions.unshift({
                txnId: `WAL-${Date.now()}`,
                type: "Paid",
                amount: walletAmountUsed,
                status: "Success",
                note: `Wallet contribution for hybrid order payment${appliedCouponCode ? " (Coupon: " + appliedCouponCode + ")" : ""}`,
                createdAt: new Date(),
            });
        } else if (paymentMethod === "Credit + Online") {
            if (creditAmountUsed <= 0) {
                return handleResponse(res, 400, "Credit amount is required for split payment");
            }

            if (onlineAmountPaid <= 0) {
                return handleResponse(res, 400, "Online payment amount must be greater than zero");
            }

            if (user.usedCredit === 0) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7);
                user.creditOverdueDate = dueDate;
            }

            user.usedCredit = Number((Number(user.usedCredit || 0) + creditAmountUsed).toFixed(2));
            user.walletTransactions = user.walletTransactions || [];
            user.walletTransactions.unshift({
                txnId: `CRD-${Date.now()}`,
                type: "Credit Used",
                amount: creditAmountUsed,
                status: "Success",
                note: `Credit contribution for hybrid order payment${appliedCouponCode ? " (Coupon: " + appliedCouponCode + ")" : ""}`,
                createdAt: new Date(),
            });
        }

        const createdOrders = [];
        for (const g of computedGroups) {
            let fulfillmentCategoryId = null;
            try {
                fulfillmentCategoryId = new mongoose.Types.ObjectId(g.categoryId);
            } catch {
                fulfillmentCategoryId = null;
            }

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
                walletAmountUsed: paymentMethod === "Wallet + Online"
                    ? Number(((g.totalAmount / grandTotal) * walletAmountUsed).toFixed(2))
                    : 0,
                creditAmountUsed: paymentMethod === "Credit + Online"
                    ? Number(((g.totalAmount / grandTotal) * creditAmountUsed).toFixed(2))
                    : 0,
                onlineAmountPaid: ["Wallet + Online", "Credit + Online"].includes(paymentMethod)
                    ? Number(((g.totalAmount / grandTotal) * onlineAmountPaid).toFixed(2))
                    : g.totalAmount,
                orderStatus: "Placed",
                shippingAddress,
                shippingLocation: userCoords,
                deliveryShift,
                orderGroupId,
                fulfillmentCategoryId,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                scheduledDate: preOrderDate,
                isPreOrder,
            });

            await newOrder.save();
            createdOrders.push(newOrder);
            console.log("Order saved successfully, ID:", newOrder._id);

            try {
                await assignOrderToFranchise(newOrder._id);
            } catch (assignErr) {
                console.error("[VerifyPayment] Auto-assignment failed:", assignErr);
            }
        }

        if (couponToIncrement) {
            couponToIncrement.timesUsed += 1;
            await couponToIncrement.save();
        }

        await user.save();

        cart.items = [];
        await cart.save();
        console.log("Cart cleared");

        console.log("=== Payment Verification Completed Successfully ===");

        const payload =
            createdOrders.length === 1
                ? {
                      order: createdOrders[0],
                      orders: createdOrders,
                      orderGroupId,
                      grandTotal,
                  }
                : { orders: createdOrders, orderGroupId, grandTotal };

        return handleResponse(res, 201, "Order placed and payment verified", payload);

    } catch (error) {
        console.error("=== Payment Verification Failed ===");
        console.error("Error type:", error.name);
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);

        // Send detailed error message to frontend
        const errorMessage = error.message || "Payment verification failed";
        if (error.name === "ValidationError") {
            return handleResponse(res, 400, `Verification error: ${errorMessage}`);
        }
        return handleResponse(res, 500, `Verification error: ${errorMessage}`);
    }
};
