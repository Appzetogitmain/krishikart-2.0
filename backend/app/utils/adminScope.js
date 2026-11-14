import mongoose from "mongoose";
import PriceZone from "../models/priceZone.js";
import Franchise from "../models/franchise.js";
import Order from "../models/order.js";
import User from "../models/user.js";
import Delivery from "../models/delivery.js";
import ProcurementRequest from "../models/procurementRequest.js";
import { cityKeyOf } from "./pricing.js";

/**
 * City-limited admins.
 *
 * A sub-admin with city codes (e.g. ["JPR"]) works only on those cities: their franchises and
 * everything linked to them (orders, stock, stock requests, returns), vendors whose farm is in
 * those cities, delivery partners whose nearest store is there, and customers who ordered there.
 * The main admin and team members without a city code (head office) see every city.
 *
 * A vendor who supplies several cities is visible to each of those cities' admins; each one still sees
 * only the orders / stock requests of their own city (lists are trimmed per franchise).
 */

const isRoot = (admin) => ["superadmin", "masteradmin"].includes(String(admin?.role || "").toLowerCase());

const idStr = (v) => (v && typeof v === "object" ? String(v._id || v.id || "") : String(v || ""));

/** null = all cities; otherwise the cities and franchises this admin may work on. */
export async function computeAdminScope(admin) {
    if (!admin || isRoot(admin)) return null;
    const codes = (admin.priceZoneCodes || []).map((c) => String(c).toUpperCase()).filter(Boolean);
    if (!codes.length) return null;
    return scopeForCodes(codes);
}

/** The cities and franchises of the given city codes (also used when head office views one city). */
export async function scopeForCodes(codes) {
    const zones = await PriceZone.find({ code: { $in: codes } }).lean();
    const cityKeys = new Set(zones.flatMap((z) => (z.cities || []).map(cityKeyOf)));
    const all = await Franchise.find({}).select("city location").lean();
    const franchises = all.filter((f) => cityKeys.has(cityKeyOf(f.city)));
    return {
        codes,
        names: zones.map((z) => z.name),
        cityKeys,
        franchiseIds: franchises.map((f) => f._id),
        franchiseIdSet: new Set(franchises.map((f) => String(f._id))),
        _allFranchises: all,
        zoneCount: zones.length,
        _deliverySet: null,
        _customerSet: null,
        _vendorSet: null,
    };
}

/** Memoised per request (set by the city-scope guard). */
export const scopeOf = (req) => req.cityScope || null;

export const franchiseInScope = (scope, f) =>
    !scope || (!!f && (scope.franchiseIdSet.has(idStr(f)) || scope.cityKeys.has(cityKeyOf(f.city))));

/** Farm in the city, or supplies a store in the city (call vendorIdsInScope first for the second part). */
export const vendorInScope = (scope, v) =>
    !scope || (!!v && (scope.cityKeys.has(cityKeyOf(v.farmLocation || v.city)) || !!scope._vendorSet?.has(idStr(v))));

/** Vendors that supply (or supplied) a store in scope */
export async function vendorIdsInScope(scope) {
    if (!scope) return null;
    if (scope._vendorSet) return scope._vendorSet;
    const ids = await ProcurementRequest.distinct("assignedVendorId", { franchiseId: { $in: scope.franchiseIds } });
    scope._vendorSet = new Set(ids.filter(Boolean).map(String));
    return scope._vendorSet;
}

/** Orders: assigned to a store in scope, or not assigned yet but delivering into the city. */
export const orderInScope = (scope, o) => {
    if (!scope) return true;
    if (!o) return false;
    const fid = idStr(o.franchiseId);
    if (fid) return scope.franchiseIdSet.has(fid);
    return scope.cityKeys.has(cityKeyOf(o.shippingLocation?.city));
};

/** MongoDB filter for orders in scope ({} when unrestricted). */
export const orderScopeMatch = (scope) => {
    if (!scope) return {};
    const cityRegexes = [...scope.cityKeys].map((c) => new RegExp(`^\\s*${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|$)`, "i"));
    return {
        $or: [
            { franchiseId: { $in: scope.franchiseIds } },
            { franchiseId: null, "shippingLocation.city": { $in: cityRegexes } },
        ],
    };
};

/** Simple franchise-only match, for statistics. */
export const franchiseScopeMatch = (scope, field = "franchiseId") =>
    scope ? { [field]: { $in: scope.franchiseIds } } : {};

const toRad = (d) => (d * Math.PI) / 180;
const distanceKm = (a, b) => {
    const [lng1, lat1] = a, [lng2, lat2] = b;
    const h = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
};

/** Delivery partners of the cities in scope: the city they chose, else their nearest store's city. */
export async function deliveryIdsInScope(scope) {
    if (!scope) return null;
    if (scope._deliverySet) return scope._deliverySet;
    const stores = scope._allFranchises.filter((f) => Array.isArray(f.location?.coordinates) && f.location.coordinates.some((n) => n));
    const partners = await Delivery.find({}).select("location city").lean();
    const set = new Set();
    for (const p of partners) {
        // The city the partner chose decides; older accounts fall back to the nearest store
        if (p.city) { if (scope.cityKeys.has(cityKeyOf(p.city))) set.add(String(p._id)); continue; }
        const c = p.location?.coordinates;
        if (!Array.isArray(c) || !c.some((n) => n)) continue;
        let best = null, bestD = Infinity;
        for (const s of stores) {
            const d = distanceKm(c, s.location.coordinates);
            if (d < bestD) { bestD = d; best = s; }
        }
        if (best && scope.franchiseIdSet.has(String(best._id))) set.add(String(p._id));
    }
    scope._deliverySet = set;
    return set;
}

/** Customers who ordered from the city, or saved an address there. */
export async function customerIdsInScope(scope) {
    if (!scope) return null;
    if (scope._customerSet) return scope._customerSet;
    const cityRegexes = [...scope.cityKeys].map((c) => new RegExp(`^\\s*${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"));
    const [fromOrders, fromAddresses] = await Promise.all([
        Order.distinct("userId", orderScopeMatch(scope)),
        User.distinct("_id", { "savedAddresses.details.city": { $in: cityRegexes } }),
    ]);
    scope._customerSet = new Set([...fromOrders, ...fromAddresses].filter(Boolean).map(String));
    return scope._customerSet;
}

export const toObjectIds = (set) =>
    [...(set || [])].filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
