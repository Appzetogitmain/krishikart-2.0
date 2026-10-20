import mongoose from "mongoose";
import FranchiseAdminPayout from "../models/franchiseAdminPayout.js";
import handleResponse from "../utils/helper.js";
import { emitToAdmin } from "../lib/socket.js";
import { createAdminNotification } from "../utils/adminNotification.js";
import { earningsStatement } from "../utils/franchiseEarnings.js";

const money = (n) => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-IN")}`;

/** GET /franchise/reports/earnings?from=&to=  The franchise's own earnings statement. */
export const getMyEarnings = async (req, res) => {
  try {
    const statement = await earningsStatement(req.franchise._id, { from: req.query.from, to: req.query.to });
    return handleResponse(res, 200, "Earnings statement", statement);
  } catch (err) {
    console.error("getMyEarnings error:", err);
    return handleResponse(res, 500, "Could not load your earnings");
  }
};

/**
 * PUT /franchise/reports/admin-payouts/:id/confirm   - the franchise got the money
 * PUT /franchise/reports/admin-payouts/:id/dispute   { note } - it did not (or the amount is wrong)
 */
const respond = (status) => async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return handleResponse(res, 404, "Payment not found");
    const note = String(req.body?.note || "").trim().slice(0, 300);
    if (status === "disputed" && !note) return handleResponse(res, 400, "Please tell the admin what is wrong with this payment");

    const payout = await FranchiseAdminPayout.findOne({ _id: id, franchiseId: req.franchise._id });
    if (!payout) return handleResponse(res, 404, "Payment not found");
    if (payout.status === "confirmed") return handleResponse(res, 400, "You already confirmed this payment");

    payout.status = status;
    payout.respondedAt = new Date();
    payout.disputeNote = status === "disputed" ? note : "";
    await payout.save();

    const who = req.franchise.franchiseName || "A franchise";
    const message = status === "confirmed"
      ? `${who} confirmed receiving ${money(payout.amount)}${payout.reference ? ` (ref ${payout.reference})` : ""}.`
      : `${who} says it did not receive ${money(payout.amount)}${payout.reference ? ` (ref ${payout.reference})` : ""}: ${note}`;
    emitToAdmin("franchise_payout_response", { payoutId: payout._id, status, message });
    await createAdminNotification({
      type: "franchise_payout_response",
      title: status === "confirmed" ? "Franchise confirmed a payment" : "Franchise disputes a payment",
      message,
      link: "/masteradmin/franchise-payouts",
      meta: { payoutId: String(payout._id), franchiseId: String(req.franchise._id), status },
    });

    return handleResponse(res, 200, status === "confirmed" ? "Payment confirmed" : "The admin has been told this payment did not arrive", payout);
  } catch (err) {
    console.error("respond to payout error:", err);
    return handleResponse(res, 500, "Could not update this payment");
  }
};

export const confirmPayout = respond("confirmed");
export const disputePayout = respond("disputed");
