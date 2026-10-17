import mongoose from "mongoose";
import ProcurementRequest from "../models/procurementRequest.js";
import Franchise from "../models/franchise.js";
import Inventory from "../models/inventory.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import { emitToAdmin, emitToFranchise } from "../lib/socket.js";
import { sendNotificationToUser } from "../utils/pushNotificationHelper.js";
import { createAdminNotification } from "../utils/adminNotification.js";
import { takeStock, addStock } from "../utils/stock.js";
import { scopeOf } from "../utils/adminScope.js";

/*
 * Mother franchise supply: a franchise asks for stock, the admin gives the request to a mother
 * franchise (a franchise that keeps stock for others) instead of a vendor, the mother franchise
 * sends it from its own stock, and the requesting franchise checks it in on Receiving as usual.
 */

const refOf = (id) => `#${String(id).slice(-6).toUpperCase()}`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const pushToFranchise = (franchiseId, title, body, link) =>
    sendNotificationToUser(String(franchiseId), { title, body, data: { type: "procurement", link } }, "franchise");

/** Current stock of the given products in one franchise, as { productId: qty }. */
const stockOf = async (franchiseId, productIds) => {
    const inv = await Inventory.findOne({ franchiseId }).select("items.productId items.currentStock").lean();
    const wanted = new Set((productIds || []).map(String));
    const out = {};
    for (const it of inv?.items || []) {
        const key = String(it.productId);
        if (wanted.has(key)) out[key] = Number(it.currentStock) || 0;
    }
    return out;
};

const addOrderNote = async (orderId, message) => {
    if (!orderId) return;
    await Order.findByIdAndUpdate(orderId, {
        $push: { statusHistory: { status: "Procuring", updatedAt: new Date(), updatedBy: "system", message } },
    });
};

/* ---------------- Admin ---------------- */

/**
 * PUT /masteradmin/franchises/:id/mother  { isMotherFranchise: boolean }
 */
export const setMotherFranchise = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isId(id)) return handleResponse(res, 404, "Franchise not found");
        const value = req.body?.isMotherFranchise === true;

        if (!value) {
            const open = await ProcurementRequest.countDocuments({ supplierFranchiseId: id, status: "approved" });
            if (open > 0) {
                return handleResponse(res, 400, `This franchise still has ${open} stock request(s) to send. Let it send or decline them first.`);
            }
        }

        const franchise = await Franchise.findByIdAndUpdate(id, { isMotherFranchise: value }, { new: true })
            .select("franchiseName isMotherFranchise");
        if (!franchise) return handleResponse(res, 404, "Franchise not found");

        return handleResponse(
            res,
            200,
            value ? `${franchise.franchiseName} is now a mother franchise` : `${franchise.franchiseName} is no longer a mother franchise`,
            franchise,
        );
    } catch (err) {
        console.error("setMotherFranchise error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * GET /procurement/admin/mother-franchises?requestId=&productId=
 * Mother franchises that can supply a request, with how much of each requested product they hold.
 */
export const listMotherFranchisesForRequest = async (req, res) => {
    try {
        const { requestId, productId } = req.query;
        const request = isId(requestId) ? await ProcurementRequest.findById(requestId).lean() : null;
        if (!request) return handleResponse(res, 404, "Request not found");

        const items = productId
            ? request.items.filter((i) => String(i.productId) === String(productId))
            : request.items;
        const productIds = items.map((i) => String(i.productId)).filter(isId);

        const query = { isMotherFranchise: true, status: "active", _id: { $ne: request.franchiseId } };
        const scope = scopeOf(req);
        if (scope) query._id = { $in: [...scope.franchiseIdSet].filter((x) => x !== String(request.franchiseId)) };

        const mothers = await Franchise.find(query).select("franchiseName ownerName mobile city area").lean();
        const result = [];
        for (const m of mothers) {
            const stock = await stockOf(m._id, productIds);
            const lines = items.map((i) => ({
                productId: String(i.productId),
                name: i.name,
                unit: i.unit,
                needed: Number(i.quantity) || 0,
                inStock: stock[String(i.productId)] || 0,
            }));
            result.push({ ...m, lines, hasAll: lines.every((l) => l.inStock >= l.needed) });
        }
        // Mothers that can send everything first, then by name
        result.sort((a, b) => Number(b.hasAll) - Number(a.hasAll) || String(a.franchiseName).localeCompare(String(b.franchiseName)));
        return handleResponse(res, 200, "Mother franchises", result);
    } catch (err) {
        console.error("listMotherFranchisesForRequest error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * PUT /procurement/admin/:requestId/assign-mother  { supplierFranchiseId, itemId? }
 * Gives the request (or one item of it, which is split off) to a mother franchise. There is no rate
 * bargaining between franchises, so the request is approved straight away and the mother can send it.
 */
export const assignMotherFranchise = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { supplierFranchiseId, itemId } = req.body || {};
        if (!isId(requestId)) return handleResponse(res, 404, "Request not found");
        if (!isId(supplierFranchiseId)) return handleResponse(res, 400, "Please choose a mother franchise");

        const request = await ProcurementRequest.findById(requestId);
        if (!request) return handleResponse(res, 404, "Request not found");
        if (request.status !== "pending_assignment") {
            return handleResponse(res, 400, "This request has already been assigned");
        }
        if (String(request.franchiseId) === String(supplierFranchiseId)) {
            return handleResponse(res, 400, "A franchise cannot supply itself");
        }

        const mother = await Franchise.findById(supplierFranchiseId).select("franchiseName isMotherFranchise status");
        if (!mother || !mother.isMotherFranchise) return handleResponse(res, 400, "This franchise is not a mother franchise");
        if (mother.status !== "active") return handleResponse(res, 400, "This mother franchise is not active");
        const scope = scopeOf(req);
        if (scope && !scope.franchiseIdSet.has(String(mother._id))) {
            return handleResponse(res, 403, "This mother franchise belongs to another city.");
        }

        let target = request;
        if (itemId && request.items.length > 1) {
            const idx = request.items.findIndex((i) =>
                String(i.productId) === String(itemId) || String(i._id) === String(itemId));
            if (idx < 0) return handleResponse(res, 400, "Item not found in this request");
            const [item] = request.items.splice(idx, 1);
            request.totalEstimatedAmount = round2(request.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0));
            await request.save();
            target = new ProcurementRequest({
                franchiseId: request.franchiseId,
                orderId: request.orderId,
                source: request.source,
                items: [item.toObject()],
                totalEstimatedAmount: round2((item.price || 0) * (item.quantity || 0)),
            });
        }

        // Transfer at the catalogue rate the franchise saw when asking
        target.items.forEach((i) => {
            i.quotedPrice = Number(i.price) || 0;
            i.originalQuotedPrice = Number(i.price) || 0;
        });
        target.totalQuotedAmount = round2(target.items.reduce((s, i) => s + (i.quotedPrice || 0) * (i.quantity || 0), 0));
        target.supplierFranchiseId = mother._id;
        target.assignedVendorId = null;
        target.status = "approved";
        target.adminId = req.masteradmin?._id || null;
        await target.save();

        const ref = refOf(target._id);
        const list = target.items.map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(", ");
        emitToFranchise(String(mother._id), "supply_request_update", {
            requestId: target._id,
            status: "approved",
            message: `New stock request ${ref} to send: ${list}`,
        });
        pushToFranchise(mother._id, "New stock to send", `Admin asked you to send ${list} (${ref}).`, "/franchise/supply");
        emitToFranchise(String(target.franchiseId), "procurement_cycle_update", {
            requestId: target._id,
            status: "approved",
            message: `Your stock request ${ref} will be sent by ${mother.franchiseName}.`,
        });
        await addOrderNote(target.orderId, `Stock will be sent by mother franchise ${mother.franchiseName}.`);

        const populated = await ProcurementRequest.findById(target._id)
            .populate("supplierFranchiseId", "franchiseName")
            .lean();
        return handleResponse(res, 200, `Request given to ${mother.franchiseName}`, populated);
    } catch (err) {
        console.error("assignMotherFranchise error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/* ---------------- Mother franchise ---------------- */

const requireMother = (req, res) => {
    if (!req.franchise?.isMotherFranchise) {
        handleResponse(res, 403, "Only a mother franchise can do this.");
        return false;
    }
    return true;
};

/**
 * GET /procurement/franchise/supply-requests
 * Stock requests the admin gave to this mother franchise, with its own stock of each item.
 */
export const getSupplyRequests = async (req, res) => {
    try {
        if (!requireMother(req, res)) return;
        const me = req.franchise._id;
        const rows = await ProcurementRequest.find({ supplierFranchiseId: me })
            .populate("franchiseId", "franchiseName ownerName mobile city area")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        const productIds = [...new Set(rows.flatMap((r) => r.items.map((i) => String(i.productId))))].filter(isId);
        const stock = await stockOf(me, productIds);
        for (const r of rows) {
            for (const i of r.items) i.myStock = stock[String(i.productId)] || 0;
        }
        return handleResponse(res, 200, "Supply requests", rows);
    } catch (err) {
        console.error("getSupplyRequests error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * PUT /procurement/franchise/supply-requests/:requestId/dispatch  { items: [{ itemId, dispatchedQuantity }], note }
 * Sends the stock: it leaves the mother franchise's stock now, and reaches the requesting franchise's
 * stock when that franchise confirms receipt. Anything not sent goes back to the admin as a new request.
 */
export const dispatchSupplyRequest = async (req, res) => {
    try {
        if (!requireMother(req, res)) return;
        const { requestId } = req.params;
        if (!isId(requestId)) return handleResponse(res, 404, "Request not found");
        const me = req.franchise._id;

        const request = await ProcurementRequest.findById(requestId);
        if (!request) return handleResponse(res, 404, "Request not found");
        if (String(request.supplierFranchiseId) !== String(me)) {
            return handleResponse(res, 403, "This request was not given to you");
        }
        if (request.status !== "approved") {
            return handleResponse(res, 400, "This request has already been sent or is no longer open");
        }

        const asked = Array.isArray(req.body?.items) ? req.body.items : [];
        const plan = [];
        for (const item of request.items) {
            const a = asked.find((x) => String(x.itemId) === String(item._id) || String(x.itemId) === String(item.productId));
            const qty = a ? Number(a.dispatchedQuantity) : Number(item.quantity);
            if (!Number.isFinite(qty) || qty < 0) return handleResponse(res, 400, `Please enter a valid quantity for ${item.name}`);
            if (qty > Number(item.quantity)) {
                return handleResponse(res, 400, `${item.name}: you can send at most ${item.quantity} ${item.unit} (what was asked).`);
            }
            plan.push({ item, qty: round2(qty) });
        }
        if (!plan.some((p) => p.qty > 0)) {
            return handleResponse(res, 400, "Nothing to send. Use \"Cannot supply\" if you do not have this stock.");
        }

        // Claim the request first so a double tap cannot take the stock twice
        const claimed = await ProcurementRequest.updateOne(
            { _id: request._id, status: "approved", supplierFranchiseId: me },
            { $set: { status: "preparing" } },
        );
        if (claimed.modifiedCount !== 1) return handleResponse(res, 400, "This request is already being sent");

        // Take the stock; if any item is short, put back what was taken and stop
        const taken = [];
        for (const p of plan) {
            if (p.qty <= 0) continue;
            const ok = isId(p.item.productId) && (await takeStock(me, p.item.productId, p.qty));
            if (!ok) {
                for (const t of taken) await addStock(me, t.item.productId, t.qty);
                await ProcurementRequest.updateOne({ _id: request._id }, { $set: { status: "approved" } });
                return handleResponse(res, 400, `Not enough ${p.item.name} in your stock to send ${p.qty} ${p.item.unit}.`);
            }
            taken.push(p);
        }

        // What was not sent goes back to the admin to find another supplier
        const rest = plan
            .filter((p) => p.qty < Number(p.item.quantity))
            .map((p) => ({ ...p.item.toObject(), _id: undefined, quantity: round2(Number(p.item.quantity) - p.qty), dispatchedQuantity: 0, quotedPrice: 0, originalQuotedPrice: 0 }));
        let restRequest = null;
        if (rest.length) {
            restRequest = await ProcurementRequest.create({
                franchiseId: request.franchiseId,
                orderId: request.orderId,
                source: request.source,
                items: rest,
                totalEstimatedAmount: round2(rest.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)),
                status: "pending_assignment",
                lastDecline: { franchiseId: me, reason: "Sent only part of the stock", at: new Date() },
            });
        }

        const fresh = await ProcurementRequest.findById(request._id);
        fresh.items = fresh.items.filter((i) => plan.find((p) => String(p.item._id) === String(i._id))?.qty > 0);
        for (const i of fresh.items) {
            const p = plan.find((x) => String(x.item._id) === String(i._id));
            i.quantity = p.qty;
            i.dispatchedQuantity = p.qty;
        }
        fresh.totalQuotedAmount = round2(fresh.items.reduce((s, i) => s + (i.quotedPrice || i.price || 0) * i.quantity, 0));
        fresh.status = "picked_up";
        fresh.supplierDispatchedAt = new Date();
        fresh.supplierNote = String(req.body?.note || "").trim().slice(0, 300);
        const count = await ProcurementRequest.countDocuments({ "invoice.invoiceNumber": { $regex: /^TRF-/ } });
        fresh.invoice = {
            invoiceNumber: `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
            invoiceDate: new Date(),
            generatedAt: new Date(),
        };
        await fresh.save();

        const ref = refOf(fresh._id);
        const sent = fresh.items.map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(", ");
        emitToFranchise(String(fresh.franchiseId), "procurement_cycle_update", {
            requestId: fresh._id,
            status: "picked_up",
            message: `${req.franchise.franchiseName} sent your stock ${ref}: ${sent}. Please check it in on Receiving when it arrives.`,
        });
        pushToFranchise(fresh.franchiseId, "Stock on the way", `${req.franchise.franchiseName} sent ${sent} (${ref}). Check it in on Receiving when it arrives.`, "/franchise/receiving");
        emitToAdmin("procurement_status_updated", { requestId: fresh._id, status: "picked_up", message: `Mother franchise sent ${ref}` });
        await createAdminNotification({
            type: "procurement_status_updated",
            title: restRequest ? "Mother franchise sent part of a request" : "Mother franchise sent stock",
            message: `${req.franchise.franchiseName} sent ${sent} for ${ref}.${restRequest ? ` The rest needs a new supplier (${refOf(restRequest._id)}).` : ""}`,
            link: "/masteradmin/assignment",
            meta: { requestId: String(fresh._id), restRequestId: restRequest ? String(restRequest._id) : "" },
        });
        await addOrderNote(fresh.orderId, `Stock sent by mother franchise ${req.franchise.franchiseName}.`);

        return handleResponse(res, 200, restRequest
            ? "Stock sent. What you could not send has gone back to the admin."
            : "Stock sent", { request: fresh, restRequestId: restRequest?._id || null });
    } catch (err) {
        console.error("dispatchSupplyRequest error:", err);
        return handleResponse(res, 500, "Server error");
    }
};

/**
 * PUT /procurement/franchise/supply-requests/:requestId/decline  { reason }
 * The mother franchise cannot send it: the request goes back to the admin to assign again.
 */
export const declineSupplyRequest = async (req, res) => {
    try {
        if (!requireMother(req, res)) return;
        const { requestId } = req.params;
        const reason = String(req.body?.reason || "").trim().slice(0, 300);
        if (!isId(requestId)) return handleResponse(res, 404, "Request not found");
        if (!reason) return handleResponse(res, 400, "Please write why you cannot send it");
        const me = req.franchise._id;

        const request = await ProcurementRequest.findOneAndUpdate(
            { _id: requestId, supplierFranchiseId: me, status: "approved" },
            {
                $set: {
                    status: "pending_assignment",
                    supplierFranchiseId: null,
                    lastDecline: { franchiseId: me, reason, at: new Date() },
                },
            },
            { new: true },
        );
        if (!request) {
            const exists = await ProcurementRequest.findById(requestId).select("supplierFranchiseId status").lean();
            if (!exists) return handleResponse(res, 404, "Request not found");
            if (String(exists.supplierFranchiseId) !== String(me)) return handleResponse(res, 403, "This request was not given to you");
            return handleResponse(res, 400, "This request can no longer be declined");
        }

        const ref = refOf(request._id);
        emitToAdmin("new_procurement_request", { requestId: request._id, message: `${req.franchise.franchiseName} cannot send ${ref}: ${reason}` });
        await createAdminNotification({
            type: "procurement_status_updated",
            title: "Mother franchise cannot send stock",
            message: `${req.franchise.franchiseName} cannot send ${ref}: ${reason}. Please assign it again.`,
            link: "/masteradmin/assignment",
            meta: { requestId: String(request._id) },
        });
        await addOrderNote(request.orderId, `Mother franchise ${req.franchise.franchiseName} could not send the stock; waiting for a new supplier.`);

        return handleResponse(res, 200, "Sent back to the admin", request);
    } catch (err) {
        console.error("declineSupplyRequest error:", err);
        return handleResponse(res, 500, "Server error");
    }
};
