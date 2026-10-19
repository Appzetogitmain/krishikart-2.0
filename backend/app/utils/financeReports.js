import FinanceEntry from "../models/financeEntry.js";
import ProcurementRequest from "../models/procurementRequest.js";
import StockReturn from "../models/stockReturn.js";
import Franchise from "../models/franchise.js";
import Vendor from "../models/vendor.js";

/*
 * Financial (profit & margin) reports for the supply chain Vendor -> Company -> Franchise -> Customer,
 * built from the records written when orders are delivered (models/financeEntry.js) and from vendor
 * deliveries. Same report shape as the other panel reports (see panelReports.controller.js).
 *
 * Who sees what:
 *   admin     - every stage, every franchise and vendor (city admins: their cities only)
 *   franchise - its own sales, its buying value from the company and its own profit only
 *   vendor    - its own sales value and selling rates only (its own buying cost is never asked for)
 */

const TZ = "Asia/Kolkata";
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (part, whole) => (Number(whole) > 0 ? round2((Number(part) / Number(whole)) * 100) : null);
const dayOf = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const ref = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const sum = (rows, f) => round2(rows.reduce((s, r) => s + (Number(r[f]) || 0), 0));

const fillDays = (range, byDay, keys) => range.days.map((date) => {
    const row = byDay.get(date) || {};
    const out = { date };
    keys.forEach((k) => { out[k] = round2(row[k] || 0); });
    return out;
});
const addTo = (map, key, obj) => {
    const cur = map.get(key) || {};
    for (const [k, v] of Object.entries(obj)) cur[k] = (cur[k] || 0) + (Number(v) || 0);
    map.set(key, cur);
};

/** Per-line figures of a record, with the company's numbers only where the cost is known. */
function lineFigures(l) {
    const known = l.cost !== null && l.cost !== undefined;
    return {
        revenue: l.revenue,
        transfer: l.transferValue,
        earning: l.franchiseEarning,
        cost: known ? l.cost : 0,
        knownTransfer: known ? l.transferValue : 0,
        knownRevenue: known ? l.revenue : 0,
        companyProfit: known ? round2(l.transferValue - l.cost) : 0,
        unknownRevenue: known ? 0 : l.revenue,
    };
}

const entriesIn = (range, extra = {}) =>
    FinanceEntry.find({ deliveredAt: { $gte: range.start, $lt: range.end }, ...extra }).sort({ deliveredAt: -1 }).lean();

/** Vendor deliveries the franchise checked in during the range, valued at the agreed rate. */
async function vendorSupplies(range, match = {}) {
    const rows = await ProcurementRequest.find({
        status: "completed",
        assignedVendorId: { $nin: [null, ""] },
        $or: [
            { "receiptSummary.at": { $gte: range.start, $lt: range.end } },
            { "receiptSummary.at": { $exists: false }, updatedAt: { $gte: range.start, $lt: range.end } },
        ],
        ...match,
    }).sort({ updatedAt: -1 }).lean();
    return rows.map((r) => {
        const lines = (r.items || []).map((i) => {
            const rate = Number(i.quotedPrice || i.price || 0);
            const received = Number(i.receivedQuantity ?? i.dispatchedQuantity ?? i.quantity) || 0;
            const accepted = i.rejected ? 0 : Math.max(0, received - (Number(i.damagedQuantity) || 0));
            return {
                productId: String(i.productId), name: i.name, unit: i.unit, rate,
                accepted, value: round2(accepted * rate), notPaid: round2((received - accepted) * rate),
            };
        });
        return {
            id: r._id, vendorId: String(r.assignedVendorId), franchiseId: r.franchiseId ? String(r.franchiseId) : null,
            at: r.receiptSummary?.at || r.updatedAt, lines,
            value: sum(lines, "value"), notPaid: sum(lines, "notPaid"),
        };
    });
}

const creditNotes = (range, match = {}) =>
    StockReturn.find({ status: "received", "destination.type": "vendor", receivedAt: { $gte: range.start, $lt: range.end }, ...match })
        .populate("fromFranchiseId", "franchiseName").sort({ receivedAt: -1 }).lean();

const names = async (Model, ids, field) => {
    const docs = await Model.find({ _id: { $in: [...new Set(ids.filter(Boolean))] } }).select(field).lean();
    return new Map(docs.map((d) => [String(d._id), d[field]]));
};

const COST_NOTE = {
    avg: "Average cost",
    last_purchase: "Last purchase rate",
    network_last_purchase: "Last purchase rate (other store)",
    unknown: "Cost not known",
};

/* ------------------------------------------------------------------ */

export async function buildAdminFinanceReport(range, scope) {
    const scoped = scope ? { franchiseId: { $in: scope.franchiseIds } } : {};
    const [entries, supplies, credits] = await Promise.all([
        entriesIn(range, scoped),
        vendorSupplies(range, scoped),
        creditNotes(range, scope ? { fromFranchiseId: { $in: scope.franchiseIds } } : {}),
    ]);

    const t = { revenue: 0, transfer: 0, earning: 0, cost: 0, knownTransfer: 0, knownRevenue: 0, companyProfit: 0, unknownRevenue: 0 };
    const byFranchise = new Map(), byProduct = new Map(), byDay = new Map();
    let deliveryFees = 0, discounts = 0, tax = 0;
    const orderRows = [];

    for (const e of entries) {
        const ef = { revenue: 0, cost: 0, companyProfit: 0, earning: 0 };
        for (const l of e.lines || []) {
            const f = lineFigures(l);
            for (const k of Object.keys(t)) t[k] += f[k];
            ef.revenue += f.revenue; ef.cost += f.cost; ef.companyProfit += f.companyProfit; ef.earning += f.earning;
            addTo(byFranchise, String(e.franchiseId), { ...f });
            const pk = String(l.productId);
            addTo(byProduct, pk, { qty: l.quantity, ...f });
            if (!byProduct.get(pk).name) Object.assign(byProduct.get(pk), { name: l.name, unit: l.unit });
        }
        deliveryFees += Number(e.totals?.deliveryFee) || 0;
        discounts += Number(e.totals?.discount) || 0;
        tax += Number(e.totals?.tax) || 0;
        addTo(byFranchise, String(e.franchiseId), { orders: 1, deliveryFee: e.totals?.deliveryFee, discount: e.totals?.discount });
        addTo(byDay, dayOf(e.deliveredAt), {
            sales: ef.revenue,
            profit: ef.companyProfit + (Number(e.totals?.deliveryFee) || 0) - (Number(e.totals?.discount) || 0),
        });
        orderRows.push({
            date: dayOf(e.deliveredAt), order: ref(e.orderId), franchiseId: String(e.franchiseId),
            sales: round2(ef.revenue), cost: round2(ef.cost), companyProfit: round2(ef.companyProfit), franchiseEarning: round2(ef.earning),
            note: e.costComplete ? "" : "Some item costs not known",
        });
    }

    const vendorValue = sum(supplies, "value");
    const creditValue = round2(credits.reduce((s, c) => s + (Number(c.creditNote?.amount) || 0), 0));
    const netCompany = round2(t.companyProfit + deliveryFees - discounts);

    const frNames = await names(Franchise, [...byFranchise.keys(), ...supplies.map((s) => s.franchiseId)], "franchiseName");
    const vNames = await names(Vendor, supplies.map((s) => s.vendorId), "fullName");
    const byVendor = new Map();
    for (const s of supplies) addTo(byVendor, s.vendorId, { deliveries: 1, value: s.value, notPaid: s.notPaid });
    for (const c of credits) if (c.destination?.vendorId) addTo(byVendor, String(c.destination.vendorId), { credit: c.creditNote?.amount });
    const moreVendorNames = await names(Vendor, [...byVendor.keys()].filter((k) => !vNames.has(k)), "fullName");

    return {
        title: "Profit & Margin Report",
        kpis: [
            { label: "Orders Delivered", value: entries.length, format: "number" },
            { label: "Sales to Customers", value: round2(t.revenue), format: "currency" },
            { label: "Company Buying Cost (vendor rates)", value: round2(t.cost), format: "currency" },
            { label: "Company Revenue from Franchises", value: round2(t.transfer), format: "currency" },
            { label: "Company Gross Profit", value: round2(t.companyProfit), format: "currency" },
            { label: "Company Margin", value: pct(t.companyProfit, t.knownTransfer), format: "percent" },
            { label: "Franchise Earnings", value: round2(t.earning), format: "currency" },
            { label: "Franchise Margin", value: pct(t.earning, t.revenue), format: "percent" },
            { label: "Delivery Fees Collected", value: round2(deliveryFees), format: "currency" },
            { label: "Coupon Discounts Given", value: round2(discounts), format: "currency" },
            { label: "Net Company Profit", value: netCompany, format: "currency" },
            { label: "Bought from Vendors (this period)", value: round2(vendorValue - creditValue), format: "currency" },
        ],
        chart: {
            title: "Daily Sales & Company Profit",
            series: [{ key: "sales", label: "Sales", format: "currency" }, { key: "profit", label: "Net Company Profit", format: "currency" }],
            data: fillDays(range, byDay, ["sales", "profit"]),
        },
        sections: [
            {
                id: "stages",
                title: "Profit by Stage",
                description: "Vendor → Company → Franchise → Customer. Company profit counts only items whose buying cost is known. Vendors' own buying cost is private and not shown.",
                columns: [
                    { key: "stage", label: "Stage" },
                    { key: "purchase", label: "Purchase Value", format: "currency" },
                    { key: "revenue", label: "Selling Revenue", format: "currency" },
                    { key: "profit", label: "Gross Profit", format: "currency" },
                    { key: "margin", label: "Margin", format: "percent" },
                ],
                rows: [
                    { stage: "Vendors → Company (supplies received)", purchase: null, revenue: round2(vendorValue - creditValue), profit: null, margin: null },
                    { stage: "Company → Franchises", purchase: round2(t.cost), revenue: round2(t.knownTransfer), profit: round2(t.companyProfit), margin: pct(t.companyProfit, t.knownTransfer) },
                    { stage: "Franchises → Customers", purchase: round2(t.transfer), revenue: round2(t.revenue), profit: round2(t.earning), margin: pct(t.earning, t.revenue) },
                    { stage: "Whole chain (customer price − buying cost)", purchase: round2(t.cost), revenue: round2(t.knownRevenue), profit: round2(t.knownRevenue - t.cost), margin: pct(t.knownRevenue - t.cost, t.knownRevenue) },
                ],
            },
            {
                id: "franchises",
                title: "By Franchise",
                description: "Franchise earnings use each franchise's commission % per category set by the admin.",
                columns: [
                    { key: "name", label: "Franchise" },
                    { key: "orders", label: "Orders", format: "number" },
                    { key: "sales", label: "Sales", format: "currency" },
                    { key: "earning", label: "Franchise Earnings", format: "currency" },
                    { key: "fMargin", label: "Franchise Margin", format: "percent" },
                    { key: "transfer", label: "Company Revenue", format: "currency" },
                    { key: "cost", label: "Company Cost", format: "currency" },
                    { key: "profit", label: "Company Profit", format: "currency" },
                    { key: "cMargin", label: "Company Margin", format: "percent" },
                ],
                rows: [...byFranchise.entries()].map(([id, f]) => ({
                    name: frNames.get(id) || "Unassigned",
                    orders: f.orders || 0,
                    sales: round2(f.revenue), earning: round2(f.earning), fMargin: pct(f.earning, f.revenue),
                    transfer: round2(f.transfer), cost: round2(f.cost), profit: round2(f.companyProfit), cMargin: pct(f.companyProfit, f.knownTransfer),
                })).sort((a, b) => b.sales - a.sales),
            },
            {
                id: "vendors",
                title: "By Vendor",
                description: "Supplies checked in by franchises in this period, at the agreed rate. Damaged or rejected goods are not paid; return credit notes are taken off.",
                columns: [
                    { key: "name", label: "Vendor" },
                    { key: "deliveries", label: "Deliveries", format: "number" },
                    { key: "value", label: "Supplied Value", format: "currency" },
                    { key: "notPaid", label: "Damaged / Rejected", format: "currency" },
                    { key: "credit", label: "Return Credit Notes", format: "currency" },
                    { key: "net", label: "Net Payable", format: "currency" },
                ],
                rows: [...byVendor.entries()].map(([id, v]) => ({
                    name: vNames.get(id) || moreVendorNames.get(id) || "Vendor",
                    deliveries: v.deliveries || 0, value: round2(v.value), notPaid: round2(v.notPaid), credit: round2(v.credit), net: round2((v.value || 0) - (v.credit || 0)),
                })).sort((a, b) => b.value - a.value),
            },
            {
                id: "products",
                title: "By Product",
                description: "Whole-chain margin = customer price minus buying cost.",
                columns: [
                    { key: "name", label: "Product" },
                    { key: "qty", label: "Qty Sold", format: "number" },
                    { key: "unit", label: "Unit" },
                    { key: "sales", label: "Sales", format: "currency" },
                    { key: "avgSell", label: "Avg Selling Rate", format: "currency" },
                    { key: "avgCost", label: "Avg Buying Rate", format: "currency" },
                    { key: "cost", label: "Buying Cost", format: "currency" },
                    { key: "profit", label: "Gross Profit", format: "currency" },
                    { key: "margin", label: "Margin", format: "percent" },
                ],
                rows: [...byProduct.values()].map((p) => ({
                    name: p.name, unit: p.unit, qty: round2(p.qty), sales: round2(p.revenue),
                    avgSell: p.qty ? round2(p.revenue / p.qty) : null,
                    avgCost: p.knownRevenue && p.qty ? round2(p.cost / (p.qty * (p.knownRevenue / p.revenue))) : null,
                    cost: round2(p.cost), profit: round2(p.knownRevenue - p.cost), margin: pct(p.knownRevenue - p.cost, p.knownRevenue),
                })).sort((a, b) => b.sales - a.sales),
            },
            {
                id: "orders",
                title: "Delivered Orders",
                columns: [
                    { key: "date", label: "Delivered", format: "date" },
                    { key: "order", label: "Order" },
                    { key: "franchise", label: "Franchise" },
                    { key: "sales", label: "Sales", format: "currency" },
                    { key: "cost", label: "Buying Cost", format: "currency" },
                    { key: "companyProfit", label: "Company Profit", format: "currency" },
                    { key: "franchiseEarning", label: "Franchise Earning", format: "currency" },
                    { key: "note", label: "Note" },
                ],
                rows: orderRows.map((r) => ({ ...r, franchise: frNames.get(r.franchiseId) || "—" })),
            },
        ],
    };
}

export async function buildFranchiseFinanceReport(range, franchiseId) {
    const entries = await entriesIn(range, { franchiseId });
    const byProduct = new Map(), byDay = new Map();
    let revenue = 0, transfer = 0, earning = 0;
    const orderRows = [];
    for (const e of entries) {
        let r = 0, tv = 0, ea = 0;
        for (const l of e.lines || []) {
            r += l.revenue; tv += l.transferValue; ea += l.franchiseEarning;
            const pk = String(l.productId);
            addTo(byProduct, pk, { qty: l.quantity, revenue: l.revenue, transfer: l.transferValue, earning: l.franchiseEarning });
            Object.assign(byProduct.get(pk), { name: l.name, unit: l.unit, commissionPct: l.commissionPct });
        }
        revenue += r; transfer += tv; earning += ea;
        addTo(byDay, dayOf(e.deliveredAt), { sales: r, profit: ea });
        orderRows.push({ date: dayOf(e.deliveredAt), order: ref(e.orderId), sales: round2(r), purchase: round2(tv), profit: round2(ea), margin: pct(ea, r) });
    }
    return {
        title: "Profit & Margin Report",
        kpis: [
            { label: "Orders Delivered", value: entries.length, format: "number" },
            { label: "Sales to Customers", value: round2(revenue), format: "currency" },
            { label: "Purchase Value (from company)", value: round2(transfer), format: "currency" },
            { label: "Your Gross Profit", value: round2(earning), format: "currency" },
            { label: "Your Margin", value: pct(earning, revenue), format: "percent" },
        ],
        chart: {
            title: "Daily Sales & Profit",
            series: [{ key: "sales", label: "Sales", format: "currency" }, { key: "profit", label: "Your Profit", format: "currency" }],
            data: fillDays(range, byDay, ["sales", "profit"]),
        },
        sections: [
            {
                id: "products",
                title: "By Product",
                description: "Your profit is your commission % on each category, set by the admin. Purchase value is the sales value minus your commission.",
                columns: [
                    { key: "name", label: "Product" },
                    { key: "qty", label: "Qty Sold", format: "number" },
                    { key: "unit", label: "Unit" },
                    { key: "sales", label: "Sales", format: "currency" },
                    { key: "purchase", label: "Purchase Value", format: "currency" },
                    { key: "profit", label: "Gross Profit", format: "currency" },
                    { key: "margin", label: "Margin", format: "percent" },
                ],
                rows: [...byProduct.values()].map((p) => ({
                    name: p.name, unit: p.unit, qty: round2(p.qty), sales: round2(p.revenue), purchase: round2(p.transfer), profit: round2(p.earning), margin: pct(p.earning, p.revenue),
                })).sort((a, b) => b.sales - a.sales),
            },
            {
                id: "orders",
                title: "Delivered Orders",
                columns: [
                    { key: "date", label: "Delivered", format: "date" },
                    { key: "order", label: "Order" },
                    { key: "sales", label: "Sales", format: "currency" },
                    { key: "purchase", label: "Purchase Value", format: "currency" },
                    { key: "profit", label: "Gross Profit", format: "currency" },
                    { key: "margin", label: "Margin", format: "percent" },
                ],
                rows: orderRows,
            },
        ],
    };
}

export async function buildVendorFinanceReport(range, vendorId) {
    const vid = String(vendorId);
    const [supplies, credits] = await Promise.all([vendorSupplies(range, { assignedVendorId: vid }), creditNotes(range, { "destination.vendorId": vendorId })]);
    const frNames = await names(Franchise, supplies.map((s) => s.franchiseId), "franchiseName");
    const byProduct = new Map(), byDay = new Map();
    for (const s of supplies) {
        addTo(byDay, dayOf(s.at), { value: s.value });
        for (const l of s.lines) {
            if (!l.accepted) continue;
            const cur = byProduct.get(l.productId) || { name: l.name, unit: l.unit, qty: 0, value: 0, min: null, max: null };
            cur.qty += l.accepted; cur.value += l.value;
            cur.min = cur.min === null ? l.rate : Math.min(cur.min, l.rate);
            cur.max = cur.max === null ? l.rate : Math.max(cur.max, l.rate);
            byProduct.set(l.productId, cur);
        }
    }
    const value = sum(supplies, "value");
    const notPaid = sum(supplies, "notPaid");
    const credit = round2(credits.reduce((s, c) => s + (Number(c.creditNote?.amount) || 0), 0));
    return {
        title: "Sales Value & Rates",
        kpis: [
            { label: "Deliveries Checked In", value: supplies.length, format: "number" },
            { label: "Sales Value", value: value, format: "currency" },
            { label: "Damaged / Rejected (not paid)", value: notPaid, format: "currency" },
            { label: "Return Credit Notes", value: credit, format: "currency" },
            { label: "Net Sales Value", value: round2(value - credit), format: "currency" },
        ],
        chart: {
            title: "Daily Sales Value",
            series: [{ key: "value", label: "Sales Value", format: "currency" }],
            data: fillDays(range, byDay, ["value"]),
        },
        sections: [
            {
                id: "products",
                title: "By Product",
                description: "Quantities the franchises accepted and the rates you sold at.",
                columns: [
                    { key: "name", label: "Product" },
                    { key: "qty", label: "Qty Accepted", format: "number" },
                    { key: "unit", label: "Unit" },
                    { key: "value", label: "Sales Value", format: "currency" },
                    { key: "avg", label: "Avg Selling Rate", format: "currency" },
                    { key: "min", label: "Lowest Rate", format: "currency" },
                    { key: "max", label: "Highest Rate", format: "currency" },
                ],
                rows: [...byProduct.values()].map((p) => ({ ...p, qty: round2(p.qty), value: round2(p.value), avg: p.qty ? round2(p.value / p.qty) : null })).sort((a, b) => b.value - a.value),
            },
            {
                id: "deliveries",
                title: "Deliveries",
                columns: [
                    { key: "date", label: "Checked In", format: "date" },
                    { key: "ref", label: "Request" },
                    { key: "franchise", label: "Franchise" },
                    { key: "items", label: "Items" },
                    { key: "value", label: "Sales Value", format: "currency" },
                    { key: "notPaid", label: "Damaged / Rejected", format: "currency" },
                ],
                rows: supplies.map((s) => ({
                    date: dayOf(s.at), ref: ref(s.id), franchise: frNames.get(s.franchiseId) || "—",
                    items: s.lines.map((l) => `${l.name} ${l.accepted} ${l.unit || ""} @ ₹${l.rate}`).join(", "),
                    value: s.value, notPaid: s.notPaid,
                })),
            },
            {
                id: "credits",
                title: "Return Credit Notes",
                columns: [
                    { key: "date", label: "Received", format: "date" },
                    { key: "number", label: "Credit Note" },
                    { key: "franchise", label: "From" },
                    { key: "amount", label: "Amount", format: "currency" },
                ],
                rows: credits.map((c) => ({ date: dayOf(c.receivedAt), number: c.creditNote?.number || "", franchise: c.fromFranchiseId?.franchiseName || "—", amount: round2(c.creditNote?.amount) })),
            },
        ],
    };
}
