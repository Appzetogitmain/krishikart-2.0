import Order from "../models/order.js";
import User from "../models/user.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Refunds a cancelled order exactly once, whatever path cancelled it
 * (customer/franchise/admin status change, franchise rejection, ...).
 *
 * - Wallet           -> full amount back to wallet
 * - Wallet + Online  -> wallet part + online part back to wallet
 * - Credit           -> credit limit restored
 * - Credit + Online  -> credit part restored, online part back to wallet
 * - UPI / Card       -> full amount back to wallet (only if payment completed)
 * - COD              -> nothing was paid, nothing to refund
 *
 * The order is "claimed" with an atomic update on `refundProcessedAt`, so two
 * simultaneous cancellations can never refund twice. The user's balance is
 * changed with a single atomic update as well.
 *
 * @returns {{ refunded: boolean, walletRefund: number, creditRestore: number }}
 */
export async function refundCancelledOrder(orderId, reasonNote = "cancelled") {
    const order = await Order.findOneAndUpdate(
        { _id: orderId, orderStatus: "Cancelled", refundProcessedAt: null },
        { $set: { refundProcessedAt: new Date() } },
        { new: true },
    );
    if (!order) return { refunded: false, walletRefund: 0, creditRestore: 0 };

    const total = Number(order.totalAmount || 0);
    let walletRefund = 0;
    let creditRestore = 0;
    switch (order.paymentMethod) {
        case "Wallet":
            walletRefund = total;
            break;
        case "Wallet + Online":
            walletRefund = Number(order.walletAmountUsed || 0) + Number(order.onlineAmountPaid || 0);
            break;
        case "Credit":
            creditRestore = total;
            break;
        case "Credit + Online":
            creditRestore = Number(order.creditAmountUsed || 0);
            walletRefund = Number(order.onlineAmountPaid || 0);
            break;
        case "UPI":
        case "Card":
        case "Razorpay":
            if (order.paymentStatus === "Completed") walletRefund = total;
            break;
        default:
            break; // COD: nothing collected yet
    }
    walletRefund = round2(walletRefund);
    creditRestore = round2(creditRestore);
    if (walletRefund <= 0 && creditRestore <= 0) {
        return { refunded: false, walletRefund: 0, creditRestore: 0 };
    }

    const now = new Date();
    const shortId = order._id.toString().slice(-6).toUpperCase();
    const txns = [];
    if (walletRefund > 0) {
        txns.push({
            txnId: `REF-${Date.now()}-${shortId}`,
            type: "Refund",
            amount: walletRefund,
            status: "Success",
            note: `Refund for order #${shortId} (${reasonNote}, paid by ${order.paymentMethod})`,
            referenceOrderId: order._id,
            createdAt: now,
        });
    }
    if (creditRestore > 0) {
        txns.push({
            txnId: `CRR-${Date.now()}-${shortId}`,
            type: "Credit Refunded",
            amount: creditRestore,
            status: "Success",
            note: `Credit restored for order #${shortId} (${reasonNote})`,
            referenceOrderId: order._id,
            createdAt: now,
        });
    }

    // One atomic update: no read-modify-write window for concurrent wallet changes
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
        // Release the claim so the refund can be retried instead of being silently lost
        await Order.updateOne({ _id: order._id }, { $set: { refundProcessedAt: null } });
        throw err;
    }

    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "Refunded" } });
    console.log(`[Refund] Order ${order._id}: wallet +₹${walletRefund}, credit restored ₹${creditRestore}`);
    return { refunded: true, walletRefund, creditRestore };
}
