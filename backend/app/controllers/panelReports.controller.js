import mongoose from "mongoose";
import * as XLSX from "xlsx";
import Order from "../models/order.js";
import User from "../models/user.js";
import Franchise from "../models/franchise.js";
import Vendor from "../models/vendor.js";
import Delivery from "../models/delivery.js";
import Product from "../models/product.js";
import Inventory from "../models/inventory.js";
import POSSale from "../models/posSale.js";
import ProcurementRequest from "../models/procurementRequest.js";
import DeliveryCodRemittance from "../models/deliveryCodRemittance.js";
import FranchiseAdminPayout from "../models/franchiseAdminPayout.js";
import handleResponse from "../utils/helper.js";
import { getISTDayKey, istDayKeyToDate } from "../utils/deliverySchedule.js";

/**
 * Reports for every panel (admin, franchise, vendor, delivery partner).
 *
 * Every report has the same shape so one screen can render any of them and one
 * exporter can turn any of them into an Excel workbook:
 *   { title, period: {from, to}, kpis: [{label, value, format}],
 *     chart: {title, series: [{key, label, format}], data: [{date, ...}]},
 *     sections: [{id, title, description, columns: [{key, label, format}], rows}] }
 * Dates are calendar days in IST.
 */

const TZ = "Asia/Kolkata";
const DELIVERED = ["Delivered", "Received"];
const SUPPLY_APPROVED = ["approved", "preparing", "ready_for_pickup", "completed"];
const SUPPLY_DISPATCHED = ["ready_for_pickup", "completed"];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const toObjectId = (id) => {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
};

function addDays(dayKey, days) {
    const d = new Date(`${dayKey}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST days). Defaults to the current month. */
function parseRange(query) {
    const today = getISTDayKey();
    const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
    let from = isDay(query.from) ? query.from : `${today.slice(0, 8)}01`;
    let to = isDay(query.to) ? query.to : today;
    if (to > today) to = today;
    if (from > to) from = to;
    // Keep reports to at most ~3 years so a single request stays fast
    if (from < addDays(to, -1100)) from = addDays(to, -1100);
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    return { from, to, start: istDayKeyToDate(from), end: istDayKeyToDate(addDays(to, 1)), days };
}

const inRange = (range) => ({ $gte: range.start, $lt: range.end });
const istDayExpr = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: TZ } });

/** Fill every day of the range so charts show gaps as zero. */
function fillDays(range, rowsByDay, keys) {
    return range.days.map((date) => {
        const row = rowsByDay.get(date) || {};
        const out = { date };
        keys.forEach((k) => { out[k] = round2(row[k] || 0); });
        return out;
    });
}

const nameMap = async (Model, ids, field) => {
    const objIds = [...new Set(ids.filter(Boolean).map(String))].map(toObjectId).filter(Boolean);
    if (!objIds.length) return new Map();
    const docs = await Model.find({ _id: { $in: objIds } }).select(field).lean();
    return new Map(docs.map((d) => [String(d._id), d[field]]));
};

/** Order-based figures shared by the admin and franchise reports. */
async function orderFigures(match, range) {
    const nonCancelled = { orderStatus: { $ne: "Cancelled" } };
    const [facet] = await Order.aggregate([
        { $match: { ...match, createdAt: inRange(range) } },
        {
            $facet: {
                totals: [{
                    $group: {
                        _id: null,
                        all: { $sum: 1 },
                        cancelled: { $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0] } },
                        booked: { $sum: { $cond: [{ $ne: ["$orderStatus", "Cancelled"] }, "$totalAmount", 0] } },
                        delivered: { $sum: { $cond: [{ $in: ["$orderStatus", DELIVERED] }, 1, 0] } },
                        deliveredValue: { $sum: { $cond: [{ $in: ["$orderStatus", DELIVERED] }, "$totalAmount", 0] } },
                        discount: { $sum: { $cond: [{ $ne: ["$orderStatus", "Cancelled"] }, { $ifNull: ["$discountAmount", 0] }, 0] } },
                        tax: { $sum: { $cond: [{ $ne: ["$orderStatus", "Cancelled"] }, { $ifNull: ["$tax", 0] }, 0] } },
                        deliveryFee: { $sum: { $cond: [{ $ne: ["$orderStatus", "Cancelled"] }, { $ifNull: ["$deliveryFee", 0] }, 0] } },
                        advance: { $sum: { $cond: [{ $and: [{ $ne: ["$orderStatus", "Cancelled"] }, { $eq: ["$isPreOrder", true] }] }, 1, 0] } },
                    },
                }],
                daily: [
                    { $match: nonCancelled },
                    { $group: { _id: istDayExpr("$createdAt"), orders: { $sum: 1 }, value: { $sum: "$totalAmount" } } },
                ],
                byStatus: [{ $group: { _id: "$orderStatus", orders: { $sum: 1 }, value: { $sum: "$totalAmount" } } }, { $sort: { orders: -1 } }],
                byPayment: [
                    { $match: nonCancelled },
                    { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, value: { $sum: "$totalAmount" } } },
                    { $sort: { value: -1 } },
                ],
                byFranchise: [
                    { $match: nonCancelled },
                    {
                        $group: {
                            _id: "$franchiseId",
                            orders: { $sum: 1 },
                            value: { $sum: "$totalAmount" },
                            delivered: { $sum: { $cond: [{ $in: ["$orderStatus", DELIVERED] }, 1, 0] } },
                            deliveredValue: { $sum: { $cond: [{ $in: ["$orderStatus", DELIVERED] }, "$totalAmount", 0] } },
                        },
                    },
                    { $sort: { value: -1 } },
                ],
                byProduct: [
                    { $match: nonCancelled },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.productId",
                            name: { $first: "$items.name" },
                            unit: { $first: "$items.unit" },
                            quantity: { $sum: "$items.quantity" },
                            value: { $sum: { $ifNull: ["$items.subtotal", { $multiply: ["$items.price", "$items.quantity"] }] } },
                            orders: { $sum: 1 },
                        },
                    },
                    { $sort: { value: -1 } },
                ],
            },
        },
    ]);
    return facet;
}

/** Group product sales rows by category name. */
async function categoryRows(productRows) {
    const products = await Product.find({ _id: { $in: productRows.map((p) => p._id).filter(Boolean) } })
        .select("category")
        .populate("category", "name")
        .lean();
    const catByProduct = new Map(products.map((p) => [String(p._id), p.category?.name || "Uncategorised"]));
    const byCat = new Map();
    for (const p of productRows) {
        const cat = catByProduct.get(String(p._id)) || "Uncategorised";
        const row = byCat.get(cat) || { category: cat, products: 0, quantity: 0, value: 0 };
        row.products += 1;
        row.quantity += p.quantity;
        row.value += p.value;
        byCat.set(cat, row);
    }
    return [...byCat.values()].map((r) => ({ ...r, quantity: round2(r.quantity), value: round2(r.value) })).sort((a, b) => b.value - a.value);
}

const productSection = (rows, title = "Product-wise Sales") => ({
    id: "products",
    title,
    description: "Quantity and value sold for each product (cancelled orders excluded).",
    columns: [
        { key: "name", label: "Product" },
        { key: "unit", label: "Unit" },
        { key: "quantity", label: "Quantity Sold", format: "number" },
        { key: "orders", label: "Orders", format: "number" },
        { key: "value", label: "Sales Value", format: "currency" },
    ],
    rows: rows.map((p) => ({ name: p.name || "Unknown product", unit: p.unit || "", quantity: round2(p.quantity), orders: p.orders, value: round2(p.value) })),
});

const statusSection = (rows) => ({
    id: "status",
    title: "Orders by Status",
    columns: [
        { key: "status", label: "Status" },
        { key: "orders", label: "Orders", format: "number" },
        { key: "value", label: "Value", format: "currency" },
    ],
    rows: rows.map((r) => ({ status: r._id || "Unknown", orders: r.orders, value: round2(r.value) })),
});

/** Procurement value of a request: approved price x quantity actually sent (or ordered). */
function supplyValue(req) {
    return (req.items || []).reduce((sum, it) => {
        const qty = Number(it.dispatchedQuantity) > 0 ? Number(it.dispatchedQuantity) : Number(it.quantity) || 0;
        return sum + qty * (Number(it.quotedPrice) || 0);
    }, 0);
}
function damagedValue(req) {
    return (req.items || []).reduce((sum, it) => {
        const lost = it.rejected ? Number(it.dispatchedQuantity || it.quantity || 0) : Number(it.damagedQuantity || 0);
        return sum + lost * (Number(it.quotedPrice) || 0);
    }, 0);
}
const requestValue = (req) => (SUPPLY_APPROVED.includes(req.status) ? (Number(req.totalQuotedAmount) || supplyValue(req)) : 0);
const STATUS_LABEL = {
    pending_assignment: "Waiting for vendor", assigned: "Waiting for quote", quoted: "Quote sent",
    approved: "Approved", preparing: "Packing", ready_for_pickup: "Dispatched", completed: "Received", rejected: "Rejected",
};

/* ===================================================================== */

async function buildAdminReport(range) {
    const f = await orderFigures({}, range);
    const t = f.totals[0] || {};
    const franchiseNames = await nameMap(Franchise, f.byFranchise.map((r) => r._id), "franchiseName");

    const [newCustomers, procurement, payouts, codOrders] = await Promise.all([
        User.countDocuments({ createdAt: inRange(range) }),
        ProcurementRequest.find({ createdAt: inRange(range) }).lean(),
        FranchiseAdminPayout.find({ paidAt: inRange(range) }).lean(),
        Order.find({ paymentMethod: "COD", "codTracking.isCollected": true, "codTracking.collectedAt": inRange(range) })
            .select("codTracking totalAmount").lean(),
    ]);

    // Procurement by vendor
    const vendorNames = await nameMap(Vendor, procurement.map((p) => p.assignedVendorId), "fullName");
    const byVendor = new Map();
    let procurementValue = 0;
    for (const p of procurement) {
        const key = p.assignedVendorId ? String(p.assignedVendorId) : "unassigned";
        const row = byVendor.get(key) || { vendor: key === "unassigned" ? "Not assigned yet" : vendorNames.get(key) || "Unknown vendor", requests: 0, approved: 0, value: 0, damaged: 0 };
        row.requests += 1;
        if (SUPPLY_APPROVED.includes(p.status)) row.approved += 1;
        const v = requestValue(p);
        row.value += v;
        row.damaged += damagedValue(p);
        procurementValue += v;
        byVendor.set(key, row);
    }

    // COD by delivery partner
    const partnerNames = await nameMap(Delivery, codOrders.map((o) => o.codTracking?.collectedByDeliveryId), "fullName");
    const byPartner = new Map();
    let codCollected = 0;
    for (const o of codOrders) {
        const key = String(o.codTracking?.collectedByDeliveryId || "unknown");
        const amt = Number(o.codTracking?.collectedAmount || o.totalAmount || 0);
        const row = byPartner.get(key) || { partner: partnerNames.get(key) || "Unknown", collected: 0, pending: 0, submitted: 0, verified: 0 };
        row.collected += amt;
        const st = o.codTracking?.remittanceStatus || "pending";
        if (row[st] !== undefined) row[st] += amt;
        codCollected += amt;
        byPartner.set(key, row);
    }
    const payoutTotal = payouts.reduce((s, p) => s + Number(p.amount || 0), 0);

    const daily = new Map(f.daily.map((d) => [d._id, { orders: d.orders, value: d.value }]));
    return {
        title: "Business Report",
        kpis: [
            { label: "Total Orders", value: (t.all || 0) - (t.cancelled || 0), format: "number" },
            { label: "Order Value", value: round2(t.booked), format: "currency" },
            { label: "Delivered Orders", value: t.delivered || 0, format: "number" },
            { label: "Delivered Sales", value: round2(t.deliveredValue), format: "currency" },
            { label: "Average Order Value", value: round2(((t.all || 0) - (t.cancelled || 0)) ? t.booked / ((t.all || 0) - (t.cancelled || 0)) : 0), format: "currency" },
            { label: "Cancelled Orders", value: t.cancelled || 0, format: "number" },
            { label: "New Customers", value: newCustomers, format: "number" },
            { label: "Stock Purchases (Vendors)", value: round2(procurementValue), format: "currency" },
            { label: "COD Cash Collected", value: round2(codCollected), format: "currency" },
            { label: "Paid to Franchises", value: round2(payoutTotal), format: "currency" },
        ],
        chart: {
            title: "Daily Orders & Sales",
            series: [{ key: "value", label: "Order Value", format: "currency" }, { key: "orders", label: "Orders", format: "number" }],
            data: fillDays(range, daily, ["orders", "value"]),
        },
        sections: [
            {
                id: "daily", title: "Day-wise Sales",
                columns: [{ key: "date", label: "Date", format: "date" }, { key: "orders", label: "Orders", format: "number" }, { key: "value", label: "Order Value", format: "currency" }],
                rows: fillDays(range, daily, ["orders", "value"]),
            },
            {
                id: "franchises", title: "Franchise-wise Sales",
                columns: [
                    { key: "franchise", label: "Franchise" }, { key: "orders", label: "Orders", format: "number" },
                    { key: "value", label: "Order Value", format: "currency" }, { key: "delivered", label: "Delivered", format: "number" },
                    { key: "deliveredValue", label: "Delivered Sales", format: "currency" },
                ],
                rows: f.byFranchise.map((r) => ({
                    franchise: r._id ? franchiseNames.get(String(r._id)) || "Unknown franchise" : "Not assigned yet",
                    orders: r.orders, value: round2(r.value), delivered: r.delivered, deliveredValue: round2(r.deliveredValue),
                })),
            },
            {
                id: "categories", title: "Category-wise Sales",
                columns: [{ key: "category", label: "Category" }, { key: "products", label: "Products", format: "number" }, { key: "quantity", label: "Quantity Sold", format: "number" }, { key: "value", label: "Sales Value", format: "currency" }],
                rows: await categoryRows(f.byProduct),
            },
            productSection(f.byProduct),
            {
                id: "payments", title: "Payment Methods",
                columns: [{ key: "method", label: "Payment Method" }, { key: "orders", label: "Orders", format: "number" }, { key: "value", label: "Value", format: "currency" }],
                rows: f.byPayment.map((r) => ({ method: r._id || "Unknown", orders: r.orders, value: round2(r.value) })),
            },
            statusSection(f.byStatus),
            {
                id: "vendors", title: "Stock Purchases by Vendor",
                description: "Value counts approved requests at the approved price.",
                columns: [
                    { key: "vendor", label: "Vendor" }, { key: "requests", label: "Requests", format: "number" },
                    { key: "approved", label: "Approved", format: "number" }, { key: "value", label: "Purchase Value", format: "currency" },
                    { key: "damaged", label: "Damaged / Rejected Value", format: "currency" },
                ],
                rows: [...byVendor.values()].map((r) => ({ ...r, value: round2(r.value), damaged: round2(r.damaged) })).sort((a, b) => b.value - a.value),
            },
            {
                id: "cod", title: "COD Cash by Delivery Partner",
                columns: [
                    { key: "partner", label: "Delivery Partner" }, { key: "collected", label: "Collected", format: "currency" },
                    { key: "pending", label: "Not Submitted", format: "currency" }, { key: "submitted", label: "Submitted", format: "currency" },
                    { key: "verified", label: "Verified", format: "currency" },
                ],
                rows: [...byPartner.values()].map((r) => ({ partner: r.partner, collected: round2(r.collected), pending: round2(r.pending), submitted: round2(r.submitted), verified: round2(r.verified) })),
            },
        ],
    };
}

async function buildFranchiseReport(range, franchiseId) {
    const fid = toObjectId(franchiseId);
    const [f, posSales, procurement, inventory] = await Promise.all([
        orderFigures({ franchiseId: fid }, range),
        POSSale.find({ franchiseId: fid, createdAt: inRange(range) }).lean(),
        ProcurementRequest.find({ franchiseId: fid, createdAt: inRange(range) }).sort({ createdAt: -1 }).lean(),
        Inventory.findOne({ franchiseId: fid }).populate("items.productId", "name unit").lean(),
    ]);
    const t = f.totals[0] || {};

    // Counter (POS) sales
    const posDaily = new Map();
    const posByMethod = new Map();
    const posProducts = new Map();
    let posValue = 0;
    for (const s of posSales) {
        const day = getISTDayKey(s.createdAt);
        const d = posDaily.get(day) || { count: 0, value: 0 };
        d.count += 1; d.value += Number(s.totalAmount || 0);
        posDaily.set(day, d);
        const m = posByMethod.get(s.paymentMethod) || { count: 0, value: 0 };
        m.count += 1; m.value += Number(s.totalAmount || 0);
        posByMethod.set(s.paymentMethod, m);
        posValue += Number(s.totalAmount || 0);
        for (const it of s.items || []) {
            const key = String(it.productId);
            const p = posProducts.get(key) || { _id: it.productId, name: it.name, unit: it.unit, quantity: 0, value: 0, orders: 0 };
            p.quantity += Number(it.quantity || 0); p.value += Number(it.subtotal || 0); p.orders += 1;
            posProducts.set(key, p);
        }
    }

    // Combined product list (online + counter)
    const combined = new Map(f.byProduct.map((p) => [String(p._id), { ...p }]));
    for (const [key, p] of posProducts) {
        const row = combined.get(key) || { _id: p._id, name: p.name, unit: p.unit, quantity: 0, value: 0, orders: 0 };
        row.quantity += p.quantity; row.value += p.value; row.orders += p.orders;
        combined.set(key, row);
    }
    const productRows = [...combined.values()].sort((a, b) => b.value - a.value);

    const onlineDaily = new Map(f.daily.map((d) => [d._id, d]));
    const chartData = range.days.map((date) => ({
        date,
        online: round2(onlineDaily.get(date)?.value || 0),
        counter: round2(posDaily.get(date)?.value || 0),
        orders: (onlineDaily.get(date)?.orders || 0) + (posDaily.get(date)?.count || 0),
    }));

    const stockRows = (inventory?.items || [])
        .filter((i) => i.productId)
        .map((i) => {
            const stock = Number(i.currentStock || 0);
            const min = Number(i.mbq || 0);
            return {
                product: i.productId.name, unit: i.productId.unit || "", stock, min,
                status: stock <= 0 ? "Out of stock" : min > 0 && stock <= min ? "Low" : "OK",
            };
        })
        .sort((a, b) => a.stock - b.stock);
    const procurementSpend = procurement.reduce((s, p) => s + requestValue(p), 0);
    const onlineOrders = (t.all || 0) - (t.cancelled || 0);

    return {
        title: "Sales & Stock Report",
        kpis: [
            { label: "Total Sales", value: round2((t.booked || 0) + posValue), format: "currency" },
            { label: "Online Orders", value: onlineOrders, format: "number" },
            { label: "Online Order Value", value: round2(t.booked), format: "currency" },
            { label: "Delivered Orders", value: t.delivered || 0, format: "number" },
            { label: "Counter Sales (POS)", value: posSales.length, format: "number" },
            { label: "Counter Sales Value", value: round2(posValue), format: "currency" },
            { label: "Cancelled Orders", value: t.cancelled || 0, format: "number" },
            { label: "Stock Requests", value: procurement.length, format: "number" },
            { label: "Stock Purchase Value", value: round2(procurementSpend), format: "currency" },
            { label: "Low / Out of Stock Items", value: stockRows.filter((r) => r.status !== "OK").length, format: "number" },
        ],
        chart: {
            title: "Daily Sales (Online + Counter)",
            series: [{ key: "online", label: "Online Orders", format: "currency" }, { key: "counter", label: "Counter Sales", format: "currency" }],
            data: chartData,
        },
        sections: [
            {
                id: "daily", title: "Day-wise Sales",
                columns: [
                    { key: "date", label: "Date", format: "date" }, { key: "orders", label: "Bills / Orders", format: "number" },
                    { key: "online", label: "Online Sales", format: "currency" }, { key: "counter", label: "Counter Sales", format: "currency" },
                    { key: "total", label: "Total", format: "currency" },
                ],
                rows: chartData.map((d) => ({ ...d, total: round2(d.online + d.counter) })),
            },
            productSection(productRows, "Product-wise Sales (Online + Counter)"),
            {
                id: "payments", title: "Payment Methods",
                columns: [{ key: "method", label: "Payment Method" }, { key: "count", label: "Orders / Bills", format: "number" }, { key: "value", label: "Value", format: "currency" }],
                rows: [
                    ...f.byPayment.map((r) => ({ method: `${r._id || "Unknown"} (online)`, count: r.orders, value: round2(r.value) })),
                    ...[...posByMethod.entries()].map(([m, v]) => ({ method: `${m} (counter)`, count: v.count, value: round2(v.value) })),
                ],
            },
            statusSection(f.byStatus),
            {
                id: "procurement", title: "Stock Requests",
                columns: [
                    { key: "date", label: "Date", format: "date" }, { key: "request", label: "Request #" },
                    { key: "items", label: "Items", format: "number" }, { key: "status", label: "Status" },
                    { key: "value", label: "Approved Value", format: "currency" }, { key: "damaged", label: "Damaged / Rejected Value", format: "currency" },
                ],
                rows: procurement.map((p) => ({
                    date: getISTDayKey(p.createdAt), request: `#${String(p._id).slice(-6).toUpperCase()}`,
                    items: (p.items || []).length, status: STATUS_LABEL[p.status] || p.status,
                    value: round2(requestValue(p)), damaged: round2(damagedValue(p)),
                })),
            },
            {
                id: "stock", title: "Current Stock",
                description: "Stock as of now (not affected by the date range).",
                columns: [
                    { key: "product", label: "Product" }, { key: "unit", label: "Unit" },
                    { key: "stock", label: "In Stock", format: "number" }, { key: "min", label: "Minimum Stock", format: "number" },
                    { key: "status", label: "Status" },
                ],
                rows: stockRows,
            },
        ],
    };
}

async function buildVendorReport(range, vendorId) {
    const requests = await ProcurementRequest.find({ assignedVendorId: String(vendorId), createdAt: inRange(range) })
        .sort({ createdAt: -1 }).lean();
    const franchiseNames = await nameMap(Franchise, requests.map((r) => r.franchiseId), "franchiseName");

    const daily = new Map();
    const byProduct = new Map();
    const byFranchise = new Map();
    let approvedValue = 0, dispatchedValue = 0, lostValue = 0, quoted = 0, approved = 0, dispatched = 0, rejected = 0;
    for (const r of requests) {
        const value = requestValue(r);
        const isDispatched = SUPPLY_DISPATCHED.includes(r.status);
        if (["quoted", ...SUPPLY_APPROVED].includes(r.status)) quoted += 1;
        if (SUPPLY_APPROVED.includes(r.status)) { approved += 1; approvedValue += value; }
        if (isDispatched) { dispatched += 1; dispatchedValue += value; }
        if (r.status === "rejected") rejected += 1;
        const lost = damagedValue(r);
        lostValue += lost;

        const day = getISTDayKey(r.createdAt);
        const d = daily.get(day) || { requests: 0, value: 0 };
        d.requests += 1; d.value += value;
        daily.set(day, d);

        const fKey = String(r.franchiseId || "");
        const fr = byFranchise.get(fKey) || { franchise: franchiseNames.get(fKey) || "Unknown franchise", requests: 0, value: 0, lost: 0 };
        fr.requests += 1; fr.value += value; fr.lost += lost;
        byFranchise.set(fKey, fr);

        for (const it of r.items || []) {
            const key = `${it.productId}|${it.unit || ""}`;
            const p = byProduct.get(key) || { product: it.name || "Unknown product", unit: it.unit || "", requested: 0, sent: 0, received: 0, damaged: 0, value: 0 };
            p.requested += Number(it.quantity || 0);
            p.sent += Number(it.dispatchedQuantity || 0);
            p.received += Number(it.receivedQuantity || 0);
            p.damaged += it.rejected ? Number(it.dispatchedQuantity || 0) : Number(it.damagedQuantity || 0);
            if (SUPPLY_APPROVED.includes(r.status)) {
                const qty = Number(it.dispatchedQuantity) > 0 ? Number(it.dispatchedQuantity) : Number(it.quantity || 0);
                p.value += qty * (Number(it.quotedPrice) || 0);
            }
            byProduct.set(key, p);
        }
    }

    return {
        title: "Supply Report",
        kpis: [
            { label: "Orders Received", value: requests.length, format: "number" },
            { label: "Quotes Sent", value: quoted, format: "number" },
            { label: "Approved Orders", value: approved, format: "number" },
            { label: "Approved Value", value: round2(approvedValue), format: "currency" },
            { label: "Dispatched Orders", value: dispatched, format: "number" },
            { label: "Dispatched Value", value: round2(dispatchedValue), format: "currency" },
            { label: "Damaged / Rejected Value", value: round2(lostValue), format: "currency" },
            { label: "Net Supply Value", value: round2(approvedValue - lostValue), format: "currency" },
        ],
        chart: {
            title: "Daily Orders & Approved Value",
            series: [{ key: "value", label: "Approved Value", format: "currency" }, { key: "requests", label: "Orders", format: "number" }],
            data: fillDays(range, daily, ["requests", "value"]),
        },
        sections: [
            {
                id: "products", title: "Product-wise Supply",
                columns: [
                    { key: "product", label: "Product" }, { key: "unit", label: "Unit" },
                    { key: "requested", label: "Requested", format: "number" }, { key: "sent", label: "Sent", format: "number" },
                    { key: "received", label: "Received", format: "number" }, { key: "damaged", label: "Damaged / Rejected", format: "number" },
                    { key: "value", label: "Approved Value", format: "currency" },
                ],
                rows: [...byProduct.values()].map((p) => ({ ...p, requested: round2(p.requested), sent: round2(p.sent), received: round2(p.received), damaged: round2(p.damaged), value: round2(p.value) })).sort((a, b) => b.value - a.value),
            },
            {
                id: "franchises", title: "Franchise-wise Supply",
                columns: [
                    { key: "franchise", label: "Franchise" }, { key: "requests", label: "Orders", format: "number" },
                    { key: "value", label: "Approved Value", format: "currency" }, { key: "lost", label: "Damaged / Rejected Value", format: "currency" },
                ],
                rows: [...byFranchise.values()].map((r) => ({ ...r, value: round2(r.value), lost: round2(r.lost) })).sort((a, b) => b.value - a.value),
            },
            {
                id: "orders", title: "All Orders",
                columns: [
                    { key: "date", label: "Date", format: "date" }, { key: "request", label: "Order #" },
                    { key: "franchise", label: "Franchise" }, { key: "items", label: "Items", format: "number" },
                    { key: "status", label: "Status" }, { key: "invoice", label: "Invoice" },
                    { key: "value", label: "Approved Value", format: "currency" },
                ],
                rows: requests.map((r) => ({
                    date: getISTDayKey(r.createdAt), request: `#${String(r._id).slice(-6).toUpperCase()}`,
                    franchise: franchiseNames.get(String(r.franchiseId)) || "Unknown franchise",
                    items: (r.items || []).length, status: STATUS_LABEL[r.status] || r.status,
                    invoice: r.invoice?.invoiceNumber || "", value: round2(requestValue(r)),
                })),
            },
            {
                id: "daily", title: "Day-wise Orders",
                columns: [{ key: "date", label: "Date", format: "date" }, { key: "requests", label: "Orders", format: "number" }, { key: "value", label: "Approved Value", format: "currency" }],
                rows: fillDays(range, daily, ["requests", "value"]),
            },
        ],
    };
}

async function buildDeliveryReport(range, deliveryId) {
    const did = toObjectId(deliveryId);
    const [delivered, codOrders, remittances, returnsOrders] = await Promise.all([
        Order.find({ deliveryPartnerId: did, orderStatus: { $in: DELIVERED }, deliveredAt: inRange(range) })
            .select("deliveredAt totalAmount paymentMethod shippingAddress userId codTracking")
            .populate("userId", "fullName").sort({ deliveredAt: -1 }).lean(),
        Order.find({ "codTracking.collectedByDeliveryId": did, "codTracking.collectedAt": inRange(range) }).select("codTracking totalAmount").lean(),
        DeliveryCodRemittance.find({ deliveryPartnerId: did, createdAt: inRange(range) }).sort({ createdAt: -1 }).lean(),
        Order.find({ "returnRequests.pickupDeliveryPartnerId": did }).select("returnRequests").lean(),
    ]);

    const daily = new Map();
    for (const o of delivered) {
        const day = getISTDayKey(o.deliveredAt);
        const d = daily.get(day) || { deliveries: 0, cod: 0 };
        d.deliveries += 1;
        if (o.paymentMethod === "COD") d.cod += Number(o.codTracking?.collectedAmount || o.totalAmount || 0);
        daily.set(day, d);
    }
    const cod = { collected: 0, pending: 0, submitted: 0, verified: 0 };
    for (const o of codOrders) {
        const amt = Number(o.codTracking?.collectedAmount || o.totalAmount || 0);
        cod.collected += amt;
        const st = o.codTracking?.remittanceStatus || "pending";
        if (cod[st] !== undefined) cod[st] += amt;
    }
    const pickups = returnsOrders.flatMap((o) => (o.returnRequests || []).filter((r) =>
        String(r.pickupDeliveryPartnerId) === String(did) && r.pickupPickedAt && r.pickupPickedAt >= range.start && r.pickupPickedAt < range.end));

    return {
        title: "My Delivery Report",
        kpis: [
            { label: "Deliveries Completed", value: delivered.length, format: "number" },
            { label: "Delivered Order Value", value: round2(delivered.reduce((s, o) => s + Number(o.totalAmount || 0), 0)), format: "currency" },
            { label: "COD Cash Collected", value: round2(cod.collected), format: "currency" },
            { label: "COD Not Yet Submitted", value: round2(cod.pending), format: "currency" },
            { label: "COD Submitted (awaiting check)", value: round2(cod.submitted), format: "currency" },
            { label: "COD Verified by Admin", value: round2(cod.verified), format: "currency" },
            { label: "Return Pickups", value: pickups.length, format: "number" },
            { label: "Average Deliveries / Day", value: round2(delivered.length / Math.max(1, range.days.length)), format: "number" },
        ],
        chart: {
            title: "Daily Deliveries",
            series: [{ key: "deliveries", label: "Deliveries", format: "number" }, { key: "cod", label: "COD Collected", format: "currency" }],
            data: fillDays(range, daily, ["deliveries", "cod"]),
        },
        sections: [
            {
                id: "deliveries", title: "Delivered Orders",
                columns: [
                    { key: "date", label: "Date", format: "date" }, { key: "order", label: "Order #" },
                    { key: "customer", label: "Customer" }, { key: "address", label: "Address" },
                    { key: "payment", label: "Payment" }, { key: "amount", label: "Amount", format: "currency" },
                ],
                rows: delivered.map((o) => ({
                    date: getISTDayKey(o.deliveredAt), order: `#${String(o._id).slice(-6).toUpperCase()}`,
                    customer: o.userId?.fullName || "Customer", address: String(o.shippingAddress || "").slice(0, 80),
                    payment: o.paymentMethod, amount: round2(o.totalAmount),
                })),
            },
            {
                id: "remittances", title: "COD Cash Submitted",
                columns: [
                    { key: "date", label: "Date", format: "date" }, { key: "orders", label: "Orders", format: "number" },
                    { key: "amount", label: "Amount", format: "currency" }, { key: "status", label: "Status" },
                    { key: "reference", label: "Reference" },
                ],
                rows: remittances.map((r) => ({
                    date: getISTDayKey(r.createdAt), orders: (r.orderIds || []).length, amount: round2(r.amount),
                    status: { submitted: "Waiting for admin", verified: "Verified", rejected: "Rejected" }[r.status] || r.status,
                    reference: r.referenceNo || "",
                })),
            },
            {
                id: "daily", title: "Day-wise Deliveries",
                columns: [{ key: "date", label: "Date", format: "date" }, { key: "deliveries", label: "Deliveries", format: "number" }, { key: "cod", label: "COD Collected", format: "currency" }],
                rows: fillDays(range, daily, ["deliveries", "cod"]),
            },
        ],
    };
}

/* ===================================================================== */

async function buildReport(role, req) {
    const range = parseRange(req.query);
    let report;
    if (role === "admin") report = await buildAdminReport(range);
    else if (role === "franchise") report = await buildFranchiseReport(range, req.franchise._id);
    else if (role === "vendor") report = await buildVendorReport(range, req.vendor._id);
    else report = await buildDeliveryReport(range, req.delivery._id);
    return { ...report, period: { from: range.from, to: range.to } };
}

/** Turn a report into an .xlsx workbook: a Summary sheet plus one sheet per section. */
function toWorkbook(report) {
    const wb = XLSX.utils.book_new();
    const fmtDate = (k) => { const [y, m, d] = String(k).split("-"); return d ? `${d}-${m}-${y}` : k; };
    const summary = [
        [report.title],
        [`Period: ${fmtDate(report.period.from)} to ${fmtDate(report.period.to)}`],
        [],
        ["Item", "Value"],
        ...report.kpis.map((k) => [k.label, k.value]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(summary);
    ws["!cols"] = [{ wch: 34 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Summary");

    const used = new Set(["Summary"]);
    for (const s of report.sections) {
        const header = s.columns.map((c) => c.label + (c.format === "currency" ? " (₹)" : ""));
        const rows = s.rows.map((r) => s.columns.map((c) => (c.format === "date" ? fmtDate(r[c.key]) : r[c.key] ?? "")));
        const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
        sheet["!cols"] = s.columns.map((c) => ({ wch: Math.max(12, c.label.length + 4, c.key === "address" ? 40 : 0) }));
        let name = s.title.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
        while (used.has(name)) name = `${name.slice(0, 28)} ${used.size}`;
        used.add(name);
        XLSX.utils.book_append_sheet(wb, sheet, name);
    }
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

const handler = (role) => async (req, res) => {
    try {
        const report = await buildReport(role, req);
        return handleResponse(res, 200, "Report generated", report);
    } catch (error) {
        console.error(`[Reports] ${role} report failed:`, error);
        return handleResponse(res, 500, "Could not generate the report");
    }
};

const exportHandler = (role) => async (req, res) => {
    try {
        const report = await buildReport(role, req);
        const buffer = toWorkbook(report);
        const fileName = `Kisaankart_${report.title.replace(/[^A-Za-z0-9]+/g, "_")}_${report.period.from}_to_${report.period.to}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        return res.send(buffer);
    } catch (error) {
        console.error(`[Reports] ${role} export failed:`, error);
        return handleResponse(res, 500, "Could not download the report");
    }
};

export const getAdminReport = handler("admin");
export const getFranchiseReport = handler("franchise");
export const getVendorReport = handler("vendor");
export const getDeliveryReport = handler("delivery");
export const exportAdminReport = exportHandler("admin");
export const exportFranchiseReport = exportHandler("franchise");
export const exportVendorReport = exportHandler("vendor");
export const exportDeliveryReport = exportHandler("delivery");
