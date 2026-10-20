import mongoose from "mongoose";

/** Records cash/settlement paid by network admin to a franchise (visible on franchise Reports). */
const franchiseAdminPayoutSchema = new mongoose.Schema(
  {
    franchiseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
    reference: { type: String, default: "" },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterAdmin",
      default: null,
    },
    // The franchise confirms it received the money, or says it did not (with a note)
    status: {
      type: String,
      enum: ["awaiting_confirmation", "confirmed", "disputed"],
      default: "awaiting_confirmation",
      index: true,
    },
    respondedAt: { type: Date, default: null },
    disputeNote: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model(
  "FranchiseAdminPayout",
  franchiseAdminPayoutSchema,
);
