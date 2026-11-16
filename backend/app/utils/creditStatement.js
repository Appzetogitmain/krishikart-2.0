import mongoose from "mongoose";
import User from "../models/user.js";
import Order from "../models/order.js";

/**
 * KK Credit statement for one customer (client, Nov 2026: customers could not see which orders were
 * on credit or clear their dues).
 *
 * Every order bought on credit has 7 days to be paid. What each order put on credit comes from the
 * order (Credit / Credit + Online) and from the credit ledger (KK Credit taken at the door, credit
 * given back for cancelled or returned items). Payments clear the oldest order first. The account's
 * `usedCredit` stays the real amount owed; the per-order split is worked out from it.
 */

export const CREDIT_DAYS = 7;
// Reminders start this many days after an order went on credit (client: "after 3 days")
export const REMINDER_AFTER_DAYS = 3;

const DAY = 24 * 3600 * 1000;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const shortIdOf = (id) => String(id || "").slice(-6).toUpperCase();

const isRepayment = (t) => t.type === "Paid" && (String(t.txnId || "").startsWith("CRD-PAY") || /credit repayment/i.test(t.note || ""));

function orderCredit(order) {
    if (order.paymentMethod === "Credit") return round2(order.partialReturn?.originalTotal || order.totalAmount);
    if (order.paymentMethod === "Credit + Online") return round2(order.creditAmountUsed);
    return 0;
}

const itemsText = (items = []) => {
    const names = items.map((i) => i.name).filter(Boolean);
    if (!names.length) return "";
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", ");
};

/**
 * Build the statement. `now` can be passed for tests.
 * Returns { limit, used, available, blocked, dueDate, isOverdue, overdueAmount, rows, history }
 */
export async function buildCreditStatement(userId, { now = new Date() } = {}) {
    const user = await User.findById(userId)
        .select("creditLimit usedCredit creditOverdueDate creditBlocked creditBlockedReason walletTransactions")
        .lean();
    if (!user) return null;
    const ledger = user.walletTransactions || [];

    // Orders that used credit: by payment method, or named in the credit ledger (door credit, refunds)
    const ledgerOrderIds = ledger
        .filter((t) => ["Credit Used", "Credit Refunded"].includes(t.type) && t.referenceOrderId)
        .map((t) => String(t.referenceOrderId));
    const orders = await Order.find({
        userId: user._id,
        $or: [
            { paymentMethod: { $in: ["Credit", "Credit + Online"] } },
            { _id: { $in: ledgerOrderIds.filter((id) => mongoose.isValidObjectId(id)) } },
        ],
    })
        .select("paymentMethod totalAmount creditAmountUsed partialReturn.originalTotal orderStatus createdAt items.name orderGroupId")
        .sort({ createdAt: 1 })
        .lean();

    const rows = orders.map((o) => {
        const id = String(o._id);
        const doorCredit = ledger.filter((t) => t.type === "Credit Used" && String(t.referenceOrderId) === id);
        const restored = ledger.filter((t) => t.type === "Credit Refunded" && String(t.referenceOrderId) === id);
        const charged = round2(orderCredit(o) + doorCredit.reduce((s, t) => s + (Number(t.amount) || 0), 0));
        const restoredAmount = round2(restored.reduce((s, t) => s + (Number(t.amount) || 0), 0));
        // Credit taken at the door starts its 7 days at the door, not when the order was placed
        const creditAt = orderCredit(o) > 0 ? new Date(o.createdAt) : new Date(doorCredit[0]?.createdAt || o.createdAt);
        return {
            orderId: id,
            shortId: shortIdOf(id),
            placedAt: o.createdAt,
            creditAt,
            items: itemsText(o.items),
            itemCount: (o.items || []).length,
            orderStatus: o.orderStatus,
            charged,
            restored: Math.min(restoredAmount, charged),
            net: round2(Math.max(0, charged - restoredAmount)),
        };
    }).filter((r) => r.charged > 0);

    const used = round2(Math.max(0, user.usedCredit || 0));
    const totalNet = round2(rows.reduce((s, r) => s + r.net, 0));
    // Credit owed that no order explains (older accounts, admin changes): shown as one line, paid first
    const unlinked = round2(Math.max(0, used - totalNet));
    let paidPool = round2(Math.max(0, totalNet - used));

    const lines = [];
    if (unlinked > 0) {
        const dueDate = user.creditOverdueDate ? new Date(user.creditOverdueDate) : now;
        lines.push({ orderId: null, shortId: null, label: "Earlier credit", creditAt: new Date(dueDate.getTime() - CREDIT_DAYS * DAY), charged: unlinked, restored: 0, net: unlinked, paid: 0, due: unlinked, dueDate });
    }
    for (const r of [...rows].sort((a, b) => a.creditAt - b.creditAt)) {
        const paid = round2(Math.min(r.net, paidPool));
        paidPool = round2(paidPool - paid);
        lines.push({ ...r, paid, due: round2(r.net - paid), dueDate: new Date(r.creditAt.getTime() + CREDIT_DAYS * DAY) });
    }
    for (const l of lines) {
        if (l.charged > 0 && l.net <= 0) l.status = "refunded";
        else if (l.due <= 0) l.status = "paid";
        else if (l.dueDate < now) l.status = "overdue";
        else l.status = l.paid > 0 ? "part_paid" : "due";
        l.daysLeft = l.due > 0 ? Math.ceil((l.dueDate - now) / DAY) : null;
    }

    const open = lines.filter((l) => l.due > 0);
    const nextDue = open.length ? open.reduce((a, b) => (a.dueDate <= b.dueDate ? a : b)) : null;
    const overdueAmount = round2(open.filter((l) => l.dueDate < now).reduce((s, l) => s + l.due, 0));

    // Credit ledger: purchases, money given back, payments
    const kindOf = (t) => (t.type === "Credit Used" ? "used" : t.type === "Credit Refunded" ? "refunded" : isRepayment(t) ? "repaid" : null);
    const history = ledger
        .map((t) => ({ t, kind: kindOf(t) }))
        .filter(({ t, kind }) => kind && t.status !== "Failed")
        .map(({ t, kind }) => ({
            txnId: t.txnId,
            kind,
            amount: round2(t.amount),
            note: t.note || "",
            orderId: t.referenceOrderId ? String(t.referenceOrderId) : null,
            shortId: t.referenceOrderId ? shortIdOf(t.referenceOrderId) : (String(t.note || "").match(/#([A-Z0-9]{6})/i)?.[1]?.toUpperCase() || null),
            createdAt: t.createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Checkout credit entries have no order on them: name the order placed at the same moment
    const checkoutOrders = rows.filter((r) => orderCredit(orders.find((o) => String(o._id) === r.orderId) || {}) > 0);
    for (const h of history) {
        if (h.kind !== "used" || h.orderId) continue;
        const t = new Date(h.createdAt).getTime();
        const match = checkoutOrders.find((r) => Math.abs(new Date(r.placedAt).getTime() - t) < 2 * 60 * 1000);
        if (match) { h.orderId = match.orderId; h.shortId = match.shortId; }
    }

    const limit = round2(user.creditLimit || 0);
    return {
        limit,
        used,
        available: user.creditBlocked ? 0 : round2(Math.max(0, limit - used)),
        blocked: !!user.creditBlocked,
        blockedReason: user.creditBlockedReason || "",
        dueDate: nextDue ? nextDue.dueDate : null,
        daysLeft: nextDue ? nextDue.daysLeft : null,
        isOverdue: overdueAmount > 0,
        overdueAmount,
        creditDays: CREDIT_DAYS,
        rows: lines.reverse(), // newest first
        history,
    };
}

/**
 * After a payment: the account's due date becomes that of the oldest order still not fully paid
 * (paying the oldest order moves the deadline to the next one). Nothing owed -> no due date.
 */
export async function refreshCreditDueDate(userId) {
    const st = await buildCreditStatement(userId);
    if (!st) return null;
    const dueDate = st.used > 0 ? st.dueDate : null;
    await User.updateOne({ _id: userId }, { $set: { creditOverdueDate: dueDate } });
    return dueDate;
}

