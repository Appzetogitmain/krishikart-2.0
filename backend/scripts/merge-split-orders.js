/**
 * One-time script: baskets placed before checkout grouped by franchise (17a4040) were split into one
 * order per category, even when one franchise serves them all. This merges such a basket back into
 * ONE order, but only when it is safe:
 *
 *   - every order of the basket has the same franchise
 *   - every order is still waiting (Placed / Assigned / Accepted) - nothing packed, sent or done
 *   - no order has a stock request in progress
 *   - all orders were paid the same way
 *
 * The earliest order is kept and gets all items and summed amounts; the others are copied to the
 * "orders_merged_backup" collection and then removed. Re-running does nothing more.
 *
 * Run: node scripts/merge-split-orders.js           (only shows what would change)
 *      node scripts/merge-split-orders.js --apply   (makes the change)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const apply = process.argv.includes("--apply");
const WAITING = ["Placed", "Assigned", "Accepted"];
const SUM_FIELDS = ["subtotal", "deliveryFee", "platformFee", "tax", "totalAmount", "walletAmountUsed", "creditAmountUsed", "onlineAmountPaid", "discountAmount"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const Orders = db.collection("orders");
  const Requests = db.collection("procurementrequests");
  const Backup = db.collection("orders_merged_backup");
  console.log(apply ? "APPLYING changes" : "DRY RUN (nothing is written; add --apply to make the change)");

  const groupIds = await Orders.distinct("orderGroupId", { orderGroupId: { $nin: [null, ""] } });
  let merged = 0;
  let skipped = 0;

  for (const groupId of groupIds) {
    const orders = await Orders.find({ orderGroupId: groupId }).sort({ createdAt: 1, _id: 1 }).toArray();
    if (orders.length < 2) continue;
    const label = `group ${String(groupId).slice(-6)} (${orders.length} orders)`;

    const franchises = new Set(orders.map((o) => String(o.franchiseId || "")));
    const why =
      franchises.size !== 1 || franchises.has("") ? "different or no franchise"
        : orders.some((o) => !WAITING.includes(o.orderStatus)) ? `not all waiting (${[...new Set(orders.map((o) => o.orderStatus))].join(", ")})`
          : new Set(orders.map((o) => o.paymentMethod)).size !== 1 ? "different payment methods"
            : (await Requests.countDocuments({ orderId: { $in: orders.map((o) => o._id) }, status: { $nin: ["completed", "rejected"] } })) > 0 ? "a stock request is in progress"
              : null;
    if (why) {
      skipped++;
      continue;
    }

    const [keep, ...rest] = orders;
    const set = { orderGroupId: null, items: orders.flatMap((o) => o.items || []) };
    for (const f of SUM_FIELDS) set[f] = round2(orders.reduce((s, o) => s + (Number(o[f]) || 0), 0));
    const cats = new Set(orders.map((o) => String(o.fulfillmentCategoryId || "")));
    set.fulfillmentCategoryId = cats.size === 1 && !cats.has("") ? keep.fulfillmentCategoryId : null;

    console.log(`MERGE ${label} -> #${String(keep._id).slice(-6).toUpperCase()}: ${set.items.length} items, total ${set.totalAmount} ` +
      `(was ${orders.map((o) => o.totalAmount).join(" + ")}) | removed: ${rest.map((o) => "#" + String(o._id).slice(-6).toUpperCase()).join(", ")}`);

    if (apply) {
      await Backup.insertMany(rest.map((o) => ({ ...o, _mergedInto: keep._id, _mergedAt: new Date() })));
      await Orders.updateOne(
        { _id: keep._id },
        {
          $set: set,
          $push: {
            statusHistory: {
              status: keep.orderStatus,
              updatedAt: new Date(),
              updatedBy: "system",
              message: `Merged ${orders.length} orders from the same basket into one (${rest.map((o) => "#" + String(o._id).slice(-6).toUpperCase()).join(", ")}).`,
            },
          },
        },
      );
      // Anything that pointed at a removed order now points at the kept one
      await Requests.updateMany({ orderId: { $in: rest.map((o) => o._id) } }, { $set: { orderId: keep._id } });
      await Orders.deleteMany({ _id: { $in: rest.map((o) => o._id) } });
    }
    merged++;
  }

  console.log(`\nDone: ${merged} basket(s) ${apply ? "merged" : "to merge"}, ${skipped} left as they are${apply ? "" : " (dry run, nothing written)"}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
