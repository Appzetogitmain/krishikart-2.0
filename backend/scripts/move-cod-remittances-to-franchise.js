/**
 * One-time script: COD cash that delivery partners submitted before the "hand it to the franchise"
 * change has no franchise on it, so only the main admin could verify it. This gives each such
 * waiting (status "submitted") remittance to the franchise its orders went out from, so the
 * franchise can verify it.
 *
 *  - all orders from one franchise -> that franchise is set on the remittance
 *  - orders from several franchises -> the remittance is split, one per franchise
 *  - an order with no franchise on it -> that remittance is left with the admin
 *
 * Already verified or rejected remittances are not touched.
 *
 * Run: node scripts/move-cod-remittances-to-franchise.js           (only shows what would change)
 *      node scripts/move-cod-remittances-to-franchise.js --apply   (makes the change)
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const apply = process.argv.includes("--apply");

const Order = (await import("../app/models/order.js")).default;
const DeliveryCodRemittance = (await import("../app/models/deliveryCodRemittance.js")).default;

const orderAmount = (o) => Number(o.codTracking?.collectedAmount || o.totalAmount || 0);

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not set in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(apply ? "APPLYING changes" : "DRY RUN (nothing is written; add --apply to make the change)");

  const waiting = await DeliveryCodRemittance.find({
    status: "submitted",
    $or: [{ franchiseId: null }, { franchiseId: { $exists: false } }],
  }).sort({ createdAt: 1 });
  console.log(`${waiting.length} waiting remittance(s) with no franchise\n`);

  let moved = 0;
  let split = 0;
  let skipped = 0;

  for (const rem of waiting) {
    const orders = await Order.find({ _id: { $in: rem.orderIds } }).select("franchiseId totalAmount codTracking");
    const label = `${rem._id} (Rs ${rem.amount}, ${rem.orderIds.length} orders)`;

    if (!orders.length || orders.some((o) => !o.franchiseId)) {
      console.log(`SKIP  ${label}: some orders have no franchise, so it stays with the admin`);
      skipped++;
      continue;
    }

    const groups = new Map();
    for (const o of orders) {
      const key = String(o.franchiseId);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    const entries = [...groups.entries()];

    if (entries.length === 1) {
      console.log(`MOVE  ${label} -> franchise ${entries[0][0]}`);
      if (apply) {
        rem.franchiseId = entries[0][0];
        await rem.save();
      }
      moved++;
      continue;
    }

    console.log(`SPLIT ${label} into ${entries.length} remittances: ` +
      entries.map(([f, g]) => `${f} Rs ${g.reduce((s, o) => s + orderAmount(o), 0).toFixed(2)}`).join(", "));
    if (apply) {
      const [firstKey, firstOrders] = entries[0];
      const base = rem.toObject();
      delete base._id;
      delete base.__v;
      delete base.updatedAt; // createdAt is kept so the new entries keep the original date

      rem.franchiseId = firstKey;
      rem.orderIds = firstOrders.map((o) => o._id);
      rem.amount = Number(firstOrders.reduce((s, o) => s + orderAmount(o), 0).toFixed(2));
      await rem.save();

      for (const [franchiseKey, group] of entries.slice(1)) {
        const created = await DeliveryCodRemittance.create({
          ...base,
          franchiseId: franchiseKey,
          orderIds: group.map((o) => o._id),
          amount: Number(group.reduce((s, o) => s + orderAmount(o), 0).toFixed(2)),
        });
        await Order.updateMany(
          { _id: { $in: group.map((o) => o._id) } },
          { $set: { "codTracking.remittanceId": created._id } },
        );
      }
    }
    split++;
  }

  console.log(`\nDone: ${moved} moved, ${split} split, ${skipped} left with the admin${apply ? "" : " (dry run, nothing written)"}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
