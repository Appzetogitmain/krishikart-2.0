import mongoose from "mongoose";
import FinanceEntry from "../models/financeEntry.js";
import FranchiseAdminPayout from "../models/franchiseAdminPayout.js";
import FranchiseCommission from "../models/franchiseCommission.js";
import Franchise from "../models/franchise.js";
import Category from "../models/category.js";
import { istDayKeyToDate } from "./deliverySchedule.js";

/*
 * A franchise's earnings statement: what it earned (its commission on delivered orders, from the
 * records written at delivery), what the admin has paid it, and what is still due. Shared by the
 * franchise's "Earnings & Payments" page and the admin's Franchise Payouts page so both agree.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const nextDay = (k) => { const d = new Date(`${k}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Payments recorded before confirmations existed count as waiting for the franchise. */
export const payoutStatus = (p) => p.status || "awaiting_confirmation";

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD as IST day bounds; either may be missing. */
export function dayRange(from, to) {
  const r = {};
  if (isDay(from)) r.$gte = istDayKeyToDate(from);
  if (isDay(to)) r.$lt = istDayKeyToDate(nextDay(to));
  return Object.keys(r).length ? r : null;
}

/** Totals that don't depend on a date range: earned so far, paid, waiting, disputed, balance due. */
export async function balanceOf(franchiseIds) {
  const ids = franchiseIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const [earned, payouts] = await Promise.all([
    FinanceEntry.aggregate([
      { $match: { franchiseId: { $in: ids } } },
      { $group: { _id: "$franchiseId", earned: { $sum: "$totals.franchiseEarning" } } },
    ]),
    FranchiseAdminPayout.find({ franchiseId: { $in: ids } }).select("franchiseId amount status").lean(),
  ]);
  const out = new Map(ids.map((id) => [String(id), { earned: 0, confirmed: 0, awaiting: 0, disputed: 0, awaitingCount: 0, disputedCount: 0 }]));
  for (const e of earned) out.get(String(e._id)).earned = round2(e.earned);
  for (const p of payouts) {
    const b = out.get(String(p.franchiseId));
    const s = payoutStatus(p);
    if (s === "confirmed") b.confirmed += Number(p.amount) || 0;
    else if (s === "disputed") { b.disputed += Number(p.amount) || 0; b.disputedCount++; }
    else { b.awaiting += Number(p.amount) || 0; b.awaitingCount++; }
  }
  for (const b of out.values()) {
    b.confirmed = round2(b.confirmed);
    b.awaiting = round2(b.awaiting);
    b.disputed = round2(b.disputed);
    // A payment counts as paid once recorded, unless the franchise says it never arrived
    b.paid = round2(b.confirmed + b.awaiting);
    b.balanceDue = round2(b.earned - b.paid);
  }
  return out;
}

/** The full statement for one franchise (period figures for from..to, plus overall balance). */
export async function earningsStatement(franchiseId, { from, to } = {}) {
  const fid = new mongoose.Types.ObjectId(String(franchiseId));
  const range = dayRange(from, to);
  const [franchise, entries, commissions, payments, balances] = await Promise.all([
    Franchise.findById(fid).select("franchiseName servedCategories").lean(),
    FinanceEntry.find({ franchiseId: fid, ...(range ? { deliveredAt: range } : {}) }).select("lines totals deliveredAt").lean(),
    FranchiseCommission.find({ franchiseId: fid }).select("categoryId commissionPercentage").lean(),
    FranchiseAdminPayout.find({ franchiseId: fid }).sort({ paidAt: -1 }).limit(200).lean(),
    balanceOf([fid]),
  ]);

  const rateOf = new Map(commissions.map((c) => [String(c.categoryId), Number(c.commissionPercentage) || 0]));
  const byCat = new Map();
  let sales = 0, earned = 0;
  for (const e of entries) {
    for (const l of e.lines || []) {
      const k = l.categoryId ? String(l.categoryId) : "none";
      const c = byCat.get(k) || { sales: 0, earned: 0, rates: new Set() };
      c.sales += Number(l.revenue) || 0;
      c.earned += Number(l.franchiseEarning) || 0;
      c.rates.add(Number(l.commissionPct) || 0);
      byCat.set(k, c);
      sales += Number(l.revenue) || 0;
      earned += Number(l.franchiseEarning) || 0;
    }
  }

  // Categories this franchise sells in (registered or actually sold) whose commission % is not set
  const served = (franchise?.servedCategories || []).map(String);
  const relevant = [...new Set([...served, ...[...byCat.keys()].filter((k) => k !== "none")])];
  const names = new Map((await Category.find({ _id: { $in: relevant } }).select("name").lean()).map((c) => [String(c._id), c.name]));
  const missingRates = relevant.filter((k) => !(rateOf.get(k) > 0)).map((k) => names.get(k) || "Unknown category");

  const byCategory = [...byCat.entries()].map(([k, c]) => ({
    category: k === "none" ? "No category" : names.get(k) || "Unknown category",
    // Rate in force when the orders were delivered (one value, or a range if it changed in the period)
    rateAtDelivery: c.rates.size === 1 ? [...c.rates][0] : `${Math.min(...c.rates)}–${Math.max(...c.rates)}`,
    currentRate: rateOf.get(k) ?? 0,
    sales: round2(c.sales),
    earned: round2(c.earned),
  })).sort((a, b) => b.sales - a.sales);

  const inRange = (p) => !range || ((!range.$gte || p.paidAt >= range.$gte) && (!range.$lt || p.paidAt < range.$lt));
  return {
    franchiseName: franchise?.franchiseName || "Franchise",
    period: {
      from: from || null,
      to: to || null,
      orders: entries.length,
      sales: round2(sales),
      earned: round2(earned),
      paidInPeriod: round2(payments.filter(inRange).filter((p) => payoutStatus(p) !== "disputed").reduce((s, p) => s + (Number(p.amount) || 0), 0)),
      byCategory,
    },
    balance: balances.get(String(fid)),
    missingRates,
    payments: payments.map((p) => ({
      _id: p._id,
      amount: round2(p.amount),
      paidAt: p.paidAt,
      reference: p.reference || "",
      note: p.note || "",
      status: payoutStatus(p),
      respondedAt: p.respondedAt || null,
      disputeNote: p.disputeNote || "",
    })),
  };
}
