import PriceZone from "../models/priceZone.js";
import ZonePrice from "../models/zonePrice.js";
import Franchise from "../models/franchise.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";
import { cityKeyOf, normalizeZoneCode } from "../utils/pricing.js";

/**
 * City rates. The main admin creates city price codes (e.g. JPR = Jaipur) and lists the cities
 * each covers. A code's rate sheet sets the selling rate, MRP and bulk rates for every franchise
 * in those cities. City admins (sub-admins) can only open and edit the codes given to them.
 */

const isRootAdmin = (admin) => ["superadmin", "masteradmin"].includes(String(admin?.role || "").toLowerCase());

const allowedCodes = (admin) =>
    isRootAdmin(admin) ? null : (admin?.priceZoneCodes || []).map(normalizeZoneCode);

export const canManageZone = (admin, code) => {
    const codes = allowedCodes(admin);
    return codes === null || codes.includes(normalizeZoneCode(code));
};

const money = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};

const franchisesForZone = async (zone) => {
    const keys = new Set((zone.cities || []).map(cityKeyOf));
    const all = await Franchise.find({}).select("franchiseName ownerName city area status isActive").lean();
    return all.filter((f) => keys.has(cityKeyOf(f.city)));
};

/** GET /masteradmin/city-rates/zones */
export const listZones = async (req, res) => {
    try {
        const codes = allowedCodes(req.masteradmin);
        const filter = codes === null ? {} : { code: { $in: codes } };
        const [zones, franchises] = await Promise.all([
            PriceZone.find(filter).sort({ code: 1 }).lean(),
            Franchise.find({}).select("city").lean(),
        ]);
        const countByCity = new Map();
        for (const f of franchises) {
            const k = cityKeyOf(f.city);
            if (k) countByCity.set(k, (countByCity.get(k) || 0) + 1);
        }
        const rateCounts = await ZonePrice.aggregate([
            { $match: { zoneCode: { $in: zones.map((z) => z.code) } } },
            { $group: { _id: "$zoneCode", n: { $sum: 1 } } },
        ]);
        const rateCountByCode = new Map(rateCounts.map((r) => [r._id, r.n]));
        const results = zones.map((z) => ({
            ...z,
            franchiseCount: (z.cities || []).reduce((s, c) => s + (countByCity.get(cityKeyOf(c)) || 0), 0),
            cityRateCount: rateCountByCode.get(z.code) || 0,
        }));

        // For the main admin: franchise cities that no code covers yet
        let uncoveredCities = [];
        if (codes === null) {
            const covered = new Set((await PriceZone.find({}).lean()).flatMap((z) => (z.cities || []).map(cityKeyOf)));
            uncoveredCities = [...countByCity.entries()]
                .filter(([k]) => !covered.has(k))
                .map(([city, count]) => ({ city, count }))
                .sort((a, b) => b.count - a.count);
        }

        return handleResponse(res, 200, "City price codes", {
            zones: results,
            uncoveredCities,
            canManageCodes: codes === null,
        });
    } catch (error) {
        console.error("listZones:", error);
        return handleResponse(res, 500, "Could not load city codes");
    }
};

const cleanZoneInput = (body = {}) => {
    const code = normalizeZoneCode(body.code);
    const name = String(body.name || "").trim().slice(0, 60);
    const cities = [...new Set((Array.isArray(body.cities) ? body.cities : String(body.cities || "").split(","))
        .map(cityKeyOf).filter(Boolean))].slice(0, 30);
    return { code, name, cities, isActive: body.isActive !== false };
};

/** POST /masteradmin/city-rates/zones  (main admin) */
export const createZone = async (req, res) => {
    try {
        const z = cleanZoneInput(req.body);
        if (!/^[A-Z0-9_-]{2,12}$/.test(z.code)) return handleResponse(res, 400, "Code must be 2–12 letters or numbers, e.g. JPR");
        if (!z.name) return handleResponse(res, 400, "Please enter the city / area name");
        if (!z.cities.length) return handleResponse(res, 400, "Please enter at least one city this code covers");
        if (await PriceZone.exists({ code: z.code })) return handleResponse(res, 400, `Code ${z.code} already exists`);
        const clash = await PriceZone.findOne({ cities: { $in: z.cities } }).lean();
        if (clash) return handleResponse(res, 400, `City "${z.cities.find((c) => clash.cities.includes(c))}" is already under code ${clash.code}`);
        const zone = await PriceZone.create({ ...z, createdBy: req.masteradmin._id });
        return handleResponse(res, 201, `City code ${zone.code} created`, zone.toObject());
    } catch (error) {
        console.error("createZone:", error);
        return handleResponse(res, 500, "Could not create the city code");
    }
};

/** PUT /masteradmin/city-rates/zones/:code  (main admin) */
export const updateZone = async (req, res) => {
    try {
        const code = normalizeZoneCode(req.params.code);
        const zone = await PriceZone.findOne({ code });
        if (!zone) return handleResponse(res, 404, "City code not found");
        const z = cleanZoneInput({ ...req.body, code });
        if (!z.name) return handleResponse(res, 400, "Please enter the city / area name");
        if (!z.cities.length) return handleResponse(res, 400, "Please enter at least one city this code covers");
        const clash = await PriceZone.findOne({ code: { $ne: code }, cities: { $in: z.cities } }).lean();
        if (clash) return handleResponse(res, 400, `City "${z.cities.find((c) => clash.cities.includes(c))}" is already under code ${clash.code}`);
        zone.name = z.name;
        zone.cities = z.cities;
        zone.isActive = z.isActive;
        await zone.save();
        return handleResponse(res, 200, `City code ${code} updated`, zone.toObject());
    } catch (error) {
        console.error("updateZone:", error);
        return handleResponse(res, 500, "Could not update the city code");
    }
};

/** DELETE /masteradmin/city-rates/zones/:code  (main admin) — its city rates are removed too */
export const deleteZone = async (req, res) => {
    try {
        const code = normalizeZoneCode(req.params.code);
        const zone = await PriceZone.findOneAndDelete({ code });
        if (!zone) return handleResponse(res, 404, "City code not found");
        const removed = await ZonePrice.deleteMany({ zoneCode: code });
        return handleResponse(res, 200, `City code ${code} deleted; its franchises now use the main rates`, {
            code,
            removedRates: removed.deletedCount || 0,
        });
    } catch (error) {
        console.error("deleteZone:", error);
        return handleResponse(res, 500, "Could not delete the city code");
    }
};

/** GET /masteradmin/city-rates/zones/:code/rates?q=&category= */
export const getZoneRates = async (req, res) => {
    try {
        const code = normalizeZoneCode(req.params.code);
        const zone = await PriceZone.findOne({ code }).lean();
        if (!zone) return handleResponse(res, 404, `No city code "${code}". Check the code and try again.`);
        if (!canManageZone(req.masteradmin, code)) {
            return handleResponse(res, 403, `You do not have access to city code ${code}`);
        }

        const filter = { status: { $ne: "deleted" } };
        if (req.query.category) filter.category = req.query.category;
        const q = String(req.query.q || "").trim().slice(0, 60);
        if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

        const [products, rows, franchises] = await Promise.all([
            Product.find(filter).select("name unit unitValue price comparePrice bulkPricing primaryImage category status").populate("category", "name").sort({ name: 1 }).lean(),
            ZonePrice.find({ zoneCode: code }).lean(),
            franchisesForZone(zone),
        ]);
        const rowByProduct = new Map(rows.map((r) => [String(r.productId), r]));

        const items = products.map((p) => {
            const r = rowByProduct.get(String(p._id));
            return {
                productId: p._id,
                name: p.name,
                unit: p.unit,
                unitValue: p.unitValue,
                image: p.primaryImage,
                category: p.category?.name || "",
                status: p.status,
                main: { price: p.price, comparePrice: p.comparePrice ?? null, bulkPricing: p.bulkPricing || [] },
                city: r
                    ? { price: r.price ?? null, comparePrice: r.comparePrice ?? null, bulkPricing: Array.isArray(r.bulkPricing) ? r.bulkPricing : null, updatedBy: r.updatedBy, updatedAt: r.updatedAt }
                    : null,
            };
        });

        return handleResponse(res, 200, `Rates for ${code}`, { zone, franchises, items });
    } catch (error) {
        console.error("getZoneRates:", error);
        return handleResponse(res, 500, "Could not load the city rates");
    }
};

/**
 * PUT /masteradmin/city-rates/zones/:code/rates
 * { items: [{ productId, price, comparePrice, bulkPricing }] }
 * price null/"" → this city goes back to the main rate for that product.
 * bulkPricing null → use the main bulk rates; [] → no bulk rates in this city.
 */
export const saveZoneRates = async (req, res) => {
    try {
        const code = normalizeZoneCode(req.params.code);
        const zone = await PriceZone.findOne({ code }).lean();
        if (!zone) return handleResponse(res, 404, "City code not found");
        if (!canManageZone(req.masteradmin, code)) {
            return handleResponse(res, 403, `You do not have access to city code ${code}`);
        }
        const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : null;
        if (!items || !items.length) return handleResponse(res, 400, "Nothing to save");

        const ids = items.map((i) => String(i?.productId || "")).filter(Boolean);
        const products = await Product.find({ _id: { $in: ids } }).select("name price").lean();
        const productById = new Map(products.map((p) => [String(p._id), p]));

        const ops = [];
        for (const item of items) {
            const product = productById.get(String(item?.productId));
            if (!product) return handleResponse(res, 400, "One of the products no longer exists. Please reload.");
            const price = money(item.price);
            const comparePrice = money(item.comparePrice);
            if (Number.isNaN(price) || Number.isNaN(comparePrice) || price === 0) {
                return handleResponse(res, 400, `Please enter a valid rate for ${product.name}`);
            }
            let bulkPricing;
            if (item.bulkPricing === null || item.bulkPricing === undefined) {
                bulkPricing = undefined;
            } else if (Array.isArray(item.bulkPricing)) {
                bulkPricing = [];
                for (const t of item.bulkPricing.slice(0, 6)) {
                    const minQty = Number(t?.minQty);
                    const tierPrice = money(t?.price);
                    if (!Number.isFinite(minQty) || minQty <= 1 || Number.isNaN(tierPrice) || !tierPrice) {
                        return handleResponse(res, 400, `Bulk rates for ${product.name}: each needs a quantity above 1 and a rate`);
                    }
                    bulkPricing.push({ minQty, price: tierPrice });
                }
                bulkPricing.sort((a, b) => a.minQty - b.minQty);
                const unit = price ?? product.price;
                if (bulkPricing.some((t) => t.price >= unit)) {
                    return handleResponse(res, 400, `Bulk rates for ${product.name} must be lower than its rate (₹${unit})`);
                }
            }

            const isEmpty = price === null && comparePrice === null && bulkPricing === undefined;
            if (isEmpty) {
                ops.push({ deleteOne: { filter: { zoneCode: code, productId: product._id } } });
            } else {
                const set = { price, comparePrice, updatedBy: req.masteradmin.fullName || req.masteradmin.email || "" };
                const update = { $set: set };
                if (bulkPricing === undefined) update.$unset = { bulkPricing: 1 };
                else set.bulkPricing = bulkPricing;
                ops.push({ updateOne: { filter: { zoneCode: code, productId: product._id }, update, upsert: true } });
            }
        }
        await ZonePrice.bulkWrite(ops, { ordered: false });
        return handleResponse(res, 200, `Rates saved for ${code}`, { code, saved: ops.length });
    } catch (error) {
        console.error("saveZoneRates:", error);
        return handleResponse(res, 500, "Could not save the city rates");
    }
};
