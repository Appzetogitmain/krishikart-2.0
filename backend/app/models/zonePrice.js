import mongoose from "mongoose";

/**
 * A product's rate for one city price code. Missing fields fall back to the product's main
 * values (price, MRP, bulk rates).
 */
const zonePriceSchema = new mongoose.Schema(
    {
        zoneCode: { type: String, required: true, uppercase: true, trim: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        price: { type: Number, min: 0, default: null },
        comparePrice: { type: Number, min: 0, default: null },
        // null = use the product's bulk rates; [] = no bulk rates in this city
        bulkPricing: {
            type: [{ minQty: { type: Number, required: true }, price: { type: Number, required: true }, _id: false }],
            default: undefined,
        },
        updatedBy: { type: String, default: "" },
    },
    { timestamps: true }
);

zonePriceSchema.index({ zoneCode: 1, productId: 1 }, { unique: true });

export default mongoose.models.ZonePrice || mongoose.model("ZonePrice", zonePriceSchema);
