import User from "../models/user.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";

/**
 * Customer saved delivery addresses, kept on the account so they show at checkout on any
 * device. The first time a customer opens them, their earlier order addresses (and the address
 * on their profile) become their starting list, so returning customers are never asked to
 * re-type an address they have already used.
 */

const MAX_ADDRESSES = 20;
const TAGS = new Set(["home", "work", "other"]);
const TAG_LABELS = { home: "Home", work: "Work", other: "Other" };

const clean = (v, max = 160) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const buildFullAddress = (d = {}) => {
    const parts = [];
    if (d.flat) parts.push(`Flat: ${d.flat}`);
    if (d.floor) parts.push(`Floor: ${d.floor}`);
    if (d.colony) parts.push(d.colony);
    if (d.landmark) parts.push(`Landmark: ${d.landmark}`);
    if (d.city) parts.push(d.city);
    if (d.state) parts.push(d.state);
    if (d.pincode) parts.push(d.pincode);
    return parts.join(", ");
};

/** Read back an address written by buildFullAddress (the format checkout has always used). */
const parseFullAddress = (text = "") => {
    const parts = String(text).split(",").map((p) => p.trim()).filter(Boolean);
    const d = { flat: "", floor: "", colony: "", landmark: "", city: "", state: "", pincode: "" };
    const rest = [];
    for (const part of parts) {
        if (/^flat:/i.test(part)) d.flat = part.replace(/^flat:\s*/i, "");
        else if (/^floor:/i.test(part)) d.floor = part.replace(/^floor:\s*/i, "");
        else if (/^landmark:/i.test(part)) d.landmark = part.replace(/^landmark:\s*/i, "");
        else rest.push(part);
    }
    if (rest.length && /^\d{6}$/.test(rest[rest.length - 1])) d.pincode = rest.pop();
    if (rest.length >= 3) {
        d.state = rest.pop();
        d.city = rest.pop();
    } else if (rest.length === 2) {
        d.city = rest.pop();
    }
    d.colony = rest.join(", ");
    // Without a house number it is not a complete address; keep the text as the area
    if (!d.flat && !d.colony) d.colony = clean(text);
    return d;
};

const validLocation = (loc) => {
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    if (lat === 0 && lng === 0) return undefined;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
    return { lat, lng };
};

const sanitize = (entry, index) => {
    const tag = TAGS.has(entry?.tag) ? entry.tag : "other";
    const src = entry?.details || {};
    const details = {
        flat: clean(src.flat, 80),
        floor: clean(src.floor, 60),
        colony: clean(src.colony, 200),
        landmark: clean(src.landmark, 120),
        city: clean(src.city, 60),
        state: clean(src.state, 60),
        pincode: clean(src.pincode, 10),
    };
    if (!details.colony && !details.flat) return null;
    const lastUsed = entry?.lastUsedAt ? new Date(entry.lastUsedAt) : null;
    return {
        id: clean(entry?.id, 60) || `${tag}_${Date.now()}_${index}`,
        tag,
        label: clean(entry?.label, 40) || TAG_LABELS[tag],
        details,
        fullAddress: buildFullAddress(details),
        location: validLocation(entry?.location),
        lastUsedAt: lastUsed && !Number.isNaN(lastUsed.getTime()) ? lastUsed : undefined,
        updatedAt: new Date(),
    };
};

/** Starting list for a customer who has never saved addresses: their past order addresses. */
const seedFromHistory = async (user) => {
    const orders = await Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .select("shippingAddress shippingLocation createdAt")
        .limit(100)
        .lean();
    const seen = new Set();
    const list = [];
    const add = (text, coords, usedAt) => {
        const key = clean(text, 400).toLowerCase();
        if (!key || seen.has(key) || list.length >= 5) return;
        seen.add(key);
        const details = parseFullAddress(text);
        list.push({
            id: `prev_${list.length + 1}_${Date.now()}`,
            tag: "other",
            label: "Previous address",
            details,
            fullAddress: buildFullAddress(details),
            location: coords,
            lastUsedAt: usedAt,
            updatedAt: new Date(),
        });
    };
    for (const o of orders) {
        const c = o.shippingLocation?.coordinates;
        add(o.shippingAddress, Array.isArray(c) ? validLocation({ lat: c[1], lng: c[0] }) : undefined, o.createdAt);
    }
    if (user.address) add(user.address, undefined, undefined);
    // The most recently used one becomes "Home" so it reads naturally
    if (list[0]) {
        list[0].tag = "home";
        list[0].label = "Home";
    }
    return list;
};

/** GET /user/addresses */
export const getSavedAddresses = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("savedAddresses address");
        if (!user) return handleResponse(res, 404, "Account not found");
        if (!Array.isArray(user.savedAddresses)) {
            const seeded = await seedFromHistory(user);
            await User.updateOne({ _id: user._id, savedAddresses: { $exists: false } }, { $set: { savedAddresses: seeded } });
            const fresh = await User.findById(user._id).select("savedAddresses").lean();
            return handleResponse(res, 200, "Saved addresses", fresh?.savedAddresses || seeded);
        }
        return handleResponse(res, 200, "Saved addresses", user.toObject().savedAddresses);
    } catch (error) {
        console.error("getSavedAddresses:", error);
        return handleResponse(res, 500, "Could not load your saved addresses");
    }
};

/** PUT /user/addresses  { addresses: [...] } — replaces the customer's list */
export const putSavedAddresses = async (req, res) => {
    try {
        const input = Array.isArray(req.body?.addresses) ? req.body.addresses : null;
        if (!input) return handleResponse(res, 400, "Please send the list of addresses");
        const list = input.slice(0, MAX_ADDRESSES).map(sanitize).filter(Boolean);
        // Only one Home and one Work address
        const seenTags = new Set();
        const deduped = list.filter((a) => {
            if (a.tag === "other") return true;
            if (seenTags.has(a.tag)) return false;
            seenTags.add(a.tag);
            return true;
        });
        await User.updateOne({ _id: req.user._id }, { $set: { savedAddresses: deduped } });
        return handleResponse(res, 200, "Addresses saved", deduped);
    } catch (error) {
        console.error("putSavedAddresses:", error);
        return handleResponse(res, 500, "Could not save your addresses");
    }
};
