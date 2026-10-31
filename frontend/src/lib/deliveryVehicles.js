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

/** Rough weight from the ordered quantities (kg / g / litre / ml), used to prefill the weight box */
export function estimateWeightKg(items = []) {
    let kg = 0;
    for (const i of items) {
        const q = Number(i.packedQuantity ?? i.quantity ?? i.qty) || 0;
        const u = String(i.unit || '').toLowerCase();
        if (u === 'kg' || u === 'ltr' || u === 'l') kg += q;
        else if (u === 'gm' || u === 'g' || u === 'ml') kg += q / 1000;
    }
    return Math.round(kg * 100) / 100;
}

/** Packed and the franchise said how big it is (weight now; box count on older orders) */
export const hasPackInfo = (o) => Number(o?.packedWeightKg) > 0 || Number(o?.numberOfPackages) > 0;

export const formatKg = (kg) => `${Math.round(Number(kg) * 100) / 100} kg`;
