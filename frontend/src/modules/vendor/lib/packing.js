/** Shared helpers for Pack & Dispatch and Dispatch History. */

const KG_FACTORS = { kg: 1, kgs: 1, g: 0.001, gm: 0.001, gms: 0.001, gram: 0.001, grams: 0.001, quintal: 100, q: 100, ton: 1000, tonne: 1000 };

export const kgFactor = (unit) => KG_FACTORS[String(unit || '').trim().toLowerCase()];

const round = (n) => Math.round(n * 100) / 100;

/** Total weight in KG plus per-unit totals for items sold by count. `qtyOf(item)` gives the amount for each item. */
export function loadOf(items = [], qtyOf) {
    let kg = 0;
    const counts = {};
    for (const item of items) {
        const qty = Number(qtyOf(item)) || 0;
        if (qty <= 0) continue;
        const f = kgFactor(item.unit);
        if (f) kg += qty * f;
        else {
            const unit = String(item.unit || 'pcs').trim();
            const key = unit.toLowerCase();
            counts[key] = { unit, qty: round((counts[key]?.qty || 0) + qty) };
        }
    }
    return { kg: round(kg), counts: Object.values(counts) };
}

/** "342 KG", "20 pcs", "342 KG + 20 pcs" ("0 KG" when empty). */
export function loadText({ kg, counts }, t = (s) => s) {
    const parts = [];
    if (kg > 0 || !counts.length) parts.push(`${kg.toLocaleString('en-IN')} KG`);
    counts.forEach((c) => parts.push(`${c.qty.toLocaleString('en-IN')} ${t(c.unit)}`));
    return parts.join(' + ');
}

export const unitLabel = (unit) => (kgFactor(unit) === 1 ? 'KG' : String(unit || 'pcs'));

export const shortId = (id) => `#${String(id || '').slice(-8).toUpperCase()}`;

export const franchiseNameOf = (f) => f?.franchiseName || f?.shopName || f?.ownerName || 'Franchise';

export const rupees = (n) => `₹ ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/** What the vendor actually sends for an item (falls back to what was ordered). */
export const sentQty = (item) => (Number(item.dispatchedQuantity) > 0 ? Number(item.dispatchedQuantity) : Number(item.quantity) || 0);

export const rateOf = (item) => Number(item.quotedPrice) || Number(item.price) || 0;
