import mongoose from "mongoose";
import DeliveryCodRemittance from "../models/deliveryCodRemittance.js";
import Order from "../models/order.js";
import { handleResponse } from "../utils/helper.js";
import { emitToDelivery, emitToAdmin } from "../lib/socket.js";

const sumAmount = (rows) => Number(rows.reduce((s, r) => s + Number(r.amount || 0), 0).toFixed(2));

/**
 * GET /franchise/cod/remittances?status=submitted|verified|rejected|all
 * Cash that delivery partners handed to this franchise for the orders it sent out.
 */
export const getFranchiseCodRemittances = async (req, res) => {
  try {
    const franchiseId = req.franchise._id;
    const { status = "all" } = req.query;
    const query = { franchiseId };
    if (["submitted", "verified", "rejected"].includes(status)) query.status = status;

    const [rows, all] = await Promise.all([
      DeliveryCodRemittance.find(query)
        .populate("deliveryPartnerId", "fullName mobile vehicleNumber")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      DeliveryCodRemittance.find({ franchiseId }).select("amount status").lean(),
    ]);

    // Cash still with the delivery partners: COD orders already delivered whose cash has not been handed
    // over yet (client, Nov 2026: show it the moment the order is delivered). Same rule as the partner app.
    const pendingOrders = await Order.find({
      franchiseId,
      paymentMethod: "COD",
      "codTracking.isCollected": true,
      "codTracking.remittanceStatus": "pending",
    })
      .select("_id totalAmount codTracking deliveredAt createdAt userId deliveryPartnerId")
      .populate("codTracking.collectedByDeliveryId", "fullName mobile vehicleNumber")
      .populate("userId", "fullName")
      .sort({ "codTracking.collectedAt": -1 })
      .lean();
    const byPartner = new Map();
    for (const o of pendingOrders) {
      const amount = Number(o.codTracking?.collectedAmount || o.totalAmount || 0);
      if (!(amount > 0)) continue;
      const partner = o.codTracking?.collectedByDeliveryId || null;
      const key = partner?._id ? String(partner._id) : "unknown";
      if (!byPartner.has(key)) {
        byPartner.set(key, { _id: `to_collect_${key}`, status: "to_collect", deliveryPartnerId: partner, amount: 0, orderIds: [], orders: [], createdAt: null });
      }
      const row = byPartner.get(key);
      const at = o.codTracking?.collectedAt || o.deliveredAt || o.createdAt;
      row.amount = Number((row.amount + amount).toFixed(2));
      row.orderIds.push(o._id);
      row.orders.push({ _id: o._id, amount, deliveredAt: at, customer: o.userId?.fullName || "" });
      if (!row.createdAt || new Date(at) > new Date(row.createdAt)) row.createdAt = at;
    }
    const toCollect = [...byPartner.values()].map((r) => ({ ...r, orderCount: r.orderIds.length }));

    const awaiting = all.filter((r) => r.status === "submitted");
    const verified = all.filter((r) => r.status === "verified");
    const rejected = all.filter((r) => r.status === "rejected");
    return handleResponse(res, 200, "COD cash fetched", {
      remittances: status === "to_collect"
        ? toCollect
        : rows.map((r) => ({ ...r, orderCount: (r.orderIds || []).length })),
      totals: {
        toCollectAmount: sumAmount(toCollect),
        toCollectCount: toCollect.reduce((s, r) => s + r.orderCount, 0),
        awaitingAmount: sumAmount(awaiting),
        awaitingCount: awaiting.length,
        verifiedAmount: sumAmount(verified),
        verifiedCount: verified.length,
        rejectedAmount: sumAmount(rejected),
        rejectedCount: rejected.length,
        allCount: all.length,
      },
    });
  } catch (err) {
    console.error("Franchise COD list error:", err);
    return handleResponse(res, 500, "Could not load the COD cash list");
  }
};

/**
 * PUT /franchise/cod/remittances/:remittanceId/review  { action: "verify" | "reject", reason }
 * The franchise confirms it received the cash (verify), or says it did not (reject, so the delivery
 * partner has to submit again).
 */
export const reviewFranchiseCodRemittance = async (req, res) => {
  try {
    const { remittanceId } = req.params;
    const { action, reason = "" } = req.body || {};

    if (!["verify", "reject"].includes(action)) {
      return handleResponse(res, 400, "Action must be verify or reject");
    }
    if (!mongoose.isValidObjectId(remittanceId)) return handleResponse(res, 404, "Remittance not found");
    if (action === "reject" && !String(reason).trim()) {
      return handleResponse(res, 400, "Please tell the delivery partner why the cash is not accepted");
    }

    const remittance = await DeliveryCodRemittance.findById(remittanceId);
    if (!remittance) return handleResponse(res, 404, "Remittance not found");
    if (!remittance.franchiseId || remittance.franchiseId.toString() !== req.franchise._id.toString()) {
      return handleResponse(res, 403, "This cash was not handed to your franchise");
    }
    if (remittance.status !== "submitted") {
      return handleResponse(res, 400, "Only cash waiting for your check can be verified or rejected");
    }

    if (action === "verify") {
      remittance.status = "verified";
      remittance.verifiedByFranchise = req.franchise._id;
      remittance.verifiedAt = new Date();
      remittance.rejectionReason = "";
      await Order.updateMany(
        { _id: { $in: remittance.orderIds } },
        { $set: { "codTracking.remittanceStatus": "verified", "codTracking.verifiedAt": new Date() } },
      );
    } else {
      remittance.status = "rejected";
      remittance.rejectionReason = String(reason).trim();
      await Order.updateMany(
        { _id: { $in: remittance.orderIds } },
        {
          $set: {
            "codTracking.remittanceStatus": "pending",
            "codTracking.remittanceId": null,
            "codTracking.remittedAt": null,
          },
        },
      );
    }
    await remittance.save();

    const payload = {
      remittanceId: remittance._id,
      status: remittance.status,
      amount: remittance.amount,
      franchiseName: req.franchise.franchiseName || "",
      reason: remittance.rejectionReason,
    };
    emitToDelivery(remittance.deliveryPartnerId.toString(), "cod_remittance_reviewed", payload);
    emitToAdmin("cod_remittance_reviewed", { ...payload, franchiseId: req.franchise._id });

    return handleResponse(
      res,
      200,
      action === "verify" ? "Cash marked as received" : "Cash rejected. The delivery partner will submit it again.",
      remittance,
    );
  } catch (err) {
    console.error("Franchise COD review error:", err);
    return handleResponse(res, 500, "Could not update this cash entry");
  }
};
