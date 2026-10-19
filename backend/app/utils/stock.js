import mongoose from "mongoose";
import Inventory from "../models/inventory.js";

/**
 * Atomic franchise stock changes.
 *
 * Stock lives in one Inventory document per franchise. Loading that document, changing it
 * and saving it back lets two simultaneous changes (two orders packed, a counter sale and
 * a delivery receipt, ...) overwrite each other. These helpers change one product's stock
 * with a single database operation instead.
 */

const toId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

/** Takes exactly `qty` if that much is in stock. Returns true on success, false if not enough. */
export async function takeStock(franchiseId, productId, qty) {
    qty = Number(qty) || 0;
    if (qty <= 0) return true;
    const r = await Inventory.updateOne(
        { franchiseId: toId(franchiseId), items: { $elemMatch: { productId: toId(productId), currentStock: { $gte: qty } } } },
        { $inc: { "items.$.currentStock": -qty }, $set: { "items.$.lastUpdated": new Date() } },
    );
    return r.modifiedCount === 1;
}

/** Takes as much as is available, up to `qty`. Returns the quantity actually taken. */
export async function takeStockUpTo(franchiseId, productId, qty) {
    qty = Number(qty) || 0;
    if (qty <= 0) return 0;
    const fid = toId(franchiseId);
    const pid = toId(productId);
    for (let attempt = 0; attempt < 5; attempt++) {
        const inv = await Inventory.findOne({ franchiseId: fid, "items.productId": pid }, { "items.$": 1 }).lean();
        const available = Number(inv?.items?.[0]?.currentStock || 0);
        const take = Math.min(available, qty);
        if (take <= 0) return 0;
        // Compare-and-set on the value we just read, so a concurrent change makes us retry
        const r = await Inventory.updateOne(
            { franchiseId: fid, items: { $elemMatch: { productId: pid, currentStock: available } } },
            { $inc: { "items.$.currentStock": -take }, $set: { "items.$.lastUpdated": new Date() } },
        );
        if (r.modifiedCount === 1) return take;
    }
    return 0;
}

/**
 * Adds `qty` bought at `rate` per unit, and updates the product's weighted-average cost in one
 * atomic step: newAvg = (stock x avg + qty x rate) / (stock + qty). Without a known rate it is a
 * plain addStock.
 */
export async function addStockWithCost(franchiseId, productId, qty, rate) {
    qty = Number(qty) || 0;
    rate = Number(rate);
    if (qty <= 0) return;
    if (!Number.isFinite(rate) || rate <= 0) return addStock(franchiseId, productId, qty);
    const fid = toId(franchiseId);
    const pid = toId(productId);
    const now = new Date();
    // Straight to the driver: Mongoose would cast this pipeline as stock rows and null them out
    const r = await Inventory.collection.updateOne(
        { franchiseId: fid, "items.productId": pid },
        [{
            $set: {
                items: {
                    $map: {
                        input: "$items",
                        as: "it",
                        in: {
                            $cond: [
                                { $eq: ["$$it.productId", pid] },
                                {
                                    $mergeObjects: ["$$it", {
                                        avgCost: {
                                            $let: {
                                                vars: { s: { $max: [{ $ifNull: ["$$it.currentStock", 0] }, 0] }, a: { $ifNull: ["$$it.avgCost", null] } },
                                                in: {
                                                    $cond: [
                                                        { $or: [{ $eq: ["$$a", null] }, { $lte: ["$$s", 0] }] },
                                                        rate,
                                                        { $round: [{ $divide: [{ $add: [{ $multiply: ["$$s", "$$a"] }, qty * rate] }, { $add: ["$$s", qty] }] }, 4] },
                                                    ],
                                                },
                                            },
                                        },
                                        currentStock: { $add: [{ $ifNull: ["$$it.currentStock", 0] }, qty] },
                                        lastUpdated: now,
                                    }],
                                },
                                "$$it",
                            ],
                        },
                    },
                },
            },
        }],
    );
    if (r.matchedCount === 0) {
        await Inventory.updateOne(
            { franchiseId: fid, "items.productId": { $ne: pid } },
            { $push: { items: { productId: pid, currentStock: qty, avgCost: rate, lastUpdated: now } } },
            { upsert: true },
        ).catch(async (err) => {
            if (err?.code !== 11000) throw err;
            await addStockWithCost(franchiseId, productId, qty, rate);
        });
    }
}

/** The weighted-average cost of a product in a franchise's stock (null when not known). */
export async function avgCostOf(franchiseId, productId) {
    const inv = await Inventory.findOne({ franchiseId: toId(franchiseId), "items.productId": toId(productId) }, { "items.$": 1 }).lean();
    const v = inv?.items?.[0]?.avgCost;
    return Number.isFinite(Number(v)) && v !== null ? Number(v) : null;
}

/** Adds `qty` to a product's stock, creating the inventory row if needed. */
export async function addStock(franchiseId, productId, qty) {
    qty = Number(qty) || 0;
    if (qty <= 0) return;
    const fid = toId(franchiseId);
    const pid = toId(productId);
    const r = await Inventory.updateOne(
        { franchiseId: fid, "items.productId": pid },
        { $inc: { "items.$.currentStock": qty }, $set: { "items.$.lastUpdated": new Date() } },
    );
    if (r.matchedCount === 0) {
        await Inventory.updateOne(
            { franchiseId: fid, "items.productId": { $ne: pid } },
            { $push: { items: { productId: pid, currentStock: qty, lastUpdated: new Date() } } },
            { upsert: true },
        ).catch(async (err) => {
            // Upsert can race with a parallel insert of the same franchise doc; retry as a plain increment
            if (err?.code !== 11000) throw err;
            await Inventory.updateOne(
                { franchiseId: fid, "items.productId": pid },
                { $inc: { "items.$.currentStock": qty }, $set: { "items.$.lastUpdated": new Date() } },
            );
        });
    }
}
