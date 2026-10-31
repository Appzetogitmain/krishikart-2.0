import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import Franchise from "../models/franchise.js";
import { emitToOrderRoom, emitToDelivery, emitToFranchise } from "../lib/socket.js";
import { sendNotificationToUser } from "./pushNotificationHelper.js";
import { createUserNotification } from "./userNotification.js";
import { createDeliveryOtps } from "./deliveryOtp.js";
import { deliveryTaskSummary, taskSummaryLine } from "./deliveryTask.js";
import { getDistance } from "./geo.js";
import { getISTDayKey } from "./deliverySchedule.js";

/**
 * Delivery partner assignment (client, Oct 2026): as soon as an order is packed and its box count is known,
 * the system gives it to a delivery partner on its own - the partner does not have to accept it. The franchise
 * can still pick or change the partner by hand ("Assign & Send" / "Change partner").
 */

const ACTIVE_TASK = ["Dispatched", "Out for Delivery"];
const MAX_KM = 25; // partners whose last known location is further than this from the store are skipped

/** The order is handed to the partner: status Dispatched, fresh delivery codes, customer + partner notified */
export async function dispatchOrderToPartner(order, partnerId, { by = "franchise" } = {}) {
  const previous = order.deliveryPartnerId ? String(order.deliveryPartnerId) : null;
  order.deliveryPartnerId = partnerId;
  order.orderStatus = "Dispatched";
  order.autoDispatched = by === "system";
  order.statusHistory.push({
    status: "Dispatched",
    updatedAt: new Date(),
    updatedBy: by,
    ...(by === "system" ? { message: "Delivery partner assigned automatically" } : {}),
  });
  await order.save();

  // A partner who was replaced drops the task from their list
  if (previous && previous !== String(partnerId)) {
    emitToDelivery(previous, "task_removed", { orderId: order._id });
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

  // Real-time + push to the partner (with address and amount); the task is already theirs
  const taskInfo = await deliveryTaskSummary(order._id).catch(() => ({}));
  emitToDelivery(partnerId, "new_task", {
    orderId: order._id,
    type: "DELIVERY",
    autoAccepted: true,
    message: `New delivery assigned to you: #${order._id.toString().slice(-6).toUpperCase()}`,
    ...taskInfo,
  });
  sendNotificationToUser(
    partnerId,
    {
      title: `New Delivery #${order._id.toString().slice(-6).toUpperCase()}`,
      body: taskSummaryLine(taskInfo) || `Order #${order._id.toString().slice(-6)} has been assigned to you.`,
      data: {
        type: "new_delivery",
        notificationCategory: "assignment",
        source: "franchise",
        orderId: order._id.toString(),
        link: `/delivery/assignments/${order._id}`,
      },
    },
    "delivery",
  );
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

/**
 * Best partner for an order:
 * 1. the partner already carrying this customer's other orders for the same day (one trip),
 * 2. otherwise an online, approved partner - fewest running deliveries first, then nearest to the store.
 */
export async function pickDeliveryPartner(order, { exclude = [] } = {}) {
  const skip = new Set([...exclude, ...(order.deliveryRejectedBy || [])].map(String));
  const partners = await Delivery.find({ status: "active", isVerified: true, isApproved: true, isOnline: true })
    .select("fullName location")
    .lean();
  const candidates = partners.filter((p) => !skip.has(String(p._id)));
  if (!candidates.length) return null;
  const ids = candidates.map((p) => p._id);

  // Same customer or same place, same day, already on the road with someone (not picked up yet,
  // so this order can still go in the same trip)
  const dayKey = getISTDayKey(order.scheduledDate || order.createdAt || new Date());
  const siblings = await Order.find({
    _id: { $ne: order._id },
    franchiseId: order.franchiseId,
    orderStatus: "Dispatched",
    deliveryPartnerId: { $in: ids },
  })
    .select("userId shippingAddress shippingLocation deliveryPartnerId scheduledDate createdAt")
    .lean();
  const sameDay = siblings.filter((o) => getISTDayKey(o.scheduledDate || o.createdAt) === dayKey);
  const sibling =
    sameDay.find((o) => String(o.userId) === String(order.userId)) || sameDay.find((o) => samePlace(o, order));
  if (sibling) return candidates.find((p) => String(p._id) === String(sibling.deliveryPartnerId)) || null;

  const loads = await Order.aggregate([
    { $match: { orderStatus: { $in: ACTIVE_TASK }, deliveryPartnerId: { $in: ids } } },
    { $group: { _id: "$deliveryPartnerId", n: { $sum: 1 } } },
  ]);
  const loadOf = new Map(loads.map((l) => [String(l._id), l.n]));

  const franchise = await Franchise.findById(order.franchiseId).select("location").lean();
  const store = franchise?.location?.coordinates;
  const scored = candidates
    .map((p) => {
      const c = p.location?.coordinates;
      const km = hasCoords(store) && hasCoords(c) ? getDistance(store[1], store[0], c[1], c[0]) : null;
      return { p, km, load: loadOf.get(String(p._id)) || 0 };
    })
    .filter((x) => x.km === null || x.km <= MAX_KM)
    // 1 running delivery counts like 3 km extra; unknown location ranks after known ones
    .sort((a, b) => (a.load * 3 + (a.km ?? MAX_KM)) - (b.load * 3 + (b.km ?? MAX_KM)));
  return scored[0]?.p || null;
}

/** Packed, box count entered, not blocked by a shortage, and due today (advance bookings wait for their day) */
export function readyForAutoDispatch(order) {
  if (!order || !["Packed", "Ready"].includes(order.orderStatus)) return false;
  if (!(Number(order.numberOfPackages) > 0)) return false;
  if ((order.items || []).some((i) => i.isShortage) && !order.allowPartialFulfillment) return false;
  if (order.scheduledDate && getISTDayKey(order.scheduledDate) > getISTDayKey(new Date())) return false;
  return !!order.franchiseId;
}

/**
 * Gives the order to the best partner. Returns the partner, or null when it stays with the franchise
 * (nobody online - the franchise can assign by hand; the scheduler tries again every few minutes).
 */
export async function autoDispatchOrder(orderId, { exclude = [], notifyFranchiseIfNone = false } = {}) {
  try {
    const order = await Order.findById(orderId);
    if (!readyForAutoDispatch(order)) return null;
    const partner = await pickDeliveryPartner(order, { exclude });
    if (!partner) {
      if (notifyFranchiseIfNone) {
        emitToFranchise(order.franchiseId, "delivery_auto_assign_failed", {
          orderId: order._id,
          message: `No delivery partner is online for order #${order._id.toString().slice(-6).toUpperCase()}. Please assign one by hand.`,
        });
      }
      return null;
    }
    await dispatchOrderToPartner(order, partner._id, { by: "system" });
    emitToFranchise(order.franchiseId, "delivery_auto_assigned", {
      orderId: order._id,
      partnerName: partner.fullName,
      message: `Order #${order._id.toString().slice(-6).toUpperCase()} given to ${partner.fullName}`,
    });
    console.log(`[AutoDispatch] Order ${order._id} -> partner ${partner._id}`);
    return partner;
  } catch (error) {
    console.error("[AutoDispatch] error:", error);
    return null;
  }
}

/** Scheduler sweep: packed orders still waiting (nobody was online, or an advance booking whose day came) */
export async function sweepAutoDispatch() {
  try {
    const waiting = await Order.find({
      orderStatus: { $in: ["Packed", "Ready"] },
      numberOfPackages: { $gt: 0 },
      franchiseId: { $ne: null },
    })
      .select("_id")
      .limit(200)
      .lean();
    for (const o of waiting) await autoDispatchOrder(o._id);
  } catch (error) {
    console.error("[AutoDispatch] sweep error:", error);
  }
}
