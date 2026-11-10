import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import Franchise from "../models/franchise.js";
import { emitToOrderRoom, emitToDelivery, emitToFranchise } from "../lib/socket.js";
import { sendNotificationToUser } from "./pushNotificationHelper.js";
import { createUserNotification } from "./userNotification.js";
import { createDeliveryOtps } from "./deliveryOtp.js";
import { deliveryTaskSummary, taskSummaryLine } from "./deliveryTask.js";
import { getDistance } from "./geo.js";
import { getISTDayKey, getShiftStartHour } from "./deliverySchedule.js";
import { TWO_WHEELER_MAX_KG, isTwoWheeler, orderWeightKg, hasPackInfo } from "../constants/delivery.js";

/**
 * Delivery requests (client, Nov 2026 - replaces the Oct 2026 "give it to one partner, no accepting" rule):
 * as soon as an order is packed and its weight is known, a REQUEST goes to every suitable online delivery partner
 * (right vehicle for the weight, near the store, has not declined it). Their app rings; the FIRST partner to accept
 * gets the order and it disappears from everyone else's app. A partner who declines never sees it again.
 * Nobody available, everybody declined, or nobody accepts within 10 minutes -> the franchise is told and can
 * assign by hand ("Assign & Send"); partners who come online later get the request within 2 minutes.
 */

const VEHICLE_LABEL = { bike: "bike", scooter: "scooter", auto: "auto", four_wheeler: "4-wheeler" };
const ACTIVE_TASK = ["Dispatched", "Out for Delivery"];
const MAX_KM = 25; // partners whose last known location is further than this from the store are skipped
const UNANSWERED_MINUTES = 10;
const ref = (id) => `#${String(id).slice(-6).toUpperCase()}`;

/** The order is handed to the partner: status Dispatched, fresh delivery codes, customer + partner notified */
export async function dispatchOrderToPartner(order, partnerId, { by = "franchise" } = {}) {
  const previous = order.deliveryPartnerId ? String(order.deliveryPartnerId) : null;
  const offeredTo = (order.deliveryOffer?.offeredTo || []).map(String);
  order.deliveryPartnerId = partnerId;
  order.orderStatus = "Dispatched";
  order.autoDispatched = by !== "franchise";
  // The request is closed whoever took it (accepted, or the franchise chose someone)
  order.set("deliveryOffer.acceptedBy", partnerId);
  if (!order.deliveryOffer?.acceptedAt) order.set("deliveryOffer.acceptedAt", new Date());
  order.statusHistory.push({
    status: "Dispatched",
    updatedAt: new Date(),
    updatedBy: by === "offer" ? "delivery" : by,
    ...(by === "offer" ? { message: "Delivery request accepted by the partner" } : by === "system" ? { message: "Delivery partner assigned automatically" } : {}),
  });
  await order.save();

  // A partner who was replaced drops the task from their list; partners who still had the request lose it
  if (previous && previous !== String(partnerId)) {
    emitToDelivery(previous, "task_removed", { orderId: order._id });
  }
  for (const other of offeredTo) {
    if (other !== String(partnerId)) emitToDelivery(other, "offer_taken", { orderId: order._id });
  }

  const { customerCode } = await createDeliveryOtps(order._id);
  emitToOrderRoom(order._id, "order_status_changed", { orderId: order._id, status: "Dispatched", updatedAt: new Date() });
  try {
    await createUserNotification({
      userId: order.userId,
      type: "order_update",
      title: "Order on the way",
      message: `Your order #${order._id.toString().slice(-6)} is out for delivery. Your delivery code is ${customerCode}. Share it with the delivery partner only when you receive your order.`,
      link: `/order-detail/${order._id}`,
      meta: { orderId: order._id.toString(), status: "Dispatched" },
    });
  } catch (notifyErr) {
    console.error("[dispatchOrderToPartner] customer notification error:", notifyErr);
  }

  // Real-time + push to the partner (with address and amount); the task is theirs now
  const taskInfo = await deliveryTaskSummary(order._id).catch(() => ({}));
  emitToDelivery(partnerId, "new_task", {
    orderId: order._id,
    type: "DELIVERY",
    autoAccepted: true,
    message: by === "offer" ? `Order ${ref(order._id)} is yours` : `New delivery assigned to you: ${ref(order._id)}`,
    ...taskInfo,
  });
  if (by !== "offer") {
    sendNotificationToUser(
      partnerId,
      {
        title: `New Delivery ${ref(order._id)}`,
        body: taskSummaryLine(taskInfo) || `Order #${order._id.toString().slice(-6)} has been assigned to you.`,
        data: { type: "new_delivery", notificationCategory: "assignment", source: "franchise", orderId: order._id.toString(), link: `/delivery/assignments/${order._id}` },
      },
      "delivery",
    );
  }
  return order;
}

const placeText = (o) => String(o.shippingAddress || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const addressWords = (o) => new Set(String(o.shippingAddress || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
const addressesAlike = (a, b) => {
  const wa = addressWords(a);
  const wb = addressWords(b);
  if (!wa.size || !wb.size) return false;
  let both = 0;
  wa.forEach((w) => { if (wb.has(w)) both += 1; });
  return both / (wa.size + wb.size - both) >= 0.5;
};
/** Same delivery address text, or delivery pins within ~60 m whose addresses mostly match (same rule as the franchise screen) */
export function samePlace(a, b) {
  const ta = placeText(a);
  if (ta.length >= 8 && ta === placeText(b)) return true;
  const ca = a.shippingLocation?.coordinates;
  const cb = b.shippingLocation?.coordinates;
  if (!hasCoords(ca) || !hasCoords(cb)) return false;
  return getDistance(ca[1], ca[0], cb[1], cb[0]) <= 0.06 && addressesAlike(a, b);
}

const hasCoords = (c) => Array.isArray(c) && c.length === 2 && !(Number(c[0]) === 0 && Number(c[1]) === 0);
const fits = (p, kg) => !isTwoWheeler(p.vehicleType) || kg <= TWO_WHEELER_MAX_KG;
const dayOf = (o) => getISTDayKey(o.scheduledDate || o.createdAt || new Date());

/**
 * Every partner who may get the request: active, verified, approved and online; has not declined this order;
 * the right vehicle for its weight (over 20 kg: auto / four-wheeler only); within 25 km of the store (or no
 * location saved yet). Sorted best first: two-wheelers first for light orders, then fewest running deliveries
 * and nearest to the store.
 */
export async function eligiblePartners(order, { exclude = [] } = {}) {
  const skip = new Set([...exclude, ...(order.deliveryRejectedBy || [])].map(String));
  const partners = await Delivery.find({ status: "active", isVerified: true, isApproved: true, isOnline: true })
    .select("fullName location vehicleType")
    .lean();
  const weight = orderWeightKg(order);
  const candidates = partners.filter((p) => !skip.has(String(p._id)) && fits(p, weight));
  if (!candidates.length) return [];
  const ids = candidates.map((p) => p._id);
  const loads = await Order.aggregate([
    { $match: { orderStatus: { $in: ACTIVE_TASK }, deliveryPartnerId: { $in: ids } } },
    { $group: { _id: "$deliveryPartnerId", n: { $sum: 1 } } },
  ]);
  const loadOf = new Map(loads.map((l) => [String(l._id), l.n]));
  const franchise = await Franchise.findById(order.franchiseId).select("location").lean();
  const store = franchise?.location?.coordinates;
  return candidates
    .map((p) => {
      const c = p.location?.coordinates;
      const km = hasCoords(store) && hasCoords(c) ? getDistance(store[1], store[0], c[1], c[0]) : null;
      return { p, km, load: loadOf.get(String(p._id)) || 0, small: isTwoWheeler(p.vehicleType) };
    })
    .filter((x) => x.km === null || x.km <= MAX_KM)
    .sort((a, b) => (Number(b.small) - Number(a.small)) || ((a.load * 3 + (a.km ?? MAX_KM)) - (b.load * 3 + (b.km ?? MAX_KM))))
    .map((x) => x.p);
}

/** Packed, weight (or older box count) entered, not blocked by a shortage, and due today (advance bookings wait for their day) */
export function readyForAutoDispatch(order) {
  if (!order || !["Packed", "Ready"].includes(order.orderStatus)) return false;
  if (!hasPackInfo(order)) return false;
  if ((order.items || []).some((i) => i.isShortage) && !order.allowPartialFulfillment) return false;
  if (order.scheduledDate && getISTDayKey(order.scheduledDate) > getISTDayKey(new Date())) return false;
  return !!order.franchiseId;
}

/**
 * Sends the delivery request to every suitable partner who does not have it yet.
 * Returns { sent: new partners now, total: partners holding the request }.
 */
export async function offerOrderToPartners(orderId, { notifyFranchiseIfNone = false, noneMessage = null } = {}) {
  try {
    const order = await Order.findById(orderId);
    if (!readyForAutoDispatch(order) || order.deliveryOffer?.acceptedBy) return { sent: 0, total: 0 };
    const partners = await eligiblePartners(order);
    const already = new Set((order.deliveryOffer?.offeredTo || []).map(String));
    const fresh = partners.filter((p) => !already.has(String(p._id)));
    const total = already.size + fresh.length;

    if (!total) {
      if (notifyFranchiseIfNone) {
        emitToFranchise(order.franchiseId, "delivery_auto_assign_failed", {
          orderId: order._id,
          message: noneMessage || (orderWeightKg(order) > TWO_WHEELER_MAX_KG
            ? `Order ${ref(order._id)} is ${orderWeightKg(order)} kg - no auto / four-wheeler partner is online. Please assign one by hand.`
            : `No delivery partner is online for order ${ref(order._id)}. Please assign one by hand.`),
        });
      }
      return { sent: 0, total: 0 };
    }
    if (!fresh.length) return { sent: 0, total };

    const firstTime = !order.deliveryOffer?.offeredAt;
    await Order.updateOne(
      { _id: order._id, "deliveryOffer.acceptedBy": null },
      {
        $addToSet: { "deliveryOffer.offeredTo": { $each: fresh.map((p) => p._id) } },
        ...(firstTime ? { $set: { "deliveryOffer.offeredAt": new Date(), "deliveryOffer.alertedAt": null } } : {}),
      },
    );

    const taskInfo = await deliveryTaskSummary(order._id).catch(() => ({}));
    for (const p of fresh) {
      emitToDelivery(p._id, "new_task", {
        orderId: order._id,
        type: "DELIVERY",
        offer: true,
        message: `New delivery request ${ref(order._id)} - the first partner to accept gets it`,
        ...taskInfo,
      });
      sendNotificationToUser(
        p._id,
        {
          title: `New delivery request ${ref(order._id)}`,
          body: taskSummaryLine(taskInfo) || "Accept it in the app - the first partner to accept gets it.",
          data: { type: "new_delivery", notificationCategory: "assignment", source: "franchise", orderId: order._id.toString(), link: "/delivery/requests" },
        },
        "delivery",
      );
    }
    emitToFranchise(order.franchiseId, "delivery_offer_sent", {
      orderId: order._id,
      count: total,
      message: firstTime
        ? `Order ${ref(order._id)} sent to ${total} delivery partner${total > 1 ? "s" : ""} - waiting for one to accept`
        : `Order ${ref(order._id)} also sent to ${fresh.length} more delivery partner${fresh.length > 1 ? "s" : ""}`,
    });
    console.log(`[DeliveryOffer] Order ${order._id} -> ${fresh.length} new partner(s), ${total} in total`);
    return { sent: fresh.length, total };
  } catch (error) {
    console.error("[DeliveryOffer] error:", error);
    return { sent: 0, total: 0 };
  }
}

/** Old name, kept for callers: an order that is ready now goes out as a request */
export const autoDispatchOrder = offerOrderToPartners;

/** Claims an open request for this partner; only one partner can ever win it */
const claim = (orderId, partnerId) =>
  Order.findOneAndUpdate(
    {
      _id: orderId,
      orderStatus: { $in: ["Packed", "Ready"] },
      "deliveryOffer.offeredTo": partnerId,
      "deliveryOffer.acceptedBy": null,
      deliveryRejectedBy: { $ne: partnerId },
    },
    { $set: { "deliveryOffer.acceptedBy": partnerId, "deliveryOffer.acceptedAt": new Date() } },
    { new: true },
  );

/**
 * A partner accepts a request. The first one wins; everyone else's request disappears. Other open requests for
 * the same customer / same place and day go along in the same trip while they still fit the partner's vehicle.
 */
export async function acceptOffer(orderId, partnerId) {
  const order = await claim(orderId, partnerId);
  if (!order) return { ok: false, message: "Another delivery partner has already taken this order." };
  const partner = await Delivery.findById(partnerId).select("fullName vehicleType").lean();
  await dispatchOrderToPartner(order, partnerId, { by: "offer" });
  const taken = [order._id];

  let tripKg = orderWeightKg(order);
  const others = await Order.find({
    _id: { $ne: order._id },
    franchiseId: order.franchiseId,
    orderStatus: { $in: ["Packed", "Ready"] },
    "deliveryOffer.offeredTo": partnerId,
    "deliveryOffer.acceptedBy": null,
    deliveryRejectedBy: { $ne: partnerId },
  });
  for (const o of others) {
    if (dayOf(o) !== dayOf(order)) continue;
    if (String(o.userId) !== String(order.userId) && !samePlace(o, order)) continue;
    if (partner && !fits(partner, tripKg + orderWeightKg(o))) continue;
    const won = await claim(o._id, partnerId);
    if (!won) continue;
    await dispatchOrderToPartner(won, partnerId, { by: "offer" });
    tripKg += orderWeightKg(won);
    taken.push(won._id);
  }

  emitToFranchise(order.franchiseId, "delivery_auto_assigned", {
    orderId: order._id,
    partnerName: partner?.fullName,
    message: `${taken.length > 1 ? `${taken.length} orders (${taken.map(ref).join(", ")})` : `Order ${ref(order._id)}`} accepted by ${partner?.fullName || "a delivery partner"}${partner?.vehicleType ? ` (${VEHICLE_LABEL[partner.vehicleType] || partner.vehicleType})` : ""}`,
  });
  console.log(`[DeliveryOffer] accepted by ${partnerId}: ${taken.join(", ")}`);
  return { ok: true, orderIds: taken };
}

/** A partner declines a request: it leaves their app for good and goes to anyone new who is available */
export async function declineOffer(orderId, partnerId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, "deliveryOffer.offeredTo": partnerId, "deliveryOffer.acceptedBy": null },
    { $pull: { "deliveryOffer.offeredTo": partnerId }, $addToSet: { deliveryRejectedBy: partnerId } },
    { new: true },
  );
  if (!order) return { ok: false, message: "This request is no longer open." };
  await offerOrderToPartners(order._id, {
    notifyFranchiseIfNone: true,
    noneMessage: `Every available delivery partner declined order ${ref(order._id)}. Please assign one by hand.`,
  });
  return { ok: true };
}

/** A partner hands back a task they had: it goes out again as a new request (not to them) */
export async function reofferAfterHandBack(orderId) {
  await Order.updateOne(
    { _id: orderId },
    { $set: { "deliveryOffer.offeredTo": [], "deliveryOffer.offeredAt": null, "deliveryOffer.acceptedBy": null, "deliveryOffer.acceptedAt": null, "deliveryOffer.alertedAt": null } },
  );
  return offerOrderToPartners(orderId, { notifyFranchiseIfNone: true });
}

/**
 * Scheduler sweep (every 2 minutes): open requests reach partners who came online since, and the franchise is
 * told once when nobody has accepted for 10 minutes. Earliest delivery day + slot first.
 */
export async function sweepAutoDispatch() {
  try {
    const waiting = await Order.find({
      orderStatus: { $in: ["Packed", "Ready"] },
      $or: [{ packedWeightKg: { $gt: 0 } }, { numberOfPackages: { $gt: 0 } }],
      franchiseId: { $ne: null },
      "deliveryOffer.acceptedBy": null,
    })
      .select("_id franchiseId scheduledDate createdAt deliveryShift deliveryOffer")
      .limit(200)
      .lean();
    const when = (o) => `${getISTDayKey(o.scheduledDate || o.createdAt)}|${String(getShiftStartHour(o.deliveryShift) ?? 99).padStart(2, "0")}|${new Date(o.createdAt).toISOString()}`;
    waiting.sort((a, b) => when(a).localeCompare(when(b)));
    const now = Date.now();
    for (const o of waiting) {
      await offerOrderToPartners(o._id);
      const since = o.deliveryOffer?.offeredAt ? new Date(o.deliveryOffer.offeredAt).getTime() : null;
      if (since && now - since > UNANSWERED_MINUTES * 60000 && !o.deliveryOffer?.alertedAt) {
        await Order.updateOne({ _id: o._id }, { $set: { "deliveryOffer.alertedAt": new Date() } });
        emitToFranchise(o.franchiseId, "delivery_offer_unanswered", {
          orderId: o._id,
          message: `No delivery partner has accepted order ${ref(o._id)} for ${UNANSWERED_MINUTES} minutes. Please assign one by hand.`,
        });
      }
    }
  } catch (error) {
    console.error("[DeliveryOffer] sweep error:", error);
  }
}

/** Kept for any older caller: the best single partner for an order */
export async function pickDeliveryPartner(order, opts = {}) {
  return (await eligiblePartners(order, opts))[0] || null;
}
