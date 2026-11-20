import mongoose from "mongoose";
import Order from "../models/order.js";
import razorpay from "./razorpay.js";
import handleResponse from "./helper.js";

/**
 * UPI at the door, verified by Razorpay (client, Nov 2026: "payment integrity").
 *
 * When a cash-on-delivery customer pays all or part by UPI, the delivery app shows a Razorpay UPI QR made
 * for exactly that amount (single use). The customer pays it with any UPI app; Razorpay confirms the
 * payment, and only then can the delivery be completed with the customer's delivery code. The partner
 * cannot take the money on another QR and mark it paid: the server checks Razorpay before the order is
 * marked Delivered.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const QR_MINUTES = 30;
const shortId = (id) => String(id).slice(-6).toUpperCase();

/** Payments Razorpay has received on this QR (captured = money received) */
async function paidOnQr(qrId) {
    const res = await razorpay.qrCode.fetchAllPayments(qrId, { count: 20 });
    return (res?.items || []).filter((p) => p.status === "captured");
}

/** Mark the QR paid when Razorpay has the money for the full amount. Returns the fresh doorUpi. */
export async function refreshDoorUpi(order) {
    const upi = order.doorUpi;
    if (!upi?.qrId) return upi || null;
    if (upi.status === "paid") return upi;
    const payments = await paidOnQr(upi.qrId);
    const paise = Math.round(round2(upi.amount) * 100);
    const got = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (got >= paise && payments.length) {
        const updated = await Order.findOneAndUpdate(
            { _id: order._id, "doorUpi.qrId": upi.qrId, "doorUpi.status": { $ne: "paid" } },
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
    const order = await Order.findById(id);
    if (!order) { handleResponse(res, 404, "Order not found"); return null; }
    if (String(order.deliveryPartnerId || "") !== String(req.delivery?._id || "")) { handleResponse(res, 403, "This order is not assigned to you"); return null; }
    if (order.paymentMethod !== "COD") { handleResponse(res, 400, "This order is already paid"); return null; }
    if (order.orderStatus !== "Dispatched") { handleResponse(res, 400, "UPI payment is only taken while the order is out for delivery"); return null; }
    return order;
};

const view = (upi) => (upi ? {
    qrId: upi.qrId,
    amount: upi.amount,
    imageUrl: upi.imageUrl,
    status: upi.status,
    paidAt: upi.paidAt || null,
    closeBy: upi.closeBy || null,
} : null);

/** POST /orders/delivery/:id/upi-qr  { amount } - the Razorpay QR for the UPI part (made once per amount) */
export const createDoorUpiQr = async (req, res) => {
    try {
        const order = await loadOrderForPartner(req, res);
        if (!order) return;
        const amount = round2(req.body?.amount);
        if (!(amount >= 1)) return handleResponse(res, 400, "The UPI amount must be at least Rs 1");
        if (amount > round2(order.totalAmount) + 0.01) return handleResponse(res, 400, "The UPI amount cannot be more than the order amount");

        const current = order.doorUpi;
        if (current?.status === "paid") {
            if (Math.abs(round2(current.amount) - amount) < 0.01) return handleResponse(res, 200, "Already paid", view(current));
            return handleResponse(res, 400, `Rs ${current.amount} has already been paid by UPI for this order. Collect the rest by cash.`);
        }
        // Same amount, still open for a few minutes: show the same QR again
        if (current?.qrId && current.status === "created" && Math.abs(round2(current.amount) - amount) < 0.01
            && current.closeBy && new Date(current.closeBy).getTime() - Date.now() > 3 * 60 * 1000) {
            const fresh = await refreshDoorUpi(order);
            return handleResponse(res, 200, fresh?.status === "paid" ? "Already paid" : "Scan to pay", view(fresh));
        }
        // A different amount (or an expired QR): close the old one first. If it was paid meanwhile, keep that.
        if (current?.qrId && current.status === "created") {
            const fresh = await refreshDoorUpi(order);
            if (fresh?.status === "paid") return handleResponse(res, 400, `Rs ${fresh.amount} has already been paid by UPI for this order.`);
            try { await razorpay.qrCode.close(current.qrId); } catch { /* already closed / expired */ }
        }

        const closeBy = new Date(Date.now() + QR_MINUTES * 60 * 1000);
        const qr = await razorpay.qrCode.create({
            type: "upi_qr",
            name: "KisaanKart",
            usage: "single_use",
            fixed_amount: true,
            payment_amount: Math.round(amount * 100),
            description: `Order #${shortId(order._id)}`,
            close_by: Math.floor(closeBy.getTime() / 1000),
            notes: { orderId: String(order._id), purpose: "door_upi" },
        });
        order.doorUpi = { qrId: qr.id, amount, imageUrl: qr.image_url, status: "created", closeBy, createdAt: new Date(), paymentId: "", paidAt: null };
        await order.save();
        return handleResponse(res, 200, "Scan to pay", view(order.doorUpi));
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
        if (!order.doorUpi?.qrId) return handleResponse(res, 200, "No UPI payment started", null);
        const fresh = await refreshDoorUpi(order);
        return handleResponse(res, 200, fresh?.status === "paid" ? "Payment received" : "Waiting for payment", view(fresh));
    } catch (error) {
        console.error("[DoorUpi] status:", error?.error || error);
        return handleResponse(res, 502, "Could not check the payment right now");
    }
};
