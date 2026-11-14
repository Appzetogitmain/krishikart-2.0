/**
 * Delivery vehicles and the weight rule (client, Oct 2026): up to 20 kg goes on a bike / scooter, heavier
 * orders on an auto or a four-wheeler. Keep in sync with backend/app/constants/delivery.js.
 */
export const TWO_WHEELER_MAX_KG = 20;
export const MAX_ORDER_WEIGHT_KG = 5000;

export const VEHICLES = [
    { id: 'bike', label: 'Bike', twoWheeler: true },
    { id: 'scooter', label: 'Scooter', twoWheeler: true },
    { id: 'auto', label: 'Auto', twoWheeler: false },
    { id: 'four_wheeler', label: '4-Wheeler', twoWheeler: false },
];

export const vehicleLabel = (type) => VEHICLES.find((v) => v.id === String(type || '').toLowerCase())?.label || type || '';
export const isTwoWheeler = (type) => !!VEHICLES.find((v) => v.id === String(type || '').toLowerCase())?.twoWheeler;

/** Which kind of vehicle an order of this weight needs */
export const vehicleFor = (kg) => (Number(kg) > TWO_WHEELER_MAX_KG ? 'Auto / 4-Wheeler' : 'Bike / Scooter');

// Packed quantity once packed (it is 0 until then), else the ordered quantity
const qtyOf = (i) => (Number(i?.packedQuantity) > 0 ? Number(i.packedQuantity) : Number(i?.quantity ?? i?.qty) || 0);

/** Rough weight from the ordered quantities (kg / g / litre / ml), used to prefill the weight box */
export function estimateWeightKg(items = []) {
    let kg = 0;
    for (const i of items) {
        const q = qtyOf(i);
        const u = String(i.unit || '').toLowerCase();
        if (u === 'kg' || u === 'ltr' || u === 'l') kg += q;
        else if (u === 'gm' || u === 'g' || u === 'ml') kg += q / 1000;
    }
    return Math.round(kg * 100) / 100;
}

const WEIGHABLE = new Set(['kg', 'ltr', 'l', 'gm', 'g', 'ml']);

/** Weight of one unit for items sold by piece / dozen / box when the product does not say (kg) */
export const DEFAULT_UNIT_KG = { pcs: 1, dz: 2, box: 20 };

const unitKgOf = (item) => {
    const own = Number(item?.productId?.unitWeightKg ?? item?.unitWeightKg);
    if (own > 0) return own;
    return DEFAULT_UNIT_KG[String(item?.unit || '').toLowerCase()] ?? DEFAULT_UNIT_KG.pcs;
};

/**
 * Most the packed weight can be: weight / volume items exactly as ordered (5 kg paneer -> 5 kg); piece / dozen /
 * box items at their weight per unit (the product's own, else 1 kg a piece, 2 kg a dozen, 20 kg a box).
 * Same rule as backend/app/constants/delivery.js maxPackedWeightKg.
 */
export function maxPackedWeightKg(items = []) {
    let kg = 0;
    for (const i of items || []) {
        const q = qtyOf(i);
        if (!(q > 0)) continue;
        const u = String(i.unit || '').toLowerCase();
        if (WEIGHABLE.has(u)) kg += u === 'gm' || u === 'g' || u === 'ml' ? q / 1000 : q;
        else kg += q * unitKgOf(i);
    }
    if (!(kg > 0)) return MAX_ORDER_WEIGHT_KG;
    return Math.min(MAX_ORDER_WEIGHT_KG, Math.round(kg * 100) / 100);
}

/** Packed and the franchise said how big it is (weight now; box count on older orders) */
export const hasPackInfo = (o) => Number(o?.packedWeightKg) > 0 || Number(o?.numberOfPackages) > 0;

export const formatKg = (kg) => `${Math.round(Number(kg) * 100) / 100} kg`;
