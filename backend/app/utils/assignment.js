import mongoose from "mongoose";
import Franchise from "../models/franchise.js";
import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import { sendNotificationToUser } from "./pushNotificationHelper.js";
import { createUserNotification } from "./userNotification.js";
import { emitToFranchise, emitToDelivery } from "../lib/socket.js";
import { deliveryTaskSummary, taskSummaryLine } from "./deliveryTask.js";
import { latLngToCell } from "h3-js";
import { getDistance } from "./geo.js";

/**
 * Sort franchises by straight-line distance from customer (nearest first).
 */
function sortFranchisesByDistance(franchises, customerLat, customerLng) {
  return [...franchises].sort((a, b) => {
    const ca = a.location?.coordinates;
    const cb = b.location?.coordinates;
    if (!Array.isArray(ca) || ca.length < 2 || !Number.isFinite(ca[0]) || !Number.isFinite(ca[1]))
      return 1;
    if (!Array.isArray(cb) || cb.length < 2 || !Number.isFinite(cb[0]) || !Number.isFinite(cb[1]))
      return -1;
    const da = getDistance(customerLat, customerLng, ca[1], ca[0]);
    const db = getDistance(customerLat, customerLng, cb[1], cb[0]);
    return da - db;
  });
}

/**
 * All franchise nodes that cover this map pin (H3 res 8 or within 25km), sorted nearest-first.
 * Used for order assignment (then narrowed by category) and storefront product availability.
 */
export async function fetchFranchiseCandidatesForLocation(
  lat,
  lng,
  excludeIds = [],
  categoryIds = [],
  city = null,
) {
  const orderHex = latLngToCell(lat, lng, 8);

  const baseQuery = {
    isActive: true,
    isOnline: true,
    capacityAvailable: true,
    status: "active",
    _id: { $nin: excludeIds },
  };

  // City Filter: flexible partial match (case-insensitive)
  // Avoids strict prefix match that breaks when area/locality is extracted instead of city
  if (city) {
    const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    baseQuery.city = { $regex: new RegExp(escapedCity, "i") };
  }

  const categoryObjectIds = (categoryIds || [])
    .map((id) => {
      if (!id) return null;
      try {
        return new mongoose.Types.ObjectId(id.toString());
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (categoryObjectIds.length > 0) {
    baseQuery.$or = [
      { servedCategories: { $all: categoryObjectIds } },
      { servedCategories: { $size: 0 } },
      { servedCategories: { $exists: false } },
    ];
  }

  // Use $or to support both legacy global coverage and new category-specific coverage
  const getHexagonQuery = (hex) => {
    const orConditions = [{ serviceHexagons: hex }];
    
    if (categoryObjectIds.length > 0) {
      orConditions.push({
        categoryCoverage: {
          $elemMatch: {
            category: { $in: categoryObjectIds },
            hexagons: hex
          }
        }
      });
    }
    return { $or: orConditions };
  };

  let nearestFranchises = await Franchise.find({
    ...baseQuery,
    ...getHexagonQuery(orderHex)
  }).lean();

  // FALLBACK 1: If no hubs found with city + location, try searching by city ONLY (handles "ordering for another city")
  if (nearestFranchises.length === 0 && city) {
    console.log(`[Assignment] No hub found for city "${city}" at this location. Trying city-only search.`);
    const cityOnlyQuery = { ...baseQuery };
    // Keep city filter but remove hexagon requirement
    nearestFranchises = await Franchise.find(cityOnlyQuery).lean();
    
    if (nearestFranchises.length > 0) {
        console.log(`[Assignment] Found ${nearestFranchises.length} hubs in "${city}" via city-only search.`);
        // We return these, sorted by distance from the (mismatched) pin, or just the first available
        return sortFranchisesByDistance(nearestFranchises, lat, lng);
    }
  }

  // FALLBACK 2: If still no hubs (maybe city is misspelled), try searching by location only
  if (nearestFranchises.length === 0) {
    console.log(`[Assignment] Still no hubs found. Falling back to location-only search.`);
    const locationOnlyQuery = { ...baseQuery };
    delete locationOnlyQuery.city;
    nearestFranchises = await Franchise.find({
      ...locationOnlyQuery,
      ...getHexagonQuery(orderHex)
    }).lean();
  }

  if (nearestFranchises.length > 0) {
    console.log(
      `[Assignment] Found ${nearestFranchises.length} franchises via EXACT H3 Hexagon matching.`,
    );
  } else {
    console.log(
      `[Assignment] No exact H3 match... falling back to 25km radius query.`,
    );
    nearestFranchises = await Franchise.find({
      ...baseQuery,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: 25000,
        },
      },
    }).lean();
  }

  nearestFranchises = nearestFranchises.filter(
    (f) =>
      Array.isArray(f.location?.coordinates) &&
      f.location.coordinates.length >= 2 &&
      Number.isFinite(f.location.coordinates[0]) &&
      Number.isFinite(f.location.coordinates[1]) &&
      !(f.location.coordinates[0] === 0 && f.location.coordinates[1] === 0),
  );

  return sortFranchisesByDistance(nearestFranchises, lat, lng);
}

/** Franchises that can serve this pin (no category filter) — for browsing / inventory union. */
export async function findFranchisesServingLocation(lat, lng, city = null) {
  return fetchFranchiseCandidatesForLocation(lat, lng, [], [], city);
}

/**
 * Finds the nearest eligible franchise for an order.
 * - Prefers franchises whose servedCategories cover ALL product categories in the order.
 * - Franchises with empty servedCategories are treated as serving all categories (legacy).
 * - Uses H3 hex match first, then falls back to geo $near within 25km.
 * - Among candidates, picks nearest by distance, preferring those in working hours (IST).
 */
export const findNearestFranchise = async (
  location,
  excludeIds = [],
  categoryIds = [],
  city = null,
) => {
  try {
    const { lat, lng } = location;

    console.log(`[Assignment] Customer Hexagon (res 8): ${latLngToCell(lat, lng, 8)}`);

    const nearestFranchises = await fetchFranchiseCandidatesForLocation(
      lat,
      lng,
      excludeIds,
      categoryIds,
      city,
    );

    const currentTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    console.log(
      `[Assignment] Found ${nearestFranchises.length} nearest franchises at ${currentTime} (IST).`,
    );

    let bestCandidate = null;

    for (const franchise of nearestFranchises) {
      const { start, end } = franchise.workingHours || {
        start: "09:00",
        end: "21:00",
      };
      console.log(
        `[Assignment] checking ${franchise.franchiseName}: Hours ${start}-${end}, Current: ${currentTime}`,
      );

      if (currentTime >= start && currentTime <= end) {
        return franchise;
      }
      if (!bestCandidate) bestCandidate = franchise;
    }

    if (bestCandidate) {
      console.log(
        `[Assignment] No franchise found in working hours, assigning to nearest candidate ${bestCandidate.franchiseName} for next-day processing.`,
      );
      return bestCandidate;
    }

    console.warn(`[Assignment] No eligible franchise found at all.`);
    return null;
  } catch (error) {
    console.error("[Assignment] Error finding nearest franchise:", error);
    return null;
  }
};

/**
 * Assigns an order to the nearest franchise and starts failover timer
 * @param {String} orderId
 */
export const assignOrderToFranchise = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate({
      path: "items.productId",
      select: "category name",
      model: "Product",
    });
    if (!order) return;

    const categoryIds = [
      ...new Set(
        order.items
          .map((item) => {
            const p = item.productId;
            if (!p) return null;
            const cat = p.category;
            return cat ? cat.toString() : null;
          })
          .filter(Boolean),
      ),
    ];

    const excludeIds = order.assignmentAttempts.map((a) => a.franchiseId);

    const coords = order?.shippingLocation?.coordinates;
    const hasValidCoords =
      Array.isArray(coords) &&
      coords.length >= 2 &&
      Number.isFinite(Number(coords[0])) &&
      Number.isFinite(Number(coords[1])) &&
      !(Number(coords[0]) === 0 && Number(coords[1]) === 0);

    if (!hasValidCoords) {
      console.warn(
        `[Assignment] Skipping order ${orderId}: invalid shipping coordinates`,
        coords,
      );
      return false;
    }

    const location = {
      lat: Number(coords[1]),
      lng: Number(coords[0]),
    };

    // Extract city: prefer shippingLocation.city (geocoded, accurate),
    // fallback to parsing shippingAddress string.
    // Address format: "Flat: X, Floor: Y, Colony, Landmark: Z, City, State[, Pincode]"
    // City is always at parts.length - 2 (second from end), skipping trailing pincode if present.
    let city = null;
    if (order.shippingLocation?.city) {
      city = order.shippingLocation.city.trim();
    } else if (order.shippingAddress) {
      const parts = order.shippingAddress.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        // Determine if last part is a pincode (pure digits)
        const lastPart = parts[parts.length - 1];
        const hasPincode = /^\d{4,6}$/.test(lastPart);
        
        // Smarter City Extraction:
        // Case 1: [..., City, State, Pincode] -> City is parts[length-3]
        // Case 2: [..., City, State] -> City is parts[length-2]
        // Case 3: [..., City] -> City is parts[length-1] (common when user doesn't type state)
        
        if (hasPincode) {
          city = parts[parts.length - 3] || parts[parts.length - 2];
        } else {
          // Check if last part looks like a state (e.g., MP, Madhya Pradesh)
          const states = ["madhya pradesh", "mp", "maharashtra", "up", "uttar pradesh", "rajasthan", "gujarat", "delhi", "punjab", "haryana"];
          const isLastPartState = states.includes(lastPart.toLowerCase());
          
          if (isLastPartState) {
            city = parts[parts.length - 2];
          } else {
            // If it's not a state or pincode, it's likely the city itself
            city = lastPart;
          }
        }
      }
    }
    console.log(`[Assignment] City for order ${orderId}: "${city}"`);

    const franchise = await findNearestFranchise(
      location,
      excludeIds,
      categoryIds,
      city,
    );

    if (franchise) {
      order.franchiseId = franchise._id;
      order.franchiseAutoAccepted = true;
      order.orderStatus = "Accepted";
      order.assignmentAttempts.push({
        franchiseId: franchise._id,
        attemptedAt: new Date(),
        reason: "auto-assigned",
      });

      order.statusHistory.push({
        status: "Accepted",
        updatedAt: new Date(),
        updatedBy: "system",
      });

      await order.save();

      await createUserNotification({
        userId: order.userId,
        type: "order_update",
        title: "Order Accepted",
        message: `Your order #${order._id.toString().slice(-6)} has been accepted and assigned for processing.`,
        link: `/order-detail/${order._id}`,
        meta: {
          orderId: order._id.toString(),
          status: "Accepted",
        },
      });

      console.log(
        `[Assignment] Order ${orderId} auto-assigned to franchise ${franchise._id}. Triggering FCM + socket...`,
      );

      const fcmData = {
        type: "new_order",
        orderId: order._id.toString(),
        link: `/franchise/orders/${order._id}`,
        autoAccepted: "true",
        showRejectOnly: "true",
        franchiseAutoAccepted: "true",
        orderStatus: "Accepted",
      };

      await sendNotificationToUser(
        franchise._id,
        {
          title: "New order — auto-accepted",
          body: `Order #${order._id.toString().slice(-6)} is assigned to you. Tap to view; use Reject only if you cannot fulfil.`,
          data: fcmData,
        },
        "franchise",
      );

      emitToFranchise(franchise._id, "new_order", {
        orderId: order._id,
        message: order.isPreOrder 
          ? `Advance Booking Assigned: #${order._id.toString().slice(-6)} for ${new Date(order.scheduledDate).toLocaleDateString()}`
          : `New order auto-assigned: #${order._id.toString().slice(-6)}`,
        autoAccepted: true,
        showRejectOnly: true,
        franchiseAutoAccepted: true,
        orderStatus: "Accepted",
        isPreOrder: order.isPreOrder,
        scheduledDate: order.scheduledDate
      });

      console.log(
        `[Assignment Success] Order ${orderId} assigned to Franchise ${franchise.franchiseName || franchise._id}`,
      );
      return true;
    }
    console.warn(
      `[Assignment Failure] No eligible franchise found for order ${orderId}.`,
    );
    return false;
  } catch (error) {
    console.error("Error assigning order to franchise:", error);
    return false;
  }
};

/**
 * Finds the nearest eligible delivery partner for an order
 * @param {Object} location Franchise location {lat, lng}
 * @returns {Promise<Object|null>}
 */
export const findNearestDeliveryPartner = async (location) => {
  try {
    const { lat, lng } = location;

    const nearestPartner = await Delivery.findOne({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: 5000,
        },
      },
      status: "active",
      isOnline: true,
    });

    return nearestPartner;
  } catch (error) {
    console.error("Error finding nearest delivery partner:", error);
    return null;
  }
};

/**
 * Assigns an order to the nearest delivery partner
 * @param {String} orderId
 */
export const assignDeliveryToOrder = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate("franchiseId");
    if (!order || !order.franchiseId) return;

    const franchise = await Franchise.findById(order.franchiseId);
    if (!franchise) return;

    const location = {
      lat: franchise.location.coordinates[1],
      lng: franchise.location.coordinates[0],
    };

    console.log(
      "[Assignment] Looking for nearest delivery partner for order",
      orderId,
      "at location",
      location,
    );
    const partner = await findNearestDeliveryPartner(location);

    if (partner) {
      console.log("[Assignment] Nearest delivery partner found:", partner._id);
      order.deliveryPartnerId = partner._id;
      await order.save();

      const taskInfo = await deliveryTaskSummary(order._id).catch(() => ({}));
      await sendNotificationToUser(
        partner._id,
        {
          title: `New Delivery Task #${order._id.toString().slice(-6).toUpperCase()}`,
          body: taskSummaryLine(taskInfo) || `You have a new delivery task for order #${order._id.toString().slice(-6)}.`,
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

      emitToDelivery(partner._id, "new_task", {
        orderId: order._id,
        type: "DELIVERY",
        message: `New delivery task assigned: #${order._id.toString().slice(-6)}`,
        ...taskInfo,
      });

      return true;
    }
    return false;
  } catch (error) {
    console.error("Error assigning delivery partner:", error);
    return false;
  }
};
