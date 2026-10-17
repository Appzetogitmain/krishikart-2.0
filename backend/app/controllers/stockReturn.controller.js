import mongoose from "mongoose";
import StockReturn from "../models/stockReturn.js";
import ProcurementRequest from "../models/procurementRequest.js";
import Franchise from "../models/franchise.js";
import Vendor from "../models/vendor.js";
import Product from "../models/product.js";
import Inventory from "../models/inventory.js";
import handleResponse from "../utils/helper.js";
import { emitToAdmin, emitToFranchise, emitToVendor } from "../lib/socket.js";
import { sendNotificationToUser } from "../utils/pushNotificationHelper.js";
import { createAdminNotification } from "../utils/adminNotification.js";
import { takeStock, addStock } from "../utils/stock.js";
import { scopeOf } from "../utils/adminScope.js";

/*
 * Stock returns go back the way the goods came: franchise -> vendor, franchise -> mother franchise,
 * mother franchise -> vendor. Every return is approved by the admin, who also decides where it goes.
 * The receiver confirms it and a credit note is raised for the amount the goods were bought at.
 */

const ACTIVE = ["requested", "approved", "sent", "received"];
const REASONS = {
    damaged_from_supplier: "Damaged goods from the supplier",
    rejected_at_receiving: "Rejected when the delivery arrived",
    spoiled_in_stock: "Spoiled / expired in stock",
    franchise_closing: "Franchise closing down",
    other: "Other",
};
const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const refOf = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const label = (r) => REASONS[r] || r;
const valueOf = (items) => round2((items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0));
const listOf = (items) => (items || []).map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(", ");

/** Damaged/rejected quantity of each item of a received delivery that can still be returned. */
const deliveryReturnable = async (request) => {
    const used = await StockReturn.find({ procurementRequestId: request._id, status: { $in: ACTIVE } }).select("items").lean();
    const usedBy = {};
    for (const r of used) for (const i of r.items) usedBy[String(i.productId)] = (usedBy[String(i.productId)] || 0) + Number(i.quantity || 0);
    return request.items
        .map((i) => {
            const bad = i.rejected
                ? Number(i.receivedQuantity || i.dispatchedQuantity || i.quantity || 0)
                : Number(i.damagedQuantity || 0);
            return {
                productId: String(i.productId),
                name: i.name,
                unit: i.unit,
                price: Number(i.quotedPrice || i.price || 0),
                rejected: !!i.rejected,
                damaged: Number(i.damagedQuantity || 0),
                returnable: round2(Math.max(0, bad - (usedBy[String(i.productId)] || 0))),
            };
        })
        .filter((i) => isId(i.productId));
};

/** Damaged goods a mother franchise received in a return that it can still pass on. */
const forwardable = async (ret) => {
    const used = await StockReturn.find({ sourceReturnId: ret._id, status: { $in: ACTIVE } }).select("items").lean();
    const usedBy = {};
    for (const r of used) for (const i of r.items) usedBy[String(i.productId)] = (usedBy[String(i.productId)] || 0) + Number(i.quantity || 0);
    return ret.items
        .filter((i) => i.condition === "damaged")
        .map((i) => ({
            productId: String(i.productId),
            name: i.name,
            unit: i.unit,
            price: Number(i.price || 0),
            returnable: round2(Math.max(0, Number(i.quantity || 0) - (usedBy[String(i.productId)] || 0))),
        }));
};

/** The supplier a delivery came from, as a destination. */
const supplierOf = (request) =>
    request?.supplierFranchiseId
        ? { type: "mother_franchise", franchiseId: request.supplierFranchiseId, vendorId: null }
        : request?.assignedVendorId && isId(request.assignedVendorId)
            ? { type: "vendor", vendorId: request.assignedVendorId, franchiseId: null }
            : { type: null, vendorId: null, franchiseId: null };

const notifyVendor = (vendorId, title, body, data = {}) => {
    emitToVendor(String(vendorId), "stock_return_update", { ...data, title, message: body });
    sendNotificationToUser(String(vendorId), { title, body, data: { type: "stock_return", link: "/vendor/returns" } }, "vendor");
};
const notifyFranchise = (franchiseId, title, body, data = {}) => {
    emitToFranchise(String(franchiseId), "stock_return_update", { ...data, title, message: body });
    sendNotificationToUser(String(franchiseId), { title, body, data: { type: "stock_return", link: "/franchise/stock-returns" } }, "franchise");
};

const populateReturn = (q) =>
    q.populate("fromFranchiseId", "franchiseName ownerName mobile city area")
        .populate("destination.vendorId", "fullName mobile farmLocation")
        .populate("destination.franchiseId", "franchiseName mobile city area")
        .populate("suggested.vendorId", "fullName")
        .populate("suggested.franchiseId", "franchiseName");

/* ---------------- Franchise ---------------- */

/**
 * GET /stock-returns/franchise/options
 * What this franchise can return: damaged/rejected goods from recent deliveries, its stock, and
 * (for a mother franchise) damaged goods it received back from other franchises.
 */
export const getReturnOptions = async (req, res) => {
    try {
        const me = req.franchise._id;
        const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
        const requests = await ProcurementRequest.find({ franchiseId: me, status: "completed", updatedAt: { $gte: since } })
            .populate("supplierFranchiseId", "franchiseName")
            .sort({ updatedAt: -1 })
            .limit(60);
        const vendorIds = [...new Set(requests.map((r) => r.assignedVendorId).filter(isId))];
        const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("fullName").lean();
        const vendorName = Object.fromEntries(vendors.map((v) => [String(v._id), v.fullName]));

        const deliveries = [];
        for (const r of requests) {
            const items = (await deliveryReturnable(r)).filter((i) => i.returnable > 0);
            if (!items.length) continue;
            deliveries.push({
                requestId: r._id,
                ref: refOf(r._id),
                receivedAt: r.receiptSummary?.at || r.updatedAt,
                supplierName: r.supplierFranchiseId?.franchiseName
                    ? `${r.supplierFranchiseId.franchiseName} (mother franchise)`
                    : vendorName[String(r.assignedVendorId)] || "Vendor",
                items,
            });
        }

        // Stock, valued at the rate the franchise last bought each product
        const inv = await Inventory.findOne({ franchiseId: me }).lean();
        const inStock = (inv?.items || []).filter((i) => Number(i.currentStock) > 0);
        const products = await Product.find({ _id: { $in: inStock.map((i) => i.productId) } }).select("name unit price").lean();
        const productById = Object.fromEntries(products.map((p) => [String(p._id), p]));
        const lastRate = {};
        for (const r of requests) {
            for (const i of r.items) {
                const k = String(i.productId);
                if (lastRate[k] === undefined) lastRate[k] = Number(i.quotedPrice || i.price || 0);
            }
        }
        const stock = inStock
            .filter((i) => productById[String(i.productId)])
            .map((i) => {
                const p = productById[String(i.productId)];
                return {
                    productId: String(i.productId),
                    name: p.name,
                    unit: p.unit,
                    inStock: Number(i.currentStock),
                    price: lastRate[String(i.productId)] ?? Number(p.price || 0),
                };
            })
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        // Mother franchise: damaged goods it received back that can go on to the vendor
        const received = [];
        if (req.franchise.isMotherFranchise) {
            const rets = await StockReturn.find({ "destination.franchiseId": me, status: "received" })
                .populate("fromFranchiseId", "franchiseName")
                .sort({ receivedAt: -1 })
                .limit(60);
            for (const r of rets) {
                const items = (await forwardable(r)).filter((i) => i.returnable > 0);
                if (items.length) received.push({ returnId: r._id, ref: refOf(r._id), fromName: r.fromFranchiseId?.franchiseName || "Franchise", receivedAt: r.receivedAt, items });
            }
        }

        return handleResponse(res, 200, "Return options", { deliveries, stock, received, reasons: REASONS });
    } catch (err) {
        console.error("getReturnOptions error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * POST /stock-returns/franchise
 * { kind, procurementRequestId?, sourceReturnId?, reason, note, items: [{ productId, quantity }] }
 */
export const createStockReturn = async (req, res) => {
    try {
        const me = req.franchise._id;
        const { kind, procurementRequestId, sourceReturnId, reason } = req.body || {};
        const note = String(req.body?.note || "").trim().slice(0, 500);
        const asked = (Array.isArray(req.body?.items) ? req.body.items : [])
            .map((i) => ({ productId: String(i.productId || ""), quantity: round2(i.quantity) }))
            .filter((i) => isId(i.productId) && i.quantity > 0);

        if (!["from_delivery", "from_stock", "from_return"].includes(kind)) return handleResponse(res, 400, "Choose what you are returning");
        if (!REASONS[reason]) return handleResponse(res, 400, "Choose a reason for the return");
        if (reason === "other" && !note) return handleResponse(res, 400, "Please write a short note about the return");
        if (!asked.length) return handleResponse(res, 400, "Add at least one item with a quantity");
        if (new Set(asked.map((i) => i.productId)).size !== asked.length) return handleResponse(res, 400, "Each product can be listed only once");

        let items = [];
        let suggested = { type: null, vendorId: null, franchiseId: null };
        const doc = { fromFranchiseId: me, kind, reason, note };

        if (kind === "from_delivery") {
            const request = isId(procurementRequestId) ? await ProcurementRequest.findById(procurementRequestId) : null;
            if (!request || String(request.franchiseId) !== String(me)) return handleResponse(res, 404, "Delivery not found");
            if (request.status !== "completed") return handleResponse(res, 400, "You can return goods only after checking the delivery in");
            const allowed = await deliveryReturnable(request);
            for (const a of asked) {
                const line = allowed.find((x) => x.productId === a.productId);
                if (!line || a.quantity > line.returnable) {
                    return handleResponse(res, 400, `${line?.name || "This item"}: you can return at most ${line?.returnable || 0} ${line?.unit || ""} (the damaged/rejected quantity of that delivery).`);
                }
                items.push({ productId: a.productId, name: line.name, unit: line.unit, quantity: a.quantity, price: line.price, condition: "damaged", fromStock: false });
            }
            doc.procurementRequestId = request._id;
            suggested = supplierOf(request);
        } else if (kind === "from_return") {
            if (!req.franchise.isMotherFranchise) return handleResponse(res, 403, "Only a mother franchise can pass on returned goods");
            const src = isId(sourceReturnId) ? await StockReturn.findById(sourceReturnId) : null;
            if (!src || String(src.destination?.franchiseId) !== String(me) || src.status !== "received") {
                return handleResponse(res, 404, "Returned goods not found");
            }
            const allowed = await forwardable(src);
            for (const a of asked) {
                const line = allowed.find((x) => x.productId === a.productId);
                if (!line || a.quantity > line.returnable) {
                    return handleResponse(res, 400, `${line?.name || "This item"}: you can pass on at most ${line?.returnable || 0} ${line?.unit || ""}.`);
                }
                items.push({ productId: a.productId, name: line.name, unit: line.unit, quantity: a.quantity, price: line.price, condition: "damaged", fromStock: false });
            }
            doc.sourceReturnId = src._id;
            // Back to whoever originally supplied the goods
            const origin = src.procurementRequestId ? await ProcurementRequest.findById(src.procurementRequestId).lean() : null;
            suggested = origin ? supplierOf(origin) : { type: null, vendorId: null, franchiseId: null };
            if (suggested.type === "mother_franchise" && String(suggested.franchiseId) === String(me)) suggested = { type: null, vendorId: null, franchiseId: null };
        } else {
            const inv = await Inventory.findOne({ franchiseId: me }).lean();
            const products = await Product.find({ _id: { $in: asked.map((a) => a.productId) } }).select("name unit price").lean();
            const lastReq = await ProcurementRequest.find({ franchiseId: me, status: "completed", "items.productId": { $in: asked.map((a) => a.productId) } })
                .sort({ updatedAt: -1 }).limit(30).lean();
            for (const a of asked) {
                const p = products.find((x) => String(x._id) === a.productId);
                const have = Number((inv?.items || []).find((i) => String(i.productId) === a.productId)?.currentStock || 0);
                if (!p) return handleResponse(res, 400, "Product not found");
                if (a.quantity > have) return handleResponse(res, 400, `${p.name}: you have only ${have} ${p.unit || ""} in stock.`);
                const last = lastReq.find((r) => r.items.some((i) => String(i.productId) === a.productId));
                const li = last?.items.find((i) => String(i.productId) === a.productId);
                items.push({
                    productId: a.productId, name: p.name, unit: p.unit, quantity: a.quantity,
                    price: Number(li?.quotedPrice || li?.price || p.price || 0),
                    condition: reason === "spoiled_in_stock" || reason === "damaged_from_supplier" ? "damaged" : "good",
                    fromStock: true,
                });
                if (!suggested.type && last) suggested = supplierOf(last);
            }
        }

        const ret = await StockReturn.create({ ...doc, items, suggested });
        const msg = `${req.franchise.franchiseName} wants to return ${listOf(items)} (${label(reason)}).`;
        emitToAdmin("stock_return_update", { returnId: ret._id, status: "requested", message: msg });
        await createAdminNotification({
            type: "stock_return_requested",
            title: "Stock return needs approval",
            message: msg,
            link: "/masteradmin/stock-returns",
            meta: { returnId: String(ret._id) },
        });
        return handleResponse(res, 201, "Return sent to the admin for approval", ret);
    } catch (err) {
        console.error("createStockReturn error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** GET /stock-returns/franchise -> { mine, incoming } (incoming only for a mother franchise) */
export const getMyStockReturns = async (req, res) => {
    try {
        const me = req.franchise._id;
        const mine = await populateReturn(StockReturn.find({ fromFranchiseId: me })).sort({ createdAt: -1 }).limit(200).lean();
        const incoming = req.franchise.isMotherFranchise
            ? await populateReturn(StockReturn.find({ "destination.franchiseId": me, status: { $in: ["approved", "sent", "received"] } })).sort({ createdAt: -1 }).limit(200).lean()
            : [];
        return handleResponse(res, 200, "Stock returns", { mine, incoming });
    } catch (err) {
        console.error("getMyStockReturns error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** PUT /stock-returns/franchise/:id/cancel (only while waiting for the admin) */
export const cancelStockReturn = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isId(id)) return handleResponse(res, 404, "Return not found");
        const ret = await StockReturn.findOneAndUpdate(
            { _id: id, fromFranchiseId: req.franchise._id, status: "requested" },
            { $set: { status: "cancelled" } },
            { new: true },
        );
        if (!ret) return handleResponse(res, 400, "Only a return waiting for the admin can be cancelled");
        emitToAdmin("stock_return_update", { returnId: ret._id, status: "cancelled", message: `${req.franchise.franchiseName} cancelled return ${refOf(ret._id)}` });
        return handleResponse(res, 200, "Return cancelled", ret);
    } catch (err) {
        console.error("cancelStockReturn error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * PUT /stock-returns/franchise/:id/sent  { note }
 * The franchise hands the goods over. Goods from its stock leave the stock now (all or nothing).
 */
export const markStockReturnSent = async (req, res) => {
    try {
        const { id } = req.params;
        const me = req.franchise._id;
        if (!isId(id)) return handleResponse(res, 404, "Return not found");

        // Claim first so a double tap cannot take the stock twice
        const ret = await StockReturn.findOneAndUpdate(
            { _id: id, fromFranchiseId: me, status: "approved" },
            { $set: { status: "sent", sentAt: new Date(), sentNote: String(req.body?.note || "").trim().slice(0, 300) } },
            { new: true },
        );
        if (!ret) return handleResponse(res, 400, "This return is not approved yet, or was already sent");

        const taken = [];
        for (const i of ret.items.filter((x) => x.fromStock)) {
            if (!(await takeStock(me, i.productId, i.quantity))) {
                for (const t of taken) await addStock(me, t.productId, t.quantity);
                await StockReturn.updateOne({ _id: ret._id }, { $set: { status: "approved", sentAt: null, sentNote: "" } });
                return handleResponse(res, 400, `Not enough ${i.name} in your stock any more to send ${i.quantity} ${i.unit}.`);
            }
            taken.push(i);
        }

        const body = `${req.franchise.franchiseName} sent return ${refOf(ret._id)}: ${listOf(ret.items)}. Please confirm when you receive it.`;
        if (ret.destination.type === "vendor") notifyVendor(ret.destination.vendorId, "Returned goods on the way", body, { returnId: ret._id });
        else notifyFranchise(ret.destination.franchiseId, "Returned goods on the way", body, { returnId: ret._id });
        emitToAdmin("stock_return_update", { returnId: ret._id, status: "sent", message: body });
        return handleResponse(res, 200, "Marked as sent", ret);
    } catch (err) {
        console.error("markStockReturnSent error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** Receiver confirms: credit note raised; a mother franchise gets good items back into its stock. */
const confirmReceived = async (ret, receiverName, note) => {
    const count = await StockReturn.countDocuments({ "creditNote.number": { $regex: /^RTN-/ } });
    const credit = {
        number: `RTN-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
        amount: valueOf(ret.items),
        at: new Date(),
    };
    await StockReturn.updateOne({ _id: ret._id }, { $set: { creditNote: credit, receivedNote: note } });
    ret.creditNote = credit;

    if (ret.destination.type === "mother_franchise") {
        for (const i of ret.items) if (i.condition === "good") await addStock(ret.destination.franchiseId, i.productId, i.quantity);
    }
    const body = `${receiverName} received your return ${refOf(ret._id)}. Credit note ${credit.number} for ₹${credit.amount}.`;
    notifyFranchise(ret.fromFranchiseId, "Return received", body, { returnId: ret._id });
    emitToAdmin("stock_return_update", { returnId: ret._id, status: "received", message: body });
    await createAdminNotification({
        type: "stock_return_received",
        title: "Return received",
        message: body,
        link: "/masteradmin/stock-returns",
        meta: { returnId: String(ret._id), creditNote: credit.number, amount: credit.amount },
    });
};

/** PUT /stock-returns/franchise/:id/received (mother franchise) */
export const motherReceiveStockReturn = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isId(id)) return handleResponse(res, 404, "Return not found");
        const ret = await StockReturn.findOneAndUpdate(
            { _id: id, "destination.type": "mother_franchise", "destination.franchiseId": req.franchise._id, status: "sent" },
            { $set: { status: "received", receivedAt: new Date() } },
            { new: true },
        );
        if (!ret) return handleResponse(res, 400, "This return is not on its way to you, or was already received");
        await confirmReceived(ret, req.franchise.franchiseName, String(req.body?.note || "").trim().slice(0, 300));
        return handleResponse(res, 200, "Return received", ret);
    } catch (err) {
        console.error("motherReceiveStockReturn error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/* ---------------- Vendor ---------------- */

/** GET /stock-returns/vendor */
export const getVendorStockReturns = async (req, res) => {
    try {
        const rows = await populateReturn(StockReturn.find({ "destination.vendorId": req.vendor._id, status: { $in: ["approved", "sent", "received"] } }))
            .sort({ createdAt: -1 }).limit(200).lean();
        return handleResponse(res, 200, "Returns", rows);
    } catch (err) {
        console.error("getVendorStockReturns error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** PUT /stock-returns/vendor/:id/received */
export const vendorReceiveStockReturn = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isId(id)) return handleResponse(res, 404, "Return not found");
        const ret = await StockReturn.findOneAndUpdate(
            { _id: id, "destination.type": "vendor", "destination.vendorId": req.vendor._id, status: "sent" },
            { $set: { status: "received", receivedAt: new Date() } },
            { new: true },
        );
        if (!ret) return handleResponse(res, 400, "This return is not on its way to you, or was already received");
        await confirmReceived(ret, req.vendor.fullName || "The vendor", String(req.body?.note || "").trim().slice(0, 300));
        return handleResponse(res, 200, "Return received", ret);
    } catch (err) {
        console.error("vendorReceiveStockReturn error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/* ---------------- Admin ---------------- */

const inScope = (req, franchiseId) => {
    const scope = scopeOf(req);
    return !scope || scope.franchiseIdSet.has(String(franchiseId));
};

/** GET /stock-returns/admin?status= */
export const adminListStockReturns = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && status !== "all") query.status = status;
        const scope = scopeOf(req);
        if (scope) query.fromFranchiseId = { $in: [...scope.franchiseIdSet].filter(isId) };
        const rows = await populateReturn(StockReturn.find(query)).sort({ createdAt: -1 }).limit(300).lean();
        return handleResponse(res, 200, "Stock returns", rows);
    } catch (err) {
        console.error("adminListStockReturns error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** GET /stock-returns/admin/destinations -> vendors and mother franchises to send a return to */
export const adminReturnDestinations = async (req, res) => {
    try {
        const scope = scopeOf(req);
        const motherQuery = { isMotherFranchise: true, status: "active" };
        if (scope) motherQuery._id = { $in: [...scope.franchiseIdSet].filter(isId) };
        const [vendors, mothers] = await Promise.all([
            Vendor.find({ status: { $ne: "blocked" } }).select("fullName mobile farmLocation status").sort({ fullName: 1 }).lean(),
            Franchise.find(motherQuery).select("franchiseName city area").sort({ franchiseName: 1 }).lean(),
        ]);
        return handleResponse(res, 200, "Destinations", { vendors, mothers });
    } catch (err) {
        console.error("adminReturnDestinations error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * PUT /stock-returns/admin/:id/approve  { type: "vendor" | "mother_franchise", vendorId | franchiseId, note }
 */
export const adminApproveStockReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, vendorId, franchiseId } = req.body || {};
        if (!isId(id)) return handleResponse(res, 404, "Return not found");
        const ret = await StockReturn.findById(id);
        if (!ret) return handleResponse(res, 404, "Return not found");
        if (!inScope(req, ret.fromFranchiseId)) return handleResponse(res, 403, "This belongs to another city. You can only work on your own city.");
        if (ret.status !== "requested") return handleResponse(res, 400, "This return has already been decided");

        let destination;
        let destName;
        if (type === "vendor") {
            const v = isId(vendorId) ? await Vendor.findById(vendorId).select("fullName status") : null;
            if (!v) return handleResponse(res, 400, "Choose a vendor");
            destination = { type, vendorId: v._id, franchiseId: null };
            destName = v.fullName;
        } else if (type === "mother_franchise") {
            const f = isId(franchiseId) ? await Franchise.findById(franchiseId).select("franchiseName isMotherFranchise status") : null;
            if (!f || !f.isMotherFranchise) return handleResponse(res, 400, "Choose a mother franchise");
            if (String(f._id) === String(ret.fromFranchiseId)) return handleResponse(res, 400, "A franchise cannot return goods to itself");
            if (!inScope(req, f._id)) return handleResponse(res, 403, "This mother franchise belongs to another city.");
            destination = { type, vendorId: null, franchiseId: f._id };
            destName = f.franchiseName;
        } else {
            return handleResponse(res, 400, "Choose where the goods go: a vendor or a mother franchise");
        }

        const updated = await StockReturn.findOneAndUpdate(
            { _id: ret._id, status: "requested" },
            { $set: { status: "approved", destination, approvedBy: req.masteradmin?._id || null, approvedAt: new Date(), adminNote: String(req.body?.note || "").trim().slice(0, 300) } },
            { new: true },
        );
        if (!updated) return handleResponse(res, 400, "This return has already been decided");

        notifyFranchise(updated.fromFranchiseId, "Return approved", `Admin approved return ${refOf(updated._id)}. Send the goods to ${destName} and mark it as sent.`, { returnId: updated._id });
        const heads = `Return ${refOf(updated._id)} (${listOf(updated.items)}) is coming to you. Confirm when you receive it.`;
        if (type === "vendor") notifyVendor(destination.vendorId, "Goods being returned to you", heads, { returnId: updated._id });
        else notifyFranchise(destination.franchiseId, "Goods being returned to you", heads, { returnId: updated._id });
        return handleResponse(res, 200, `Approved. The goods go to ${destName}.`, updated);
    } catch (err) {
        console.error("adminApproveStockReturn error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** PUT /stock-returns/admin/:id/reject  { reason } */
export const adminRejectStockReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = String(req.body?.reason || "").trim().slice(0, 300);
        if (!isId(id)) return handleResponse(res, 404, "Return not found");
        if (!reason) return handleResponse(res, 400, "Please write why the return is rejected");
        const ret = await StockReturn.findById(id).select("fromFranchiseId status");
        if (!ret) return handleResponse(res, 404, "Return not found");
        if (!inScope(req, ret.fromFranchiseId)) return handleResponse(res, 403, "This belongs to another city. You can only work on your own city.");
        const updated = await StockReturn.findOneAndUpdate(
            { _id: id, status: "requested" },
            { $set: { status: "rejected", adminNote: reason, approvedBy: req.masteradmin?._id || null, approvedAt: new Date() } },
            { new: true },
        );
        if (!updated) return handleResponse(res, 400, "This return has already been decided");
        notifyFranchise(updated.fromFranchiseId, "Return not approved", `Admin did not approve return ${refOf(updated._id)}: ${reason}`, { returnId: updated._id });
        return handleResponse(res, 200, "Return rejected", updated);
    } catch (err) {
        console.error("adminRejectStockReturn error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/** Received returns credited to a vendor (subtracted from what the vendor is owed). */
export const vendorReturnCredits = async (vendorId) => {
    const rows = await StockReturn.find({ "destination.vendorId": vendorId, status: "received" }).select("creditNote").lean();
    return { count: rows.length, amount: round2(rows.reduce((s, r) => s + Number(r.creditNote?.amount || 0), 0)) };
};
