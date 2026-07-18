import Delivery from "../models/delivery.js";
import Order from "../models/order.js";
import DeliveryCodRemittance from "../models/deliveryCodRemittance.js";
import { handleResponse } from "../utils/helper.js";
// import razorpay from "../utils/razorpay.js"; // Razorpay COD UPI — temporarily disabled
// import crypto from "crypto";
import mongoose from "mongoose";
import admin from "../services/firebaseAdmin.js";

/**
 * @desc Get All Active Delivery Partners
 * @route GET /delivery/partners
 * @access Private (Franchise/Admin)
 */
export const getAllDeliveryPartners = async (req, res) => {
    try {
        const partners = await Delivery.find({ status: 'active', isVerified: true, isOnline: true, isApproved: true })
            .select('fullName mobile vehicleNumber vehicleType isOnline');

        return handleResponse(res, 200, "Delivery partners fetched successfully", partners);
    } catch (err) {
        console.error("Get Delivery Partners Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

export const getMyCodSummary = async (req, res) => {
    try {
        const deliveryId = req.delivery?._id;
        if (!deliveryId) return handleResponse(res, 401, "Unauthorized");

        const pendingOrders = await Order.find({
            paymentMethod: "COD",
            "codTracking.isCollected": true,
            "codTracking.collectedByDeliveryId": deliveryId,
            "codTracking.remittanceStatus": "pending"
        }).select("_id totalAmount createdAt codTracking");

        const submittedRemittances = await DeliveryCodRemittance.find({
            deliveryPartnerId: deliveryId,
            status: "submitted"
        }).select("amount");

        const verifiedRemittances = await DeliveryCodRemittance.find({
            deliveryPartnerId: deliveryId,
            status: "verified"
        }).select("amount");

        const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.codTracking?.collectedAmount || o.totalAmount || 0), 0);
        const submittedAmount = submittedRemittances.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const verifiedAmount = verifiedRemittances.reduce((sum, r) => sum + Number(r.amount || 0), 0);

        return handleResponse(res, 200, "COD summary fetched", {
            pendingOrders: pendingOrders.map((o) => ({
                orderId: o._id,
                amount: Number(o.codTracking?.collectedAmount || o.totalAmount || 0),
                collectedAt: o.codTracking?.collectedAt || o.createdAt
            })),
            totals: {
                pendingAmount: Number(pendingAmount.toFixed(2)),
                submittedAmount: Number(submittedAmount.toFixed(2)),
                verifiedAmount: Number(verifiedAmount.toFixed(2))
            }
        });
    } catch (err) {
        console.error("Get COD summary error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

export const submitCodRemittance = async (req, res) => {
    try {
        const deliveryId = req.delivery?._id;
        if (!deliveryId) return handleResponse(res, 401, "Unauthorized");

        const { orderIds, paymentMethod = "cash", referenceNo = "", note = "" } = req.body;

        let targetOrderIds = Array.isArray(orderIds) ? orderIds : [];

        if (!targetOrderIds.length) {
            const pending = await Order.find({
                paymentMethod: "COD",
                "codTracking.isCollected": true,
                "codTracking.collectedByDeliveryId": deliveryId,
                "codTracking.remittanceStatus": "pending"
            }).select("_id");
            targetOrderIds = pending.map((o) => o._id);
        }

        if (!targetOrderIds.length) {
            return handleResponse(res, 400, "No pending COD orders to remit");
        }

        const orders = await Order.find({
            _id: { $in: targetOrderIds },
            paymentMethod: "COD",
            "codTracking.isCollected": true,
            "codTracking.collectedByDeliveryId": deliveryId,
            "codTracking.remittanceStatus": "pending"
        }).select("_id totalAmount codTracking");

        if (!orders.length) {
            return handleResponse(res, 400, "No valid COD orders found for remittance");
        }

        const amount = orders.reduce((sum, o) => sum + Number(o.codTracking?.collectedAmount || o.totalAmount || 0), 0);

        const remittance = await DeliveryCodRemittance.create({
            deliveryPartnerId: deliveryId,
            orderIds: orders.map((o) => o._id),
            amount: Number(amount.toFixed(2)),
            paymentMethod,
            referenceNo: String(referenceNo || ""),
            note: String(note || ""),
            status: "submitted"
        });

        await Order.updateMany(
            { _id: { $in: orders.map((o) => o._id) } },
            {
                $set: {
                    "codTracking.remittanceStatus": "submitted",
                    "codTracking.remittanceId": remittance._id,
                    "codTracking.remittedAt": new Date()
                }
            }
        );

        return handleResponse(res, 201, "COD remittance submitted successfully", remittance);
    } catch (err) {
        console.error("Submit COD remittance error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/* Razorpay COD UPI remittance — temporarily disabled
export const createCodRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount) return handleResponse(res, 400, "Amount is required");

        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `rcpt_${String(req.delivery._id).slice(-6)}_${Date.now().toString().slice(-8)}`,
        };

        const order = await razorpay.orders.create(options);
        return handleResponse(res, 200, "Razorpay order created", order);
    } catch (error) {
        console.error("Razorpay create remit order error:", error);
        return handleResponse(res, 500, error.message || "Payment initialization failed");
    }
};

export const verifyCodUpiPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderIds,
            note
        } = req.body;

        const deliveryId = req.delivery._id.toString();

        // 1. Verify Signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return handleResponse(res, 400, "Invalid payment signature");
        }

        // 2. Fetch Orders to get exact amount
        const orders = await Order.find({
            _id: { $in: orderIds },
            "codTracking.collectedByDeliveryId": deliveryId,
            "codTracking.remittanceStatus": "pending"
        });

        if (!orders.length) {
            return handleResponse(res, 400, "No valid orders found for remittance");
        }

        const amount = orders.reduce((sum, o) => sum + Number(o.codTracking?.collectedAmount || o.totalAmount || 0), 0);

        // 3. Create Remittance
        const remittance = await DeliveryCodRemittance.create({
            deliveryPartnerId: deliveryId,
            orderIds: orders.map((o) => o._id),
            amount: Number(amount.toFixed(2)),
            paymentMethod: "upi",
            referenceNo: razorpay_payment_id,
            note: String(note || ""),
            status: "verified" // Since it's digital prepaid to admin, we can auto-verify or mark as submitted
        });

        // 4. Update Orders
        await Order.updateMany(
            { _id: { $in: orders.map((o) => o._id) } },
            {
                $set: {
                    "codTracking.remittanceStatus": "verified",
                    "codTracking.remittanceId": remittance._id,
                    "codTracking.remittedAt": new Date()
                }
            }
        );

        return handleResponse(res, 201, "UPI Remittance successful and verified", remittance);
    } catch (error) {
        console.error("Verify UPI Remittance error:", error);
        return handleResponse(res, 500, "Verification failed");
    }
};
*/

export const getMyCodRemittances = async (req, res) => {
    try {
        const deliveryId = req.delivery?._id;
        if (!deliveryId) return handleResponse(res, 401, "Unauthorized");

        const remittances = await DeliveryCodRemittance.find({ deliveryPartnerId: deliveryId })
            .sort({ createdAt: -1 })
            .limit(50);

        return handleResponse(res, 200, "COD remittance history fetched", remittances);
    } catch (err) {
        console.error("Get COD remittance history error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Update Delivery Availability and Location
 * @route PUT /delivery/availability
 * @access Private (Delivery)
 */
export const updateAvailability = async (req, res) => {
    try {
        const { isOnline, lat, lng } = req.body;
        const deliveryId = req.delivery._id;

        const updateData = {};
        if (typeof isOnline === 'boolean') updateData.isOnline = isOnline;
        if (lat !== undefined && lng !== undefined) {
            updateData.location = {
                type: 'Point',
                coordinates: [lng, lat]
            };
        }

        const delivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            { $set: updateData },
            { new: true }
        )
            .select('-password -otp -otpExpiresAt');

        if (!delivery) return handleResponse(res, 404, "Delivery partner not found");

        return handleResponse(res, 200, "Availability updated successfully", delivery);
    } catch (err) {
        console.error("Update Availability Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Save Delivery FCM Token
 * @route POST /delivery/fcm-token
 * @access Private (Delivery)
 */
export const saveFCMToken = async (req, res) => {
    try {
        const { token, fcm_token, plateform, platform } = req.body;
        const deliveryId = req.delivery._id;
        const finalToken = fcm_token || token;
        const finalPlatform = plateform || platform || 'web';

        console.log(`[FCM-Delivery] Incoming token for Delivery ${deliveryId} [Platform: ${finalPlatform}]:`, finalToken);

        if (!finalToken) return handleResponse(res, 400, "FCM Token is required");

        const delivery = await Delivery.findById(deliveryId);
        if (!delivery) return handleResponse(res, 404, "Delivery partner not found");
        if (!delivery.fcmTokens) delivery.fcmTokens = [];

        if (!delivery.fcmTokens.includes(finalToken)) {
            console.log(`[FCM-Delivery] Registering new unique token for Delivery ${deliveryId}`);
            delivery.fcmTokens.push(finalToken);
            if (delivery.fcmTokens.length > 10) {
                console.log(`[FCM-Delivery] Token limit (10) reached for Delivery ${deliveryId}. Slicing older tokens.`);
                delivery.fcmTokens = delivery.fcmTokens.slice(-10);
            }
            await delivery.save();
        }
        else {
            console.log(`[FCM-Delivery] Token already exists for Delivery ${deliveryId}.`);
        }

        return handleResponse(res, 200, "FCM token saved successfully");
    } catch (err) {
        console.error("Save FCM Token Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Test Push Notification (Delivery App Helper)
 * @route POST /delivery/test-notification
 * @access Private (Delivery)
 */
export const testPushByToken = async (req, res) => {
    try {
        const { fcm_token, fcmToken, plateform, platform } = req.body;
        const targetToken = fcm_token || fcmToken;
        const targetPlatform = plateform || platform || 'device';

        if (!targetToken) return handleResponse(res, 400, "fcm_token is required");

        const message = {
            notification: {
                title: "Kisaankart Delivery Test",
                body: `Success! Your ${targetPlatform} is correctly integrated with Kisaankart FCM.`
            },
            token: targetToken
        };

        const response = await admin.messaging().send(message);
        return handleResponse(res, 200, "Test notification sent successfully!", response);
    } catch (error) {
        console.error("Test Notification Error:", error);

        if (error.code === 'messaging/registration-token-not-registered') {
            const deliveryId = req.delivery?._id;
            if (deliveryId) {
                await Delivery.findByIdAndUpdate(deliveryId, { $pull: { fcmTokens: targetToken } });
            }
            return handleResponse(res, 410, "FCM Token invalid.", { code: error.code });
        }

        return handleResponse(res, 500, "Failed to send test notification", {
            code: error.code,
            error_message: error.message
        });
    }
};
