import mongoose from "mongoose";

// Chat between admin and a vendor on the vendor's daily quotation / rate negotiation page
const rateMessageSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    by: { type: String, enum: ["vendor", "admin"], required: true },
    byName: { type: String, default: "" },
    text: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

rateMessageSchema.index({ vendorId: 1, createdAt: -1 });

export default mongoose.model("RateMessage", rateMessageSchema);
