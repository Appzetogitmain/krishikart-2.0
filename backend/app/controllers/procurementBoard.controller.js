import mongoose from "mongoose";
import ProcurementRequest from "../models/procurementRequest.js";
import VendorInventory from "../models/vendorInventory.js";
import Vendor from "../models/vendor.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import { emitToVendor, emitToAdmin, emitToFranchise } from "../lib/socket.js";
import { sendNotificationToUser } from "../utils/pushNotificationHelper.js";
import { OPEN_RATE, recompute, syncStatus, lineStateFor, applyLineState, freezeLegacy } from "../utils/rateNegotiation.js";

/*
 * Consolidated procurement: franchises order whenever they need to, the admin sees every open
 * request merged product-wise (e.g. Potato 85 KG = Hotel A 20 + Hotel B 25 + ...), compares the
 * vendors' own rates and gives each product to a vendor. The product then sits on that vendor's one
 * quotation page for item-wise rate negotiation (utils/rateNegotiation.js) — or, if the admin fixes a
 * rate or the rate was already agreed today, goes straight to packing. Each franchise request (and the
 * hotel order behind it) stays as its own record, so the totals can always be opened up again.
 */

// Given to a vendor but not packed yet: the admin may still move it to another vendor
export const REASSIGNABLE = ["assigned", "quoted", "negotiating", "approved"];
// Vendor has it (for the monitoring view)
const WITH_VENDOR = [...REASSIGNABLE, "preparing", "ready_for_pickup", "picked_up"];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const refOf = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const money = (n) => `₹${round2(n).toLocaleString("en-IN")}`;
const unitKey = (u) => String(u || "").trim().toLowerCase();
const lineKey = (productId, unit) => `${productId}|${unitKey(unit)}`;

/** { productId: { rate, available, stock } } for one vendor. */
export async function vendorRateMap(vendorId) {
    const inv = await VendorInventory.findOne({ vendorId }).select("items").lean();
    const map = {};
    for (const i of inv?.items || []) {
        map[String(i.productId)] = { rate: Number(i.rate) || 0, available: i.available !== false, stock: Number(i.currentStock) || 0, rateUpdatedAt: i.rateUpdatedAt || null };
    }
    return map;
}

export const productImages = async (ids) => {
    const valid = [...new Set(ids)].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!valid.length) return {};
    const rows = await Product.find({ _id: { $in: valid } }).select("primaryImage images name unit").lean();
    return Object.fromEntries(rows.map((p) => [String(p._id), p.primaryImage || p.images?.[0] || ""]));
};

/** Vendors that carry each product, with their own rate. */
async function vendorOptionsFor(productIds) {
    const ids = [...new Set(productIds.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return {};
    const vendors = await Vendor.find({ products: { $in: ids }, status: { $ne: "blocked" } })
        .select("fullName farmLocation status products").lean();
    const inventories = await VendorInventory.find({ vendorId: { $in: vendors.map((v) => v._id) } }).select("vendorId items").lean();
    const invBy = Object.fromEntries(inventories.map((inv) => [String(inv.vendorId), inv.items || []]));
    const out = {};
    for (const pid of ids) out[pid] = [];
    for (const v of vendors) {
        const carries = new Set((v.products || []).map(String));
        for (const pid of ids) {
            if (!carries.has(pid)) continue;
            const row = (invBy[String(v._id)] || []).find((i) => String(i.productId) === pid);
            out[pid].push({
                vendorId: String(v._id),
                name: v.fullName || "Vendor",
                city: v.farmLocation || "",
                status: v.status,
                rate: Number(row?.rate) || 0,
                rateUpdatedAt: row?.rateUpdatedAt || null,
                available: row ? row.available !== false : true,
                stock: Number(row?.currentStock) || 0,
            });
        }
    }
    // Cheapest rate first; vendors without a rate last
    for (const pid of ids) out[pid].sort((a, b) => (a.rate > 0 ? a.rate : Infinity) - (b.rate > 0 ? b.rate : Infinity) || a.name.localeCompare(b.name));
    return out;
}

/** "Hotel / customer" name for each linked customer order (admin and franchise only — not shown to vendors). */
export async function orderCustomers(orderIds) {
    const ids = [...new Set(orderIds.filter(Boolean).map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return {};
    const orders = await Order.find({ _id: { $in: ids } })
        .select("userId user shippingAddress")
        .populate("userId", "legalEntityName fullName")
        .populate("user", "legalEntityName fullName")
        .lean();
    return Object.fromEntries(orders.map((o) => {
        const u = o.userId || o.user || {};
        const name = u.legalEntityName || u.fullName || o.shippingAddress?.name || o.shippingAddress?.fullName || "";
        return [String(o._id), name];
    }));
}

function linesOf(requests, customers, images) {
    const lines = [];
    for (const r of requests) {
        const f = r.franchiseId || {};
        for (const item of r.items || []) {
            const pid = String(item.productId);
            lines.push({
                requestId: String(r._id),
                itemId: String(item._id),
                productId: pid,
                name: item.name,
                unit: item.unit || "",
                image: item.image || images[pid] || "",
                quantity: Number(item.quantity) || 0,
                rate: Number(item.quotedPrice) || 0,
                status: r.status,
                vendorId: r.assignedVendorId ? String(r.assignedVendorId) : null,
                franchiseId: String(f._id || r.franchiseId || ""),
                franchiseName: f.franchiseName || f.ownerName || "Franchise",
                franchiseCity: f.city || "",
                orderId: r.orderId ? String(r.orderId) : null,
                customerName: r.orderId ? customers[String(r.orderId)] || "" : "",
                createdAt: r.createdAt,
            });
        }
    }
    return lines;
}

/** Group lines by product (and unit), each with a per-franchise breakdown. Biggest totals first. */
function byProduct(lines) {
    const map = new Map();
    for (const l of lines) {
        const key = lineKey(l.productId, l.unit);
        if (!map.has(key)) map.set(key, { key, productId: l.productId, name: l.name, unit: l.unit, image: l.image, totalQty: 0, amount: 0, franchises: new Map(), lineCount: 0 });
        const p = map.get(key);
        p.totalQty = round2(p.totalQty + l.quantity);
        p.amount = round2(p.amount + l.quantity * l.rate);
        p.lineCount += 1;
        if (!p.image && l.image) p.image = l.image;
        if (!p.franchises.has(l.franchiseId)) p.franchises.set(l.franchiseId, { franchiseId: l.franchiseId, name: l.franchiseName, city: l.franchiseCity, qty: 0, lines: [] });
        const f = p.franchises.get(l.franchiseId);
        f.qty = round2(f.qty + l.quantity);
        f.lines.push(l);
    }
    return [...map.values()]
        .map((p) => ({ ...p, franchises: [...p.franchises.values()].sort((a, b) => b.qty - a.qty) }))
        .sort((a, b) => b.totalQty - a.totalQty || a.name.localeCompare(b.name));
}

/**
 * GET /procurement/admin/board
 * pending: open franchise requests merged product-wise, with each vendor's rate for the product.
 * vendors: what each vendor has been given, franchise-wise and product-wise (to monitor and reassign).
 */
export const getProcurementBoard = async (req, res) => {
    try {
        const [pendingReqs, activeReqs] = await Promise.all([
            ProcurementRequest.find({ status: "pending_assignment", source: { $ne: "mother_franchise" }, supplierFranchiseId: null })
                .populate("franchiseId", "franchiseName ownerName city area").sort({ createdAt: 1 }).lean(),
            ProcurementRequest.find({ status: { $in: WITH_VENDOR }, assignedVendorId: { $ne: null } })
                .populate("franchiseId", "franchiseName ownerName city area").sort({ createdAt: 1 }).lean(),
        ]);
        const all = [...pendingReqs, ...activeReqs];
        const [customers, images] = await Promise.all([
            orderCustomers(all.map((r) => r.orderId)),
            productImages(all.flatMap((r) => (r.items || []).map((i) => String(i.productId)))),
        ]);

        const pendingLines = linesOf(pendingReqs, customers, images);
        const activeLines = linesOf(activeReqs, customers, images);
        const options = await vendorOptionsFor([...pendingLines, ...activeLines].map((l) => l.productId));

        const products = byProduct(pendingLines).map((p) => ({ ...p, vendors: options[p.productId] || [] }));

        // Vendor -> franchise -> product
        const vendorIds = [...new Set(activeLines.map((l) => l.vendorId))].filter((id) => mongoose.Types.ObjectId.isValid(id));
        const vendorDocs = await Vendor.find({ _id: { $in: vendorIds } }).select("fullName farmLocation mobile").lean();
        const vendorName = Object.fromEntries(vendorDocs.map((v) => [String(v._id), v]));
        const byVendor = new Map();
        for (const l of activeLines) {
            if (!byVendor.has(l.vendorId)) byVendor.set(l.vendorId, []);
            byVendor.get(l.vendorId).push(l);
        }
        const vendors = [...byVendor.entries()].map(([vendorId, vLines]) => {
            const byFr = new Map();
            vLines.forEach((l) => {
                if (!byFr.has(l.franchiseId)) byFr.set(l.franchiseId, []);
                byFr.get(l.franchiseId).push(l);
            });
            const franchises = [...byFr.values()].map((fl) => {
                const products = byProduct(fl).map((p) => {
                    const ls = p.franchises[0]?.lines || [];
                    const statuses = [...new Set(ls.map((x) => x.status))];
                    return {
                        productId: p.productId, name: p.name, unit: p.unit, image: p.image,
                        qty: p.totalQty, amount: p.amount,
                        rate: p.totalQty ? round2(p.amount / p.totalQty) : 0,
                        statuses,
                        reassignable: ls.some((x) => REASSIGNABLE.includes(x.status)),
                        lines: ls,
                        vendors: options[p.productId] || [],
                    };
                });
                return {
                    franchiseId: fl[0].franchiseId, name: fl[0].franchiseName, city: fl[0].franchiseCity,
                    amount: round2(products.reduce((s, p) => s + p.amount, 0)),
                    products,
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
            const v = vendorName[vendorId] || {};
            return {
                vendorId, name: v.fullName || "Vendor", city: v.farmLocation || "", mobile: v.mobile || "",
                amount: round2(franchises.reduce((s, f) => s + f.amount, 0)),
                franchiseCount: franchises.length,
                productCount: new Set(vLines.map((l) => l.productId)).size,
                franchises,
            };
        }).sort((a, b) => b.amount - a.amount);

        return handleResponse(res, 200, "Procurement board", {
            products,
            vendors,
            summary: {
                pendingProducts: products.length,
                pendingRequests: pendingReqs.length,
                pendingFranchises: new Set(pendingLines.map((l) => l.franchiseId)).size,
                activeVendors: vendors.length,
            },
        });
    } catch (error) {
        console.error("Procurement board error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

const plainItem = (item) => {
    const o = item.toObject ? item.toObject() : { ...item };
    delete o._id;
    return o;
};


/**
 * POST /procurement/admin/board/assign
 * Body: { productId, unit?, vendorId, rate?, franchiseId?, fromVendorId? }
 * Gives every open line of the product (optionally only one franchise's) to the vendor at the vendor's
 * rate (or the admin's rate). Without fromVendorId the lines come from unassigned requests; with it,
 * they are taken back from that vendor (only while not packed yet) — i.e. a reassignment.
 * Requests that also hold other products are split; the new request keeps the order link and splitFrom.
 */
export const assignProductToVendor = async (req, res) => {
    try {
        const { productId, unit, vendorId, franchiseId, fromVendorId } = req.body || {};
        if (!productId || !mongoose.Types.ObjectId.isValid(String(vendorId || ""))) {
            return handleResponse(res, 400, "Choose a product and a vendor");
        }
        if (franchiseId && !mongoose.Types.ObjectId.isValid(String(franchiseId))) {
            return handleResponse(res, 400, "Invalid franchise");
        }
        if (fromVendorId && String(fromVendorId) === String(vendorId)) {
            return handleResponse(res, 400, "The product is already with this vendor");
        }

        const vendor = await Vendor.findById(vendorId).select("fullName status products").lean();
        if (!vendor) return handleResponse(res, 404, "Vendor not found");
        if (vendor.status === "blocked") return handleResponse(res, 400, "This vendor is blocked");
        if (!(vendor.products || []).some((p) => String(p) === String(productId))) {
            return handleResponse(res, 400, `${vendor.fullName || "This vendor"} does not supply this product. Add it to the vendor's products first.`);
        }

        const adminRate = Number(req.body.rate);
        if (req.body.rate !== undefined && req.body.rate !== null && req.body.rate !== "" && (!Number.isFinite(adminRate) || adminRate <= 0 || adminRate > 1000000)) {
            return handleResponse(res, 400, "Rate must be more than 0");
        }
        // A rate from the admin fixes it now; otherwise the item goes on the vendor's quotation sheet
        // (or takes the rate already agreed with this vendor today)
        const state = adminRate > 0 ? { rateStatus: "final", rate: round2(adminRate) } : await lineStateFor(vendorId, productId, unit);
        const rate = state.rateStatus === "final" ? state.rate : 0;

        const query = { "items.productId": String(productId) };
        if (franchiseId) query.franchiseId = franchiseId;
        if (fromVendorId) {
            query.assignedVendorId = String(fromVendorId);
            query.status = { $in: REASSIGNABLE };
        } else {
            query.status = "pending_assignment";
            query.source = { $ne: "mother_franchise" };
            query.supplierFranchiseId = null;
        }
        const pool = await ProcurementRequest.find(query).sort({ createdAt: 1 });
        const matches = (i) => String(i.productId) === String(productId) && (unit === undefined || unitKey(i.unit) === unitKey(unit));

        const adminName = req.masteradmin?.fullName || "Admin";
        const now = new Date();
        const given = []; // requests the vendor now has
        const takenFrom = new Map(); // old vendor -> request refs
        let qty = 0;

        for (const request of pool) {
            const moving = request.items.filter(matches);
            if (!moving.length) continue;
            const oldVendor = request.assignedVendorId ? String(request.assignedVendorId) : null;
            moving.forEach((i) => { qty += Number(i.quantity) || 0; });

            const priceItem = (i) => applyLineState(i, state, now);
            const approve = (r) => {
                r.assignedVendorId = String(vendorId);
                r.assignedAt = now;
                r.adminId = req.masteradmin?._id || r.adminId;
                syncStatus(r);
                if (rate) r.pricing = adminRate > 0 ? "rate_list" : "negotiated";
                r.offers = r.offers || [];
                r.offers.push({
                    by: "admin", byName: adminName, action: rate ? "accept" : "quote",
                    items: r.items.map((i) => ({ productId: String(i.productId), name: i.name, unit: i.unit, quantity: Number(i.quantity) || 0, price: Number(i.quotedPrice) || 0 })),
                    total: r.totalQuotedAmount,
                    note: `${fromVendorId ? "Moved" : "Assigned"} to ${vendor.fullName || "vendor"}${rate ? ` at ${money(rate)}/${moving[0].unit || "unit"}` : " for rates"}`,
                });
            };

            let target;
            if (moving.length === request.items.length) {
                // The whole request is this product: give it as it is
                moving.forEach(priceItem);
                approve(request);
                await request.save();
                target = request;
            } else {
                // Split: this product goes to the vendor in its own request; the rest stays where it was
                const rootId = request.splitFrom || request._id;
                request.items.forEach((i) => { if (OPEN_RATE.includes(request.status)) freezeLegacy(i, request); });
                request.items = request.items.filter((i) => !matches(i));
                if (OPEN_RATE.includes(request.status)) syncStatus(request); // still negotiating its other items
                else recompute(request);
                await request.save();
                const child = new ProcurementRequest({
                    franchiseId: request.franchiseId,
                    orderId: request.orderId,
                    source: request.source || "vendor",
                    splitFrom: rootId,
                    items: moving.map(plainItem),
                });
                child.items.forEach(priceItem);
                approve(child);
                await child.save();
                target = child;
            }
            given.push(target);
            if (oldVendor && oldVendor !== String(vendorId)) {
                if (!takenFrom.has(oldVendor)) takenFrom.set(oldVendor, []);
                takenFrom.get(oldVendor).push(refOf(request._id));
            }

            if (target.orderId) {
                await Order.findByIdAndUpdate(target.orderId, {
                    orderStatus: "Procuring",
                    $push: { statusHistory: { status: "Procuring", updatedAt: now, updatedBy: "admin", message: `Vendor assigned for ${moving.map((i) => i.name).join(", ")}.` } },
                });
            }
        }

        if (!given.length) {
            return handleResponse(res, 404, fromVendorId ? "Nothing left to move — the vendor may have started packing it." : "No open orders for this product");
        }

        if (adminRate > 0) {
            // A rate the admin fixed counts as today's agreed rate for later orders of this product
            await VendorInventory.updateOne({ vendorId, "items.productId": productId },
                { $set: { "items.$.agreedRate": rate, "items.$.agreedAt": now } }).catch(() => {});
        }
        const productName = given[0].items.find(matches)?.name || "Product";
        const unitName = given[0].items.find(matches)?.unit || "";
        emitToVendor(String(vendorId), "new_assignment", {
            requestId: given[0]._id,
            status: given[0].status,
            message: `New order: ${productName} ${round2(qty)} ${unitName}`.trim(),
        });
        sendNotificationToUser(String(vendorId), rate ? {
            title: "New order to pack",
            body: `${productName} ${round2(qty)} ${unitName} at ${money(rate)}/${unitName || "unit"}. Open Pack & Dispatch.`,
            data: { type: "assignment", requestId: String(given[0]._id), link: "/vendor/dispatch" },
        } : {
            title: "Send your rate",
            body: `${productName} ${round2(qty)} ${unitName} added to today's quotation list. Send your rate.`,
            data: { type: "assignment", requestId: String(given[0]._id), link: "/vendor/quotations" },
        }, "vendor");
        for (const [oldVendor, refs] of takenFrom) {
            emitToVendor(oldVendor, "procurement_update", { status: "reassigned", message: `${productName} was moved to another vendor (${refs.join(", ")}).` });
            sendNotificationToUser(oldVendor, {
                title: "Order changed",
                body: `${productName} is no longer in your list — the admin gave it to another vendor.`,
                data: { type: "assignment", link: "/vendor/dispatch" },
            }, "vendor");
        }
        const franchises = [...new Set(given.map((r) => String(r.franchiseId)))];
        franchises.forEach((f) => emitToFranchise(f, "procurement_cycle_update", { status: "approved", message: `${productName}: vendor assigned.` }));
        emitToAdmin("procurement_status_updated", { status: "approved", message: `${productName} assigned to ${vendor.fullName}` });

        return handleResponse(res, 200, `${productName} ${round2(qty)} ${unitName} given to ${vendor.fullName || "the vendor"}${rate ? ` at ${money(rate)}` : " — waiting for the vendor's rate"}`, {
            status: given[0].status,
            requests: given.map((r) => String(r._id)),
            quantity: round2(qty),
            rate,
            amount: round2(qty * rate),
        });
    } catch (error) {
        console.error("Assign product to vendor error:", error);
        return handleResponse(res, 500, "Server error");
    }
};
