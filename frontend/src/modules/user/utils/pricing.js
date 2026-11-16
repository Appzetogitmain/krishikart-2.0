/**
 * Bulk rates the customer can actually benefit from: only tiers cheaper than the normal rate,
 * lowest quantity first. (Same rule the server uses at checkout.)
 */
export function usefulBulkTiers(unitPrice, bulkPricing) {
    const base = Number(unitPrice) || 0
    return [...(bulkPricing || [])]
        .filter((t) => Number.isFinite(Number(t?.minQty)) && Number(t?.price) > 0 && Number(t.price) < base)
        .sort((a, b) => Number(a.minQty) - Number(b.minQty))
}

/** Unit price for a quantity: the highest bulk tier reached, only if it is cheaper. */
export function unitPriceForQuantity(unitPrice, bulkPricing, quantity) {
    const base = Number(unitPrice) || 0
    const tier = usefulBulkTiers(base, bulkPricing)
        .reverse()
        .find((t) => Number(quantity) >= Number(t.minQty))
    return tier ? Number(tier.price) : base
}

/**
 * The cheapest rate the customer can get for this product (its best bulk tier), or null.
 * Shown as the flashing "Best rate" on product cards.
 */
export function bestBulkRate(unitPrice, bulkPricing) {
    const tiers = usefulBulkTiers(unitPrice, bulkPricing)
    if (!tiers.length) return null
    const best = tiers.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a))
    return { price: Number(best.price), minQty: Number(best.minQty) }
}

/** "kg", "pc", "dozen"... for "₹59/kg" */
export const perUnitLabel = (unit) => (unit === 'pcs' || unit === 'pc' ? 'pc' : (unit || 'unit'))
