import mongoose from "mongoose";

/** Offer banners for the customer home page carousel, managed by the admin (image upload). */
const offerBannerSchema = new mongoose.Schema(
    {
        image: { type: String, required: true },
        title: { type: String, trim: true, default: "" }, // admin label / alt text
        link: { type: String, trim: true, default: "" }, // in-app path opened on tap, e.g. /products/all
        isActive: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model("OfferBanner", offerBannerSchema);
