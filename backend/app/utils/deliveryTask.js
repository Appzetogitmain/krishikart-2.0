import Order from "../models/order.js";

/**
 * What a delivery partner needs to decide on a new task before accepting it: where it goes, how much
 * to collect, how big it is. Sent with the "new_task" alert and the push notification.
 */
export async function deliveryTaskSummary(orderId) {
    const o = await Order.findById(orderId)
        .select("shippingAddress totalAmount paymentMethod items numberOfPackages userId franchiseId")
        .populate("userId", "fullName legalEntityName")
        .populate("franchiseId", "franchiseName formattedAddress area city")
        .lean();
    if (!o) return {};
    const cod = o.paymentMethod === "COD";
    return {
        customerName: o.userId?.legalEntityName || o.userId?.fullName || "Customer",
        address: o.shippingAddress || "",
        pickupFrom: o.franchiseId?.franchiseName || "",
        pickupAddress: o.franchiseId?.formattedAddress || [o.franchiseId?.area, o.franchiseId?.city].filter(Boolean).join(", "),
        orderTotal: Number(o.totalAmount) || 0,
        // What the partner has to take from the customer (0 when it was paid online)
        amountToCollect: cod ? Number(o.totalAmount) || 0 : 0,
        paymentMethod: o.paymentMethod,
        itemCount: (o.items || []).length,
        packages: o.numberOfPackages || 0,
    };
}

/** One line for push notifications: "Ramesh Hotel, MG Road ... · Collect ₹1,250 (COD)". */
export function taskSummaryLine(s) {
    const money = s.amountToCollect > 0 ? `Collect ₹${Math.round(s.amountToCollect).toLocaleString("en-IN")} (COD)` : "Paid online";
    return [s.customerName, s.address, money].filter(Boolean).join(" · ").slice(0, 180);
}
