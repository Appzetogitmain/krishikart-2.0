/**
 * One-time script: writes the financial record (FinanceEntry) for orders delivered before the
 * financial reports existed. Stock bought before then has no average cost, so those lines use the
 * last rate paid for the product (marked as such in the report). Re-running adds nothing twice.
 *
 * Run: node scripts/backfill-finance.js           (only counts what would be added)
 *      node scripts/backfill-finance.js --apply   (adds the records)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const apply = process.argv.includes("--apply");
const Order = (await import("../app/models/order.js")).default;
const FinanceEntry = (await import("../app/models/financeEntry.js")).default;
const { recordDeliveredOrder } = await import("../app/utils/finance.js");

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(apply ? "APPLYING" : "DRY RUN (nothing is written; add --apply to add the records)");

  const done = new Set((await FinanceEntry.find({}).select("orderId").lean()).map((e) => String(e.orderId)));
  const delivered = await Order.find({ orderStatus: { $in: ["Delivered", "Received"] } }).select("_id").lean();
  const todo = delivered.filter((o) => !done.has(String(o._id)));
  console.log(`${delivered.length} delivered orders, ${done.size} already recorded, ${todo.length} to add`);

  if (apply) {
    let added = 0, noCost = 0;
    for (const o of todo) {
      const e = await recordDeliveredOrder(o._id, "backfill");
      if (e) {
        added++;
        if (!e.costComplete) noCost++;
      }
    }
    console.log(`Added ${added} records (${noCost} have items whose buying cost is not known).`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
