import mongoose from "mongoose";

/**
 * A city price code (e.g. "JPR" = Jaipur). Every franchise whose city is in `cities` uses this
 * code's rate sheet. City admins (sub-admins) are given the codes they may edit.
 */
const priceZoneSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        // Lower-case city names this code covers, e.g. ["jaipur"]
        cities: { type: [String], default: [] },
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
);

export default mongoose.models.PriceZone || mongoose.model("PriceZone", priceZoneSchema);
