/**
 * Delivery date / shift helpers.
 *
 * All business dates are evaluated in IST (Asia/Kolkata) regardless of the
 * server's own timezone, so a server running in UTC behaves the same as one
 * running in India.
 */

import GlobalSetting from "../models/globalSetting.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MAX_ADVANCE_DAYS = 7;

/** GlobalSetting key holding the admin's no-delivery days. */
export const DELIVERY_OFF_DAYS_KEY = "delivery_off_days";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Days the admin has closed for delivery:
 * { weeklyOff: [0-6] (0 = Sunday), dates: [{ date: "YYYY-MM-DD", reason, closedSlots }] }
 * A date with closedSlots (e.g. ["4 PM - 6 PM", "6 PM - 8 PM"]) is a part day: the store is open
 * and only those slots are closed. Without them the whole day is off.
 */
export async function getDeliveryOffDays() {
    try {
        const doc = await GlobalSetting.findOne({ key: DELIVERY_OFF_DAYS_KEY }).lean();
        const value = doc?.value || {};
        return {
            weeklyOff: Array.isArray(value.weeklyOff) ? value.weeklyOff.map(Number).filter((n) => n >= 0 && n <= 6) : [],
            dates: Array.isArray(value.dates)
                ? value.dates
                    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date)))
                    .map((d) => ({ ...d, closedSlots: Array.isArray(d.closedSlots) ? d.closedSlots.map(String).filter(Boolean) : [] }))
                : [],
        };
    } catch (err) {
        console.error("Load delivery off days error:", err);
        return { weeklyOff: [], dates: [] };
    }
}

/** Returns why there is no delivery on this IST day ("Diwali", "Sunday"), or null if it is open. */
export function getOffDayReason(dayKey, offDays) {
    if (!offDays || !dayKey) return null;
    const holiday = (offDays.dates || []).find((d) => d.date === dayKey);
    // A part day (only some slots closed) keeps the day open
    if (holiday && !(holiday.closedSlots || []).length) return String(holiday.reason || "").trim() || "Holiday";
    const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
    if ((offDays.weeklyOff || []).includes(weekday)) return `weekly off on ${WEEKDAY_NAMES[weekday]}s`;
    return null;
}

const slotKey = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

/** Why this slot is closed on this IST day (part-day holiday), or null if it is open. */
export function getClosedSlotReason(dayKey, shift, offDays) {
    if (!offDays || !dayKey || !shift) return null;
    const holiday = (offDays.dates || []).find((d) => d.date === dayKey);
    if (!holiday || !(holiday.closedSlots || []).length) return null;
    return holiday.closedSlots.some((s) => slotKey(s) === slotKey(shift))
        ? String(holiday.reason || "").trim() || "Holiday"
        : null;
}

/** Customer-facing message for an order placed on a closed day. */
export function offDayMessage(dayKey, reason) {
    const label = new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    });
    return `We are not delivering on ${label} (${reason}). Please pick another delivery date.`;
}

/** Returns "YYYY-MM-DD" for the IST calendar day of the given instant. */
export function getISTDayKey(date = new Date()) {
    const d = new Date(new Date(date).getTime() + IST_OFFSET_MS);
    return d.toISOString().slice(0, 10);
}

/** Minutes past IST midnight for the given instant. */
export function getISTMinutesOfDay(date = new Date()) {
    const d = new Date(new Date(date).getTime() + IST_OFFSET_MS);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Instant of IST midnight for a "YYYY-MM-DD" key. */
export function istDayKeyToDate(dayKey) {
    return new Date(`${dayKey}T00:00:00+05:30`);
}

function addDaysToKey(dayKey, days) {
    const d = new Date(`${dayKey}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * Parses a delivery shift label like "6 AM - 8 AM" and returns its start hour (0-23).
 */
export function getShiftStartHour(shift) {
    if (!shift) return null;
    const match = String(shift).match(/(\d+)\s*(AM|PM)/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const ampm = match[2].toUpperCase();

    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    return hour;
}

/**
 * Validates the delivery date + shift chosen at checkout.
 *
 * `scheduledDate` may be "YYYY-MM-DD" (treated as an IST day) or any ISO
 * timestamp (its IST calendar day is used).
 *
 * Pass `offDays` (from getDeliveryOffDays) to also reject days the admin has closed.
 *
 * @returns {{ ok: true, scheduledDate: Date|null, isPreOrder: boolean } | { ok: false, status: number, message: string }}
 */
export function resolveDeliverySchedule(scheduledDate, deliveryShift, now = new Date(), offDays = null) {
    const todayKey = getISTDayKey(now);

    let dayKey = todayKey;
    if (scheduledDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(scheduledDate))) {
            dayKey = String(scheduledDate);
        } else {
            const parsed = new Date(scheduledDate);
            if (Number.isNaN(parsed.getTime())) {
                return { ok: false, status: 400, message: "Invalid delivery date" };
            }
            dayKey = getISTDayKey(parsed);
        }
    }

    if (dayKey < todayKey) {
        return { ok: false, status: 400, message: "Delivery date cannot be in the past. Please pick today or a later date." };
    }
    if (dayKey > addDaysToKey(todayKey, MAX_ADVANCE_DAYS)) {
        return { ok: false, status: 400, message: `Orders can only be scheduled up to ${MAX_ADVANCE_DAYS} days in advance` };
    }

    const offReason = getOffDayReason(dayKey, offDays);
    if (offReason) {
        return { ok: false, status: 400, message: offDayMessage(dayKey, offReason) };
    }
    const slotReason = getClosedSlotReason(dayKey, deliveryShift, offDays);
    if (slotReason) {
        const label = new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
        return { ok: false, status: 400, message: `The ${deliveryShift} slot is closed on ${label} (${slotReason}). Please pick another slot.` };
    }

    if (dayKey === todayKey) {
        const startHour = getShiftStartHour(deliveryShift);
        if (startHour !== null && getISTMinutesOfDay(now) >= startHour * 60) {
            return {
                ok: false,
                status: 400,
                message: "This delivery slot has already started for today. Please pick a later slot or another date.",
            };
        }
    }

    return {
        ok: true,
        scheduledDate: istDayKeyToDate(dayKey),
        isPreOrder: dayKey > todayKey,
    };
}
