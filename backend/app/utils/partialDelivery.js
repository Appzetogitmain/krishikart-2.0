import Order from "../models/order.js";
import User from "../models/user.js";

/*
 * Partial delivery at the door: the customer keeps some items and gives the rest back to the delivery
 * partner. The customer's delivery code confirms what was handed over.
 *  - Amount due = value of the items kept; the delivery/platform fee stays; the coupon discount and the
 *    tax shrink in proportion to what was returned.
 *  - Cash-on-delivery orders simply collect the smaller amount. Orders already paid get the difference
 *    back: to KK Credit for credit orders (credit first for "Credit + Online"), else to the wallet.
 *  - The returned goods go back to the franchise like refused orders (franchise code, then restock or
 *    write off) — see order.partialReturn.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pidOf = (i) => String(i.productId?._id || i.productId);
/** What the partner carried for an item (less than ordered when the franchise packed short). */
export const handedQty = (i) => (Number(i.packedQuantity) > 0 ? Number(i.packedQuantity) : Number(i.quantity) || 0);

/**
 * returned: [{ productId, quantity }] (quantity in the item's unit).
 * Returns { error } or { lines, returnedValue, newTotal, newDiscount, newTax, refund }.
 */
export function planPartialDelivery(order, returned) {
    const wanted = new Map();
    for (const r of returned || []) {
        const qty = Number(r?.quantity);
        if (!r?.productId || !Number.isFinite(qty) || qty < 0) return { error: "Returned quantity must be 0 or more" };
        if (qty > 0) wanted.set(String(r.productId), round2((wanted.get(String(r.productId)) || 0) + qty));
    }
    if (!wanted.size) return { error: "Choose at least one returned item" };

    const lines = [];
    for (const [pid, qty] of wanted) {
        const item = (order.items || []).find((i) => pidOf(i) === pid);
        if (!item) return { error: "A returned item is not part of this order" };
        const carried = handedQty(item);
        if (qty > carried) return { error: `${item.name}: only ${carried} ${item.unit || ""} was delivered, so ${qty} cannot be returned.`.replace(/\s+/g, " ") };
        lines.push({ productId: item.productId?._id || item.productId, name: item.name, unit: item.unit || "", quantity: qty, price: Number(item.price) || 0, value: round2(qty * (Number(item.price) || 0)) });
    }
    const keptAny = (order.items || []).some((i) => handedQty(i) - (wanted.get(pidOf(i)) || 0) > 0);
    if (!keptAny) return { error: "Every item is being returned. Use \"Customer did not take the order\" instead." };

    const returnedValue = round2(lines.reduce((s, l) => s + l.value, 0));
    const itemsValue = round2((order.items || []).reduce((s, i) => s + handedQty(i) * (Number(i.price) || 0), 0)) || returnedValue;
    const share = Math.min(1, returnedValue / itemsValue);
    const discount = Number(order.discountAmount) || 0;
    const tax = Number(order.tax) || 0;
    const newDiscount = round2(discount * (1 - share));
    const newTax = round2(tax * (1 - share));
    const originalTotal = round2(order.totalAmount);
    const newTotal = Math.max(0, round2(originalTotal - returnedValue + (discount - newDiscount) - (tax - newTax)));
    return { lines, wanted, returnedValue, newDiscount, newTax, originalTotal, newTotal, refund: round2(originalTotal - newTotal) };
}

/** Write the plan onto the (mongoose) order: delivered quantities, smaller total, goods coming back. */
export function applyPartialDelivery(order, plan, { reason = "", partnerId = null } = {}) {
    for (const item of order.items) {
        const back = plan.wanted.get(pidOf(item)) || 0;
        item.deliveredQuantity = round2(handedQty(item) - back);
    }
    order.partialReturn = {
        items: plan.lines,
        reason: String(reason || "").trim().slice(0, 300),
        returnedValue: plan.returnedValue,
        originalTotal: plan.originalTotal,
        refundAmount: isPrepaid(order) ? plan.refund : 0,
        at: new Date(),
        deliveryPartnerId: partnerId,
        goodsStatus: "with_delivery",
        handedBackAt: null,
        resolvedAt: null,
        refundedAt: null,
    };
    order.discountAmount = plan.newDiscount;
    order.tax = plan.newTax;
    order.totalAmount = plan.newTotal;
}

export const isPrepaid = (order) => order.paymentMethod !== "COD";

/**
 * Give back what the customer paid for the returned items (prepaid orders only), exactly once.
 * Returns { walletRefund, creditRestore }.
 */
export async function refundPartialDelivery(orderId) {
    const order = await Order.findOneAndUpdate(
        { _id: orderId, "partialReturn.refundAmount": { $gt: 0 }, "partialReturn.refundedAt": null },
        { $set: { "partialReturn.refundedAt": new Date() } },
        { new: true },
    );
    if (!order) return { walletRefund: 0, creditRestore: 0 };

    const amount = round2(order.partialReturn.refundAmount);
    let creditRestore = 0;
    if (order.paymentMethod === "Credit") creditRestore = amount;
    else if (order.paymentMethod === "Credit + Online") creditRestore = Math.min(amount, Number(order.creditAmountUsed) || 0);
    creditRestore = round2(creditRestore);
    const walletRefund = round2(amount - creditRestore);

    const shortId = order._id.toString().slice(-6).toUpperCase();
    const now = new Date();
    const txns = [];
    if (walletRefund > 0) {
        txns.push({ txnId: `PRF-${Date.now()}-${shortId}`, type: "Refund", amount: walletRefund, status: "Success", note: `Refund for items returned at delivery, order #${shortId}`, referenceOrderId: order._id, createdAt: now });
    }
    if (creditRestore > 0) {
        txns.push({ txnId: `PCR-${Date.now()}-${shortId}`, type: "Credit Refunded", amount: creditRestore, status: "Success", note: `Credit restored for items returned at delivery, order #${shortId}`, referenceOrderId: order._id, createdAt: now });
    }
    try {
        await User.updateOne({ _id: order.userId }, [
            {
                $set: {
                    walletBalance: { $round: [{ $add: [{ $ifNull: ["$walletBalance", 0] }, walletRefund] }, 2] },
                    usedCredit: { $max: [0, { $round: [{ $subtract: [{ $ifNull: ["$usedCredit", 0] }, creditRestore] }, 2] }] },
                    walletTransactions: { $concatArrays: [{ $literal: txns }, { $ifNull: ["$walletTransactions", []] }] },
                },
            },
        ], { updatePipeline: true });
    } catch (err) {
        await Order.updateOne({ _id: order._id }, { $set: { "partialReturn.refundedAt": null } });
        throw err;
    }
    return { walletRefund, creditRestore };
}

/**
 * Payments taken at the door for a cash-on-delivery order: [{ mode: "cash" | "upi", amount }].
 * Without a list, the whole amount is taken in one mode (legacy "collectionMode").
 * Returns { error } or { cash, upi }.
 */
export function splitPayments(payments, amountDue, legacyMode) {
    const due = round2(amountDue);
    if (!Array.isArray(payments) || !payments.length) {
        return legacyMode === "upi_franchise_qr" ? { cash: 0, upi: due } : { cash: due, upi: 0 };
    }
    let cash = 0;
    let upi = 0;
    for (const p of payments) {
        const amount = Number(p?.amount);
        if (!["cash", "upi"].includes(p?.mode) || !Number.isFinite(amount) || amount < 0) {
            return { error: "Each payment needs a mode (cash or UPI) and an amount" };
        }
        if (p.mode === "cash") cash += amount;
        else upi += amount;
    }
    cash = round2(cash);
    upi = round2(upi);
    if (Math.abs(cash + upi - due) > 0.5) {
        return { error: `Cash + UPI must add up to ₹${due} (you entered ₹${round2(cash + upi)}).` };
    }
    return { cash, upi };
}
