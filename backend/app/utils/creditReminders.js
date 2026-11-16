import User from "../models/user.js";
import { buildCreditStatement, CREDIT_DAYS, REMINDER_AFTER_DAYS } from "./creditStatement.js";
import { createUserNotification } from "./userNotification.js";
import { sendNotificationToUser } from "./pushNotificationHelper.js";
import { getISTDayKey, getISTMinutesOfDay } from "./deliverySchedule.js";

/**
 * KK Credit due reminders (client, Nov 2026): credit must be paid within 7 days; from 3 days after an
 * order went on credit the customer is reminded every day until it is paid, and twice a day once it
 * is overdue. Sent as an app notification and a phone push, each at most once per slot:
 *   morning slot 10:00-17:59 IST (every day from day 3), evening slot 18:00-21:59 IST (overdue only).
 */

const DAY = 24 * 3600 * 1000;
const IST_OFFSET = 5.5 * 3600 * 1000;
const istDay = (d) => Math.floor((new Date(d).getTime() + IST_OFFSET) / DAY);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const rupees = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN")}`;

/** Which slot is open right now, or null outside reminder hours */
export function reminderSlot(now = new Date()) {
    const m = getISTMinutesOfDay(now);
    if (m >= 10 * 60 && m < 18 * 60) return "am";
    if (m >= 18 * 60 && m < 22 * 60) return "pm";
    return null;
}

/** The reminder text for a statement, or null when no reminder is due yet */
export function reminderFor(st, now = new Date()) {
    if (!st || !(st.used > 0) || !st.dueDate) return null;
    // From the 3rd calendar day (IST) after the order went on credit
    if (istDay(now) < istDay(st.dueDate) - (CREDIT_DAYS - REMINDER_AFTER_DAYS)) return null;
    const open = st.rows.filter((r) => r.due > 0);
    if (st.isOverdue) {
        const since = open.filter((r) => new Date(r.dueDate) < now).reduce((a, r) => (new Date(r.dueDate) < new Date(a) ? r.dueDate : a), st.dueDate);
        return {
            overdue: true,
            title: "KK Credit payment overdue",
            message: `${rupees(st.overdueAmount)} was due on ${fmtDate(since)}. KK Credit orders are paused until you pay. Tap to pay now.`,
        };
    }
    const dueNow = open.filter((r) => istDay(r.dueDate) <= istDay(st.dueDate)).reduce((s, r) => s + r.due, 0);
    const days = istDay(st.dueDate) - istDay(now);
    const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return {
        overdue: false,
        title: `KK Credit due ${when}`,
        message: `Please pay ${rupees(dueNow)} by ${fmtDate(st.dueDate)} to keep using KK Credit.${st.used > dueNow ? ` Total credit used: ${rupees(st.used)}.` : ""}`,
    };
}

export async function sendCreditReminders(now = new Date()) {
    const slot = reminderSlot(now);
    if (!slot) return { sent: 0 };
    const slotKey = `${getISTDayKey(now)}-${slot}`;
    // Only accounts whose (oldest) due date is close enough for reminders
    const horizon = new Date(now.getTime() + (CREDIT_DAYS - REMINDER_AFTER_DAYS + 1) * DAY);
    const users = await User.find({
        usedCredit: { $gt: 0 },
        creditOverdueDate: { $ne: null, $lte: horizon },
        creditReminderSlot: { $ne: slotKey },
    }).select("_id").lean();

    let sent = 0;
    for (const { _id } of users) {
        try {
            const st = await buildCreditStatement(_id, { now });
            const r = reminderFor(st, now);
            if (!r || (slot === "pm" && !r.overdue)) continue;
            // Claim the slot first so a second server / restart can't send it twice
            const claim = await User.updateOne({ _id, creditReminderSlot: { $ne: slotKey } }, { $set: { creditReminderSlot: slotKey } });
            if (!claim.modifiedCount) continue;
            await createUserNotification({
                userId: _id,
                type: "credit",
                title: r.title,
                message: r.message,
                link: "/credit-info",
                meta: { amount: st.used, overdueAmount: st.overdueAmount, dueDate: st.dueDate, kind: "credit_due" },
            });
            await sendNotificationToUser(_id, {
                title: r.title,
                body: r.message,
                data: { type: "credit_due", link: "/credit-info" },
            }, "user");
            sent++;
        } catch (err) {
            console.error("[CreditReminders] user", String(_id), err?.message || err);
        }
    }
    if (sent) console.log(`[CreditReminders] ${slotKey}: sent ${sent}`);
    return { sent };
}
