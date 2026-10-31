import mongoose from "mongoose";
import Franchise from "../models/franchise.js";
import Order from "../models/order.js";
import ProcurementRequest from "../models/procurementRequest.js";
import StockReturn from "../models/stockReturn.js";
import Vendor from "../models/vendor.js";
import { cityKeyOf } from "./pricing.js";

/**
 * City-wise admin alerts (client, Nov 2026): every admin alert (socket event or bell notification) is tagged
 * with the city / cities it belongs to, worked out from the ids in its payload, so a city admin gets only their
 * own city's alerts. Head office (main admin, team members without a city code) gets everything.
 * An alert that belongs to no city (e.g. a franchise payout) goes to head office only.
 */

const idStr = (v) => (v && typeof v === "object" ? String(v._id || v.id || "") : String(v || ""));
const valid = (id) => mongoose.isValidObjectId(id);

export const ADMIN_ALL_ROOM = "admin_all";
export const adminCityRoom = (cityKey) => `admin_city:${cityKey}`;

/** City keys (lower-case city names) for an alert payload; [] = head office only */
export async function cityKeysFor(data) {
    try {
        if (!data || typeof data !== "object") return [];
        if (Array.isArray(data.cityKeys)) return data.cityKeys.filter(Boolean);
        const src = data.meta && typeof data.meta === "object" ? { ...data.meta, ...data } : data;
        const keys = new Set();

        const addFranchise = async (f) => {
            if (!f) return;
            if (typeof f === "object" && f.city) { keys.add(cityKeyOf(f.city)); return; }
            const id = idStr(f);
            if (!valid(id)) return;
            const doc = await Franchise.findById(id).select("city").lean();
            if (doc?.city) keys.add(cityKeyOf(doc.city));
        };

        await addFranchise(src.franchiseId || src.franchise);

        const orderId = src.orderId || (src.orderStatus ? src._id : null);
        if (!keys.size && orderId && valid(idStr(orderId))) {
            const o = await Order.findById(idStr(orderId)).select("franchiseId shippingLocation").lean();
            if (o?.franchiseId) await addFranchise(o.franchiseId);
            else if (o?.shippingLocation?.city) keys.add(cityKeyOf(o.shippingLocation.city));
        }
        if (!keys.size && src.requestId && valid(idStr(src.requestId))) {
            const p = await ProcurementRequest.findById(idStr(src.requestId)).select("franchiseId").lean();
            await addFranchise(p?.franchiseId);
        }
        if (!keys.size && src.returnId && valid(idStr(src.returnId))) {
            const r = await StockReturn.findById(idStr(src.returnId)).select("fromFranchiseId").lean();
            await addFranchise(r?.fromFranchiseId);
        }
        if (!keys.size && src.vendorId && valid(idStr(src.vendorId))) {
            // The vendor's own city and every city it supplies
            const vid = idStr(src.vendorId);
            const [v, fids] = await Promise.all([
                Vendor.findById(vid).select("farmLocation").lean(),
                ProcurementRequest.distinct("franchiseId", { assignedVendorId: vid }),
            ]);
            if (v?.farmLocation) keys.add(cityKeyOf(v.farmLocation));
            if (fids.length) {
                const fs = await Franchise.find({ _id: { $in: fids } }).select("city").lean();
                fs.forEach((f) => f.city && keys.add(cityKeyOf(f.city)));
            }
        }
        return [...keys].filter(Boolean);
    } catch (error) {
        console.error("[adminCity] could not work out the city:", error?.message);
        return [];
    }
}
