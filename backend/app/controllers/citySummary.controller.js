import PriceZone from "../models/priceZone.js";
import Franchise from "../models/franchise.js";
import Order from "../models/order.js";
import { handleResponse } from "../utils/helper.js";
import { cityKeyOf } from "../utils/pricing.js";

/**
 * GET /masteradmin/dashboard/city-summary (client, Nov 2026): per city code, at a glance - stores (and how many
 * are online), today's orders and sales, orders still open and orders waiting for / out for delivery.
 * Head office sees every city (plus stores no city code covers yet); a city admin only their own.
 */
const OPEN = ["Placed", "Assigned", "Accepted", "Procuring", "Packed", "Ready", "Dispatched", "Out for Delivery"];
const DELIVERY = ["Packed", "Ready", "Dispatched", "Out for Delivery"];

export const getCitySummary = async (req, res) => {
    try {
        const scope = req.cityScope || null;
        const zones = await PriceZone.find(scope ? { code: { $in: scope.codes } } : {}).sort({ code: 1 }).lean();
        const franchises = await Franchise.find({}).select("city isOnline status").lean();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const perStore = await Order.aggregate([
            { $match: { franchiseId: { $ne: null }, $or: [{ createdAt: { $gte: today } }, { orderStatus: { $in: OPEN } }] } },
            {
                $group: {
                    _id: "$franchiseId",
                    ordersToday: { $sum: { $cond: [{ $gte: ["$createdAt", today] }, 1, 0] } },
                    salesToday: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", today] }, { $ne: ["$orderStatus", "Cancelled"] }] }, "$totalAmount", 0] } },
                    open: { $sum: { $cond: [{ $in: ["$orderStatus", OPEN] }, 1, 0] } },
                    delivery: { $sum: { $cond: [{ $in: ["$orderStatus", DELIVERY] }, 1, 0] } },
                },
            },
        ]);
        const figuresOf = new Map(perStore.map((r) => [String(r._id), r]));

        const row = (code, name, cities, stores) => {
            const r = { code, name, cities, stores: stores.length, storesOnline: 0, ordersToday: 0, salesToday: 0, openOrders: 0, forDelivery: 0 };
            for (const f of stores) {
                if (f.isOnline && f.status !== "blocked") r.storesOnline += 1;
                const x = figuresOf.get(String(f._id));
                if (!x) continue;
                r.ordersToday += x.ordersToday;
                r.salesToday += x.salesToday;
                r.openOrders += x.open;
                r.forDelivery += x.delivery;
            }
            r.salesToday = Math.round(r.salesToday * 100) / 100;
            return r;
        };

        const covered = new Set();
        const rows = zones.map((z) => {
            const keys = new Set((z.cities || []).map(cityKeyOf));
            keys.forEach((k) => covered.add(k));
            return row(z.code, z.name || z.code, z.cities || [], franchises.filter((f) => keys.has(cityKeyOf(f.city))));
        });
        // Head office: stores in cities that no city code covers yet
        if (!scope) {
            const rest = franchises.filter((f) => !covered.has(cityKeyOf(f.city)));
            if (rest.length) rows.push(row(null, "No city code yet", [...new Set(rest.map((f) => f.city).filter(Boolean))], rest));
        }

        return handleResponse(res, 200, "City summary", { rows });
    } catch (error) {
        console.error("getCitySummary:", error);
        return handleResponse(res, 500, "Could not load the city summary");
    }
};
