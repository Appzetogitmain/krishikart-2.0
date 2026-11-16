import mongoose from "mongoose";
import OfferBanner from "../models/offerBanner.js";
import handleResponse from "../utils/helper.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const MAX_ACTIVE_BANNERS = 6;

// Only in-app paths ("/products/all") or full https links are allowed as the tap target
const cleanLink = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (s.startsWith("/") && !s.startsWith("//")) return s.slice(0, 300);
    if (/^https:\/\/[^\s]+$/i.test(s)) return s.slice(0, 500);
    return null;
};

const isImage = (file) => file && /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || "");

/** GET /banners - active banners for the customer home page, in order */
export const getActiveBanners = async (req, res) => {
    try {
        const banners = await OfferBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: 1 })
            .limit(MAX_ACTIVE_BANNERS)
            .select("image title link")
            .lean();
        return handleResponse(res, 200, "Offer banners", banners);
    } catch (err) {
        console.error("getActiveBanners", err);
        return handleResponse(res, 500, "Could not load offer banners");
    }
};

/** GET /banners/admin - every banner (active and hidden) */
export const getAllBanners = async (req, res) => {
    try {
        const banners = await OfferBanner.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
        return handleResponse(res, 200, "Offer banners", banners);
    } catch (err) {
        console.error("getAllBanners", err);
        return handleResponse(res, 500, "Could not load offer banners");
    }
};

/** POST /banners/admin - multipart: image (required), title, link */
export const createBanner = async (req, res) => {
    try {
        if (!req.file) return handleResponse(res, 400, "Please choose the offer image");
        if (!isImage(req.file)) return handleResponse(res, 400, "Only JPG, PNG, WEBP or GIF images can be used");
        if (req.file.size > 5 * 1024 * 1024) return handleResponse(res, 400, "Image is too big - keep it under 5 MB");
        const link = cleanLink(req.body.link);
        if (link === null) return handleResponse(res, 400, "Link must be a page of the app (starting with /) or an https link");

        const activeCount = await OfferBanner.countDocuments({ isActive: true });
        const image = await uploadToCloudinary(req.file.buffer, "offer-banners");
        const last = await OfferBanner.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean();
        const banner = await OfferBanner.create({
            image,
            title: String(req.body.title || "").slice(0, 120),
            link,
            // Over the limit: keep it, but hidden, so the admin can swap it in later
            isActive: activeCount < MAX_ACTIVE_BANNERS,
            sortOrder: (last?.sortOrder ?? -1) + 1,
        });
        const msg = banner.isActive
            ? "Offer banner added"
            : `Saved as hidden - only ${MAX_ACTIVE_BANNERS} banners can show at a time`;
        return handleResponse(res, 201, msg, banner);
    } catch (err) {
        console.error("createBanner", err);
        return handleResponse(res, 500, "Could not save the offer banner");
    }
};

/** PUT /banners/admin/:id - title, link, isActive, optional new image */
export const updateBanner = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return handleResponse(res, 400, "Invalid banner");
        const banner = await OfferBanner.findById(req.params.id);
        if (!banner) return handleResponse(res, 404, "Banner not found");

        if (req.body.title !== undefined) banner.title = String(req.body.title || "").slice(0, 120);
        if (req.body.link !== undefined) {
            const link = cleanLink(req.body.link);
            if (link === null) return handleResponse(res, 400, "Link must be a page of the app (starting with /) or an https link");
            banner.link = link;
        }
        if (req.body.isActive !== undefined) {
            const on = req.body.isActive === true || req.body.isActive === "true";
            if (on && !banner.isActive) {
                const activeCount = await OfferBanner.countDocuments({ isActive: true });
                if (activeCount >= MAX_ACTIVE_BANNERS) {
                    return handleResponse(res, 400, `Only ${MAX_ACTIVE_BANNERS} banners can show at a time - hide one first`);
                }
            }
            banner.isActive = on;
        }
        if (req.file) {
            if (!isImage(req.file)) return handleResponse(res, 400, "Only JPG, PNG, WEBP or GIF images can be used");
            if (req.file.size > 5 * 1024 * 1024) return handleResponse(res, 400, "Image is too big - keep it under 5 MB");
            banner.image = await uploadToCloudinary(req.file.buffer, "offer-banners");
        }
        await banner.save();
        return handleResponse(res, 200, "Offer banner updated", banner);
    } catch (err) {
        console.error("updateBanner", err);
        return handleResponse(res, 500, "Could not update the offer banner");
    }
};

/** PUT /banners/admin/reorder - { ids: [...] } in the new order */
export const reorderBanners = async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.filter((id) => mongoose.isValidObjectId(id)) : [];
        if (!ids.length) return handleResponse(res, 400, "Nothing to reorder");
        await OfferBanner.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i } } } })));
        const banners = await OfferBanner.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
        return handleResponse(res, 200, "Order saved", banners);
    } catch (err) {
        console.error("reorderBanners", err);
        return handleResponse(res, 500, "Could not save the order");
    }
};

/** DELETE /banners/admin/:id */
export const deleteBanner = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return handleResponse(res, 400, "Invalid banner");
        const banner = await OfferBanner.findByIdAndDelete(req.params.id);
        if (!banner) return handleResponse(res, 404, "Banner not found");
        return handleResponse(res, 200, "Offer banner removed", { _id: banner._id });
    } catch (err) {
        console.error("deleteBanner", err);
        return handleResponse(res, 500, "Could not remove the offer banner");
    }
};
