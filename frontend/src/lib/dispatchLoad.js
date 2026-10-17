/**
 * How much is being dispatched, in the unit that fits the goods: weighed items give a total weight
 * in KG; items sold by count (pcs, bundle, dozen, ...) give a quantity in their own unit.
 */

const WEIGHT_UNITS = new Set(['kg', 'kgs', 'g', 'gm', 'gms', 'gram', 'grams', 'quintal', 'q', 'ton', 'tonne']);

export const isWeightUnit = (unit) => WEIGHT_UNITS.has(String(unit || '').trim().toLowerCase());

/** Per-unit totals for the count items, e.g. [{ unit: 'pcs', qty: 200 }]. */
export function countTotals(items = []) {
    const totals = {};
    for (const item of items) {
        if (!item || isWeightUnit(item.unit)) continue;
        const qty = Number(item.dispatchedQuantity) > 0 ? Number(item.dispatchedQuantity) : Number(item.quantity ?? item.qty) || 0;
        if (qty <= 0) continue;
        const unit = String(item.unit || 'pcs').trim();
        const key = unit.toLowerCase();
        totals[key] = { unit, qty: (totals[key]?.qty || 0) + qty };
    }
    return Object.values(totals);
}

/** e.g. "12 KG", "200 pcs", "12 KG + 200 pcs" ("0" when there is nothing). */
export function describeLoad(items = [], weightKg = 0) {
    const kg = Number(weightKg) || 0;
    const parts = [];
    if (kg > 0) parts.push(`${kg} KG`);
    const counts = countTotals(items);
    if (counts.length) parts.push(counts.map((c) => `${c.qty} ${c.unit}`).join(' + '));
    return parts.join(' + ') || '0';
}

/** Label that matches what describeLoad shows. */
export function loadLabel(items = [], weightKg = 0, { prefix = 'Packed' } = {}) {
    const hasWeight = Number(weightKg) > 0;
    const hasCount = countTotals(items).length > 0;
    if (hasWeight && hasCount) return `${prefix} weight & quantity`;
    if (!hasWeight && hasCount) return `${prefix} quantity`;
    return `${prefix} weight`;
}
