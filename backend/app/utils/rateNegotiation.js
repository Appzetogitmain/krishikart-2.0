import ProcurementRequest from "../models/procurementRequest.js";
import VendorInventory from "../models/vendorInventory.js";

/*
 * Item-wise rate negotiation between the admin and a vendor, on one page per vendor (the day's list).
 * Each product's lines (one per franchise request) move together:
 *   open -> sent (vendor's rate, waiting for admin) <-> countered (admin's offer, waiting for vendor) -> final
 * Final lines go to packing straight away (split off from a request whose other items are still open).
 * Rates are per product unit (₹/kg).
 */

// Request statuses that are still on the quotation sheet
export const OPEN_RATE = ["assigned", "quoted", "negotiating"];

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const unitKey = (u) => String(u || "").trim().toLowerCase();
export const sameLine = (item, productId, unit) =>
    String(item.productId) === String(productId) && (unit === undefined || unitKey(item.unit) === unitKey(unit));

/** Midnight in India (the business day), as a Date. */
export function istDayStart(now = new Date()) {
    const IST = 330 * 60000;
    const local = new Date(now.getTime() + IST);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - IST);
}

/** An item's negotiation state; requests from the old per-request quotation flow have none saved. */
export function stateOf(item, request) {
    if (item.rateStatus) return item.rateStatus;
    if (request.status === "quoted") return "sent";
    if (request.status === "negotiating") return "countered";
    if (request.status === "assigned" || request.status === "pending_assignment") return "open";
    return "final";
}

/** Admin's offer for an item (old flow: the admin edited quotedPrice directly). */
export const adminRateOf = (item, request) =>
    Number(item.adminPrice) || (stateOf(item, request) === "countered" && !item.rateStatus ? Number(item.quotedPrice) || 0 : 0);

/** Vendor's rate for an item (old flow keeps the vendor's own in originalQuotedPrice after an admin edit). */
export const vendorRateOf = (item, request) =>
    !item.rateStatus && request.status === "negotiating" ? Number(item.originalQuotedPrice) || 0 : Number(item.quotedPrice) || 0;

/** Save an old-flow item's state explicitly (vendor rate in quotedPrice, admin offer in adminPrice). */
export function freezeLegacy(item, request) {
    if (item.rateStatus) return;
    const vendorRate = vendorRateOf(item, request);
    const adminRate = adminRateOf(item, request);
    item.rateStatus = stateOf(item, request);
    if (item.rateStatus !== "final") {
        item.quotedPrice = vendorRate;
        item.adminPrice = adminRate;
    }
}

export function recompute(request) {
    request.totalEstimatedAmount = round2(request.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0));
    request.totalQuotedAmount = round2(request.items.reduce((s, i) => s + (Number(i.quotedPrice) || 0) * (Number(i.quantity) || 0), 0));
}

/** Request status from its items: approved when all are agreed, else who the sheet waits for. */
export function syncStatus(request) {
    const states = request.items.map((i) => stateOf(i, request));
    recompute(request);
    if (states.every((s) => s === "final")) {
        request.status = "approved";
        request.awaitingFrom = null;
        request.pricing = "negotiated";
        request.vendorQuoteTotal = request.totalQuotedAmount;
        return;
    }
    const open = states.filter((s) => s !== "final");
    if (open.includes("countered")) { request.status = "negotiating"; request.awaitingFrom = "vendor"; }
    else if (open.includes("sent")) { request.status = "quoted"; request.awaitingFrom = "admin"; }
    else { request.status = "assigned"; request.awaitingFrom = "vendor"; }
}

const finalItem = (item, rate, now) => {
    item.quotedPrice = round2(rate);
    if (!Number(item.originalQuotedPrice)) item.originalQuotedPrice = round2(rate);
    item.adminPrice = round2(rate);
    item.rateStatus = "final";
    item.finalAt = now;
};

/**
 * The state a product's new lines take when they are given to this vendor: agreed today -> that rate,
 * being negotiated -> the same offer, else open (the vendor's own rate list is shown as a suggestion).
 */
export async function lineStateFor(vendorId, productId, unit) {
    const dayStart = istDayStart();
    const inv = await VendorInventory.findOne({ vendorId }).select("items").lean();
    const deal = (inv?.items || []).find((i) => String(i.productId) === String(productId));
    if (deal?.agreedAt && new Date(deal.agreedAt) >= dayStart && Number(deal.agreedRate) > 0) {
        return { rateStatus: "final", rate: Number(deal.agreedRate) };
    }
    const reqs = await ProcurementRequest.find({ assignedVendorId: String(vendorId), "items.productId": String(productId) })
        .select("status items").sort({ updatedAt: -1 }).limit(50).lean();
    let negotiating = null;
    for (const r of reqs) {
        for (const i of r.items || []) {
            if (!sameLine(i, productId, unit)) continue;
            if (i.rateStatus === "final" && i.finalAt && new Date(i.finalAt) >= dayStart) return { rateStatus: "final", rate: Number(i.quotedPrice) };
            if (!negotiating && OPEN_RATE.includes(r.status)) {
                const s = stateOf(i, r);
                if (s === "sent" || s === "countered") negotiating = { rateStatus: s, quotedPrice: vendorRateOf(i, r), adminPrice: adminRateOf(i, r) };
            }
        }
    }
    return negotiating || { rateStatus: "open" };
}

/** Put an item into the given state (from lineStateFor). */
export function applyLineState(item, state, now = new Date()) {
    item.dispatchedQuantity = 0;
    if (state.rateStatus === "final") return finalItem(item, state.rate, now);
    item.rateStatus = state.rateStatus;
    item.quotedPrice = round2(state.quotedPrice || 0);
    item.originalQuotedPrice = round2(state.quotedPrice || 0);
    item.adminPrice = round2(state.adminPrice || 0);
    item.finalAt = undefined;
}

/** Give a whole request (all its items) to a vendor: each product picks up its current state for that vendor. */
export async function enterNegotiation(request, vendorId) {
    const now = new Date();
    for (const item of request.items) {
        applyLineState(item, await lineStateFor(vendorId, item.productId, item.unit), now);
    }
    request.assignedVendorId = String(vendorId);
    request.assignedAt = now;
    syncStatus(request);
}

/**
 * Agree a product's rate: every open line of it for this vendor becomes final at `rate`. Lines in a request
 * that still has other open items are split into their own approved request so they can be packed now.
 * Also keeps the vendor's rate list up to date. Returns { quantity, requests }.
 */
export async function finalizeProduct(vendorId, productId, unit, rate, { by = "admin", byName = "" } = {}) {
    const now = new Date();
    const reqs = await ProcurementRequest.find({ assignedVendorId: String(vendorId), status: { $in: OPEN_RATE }, "items.productId": String(productId) }).sort({ createdAt: 1 });
    let quantity = 0;
    const touched = [];
    for (const request of reqs) {
        const lines = request.items.filter((i) => sameLine(i, productId, unit) && stateOf(i, request) !== "final");
        if (!lines.length) continue;
        lines.forEach((i) => { quantity += Number(i.quantity) || 0; });
        // Freeze the old-flow states of the other items before anything changes the request status
        request.items.forEach((i) => freezeLegacy(i, request));
        const others = request.items.filter((i) => !lines.includes(i) && i.rateStatus !== "final");
        lines.forEach((i) => finalItem(i, rate, now));
        const entry = (r) => ({
            by, byName, action: "accept",
            items: r.items.map((i) => ({ productId: String(i.productId), name: i.name, unit: i.unit, quantity: Number(i.quantity) || 0, price: Number(i.quotedPrice) || 0 })),
            total: round2(r.items.reduce((s, i) => s + (Number(i.quotedPrice) || 0) * (Number(i.quantity) || 0), 0)),
            note: `${lines[0].name}: rate agreed at ₹${round2(rate)}/${lines[0].unit || "unit"}`,
        });
        if (others.length) {
            const plain = lines.map((i) => { const o = i.toObject(); delete o._id; return o; });
            request.items = request.items.filter((i) => !lines.includes(i));
            syncStatus(request);
            await request.save();
            const child = new ProcurementRequest({
                franchiseId: request.franchiseId,
                orderId: request.orderId,
                source: request.source || "vendor",
                splitFrom: request.splitFrom || request._id,
                assignedVendorId: String(vendorId),
                assignedAt: request.assignedAt || now,
                adminId: request.adminId,
                items: plain,
            });
            syncStatus(child);
            child.offers = [entry(child)];
            await child.save();
            touched.push(child);
        } else {
            syncStatus(request);
            request.offers = request.offers || [];
            request.offers.push(entry(request));
            await request.save();
            touched.push(request);
        }
    }
    if (touched.length) {
        // The agreed rate becomes the vendor's rate for this product
        await VendorInventory.updateOne(
            { vendorId, "items.productId": productId },
            { $set: { "items.$.rate": round2(rate), "items.$.rateUpdatedAt": now, "items.$.agreedRate": round2(rate), "items.$.agreedAt": now } },
        ).catch(() => {});
    }
    return { quantity: round2(quantity), requests: touched };
}
