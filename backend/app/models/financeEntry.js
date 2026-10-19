import mongoose from "mongoose";

/**
 * Financial record of one delivered customer order, written once when it is delivered
 * (utils/finance.js). Values are frozen then, so later rate or cost changes don't rewrite history.
 *
 * Stages per line:
 *   Superadmin buys from vendors   -> cost          (weighted-average price actually paid)
 *   Superadmin "sells" to franchise -> transferValue (customer price minus the franchise's commission)
 *   Franchise sells to customer     -> revenue       (customer price)
 *   franchiseEarning = revenue - transferValue (the franchise's commission)
 */
const lineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    name: String,
    unit: String,
    quantity: Number,
    sellPrice: Number,
    revenue: Number,
    unitCost: { type: Number, default: null },
    cost: { type: Number, default: null },
    // avg = franchise's weighted-average cost; last_purchase = franchise's last delivery of it;
    // network_last_purchase = last delivery of it anywhere; unknown = no purchase found
    costSource: { type: String, enum: ["avg", "last_purchase", "network_last_purchase", "unknown"], default: "unknown" },
    commissionPct: { type: Number, default: 0 },
    franchiseEarning: Number,
    transferValue: Number,
  },
  { _id: false },
);

const financeEntrySchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deliveredAt: { type: Date, required: true, index: true },
    paymentMethod: String,
    lines: [lineSchema],
    totals: {
      revenue: Number, // items at customer prices
      transferValue: Number,
      franchiseEarning: Number,
      cost: Number, // only lines with a known cost
      costUnknownRevenue: Number, // revenue of lines whose cost is not known (left out of profit)
      discount: Number,
      deliveryFee: Number,
      tax: Number,
    },
    costComplete: { type: Boolean, default: true },
    source: { type: String, enum: ["delivery", "backfill"], default: "delivery" },
  },
  { timestamps: true },
);

export default mongoose.models.FinanceEntry || mongoose.model("FinanceEntry", financeEntrySchema);
