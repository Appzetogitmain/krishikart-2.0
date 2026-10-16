import PriceZone from "../models/priceZone.js";
import ZonePrice from "../models/zonePrice.js";

/**
 * Selling prices.
 *
 * A product's rate at a franchise is decided in this order:
 *   1. the franchise's own override (set by admin on Stock Levels), if any
 *   2. the rate for the franchise's city price code (e.g. JPR = Jaipur), if set
 *   3. the product's main rate
 * MRP and bulk rates follow the city code when it sets them, else the product.
 */

/** "Jaipur, Rajasthan" / " jaipur " → "jaipur" (city names are typed freely) */
export const cityKeyOf = (text) => String(text || "").split(",")[0].replace(/\s+/g, " ").trim().toLowerCase();

export const normalizeZoneCode = (code) => String(code || "").trim().toUpperCase();

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** All active city codes, with a lookup from city name to code. */
export async function loadZones() {
    const zones = await PriceZone.find({ isActive: true }).lean();
    const byCity = new Map();
    for (const z of zones) for (const c of z.cities || []) byCity.set(cityKeyOf(c), z);
    return { zones, byCity };
}

export const zoneOfFranchise = (franchise, zoneIndex) =>
    (franchise && zoneIndex?.byCity.get(cityKeyOf(franchise.city))) || null;

/**
 * Prepare price lookups for the given franchises and products in two queries.
 * @returns resolve(franchise, product, inventoryRow) → { price, listPrice, comparePrice, bulkPricing, zoneCode }
 */
export async function buildPriceResolver(franchises = [], productIds = []) {
    const zoneIndex = await loadZones();
    const codes = [...new Set(franchises.map((f) => zoneOfFranchise(f, zoneIndex)?.code).filter(Boolean))];
    const zoneRows = codes.length && productIds.length
        ? await ZonePrice.find({ zoneCode: { $in: codes }, productId: { $in: productIds } }).lean()
        : [];
    const zoneMap = new Map(zoneRows.map((r) => [`${r.zoneCode}:${r.productId}`, r]));

    return function resolve(franchise, product, inventoryRow) {
        const zone = zoneOfFranchise(franchise, zoneIndex);
        const zr = zone ? zoneMap.get(`${zone.code}:${product._id}`) : null;
        const mainPrice = Number(product.price) || 0;
        const cityPrice = num(zr?.price);
        const listPrice = cityPrice != null ? cityPrice : mainPrice;
        const override = num(inventoryRow?.franchisePrice);
        const price = override != null && override > 0 ? override : listPrice;
        const comparePrice = num(zr?.comparePrice) ?? num(product.comparePrice) ?? null;
        const bulkPricing = Array.isArray(zr?.bulkPricing) ? zr.bulkPricing : (product.bulkPricing || []);
        return { price, listPrice, comparePrice, bulkPricing, zoneCode: zone?.code || null };
    };
}

/**
 * Unit price for a quantity. A bulk tier is used only when it is actually cheaper than the
 * normal rate, so buying more never costs more per unit.
 */
export function priceForQuantity(unitPrice, bulkPricing, quantity) {
    const base = Number(unitPrice) || 0;
    const tier = [...(bulkPricing || [])]
        .filter((t) => Number.isFinite(Number(t?.minQty)) && Number.isFinite(Number(t?.price)))
        .sort((a, b) => Number(b.minQty) - Number(a.minQty))
        .find((t) => Number(quantity) >= Number(t.minQty));
    if (tier && Number(tier.price) < base) return { price: Number(tier.price), isBulkRate: true };
    return { price: base, isBulkRate: false };
}
