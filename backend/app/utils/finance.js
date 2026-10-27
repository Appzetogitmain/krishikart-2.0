import mongoose from "mongoose";
import Order from "../models/order.js";
import Product from "../models/product.js";
import Inventory from "../models/inventory.js";
import ProcurementRequest from "../models/procurementRequest.js";
import FranchiseCommission from "../models/franchiseCommission.js";
import FinanceEntry from "../models/financeEntry.js";

/*
 * Writes the financial record of a delivered order (see models/financeEntry.js).
 * Rates come only from data: the price the customer was charged, the cost actually paid for the
 * stock, and the franchise's commission % set by the admin. Nothing is a fixed markup.
 * One record per order (unique orderId), so calling this again never adds a duplicate.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DELIVERED = ["Delivered", "Received"];

/** Cost per unit of each product for a franchise, with where the figure came from. */
async function costsFor(franchiseId, productIds) {
  const out = new Map();
  const ids = productIds.map(String);
  const inv = franchiseId ? await Inventory.findOne({ franchiseId }).select("items.productId items.avgCost").lean() : null;
  for (const it of inv?.items || []) {
    const k = String(it.productId);
    if (ids.includes(k) && Number(it.avgCost) > 0) out.set(k, { unitCost: Number(it.avgCost), costSource: "avg" });
  }
  const missing = ids.filter((k) => !out.has(k));
  if (!missing.length) return out;

  // Stock bought before costs were tracked: use the last rate paid for that product
  const lastPaid = (rows, source) => {
    for (const r of rows) {
      for (const i of r.items || []) {
        const k = String(i.productId);
        const rate = Number(i.quotedPrice || i.price || 0);
        if (missing.includes(k) && !out.has(k) && rate > 0) out.set(k, { unitCost: rate, costSource: source });
      }
    }
  };
  if (franchiseId) {
    lastPaid(await ProcurementRequest.find({ franchiseId, status: "completed", "items.productId": { $in: missing } })
      .sort({ updatedAt: -1 }).limit(50).select("items.productId items.quotedPrice items.price").lean(), "last_purchase");
  }
  const still = missing.filter((k) => !out.has(k));
  if (still.length) {
    lastPaid(await ProcurementRequest.find({ status: "completed", "items.productId": { $in: still } })
      .sort({ updatedAt: -1 }).limit(100).select("items.productId items.quotedPrice items.price").lean(), "network_last_purchase");
  }
  return out;
}

/**
 * Builds and stores the record for one order. Returns the entry, or null when the order is not
 * delivered. `source` is "delivery" (live) or "backfill" (script for older orders).
 */
export async function recordDeliveredOrder(orderId, source = "delivery") {
  const existing = await FinanceEntry.findOne({ orderId }).lean();
  if (existing) return existing;

  const order = await Order.findById(orderId).lean();
  if (!order || !DELIVERED.includes(order.orderStatus)) return null;

  const productIds = (order.items || []).map((i) => i.productId?._id || i.productId).filter(Boolean);
  const [products, commissions, costs] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select("category").lean(),
    order.franchiseId ? FranchiseCommission.find({ franchiseId: order.franchiseId }).select("categoryId commissionPercentage").lean() : [],
    costsFor(order.franchiseId, productIds),
  ]);
  const categoryOf = new Map(products.map((p) => [String(p._id), p.category ? String(p.category) : null]));
  const pctOf = new Map(commissions.map((c) => [String(c.categoryId), Number(c.commissionPercentage) || 0]));

  const lines = (order.items || []).map((i) => {
    const pid = String(i.productId?._id || i.productId);
    // What the customer actually kept (packed short, or some items given back at the door)
    const quantity = i.deliveredQuantity != null ? Number(i.deliveredQuantity) || 0
      : Number(i.packedQuantity) > 0 ? Number(i.packedQuantity) : Number(i.quantity) || 0;
    const sellPrice = Number(i.price) || 0;
    const revenue = round2(quantity * sellPrice);
    const categoryId = categoryOf.get(pid) || null;
    const commissionPct = categoryId ? pctOf.get(categoryId) || 0 : 0;
    const franchiseEarning = round2((revenue * commissionPct) / 100);
    const c = costs.get(pid);
    return {
      productId: pid,
      categoryId,
      name: i.name,
      unit: i.unit,
      quantity,
      sellPrice,
      revenue,
      unitCost: c ? round2(c.unitCost) : null,
      cost: c ? round2(c.unitCost * quantity) : null,
      costSource: c ? c.costSource : "unknown",
      commissionPct,
      franchiseEarning,
      transferValue: round2(revenue - franchiseEarning),
    };
  });

  const sum = (f, pick = () => true) => round2(lines.filter(pick).reduce((s, l) => s + (Number(l[f]) || 0), 0));
  const known = (l) => l.cost !== null;
  const entry = {
    orderId: order._id,
    franchiseId: order.franchiseId || null,
    userId: order.userId || null,
    deliveredAt: order.deliveredAt || order.updatedAt || new Date(),
    paymentMethod: order.paymentMethod,
    lines,
    totals: {
      revenue: sum("revenue"),
      transferValue: sum("transferValue"),
      franchiseEarning: sum("franchiseEarning"),
      cost: sum("cost", known),
      costUnknownRevenue: sum("revenue", (l) => !known(l)),
      discount: round2(order.discountAmount),
      deliveryFee: round2(order.deliveryFee),
      tax: round2(order.tax),
    },
    costComplete: lines.every(known),
    source,
  };

  // Insert only if missing: a second call (double tap, retry, backfill re-run) never duplicates
  await FinanceEntry.updateOne({ orderId: order._id }, { $setOnInsert: entry }, { upsert: true }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });
  return FinanceEntry.findOne({ orderId: order._id }).lean();
}

export const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
