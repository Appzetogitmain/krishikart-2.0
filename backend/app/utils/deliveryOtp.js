import crypto from "crypto";
import Order from "../models/order.js";

/*
 * Two 4-digit codes per delivery, made when the franchise hands the order to a delivery partner:
 *  - customer code: the customer reads it out at the door; the order can only be marked delivered with it
 *  - franchise code: if the customer does not take the order, the partner brings the goods back and
 *    the franchise reads this code out to confirm it got them back
 * The codes are never sent to the delivery partner.
 */

const MAX_WRONG = 5;
const LOCK_MINUTES = 10;
const code = () => String(crypto.randomInt(1000, 10000));

/** Makes (or re-makes, e.g. for a new partner) both codes. */
export async function createDeliveryOtps(orderId) {
    const customerCode = code();
    let franchiseCode = code();
    while (franchiseCode === customerCode) franchiseCode = code();
    await Order.updateOne(
        { _id: orderId },
        {
            $set: {
                deliveryOtp: {
                    customerCode,
                    franchiseCode,
                    generatedAt: new Date(),
                    customerVerifiedAt: null,
                    franchiseVerifiedAt: null,
                    customerAttempts: 0,
                    customerLockedUntil: null,
                    franchiseAttempts: 0,
                    franchiseLockedUntil: null,
                },
            },
        },
    );
    return { customerCode, franchiseCode };
}

/** The codes of some orders, as { orderId: { customerCode, franchiseCode, ... } }. */
export async function otpsOf(orderIds) {
    if (!orderIds?.length) return {};
    const rows = await Order.find({ _id: { $in: orderIds } })
        .select("+deliveryOtp.customerCode +deliveryOtp.franchiseCode")
        .lean();
    return Object.fromEntries(rows.map((r) => [String(r._id), r.deliveryOtp || {}]));
}

/**
 * Checks a code. which = "customer" | "franchise".
 * Returns { ok: true } (also when the order has no code, e.g. dispatched before codes existed),
 * or { ok: false, status, message }.
 */
export async function verifyDeliveryOtp(orderId, which, given) {
    const field = which === "customer" ? "customerCode" : "franchiseCode";
    const attemptsField = which === "customer" ? "customerAttempts" : "franchiseAttempts";
    const lockField = which === "customer" ? "customerLockedUntil" : "franchiseLockedUntil";
    const verifiedField = which === "customer" ? "customerVerifiedAt" : "franchiseVerifiedAt";
    const who = which === "customer" ? "customer" : "franchise";

    const row = await Order.findById(orderId).select(`+deliveryOtp.${field}`).lean();
    const otp = row?.deliveryOtp || {};
    if (!otp[field]) return { ok: true, noCode: true };

    if (otp[lockField] && new Date(otp[lockField]) > new Date()) {
        const mins = Math.ceil((new Date(otp[lockField]) - Date.now()) / 60000);
        return { ok: false, status: 429, message: `Too many wrong codes. Try again in ${mins} minute(s).` };
    }

    const entered = String(given ?? "").replace(/\D/g, "");
    if (!entered) {
        return { ok: false, status: 400, message: `Please enter the 4-digit code from the ${who}.` };
    }

    if (entered !== otp[field]) {
        const attempts = Number(otp[attemptsField] || 0) + 1;
        const set = attempts >= MAX_WRONG
            ? { [`deliveryOtp.${attemptsField}`]: 0, [`deliveryOtp.${lockField}`]: new Date(Date.now() + LOCK_MINUTES * 60000) }
            : { [`deliveryOtp.${attemptsField}`]: attempts };
        await Order.updateOne({ _id: orderId }, { $set: set });
        const left = MAX_WRONG - attempts;
        return {
            ok: false,
            status: 400,
            message: left > 0
                ? `Wrong code. Please check with the ${who}. ${left} tries left.`
                : `Wrong code too many times. Try again in ${LOCK_MINUTES} minutes.`,
        };
    }

    await Order.updateOne(
        { _id: orderId },
        { $set: { [`deliveryOtp.${verifiedField}`]: new Date(), [`deliveryOtp.${attemptsField}`]: 0, [`deliveryOtp.${lockField}`]: null } },
    );
    return { ok: true };
}
