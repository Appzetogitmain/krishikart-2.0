/**
 * Earliest delivery first (client, Oct 2026): lists used for packing and assigning deliveries are sorted by
 * delivery day, then by the start of the delivery slot ("6 AM - 8 AM" before "2 PM - 4 PM"), then by order time.
 * Same rule as backend/app/utils/deliverySchedule.js getShiftStartHour.
 */

/** Minutes after midnight when the slot starts ("2 PM - 4 PM" -> 840, "10:30 AM - 12 PM" -> 630); null if unknown */
export function slotStartMinutes(shift) {
    const m = String(shift || '').match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + (parseInt(m[2] || '0', 10) || 0);
}

const dayOf = (o) => {
    const d = new Date(o?.scheduledDate || o?.createdAt || o?.date || 0);
    return Number.isNaN(d.getTime()) ? 0 : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const slotOf = (o) => slotStartMinutes(o?.deliveryShift || o?.deliverySlot || o?.slot);
const timeOf = (o) => new Date(o?.createdAt || 0).getTime() || 0;

/** Array.sort comparator: earliest delivery day, then earliest slot (unknown slot last), then oldest order */
export function byDeliveryTime(a, b) {
    return (dayOf(a) - dayOf(b))
        || ((slotOf(a) ?? 24 * 60) - (slotOf(b) ?? 24 * 60))
        || (timeOf(a) - timeOf(b));
}
