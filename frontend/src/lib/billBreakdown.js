/**
 * The lines of an order's bill, so every screen (customer, franchise, admin, printed bill) shows the
 * same thing and the lines add up to the total.
 *
 * After a partial delivery (customer gave some items back at the door) the order keeps its original
 * subtotal; totalAmount, discountAmount and tax are already the new, smaller values. The bill then reads:
 *   Subtotal - Returned at delivery - Discount (now only the kept items' share) + Tax + Delivery = Total
 * e.g. tomato 1000 + potato 1000, coupon 500, tomato given back: 2000 - 1000 - 250 = 750.
 */
export function billBreakdown(order = {}) {
    const n = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const pr = order.partialReturn || null;
    const returned = pr && n(pr.returnedValue) > 0 ? n(pr.returnedValue) : 0;
    return {
        subtotal: n(order.subtotal),
        returned,
        returnedItems: returned ? (pr.items || []).map((i) => `${i.name} ${i.quantity} ${i.unit || ''}`.trim()) : [],
        discount: n(order.discountAmount ?? order.discount),
        couponCode: order.couponCode || '',
        tax: n(order.tax),
        deliveryFee: n(order.deliveryFee),
        total: n(order.totalAmount ?? order.total),
    };
}
