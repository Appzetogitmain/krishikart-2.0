/**
 * Delivery date / shift helpers.
 *
 * All business dates are evaluated in IST (Asia/Kolkata) regardless of the
 * server's own timezone, so a server running in UTC behaves the same as one
 * running in India.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MAX_ADVANCE_DAYS = 7;

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
 * @returns {{ ok: true, scheduledDate: Date|null, isPreOrder: boolean } | { ok: false, status: number, message: string }}
 */
export function resolveDeliverySchedule(scheduledDate, deliveryShift, now = new Date()) {
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
