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
