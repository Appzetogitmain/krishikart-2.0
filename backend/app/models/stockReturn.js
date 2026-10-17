import mongoose from "mongoose";

/**
 * Stock a franchise sends back up the supply chain (to a vendor or a mother franchise), always
 * approved by the admin first. Goes requested -> approved -> sent -> received, or rejected/cancelled.
 */
const stockReturnSchema = new mongoose.Schema(
  {
    fromFranchiseId: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", required: true, index: true },

    // from_delivery: damaged/rejected goods from a delivery the franchise received (never went into stock)
    // from_stock:    goods taken out of the franchise's stock (spoiled later, franchise closing, ...)
    // from_return:   damaged goods a mother franchise received in a return, sent on to the vendor
    kind: { type: String, enum: ["from_delivery", "from_stock", "from_return"], required: true },
    procurementRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "ProcurementRequest", default: null },
    sourceReturnId: { type: mongoose.Schema.Types.ObjectId, ref: "StockReturn", default: null },

    reason: {
      type: String,
      enum: ["damaged_from_supplier", "rejected_at_receiving", "spoiled_in_stock", "franchise_closing", "other"],
      required: true,
    },
    note: { type: String, default: "", trim: true },

    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: String,
        unit: String,
        quantity: { type: Number, required: true, min: 0 },
        price: { type: Number, default: 0 }, // rate the franchise paid; used for the credit note
        condition: { type: String, enum: ["good", "damaged"], default: "damaged" },
        fromStock: { type: Boolean, default: false }, // leaves the franchise's stock when sent
      },
    ],

    // Supplier the goods came from (suggested destination)
    suggested: {
      type: { type: String, enum: ["vendor", "mother_franchise", null], default: null },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
      franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", default: null },
    },
    // Where the admin decided it goes
    destination: {
      type: { type: String, enum: ["vendor", "mother_franchise", null], default: null },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
      franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", default: null },
    },

    status: {
      type: String,
      enum: ["requested", "approved", "sent", "received", "rejected", "cancelled"],
      default: "requested",
      index: true,
    },
    adminNote: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "MasterAdmin", default: null },
    approvedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    sentNote: { type: String, default: "" },
    receivedAt: { type: Date, default: null },
    receivedNote: { type: String, default: "" },

    // Billing: credit note raised when the receiver confirms the goods
    creditNote: {
      number: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

stockReturnSchema.index({ "destination.vendorId": 1, status: 1 });
stockReturnSchema.index({ "destination.franchiseId": 1, status: 1 });

export default mongoose.model("StockReturn", stockReturnSchema);
