/**
 * Delivery vehicles and weight limits (client, Oct 2026): orders up to 20 kg go on a bike / scooter,
 * heavier orders on an auto or a four-wheeler. The franchise enters the packed weight instead of a box count.
 * Keep in sync with frontend/src/lib/deliveryVehicles.js.
 */
export const VEHICLE_TYPES = ["bike", "scooter", "auto", "four_wheeler"];
export const TWO_WHEELERS = ["bike", "scooter"];
export const TWO_WHEELER_MAX_KG = 20;
export const MAX_ORDER_WEIGHT_KG = 5000;

// Indian registration numbers: MP09CS1234, MP09R1234 (autos often have a one-letter series), DL1CAB1234
export const VEHICLE_NUMBER_RE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;

export const isTwoWheeler = (type) => TWO_WHEELERS.includes(String(type || "").toLowerCase());

// Packed quantity once packed (it is 0 until then), else the ordered quantity
const qtyOf = (i) => (Number(i?.packedQuantity) > 0 ? Number(i.packedQuantity) : Number(i?.quantity) || 0);

/** Rough weight from the ordered quantities (kg / g / litre / ml); used when no packed weight was entered */
export function estimateWeightKg(items = []) {
  let kg = 0;
  for (const i of items) {
    const q = qtyOf(i);
    const u = String(i.unit || "").toLowerCase();
    if (u === "kg" || u === "ltr" || u === "l") kg += q;
    else if (u === "gm" || u === "g" || u === "ml") kg += q / 1000;
  }
  return Math.round(kg * 100) / 100;
}

const WEIGHABLE = new Set(["kg", "ltr", "l", "gm", "g", "ml"]);

/**
 * Most the packed weight can be (client, Nov 2026: "5 kg paneer, 122 kg makes no sense"): when every item is
 * sold by weight / volume, never more than what was ordered (packed). Items sold by piece / box / dozen have no
 * known weight, so such orders only get the overall limit.
 */
export function maxPackedWeightKg(items = []) {
  const list = (items || []).filter((i) => qtyOf(i) > 0);
  if (!list.length || !list.every((i) => WEIGHABLE.has(String(i.unit || "").toLowerCase()))) return MAX_ORDER_WEIGHT_KG;
  return estimateWeightKg(list);
}

/** Weight that decides the vehicle: what the franchise entered at packing, else the estimate */
export const orderWeightKg = (order) => Number(order?.packedWeightKg) > 0 ? Number(order.packedWeightKg) : estimateWeightKg(order?.items);

/** Packed and the franchise said how big it is (weight now; box count on older orders) */
export const hasPackInfo = (order) => Number(order?.packedWeightKg) > 0 || Number(order?.numberOfPackages) > 0;
