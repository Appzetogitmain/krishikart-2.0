import crypto from "crypto";
import mongoose from "mongoose";
import Order from "../models/order.js";
import razorpay from "./razorpay.js";
import handleResponse from "./helper.js";

/**
 * UPI at the door, verified by Razorpay (client, Nov 2026: "payment integrity").
 *
 * When a cash-on-delivery customer pays all or part by UPI, the money must reach Razorpay for exactly
 * that amount before the delivery can be completed (the server checks before the order is marked
 * Delivered), so a partner cannot take the money on another QR and mark it paid. Two ways:
 *  - kind "qr": a single-use Razorpay UPI QR for the amount (needs the "QR Codes" feature on the account)
 *  - kind "checkout": when QR Codes is not enabled, a Razorpay order paid in Razorpay's payment window
 *    on the partner's phone (customer enters their UPI ID / uses a UPI app). Verified the same way.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const QR_MINUTES = 30;
const shortId = (id) => String(id).slice(-6).toUpperCase();

// Razorpay answers like this when the account does not have the QR Codes product
const qrNotAvailable = (e) => e?.statusCode === 400 && /requested URL was not found/i.test(e?.error?.description || "");

/** Payments Razorpay has for this door payment that count as received (captures authorized ones) */
async function receivedPayments(upi) {
    if (upi.kind === "checkout") {
        const res = await razorpay.orders.fetchPayments(upi.rzpOrderId);
        const items = res?.items || [];
        for (const p of items) {
            // Not captured yet: capture now, otherwise Razorpay would refund it after a few days
            if (p.status === "authorized") {
                try { const c = await razorpay.payments.capture(p.id, p.amount, p.currency || "INR"); p.status = c?.status || p.status; } catch (e) { console.error("[DoorUpi] capture:", e?.error || e); }
            }
        }
        return items.filter((p) => p.status === "captured");
    }
    const res = await razorpay.qrCode.fetchAllPayments(upi.qrId, { count: 20 });
    return (res?.items || []).filter((p) => p.status === "captured");
}

/** Mark the door payment paid when Razorpay has the money for the full amount. Returns the fresh doorUpi. */
export async function refreshDoorUpi(order) {
    const upi = order.doorUpi;
    const ref = upi?.kind === "checkout" ? upi?.rzpOrderId : upi?.qrId;
    if (!ref) return upi || null;
    if (upi.status === "paid") return upi;
    const payments = await receivedPayments(upi);
    const paise = Math.round(round2(upi.amount) * 100);
    const got = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (got >= paise && payments.length) {
        const match = upi.kind === "checkout" ? { "doorUpi.rzpOrderId": ref } : { "doorUpi.qrId": ref };
        const updated = await Order.findOneAndUpdate(
            { _id: order._id, ...match, "doorUpi.status": { $ne: "paid" } },
            { $set: { "doorUpi.status": "paid", "doorUpi.paymentId": payments[0].id, "doorUpi.paidAt": new Date(), "doorUpi.vpa": payments[0].vpa || "" } },
            { new: true },
        );
        return (updated || (await Order.findById(order._id).lean()))?.doorUpi || upi;
    }
    return upi;
}

const loadOrderForPartner = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { handleResponse(res, 400, "Invalid order"); return null; }
    const order = await Order.findById(id).populate("userId", "fullName mobile email");
    if (!order) { handleResponse(res, 404, "Order not found"); return null; }
    if (String(order.deliveryPartnerId || "") !== String(req.delivery?._id || "")) { handleResponse(res, 403, "This order is not assigned to you"); return null; }
    if (order.paymentMethod !== "COD") { handleResponse(res, 400, "This order is already paid"); return null; }
    if (order.orderStatus !== "Dispatched") { handleResponse(res, 400, "UPI payment is only taken while the order is out for delivery"); return null; }
    return order;
};

const view = (upi, order) => (upi ? {
    kind: upi.kind || "qr",
    qrId: upi.qrId || "",
    rzpOrderId: upi.rzpOrderId || "",
    amount: upi.amount,
    imageUrl: upi.imageUrl || "",
    status: upi.status,
    paidAt: upi.paidAt || null,
    closeBy: upi.closeBy || null,
    // for Razorpay's payment window (kind "checkout")
    customer: order?.userId ? { name: order.userId.fullName || "", contact: order.userId.mobile || "" } : null,
    orderRef: order ? `#${shortId(order._id)}` : "",
} : null);

const sameAmount = (a, b) => Math.abs(round2(a) - round2(b)) < 0.01;

/** POST /orders/delivery/:id/upi-qr  { amount } - start the UPI payment for the UPI part (made once per amount) */
export const createDoorUpiQr = async (req, res) => {
    try {
        const order = await loadOrderForPartner(req, res);
        if (!order) return;
        const amount = round2(req.body?.amount);
        if (!(amount >= 1)) return handleResponse(res, 400, "The UPI amount must be at least Rs 1");
        if (amount > round2(order.totalAmount) + 0.01) return handleResponse(res, 400, "The UPI amount cannot be more than the order amount");

        const current = order.doorUpi;
        if (current?.status === "paid") {
            if (sameAmount(current.amount, amount)) return handleResponse(res, 200, "Already paid", view(current, order));
            return handleResponse(res, 400, `Rs ${current.amount} has already been paid by UPI for this order. Collect the rest by cash.`);
        }
        const open = current?.status === "created" && (current.qrId || current.rzpOrderId);
        // Same amount, still open for a few minutes: use the same payment again
        if (open && sameAmount(current.amount, amount) && current.closeBy && new Date(current.closeBy).getTime() - Date.now() > 3 * 60 * 1000) {
            const fresh = await refreshDoorUpi(order);
            return handleResponse(res, 200, fresh?.status === "paid" ? "Already paid" : "Waiting for payment", view(fresh, order));
        }
        // A different amount (or expired): check the old one was not paid meanwhile, then close it
        if (open) {
            const fresh = await refreshDoorUpi(order);
            if (fresh?.status === "paid") return handleResponse(res, 400, `Rs ${fresh.amount} has already been paid by UPI for this order.`);
            if (current.qrId && current.kind !== "checkout") { try { await razorpay.qrCode.close(current.qrId); } catch { /* already closed / expired */ } }
        }

        const closeBy = new Date(Date.now() + QR_MINUTES * 60 * 1000);
        const notes = { orderId: String(order._id), purpose: "door_upi" };
        let doorUpi;
        try {
            const qr = await razorpay.qrCode.create({
                type: "upi_qr",
                name: "KisaanKart",
                usage: "single_use",
                fixed_amount: true,
                payment_amount: Math.round(amount * 100),
                description: `Order #${shortId(order._id)}`,
                close_by: Math.floor(closeBy.getTime() / 1000),
                notes,
            });
            doorUpi = { kind: "qr", qrId: qr.id, rzpOrderId: "", amount, imageUrl: qr.image_url, status: "created", closeBy, createdAt: new Date(), paymentId: "", paidAt: null };
        } catch (e) {
            if (!qrNotAvailable(e)) throw e;
            // QR Codes not enabled on this Razorpay account: a Razorpay order paid in Razorpay's payment window
            const rzpOrder = await razorpay.orders.create({
                amount: Math.round(amount * 100),
                currency: "INR",
                receipt: `door_${shortId(order._id)}_${Date.now().toString(36)}`,
                notes,
            });
            doorUpi = { kind: "checkout", qrId: "", rzpOrderId: rzpOrder.id, amount, imageUrl: "", status: "created", closeBy, createdAt: new Date(), paymentId: "", paidAt: null };
        }
        order.doorUpi = doorUpi;
        await order.save();
        return handleResponse(res, 200, doorUpi.kind === "qr" ? "Scan to pay" : "Open the UPI payment", view(order.doorUpi, order));
    } catch (error) {
        console.error("[DoorUpi] create:", error?.error || error);
        const why = error?.error?.description || error?.message || "";
        return handleResponse(res, 502, `UPI payment could not be started${why ? ` (${why})` : ""}. Please collect cash or try again.`);
    }
};

/** GET /orders/delivery/:id/upi-qr - has Razorpay received the money? (the app asks every few seconds) */
export const getDoorUpiStatus = async (req, res) => {
    try {
        const order = await loadOrderForPartner(req, res);
        if (!order) return;
        if (!order.doorUpi?.qrId && !order.doorUpi?.rzpOrderId) return handleResponse(res, 200, "No UPI payment started", null);
        const fresh = await refreshDoorUpi(order);
        return handleResponse(res, 200, fresh?.status === "paid" ? "Payment received" : "Waiting for payment", view(fresh, order));
    } catch (error) {
        console.error("[DoorUpi] status:", error?.error || error);
        return handleResponse(res, 502, "Could not check the payment right now");
    }
};

/**
 * POST /orders/delivery/:id/upi-qr/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * After Razorpay's payment window: check the signature, then confirm with Razorpay that the money arrived.
 */
export const verifyDoorUpiCheckout = async (req, res) => {
    try {
        const order = await loadOrderForPartner(req, res);
        if (!order) return;
        const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.body || {};
        if (!oid || !pid || !sig) return handleResponse(res, 400, "Payment details are missing");
        if (order.doorUpi?.kind !== "checkout" || order.doorUpi?.rzpOrderId !== oid) return handleResponse(res, 400, "This payment does not belong to this order");
        const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${oid}|${pid}`).digest("hex");
        if (expected.length !== String(sig).length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig)))) {
            return handleResponse(res, 400, "Payment could not be verified");
        }
        const fresh = await refreshDoorUpi(order);
        return handleResponse(res, 200, fresh?.status === "paid" ? "Payment received" : "Waiting for payment", view(fresh, order));
    } catch (error) {
        console.error("[DoorUpi] verify:", error?.error || error);
        return handleResponse(res, 502, "Could not check the payment right now");
    }
};
