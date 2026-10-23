import mongoose from "mongoose";
import ProcurementRequest from "../models/procurementRequest.js";
import Vendor from "../models/vendor.js";
import RateMessage from "../models/rateMessage.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import { emitToVendor, emitToAdmin } from "../lib/socket.js";
import { sendNotificationToUser } from "../utils/pushNotificationHelper.js";
import { createAdminNotification } from "../utils/adminNotification.js";
import { vendorRateMap, productImages } from "./procurementBoard.controller.js";
import {
    OPEN_RATE, round2, istDayStart, stateOf, adminRateOf, vendorRateOf, sameLine, syncStatus, finalizeProduct, freezeLegacy,
} from "../utils/rateNegotiation.js";

/*
 * The vendor's quotation / rate negotiation page: everything the admin has given the vendor that has no
 * agreed rate yet, added up product-wise across franchises. The vendor sends a rate per item, the admin
 * accepts or offers another rate per item, and agreed items leave the list and go to packing.
 */

const money = (n) => `₹${round2(n).toLocaleString("en-IN")}`;
const keyOf = (productId, unit) => `${productId}|${String(unit || "").trim().toLowerCase()}`;
const ROW_ORDER = { countered: 0, open: 1, sent: 2 };

/** The sheet for one vendor: { items, final, summary, messages }. */
async function buildSheet(vendorId) {
    const dayStart = istDayStart();
    const reqs = await ProcurementRequest.find({
        assignedVendorId: String(vendorId),
        $or: [{ status: { $in: OPEN_RATE } }, { "items.finalAt": { $gte: dayStart } }],
    }).populate("franchiseId", "franchiseName ownerName city").sort({ createdAt: 1 }).lean();

    const rows = new Map();
    for (const r of reqs) {
        const open = OPEN_RATE.includes(r.status);
        for (const item of r.items || []) {
            const state = open ? stateOf(item, r) : item.rateStatus;
            const finalToday = state === "final" && item.finalAt && new Date(item.finalAt) >= dayStart;
            if (!(open && state !== "final") && !finalToday) continue;
            const key = keyOf(item.productId, item.unit);
            if (!rows.has(key)) {
                rows.set(key, { key, productId: String(item.productId), unit: item.unit || "", name: item.name, image: item.image || "", qty: 0, finalQty: 0, franchises: new Set(), lines: 0, states: [], vendorRate: 0, adminRate: 0, finalRate: 0, finalAt: null });
            }
            const row = rows.get(key);
            row.franchises.add(String(r.franchiseId?._id || r.franchiseId));
            row.lines += 1;
            if (finalToday) {
                row.finalQty = round2(row.finalQty + (Number(item.quantity) || 0));
                row.finalRate = Number(item.quotedPrice) || row.finalRate;
                row.finalAt = item.finalAt;
                continue;
            }
            row.qty = round2(row.qty + (Number(item.quantity) || 0));
            row.states.push(state);
            row.vendorRate = vendorRateOf(item, r) || row.vendorRate;
            row.adminRate = adminRateOf(item, r) || row.adminRate;
        }
    }

    const [listRates, images] = await Promise.all([
        vendorRateMap(vendorId),
        productImages([...rows.values()].map((r) => r.productId)),
    ]);
    const all = [...rows.values()].map((r) => {
        const status = !r.states.length ? "final" : r.states.includes("countered") ? "countered" : r.states.includes("open") ? "open" : "sent";
        return {
            key: r.key, productId: r.productId, unit: r.unit, name: r.name, image: r.image || images[r.productId] || "",
            franchises: r.franchises.size, lines: r.lines,
            qty: r.qty, finalQty: r.finalQty,
            status,
            vendorRate: r.vendorRate, adminRate: r.adminRate, finalRate: r.finalRate, finalAt: r.finalAt,
            listRate: listRates[r.productId]?.rate || 0,
        };
    });
    const items = all.filter((r) => r.status !== "final" && r.qty > 0)
        .sort((a, b) => ROW_ORDER[a.status] - ROW_ORDER[b.status] || b.qty - a.qty);
    const final = all.filter((r) => r.finalQty > 0).sort((a, b) => b.finalQty - a.finalQty);

    const messages = await RateMessage.find({ vendorId, createdAt: { $gte: new Date(dayStart.getTime() - 24 * 3600000) } })
        .sort({ createdAt: -1 }).limit(40).lean();

    const unitKg = (u) => ["kg", "kgs"].includes(String(u).toLowerCase());
    const summary = {
        itemCount: items.length + final.filter((f) => !items.some((i) => i.key === f.key)).length,
        totalKg: round2([...items.map((i) => (unitKg(i.unit) ? i.qty : 0)), ...final.map((f) => (unitKg(f.unit) ? f.finalQty : 0))].reduce((s, n) => s + n, 0)),
        open: items.filter((i) => i.status === "open").length,
        waitingAdmin: items.filter((i) => i.status === "sent").length,
        waitingVendor: items.filter((i) => i.status === "countered").length,
        finalCount: final.length,
        // What the vendor is asking for everything on the sheet (agreed items at the agreed rate)
        quotationValue: round2(items.reduce((s, i) => s + i.qty * i.vendorRate, 0) + final.reduce((s, f) => s + f.finalQty * f.finalRate, 0)),
    };
    return { items, final, summary, messages: messages.reverse() };
}

/** Lines of one product still being negotiated with this vendor. */
async function openRequestsFor(vendorId, productId) {
    return ProcurementRequest.find({ assignedVendorId: String(vendorId), status: { $in: OPEN_RATE }, "items.productId": String(productId) }).sort({ createdAt: 1 });
}

const orderNote = async (requests, message) => {
    const ids = [...new Set(requests.map((r) => r.orderId).filter(Boolean).map(String))];
    if (ids.length) {
        await Order.updateMany({ _id: { $in: ids } }, { $push: { statusHistory: { status: "Procuring", updatedAt: new Date(), updatedBy: "system", message } } });
    }
};

const tellAdmin = async (vendor, title, message) => {
    emitToAdmin("procurement_quote_received", { vendorId: String(vendor._id), message });
    await createAdminNotification({
        type: "procurement_quote_received",
        title,
        message,
        link: `/masteradmin/quotations?vendor=${vendor._id}`,
        meta: { vendorId: String(vendor._id) },
    });
};

const tellVendor = (vendorId, title, body) => {
    emitToVendor(String(vendorId), "procurement_update", { status: "rate_sheet", title, message: body });
    sendNotificationToUser(String(vendorId), { title, body, data: { type: "assignment", link: "/vendor/quotations" } }, "vendor");
};

const cleanText = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 500);

/* ---------- vendor ---------- */

// GET /procurement/vendor/rate-sheet
export const getVendorRateSheet = async (req, res) => {
    try {
        return handleResponse(res, 200, "Rate sheet", await buildSheet(req.vendor._id));
    } catch (error) {
        console.error("Vendor rate sheet error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// POST /procurement/vendor/rate-sheet/send  { rates: [{ productId, unit, rate }], message? }  (rate per unit)
export const vendorSendRates = async (req, res) => {
    try {
        const vendor = req.vendor;
        const rates = Array.isArray(req.body?.rates) ? req.body.rates : [];
        const message = cleanText(req.body?.message);
        if (!rates.length && !message) return handleResponse(res, 400, "Enter a rate for at least one item");
        for (const r of rates) {
            const rate = Number(r?.rate);
            if (!r?.productId || !Number.isFinite(rate) || rate <= 0 || rate > 1000000) {
                return handleResponse(res, 400, "Every rate must be more than 0");
            }
        }

        let sent = 0;
        let agreed = 0;
        const changed = [];
        for (const r of rates) {
            const rate = round2(r.rate);
            const reqs = await openRequestsFor(vendor._id, r.productId);
            const lines = reqs.flatMap((q) => q.items.filter((i) => sameLine(i, r.productId, r.unit) && stateOf(i, q) !== "final").map((i) => ({ q, i })));
            if (!lines.length) continue;
            // Vendor typed exactly the admin's offer: that's an acceptance
            const offer = lines.map(({ q, i }) => adminRateOf(i, q)).find((n) => n > 0);
            if (offer && stateOf(lines[0].i, lines[0].q) === "countered" && round2(offer) === rate) {
                const done = await finalizeProduct(vendor._id, r.productId, r.unit, rate, { by: "vendor", byName: vendor.fullName });
                changed.push(...done.requests);
                agreed += 1;
                continue;
            }
            for (const q of reqs) {
                let touched = false;
                q.items.forEach((i) => {
                    freezeLegacy(i, q);
                    if (!sameLine(i, r.productId, r.unit) || i.rateStatus === "final") return;
                    i.quotedPrice = rate;
                    if (!Number(i.originalQuotedPrice)) i.originalQuotedPrice = rate;
                    i.rateStatus = "sent";
                    touched = true;
                });
                if (!touched) continue;
                syncStatus(q);
                q.vendorQuoteTotal = q.totalQuotedAmount;
                q.offers = q.offers || [];
                q.offers.push({
                    by: "vendor", byName: vendor.fullName || "", action: "quote",
                    items: q.items.map((i) => ({ productId: String(i.productId), name: i.name, unit: i.unit, quantity: Number(i.quantity) || 0, price: Number(i.quotedPrice) || 0 })),
                    total: q.totalQuotedAmount, note: message,
                });
                await q.save();
                changed.push(q);
            }
            sent += 1;
        }
        if (message) await RateMessage.create({ vendorId: vendor._id, by: "vendor", byName: vendor.fullName || "", text: message });

        if (sent || agreed || message) {
            const parts = [];
            if (sent) parts.push(`sent rates for ${sent} item${sent > 1 ? "s" : ""}`);
            if (agreed) parts.push(`accepted your rate for ${agreed} item${agreed > 1 ? "s" : ""}`);
            if (message) parts.push(`wrote: "${message.slice(0, 80)}"`);
            await tellAdmin(vendor, "Vendor rates", `${vendor.fullName || "Vendor"} ${parts.join(", ")}.`);
        }
        if (changed.length) await orderNote(changed, "Vendor sent rates for the out-of-stock items.");

        return handleResponse(res, 200, agreed && !sent ? "Rate accepted" : "Rates sent to admin", { sent, agreed, sheet: await buildSheet(vendor._id) });
    } catch (error) {
        console.error("Vendor send rates error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// POST /procurement/vendor/rate-sheet/accept  { productId, unit }  -> agree to the admin's offer
export const vendorAcceptAdminRate = async (req, res) => {
    try {
        const { productId, unit } = req.body || {};
        if (!productId) return handleResponse(res, 400, "Choose an item");
        const reqs = await openRequestsFor(req.vendor._id, productId);
        const line = reqs.flatMap((q) => q.items.filter((i) => sameLine(i, productId, unit) && stateOf(i, q) === "countered").map((i) => ({ q, i })))[0];
        const offer = line ? adminRateOf(line.i, line.q) : 0;
        if (!(offer > 0)) return handleResponse(res, 400, "There is no admin offer for this item");
        const done = await finalizeProduct(req.vendor._id, productId, unit, offer, { by: "vendor", byName: req.vendor.fullName });
        await tellAdmin(req.vendor, "Vendor accepted your rate", `${req.vendor.fullName || "Vendor"} accepted ${money(offer)}/${line.i.unit || "unit"} for ${line.i.name} (${done.quantity} ${line.i.unit || ""}).`);
        await orderNote(done.requests, "Rate agreed with the vendor; items are being packed.");
        return handleResponse(res, 200, "Rate agreed — item moved to packing", { sheet: await buildSheet(req.vendor._id) });
    } catch (error) {
        console.error("Vendor accept rate error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// POST /procurement/vendor/rate-sheet/message  { text }
export const vendorRateMessage = async (req, res) => {
    try {
        const text = cleanText(req.body?.text);
        if (!text) return handleResponse(res, 400, "Write a message");
        const msg = await RateMessage.create({ vendorId: req.vendor._id, by: "vendor", byName: req.vendor.fullName || "", text });
        await tellAdmin(req.vendor, "Message from vendor", `${req.vendor.fullName || "Vendor"}: ${text.slice(0, 120)}`);
        return handleResponse(res, 201, "Message sent", msg);
    } catch (error) {
        console.error("Vendor rate message error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

/* ---------- admin ---------- */

// GET /procurement/admin/rate-sheets  -> vendors with a quotation sheet (open or agreed today)
export const getRateSheetVendors = async (req, res) => {
    try {
        const dayStart = istDayStart();
        const ids = await ProcurementRequest.distinct("assignedVendorId", {
            assignedVendorId: { $ne: null },
            $or: [{ status: { $in: OPEN_RATE } }, { "items.finalAt": { $gte: dayStart } }],
        });
        const valid = ids.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
        const vendors = await Vendor.find({ _id: { $in: valid } }).select("fullName farmLocation mobile").lean();
        const out = [];
        for (const v of vendors) {
            const sheet = await buildSheet(v._id);
            if (!sheet.items.length && !sheet.final.length) continue;
            out.push({ vendorId: String(v._id), name: v.fullName || "Vendor", city: v.farmLocation || "", mobile: v.mobile || "", summary: sheet.summary, lastMessage: sheet.messages[sheet.messages.length - 1] || null });
        }
        // Vendors waiting for the admin first
        out.sort((a, b) => b.summary.waitingAdmin - a.summary.waitingAdmin || b.summary.quotationValue - a.summary.quotationValue);
        return handleResponse(res, 200, "Rate sheets", out);
    } catch (error) {
        console.error("Rate sheet vendors error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// GET /procurement/admin/rate-sheets/:vendorId
export const getAdminRateSheet = async (req, res) => {
    try {
        const { vendorId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(vendorId)) return handleResponse(res, 400, "Invalid vendor");
        const vendor = await Vendor.findById(vendorId).select("fullName farmLocation mobile").lean();
        if (!vendor) return handleResponse(res, 404, "Vendor not found");
        return handleResponse(res, 200, "Rate sheet", { vendor: { vendorId, name: vendor.fullName, city: vendor.farmLocation || "", mobile: vendor.mobile || "" }, ...(await buildSheet(vendorId)) });
    } catch (error) {
        console.error("Admin rate sheet error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// POST /procurement/admin/rate-sheets/:vendorId/respond  { productId, unit, action: "accept" | "counter", rate? }
export const adminRespondRate = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { productId, unit, action } = req.body || {};
        if (!mongoose.Types.ObjectId.isValid(vendorId) || !productId) return handleResponse(res, 400, "Choose a vendor and an item");
        if (!["accept", "counter"].includes(action)) return handleResponse(res, 400, "Accept the vendor's rate or offer another rate");
        const adminName = req.masteradmin?.fullName || "Admin";
        const reqs = await openRequestsFor(vendorId, productId);
        const lines = reqs.flatMap((q) => q.items.filter((i) => sameLine(i, productId, unit) && stateOf(i, q) !== "final").map((i) => ({ q, i })));
        if (!lines.length) return handleResponse(res, 404, "This item is not on the vendor's list any more");
        const { i: first } = lines[0];

        if (action === "accept") {
            const vendorRate = vendorRateOf(first, lines[0].q);
            if (stateOf(first, lines[0].q) !== "sent" || !(vendorRate > 0)) return handleResponse(res, 400, "The vendor has not sent a rate for this item yet");
            const done = await finalizeProduct(vendorId, productId, unit, vendorRate, { by: "admin", byName: adminName });
            tellVendor(vendorId, "Rate accepted", `Admin accepted your rate ${money(vendorRate)}/${first.unit || "unit"} for ${first.name}. Pack it now.`);
            await orderNote(done.requests, "Rate agreed with the vendor; items are being packed.");
            return handleResponse(res, 200, `${first.name} final at ${money(vendorRate)}/${first.unit || "unit"}`, await buildSheet(vendorId));
        }

        const rate = round2(req.body.rate);
        if (!(rate > 0) || rate > 1000000) return handleResponse(res, 400, "Enter your rate");
        // Offering what the vendor already asked for is simply accepting it
        if (stateOf(first, lines[0].q) === "sent" && round2(vendorRateOf(first, lines[0].q)) === rate) {
            const done = await finalizeProduct(vendorId, productId, unit, rate, { by: "admin", byName: adminName });
            tellVendor(vendorId, "Rate accepted", `Admin accepted your rate ${money(rate)}/${first.unit || "unit"} for ${first.name}. Pack it now.`);
            await orderNote(done.requests, "Rate agreed with the vendor; items are being packed.");
            return handleResponse(res, 200, `${first.name} final at ${money(rate)}/${first.unit || "unit"}`, await buildSheet(vendorId));
        }
        for (const q of reqs) {
            let touched = false;
            q.items.forEach((i) => {
                freezeLegacy(i, q);
                if (!sameLine(i, productId, unit) || i.rateStatus === "final") return;
                i.adminPrice = rate;
                i.rateStatus = "countered";
                touched = true;
            });
            if (!touched) continue;
            syncStatus(q);
            q.offers = q.offers || [];
            q.offers.push({
                by: "admin", byName: adminName, action: "counter",
                items: q.items.map((i) => ({ productId: String(i.productId), name: i.name, unit: i.unit, quantity: Number(i.quantity) || 0, price: Number(i.adminPrice) || Number(i.quotedPrice) || 0 })),
                total: round2(q.items.reduce((s, i) => s + (Number(i.adminPrice) || Number(i.quotedPrice) || 0) * (Number(i.quantity) || 0), 0)),
                note: cleanText(req.body?.note),
            });
            await q.save();
        }
        tellVendor(vendorId, "Admin offered a rate", `Admin offered ${money(rate)}/${first.unit || "unit"} for ${first.name}. Accept it or send your rate.`);
        return handleResponse(res, 200, `Offer of ${money(rate)}/${first.unit || "unit"} sent for ${first.name}`, await buildSheet(vendorId));
    } catch (error) {
        console.error("Admin respond rate error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// POST /procurement/admin/rate-sheets/:vendorId/message  { text }
export const adminRateMessage = async (req, res) => {
    try {
        const { vendorId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(vendorId)) return handleResponse(res, 400, "Invalid vendor");
        const text = cleanText(req.body?.text);
        if (!text) return handleResponse(res, 400, "Write a message");
        if (!(await Vendor.exists({ _id: vendorId }))) return handleResponse(res, 404, "Vendor not found");
        const msg = await RateMessage.create({ vendorId, by: "admin", byName: req.masteradmin?.fullName || "Admin", text });
        tellVendor(vendorId, "Message from admin", text.slice(0, 140));
        return handleResponse(res, 201, "Message sent", msg);
    } catch (error) {
        console.error("Admin rate message error:", error);
        return handleResponse(res, 500, "Server error");
    }
};
