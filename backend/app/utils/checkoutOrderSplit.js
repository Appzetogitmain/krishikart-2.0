import mongoose from "mongoose";
import Coupon from "../models/coupon.js";
import Order from "../models/order.js";
import GlobalSetting from "../models/globalSetting.js";
import { geocodeAddress } from "./geo.js";
import { getStorefrontOffersByProduct } from "./storefrontAvailability.js";
import { priceForQuantity } from "./pricing.js";

// Bulk tiers apply only when cheaper than the normal rate (see utils/pricing.js)
export const calculateItemPriceForCheckout = (product, quantity) =>
  priceForQuantity(product.price, product.bulkPricing, quantity);

/**
 * Resolve map pin; same rules as order placement.
 */
export async function resolveCheckoutCoordinates(shippingAddress, shippingLocation) {
  const parsedLat = Number(shippingLocation?.lat);
  const parsedLng = Number(shippingLocation?.lng);
  const hasValidClientCoords =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  if (hasValidClientCoords) {
    // If coordinates are from client pin, we still need to geocode once to get the city/pincode 
    // for validation, OR we trust the shippingAddress string. 
    // To be strict, let's geocode the lat/lng to get the official city.
    const reverse = await geocodeAddress(`${parsedLat},${parsedLng}`);
    return { 
      lat: parsedLat, 
      lng: parsedLng, 
      city: reverse?.city || "", 
      pincode: reverse?.pincode || "" 
    };
  }

  const geo = await geocodeAddress(shippingAddress);
  if (geo) {
    return {
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city,
      pincode: geo.pincode
    };
  }
  return null;
}

/**
 * Build order slices, one per franchise: each item is priced and served by the nearest franchise
 * that has it, and all items served by the same franchise go into ONE order (a basket only splits
 * when its items really come from different franchises). Coupon on the combined subtotal, single
 * delivery fee on the first slice, tax per slice.
 * @returns {{ ok: true, payload } | { ok: false, status: number, message: string }}
 */
export async function computeSplitCheckoutPayload({
  cart,
  userId,
  couponCode,
  resolvedLocation,
}) {
  const settings = await GlobalSetting.findOne({
    key: "delivery_constraints",
  });
  const constraints = settings?.value || {
    baseFee: 40,
    freeMov: 500,
    tax: 5,
    platformFee: 2,
  };

  const offers = await getStorefrontOffersByProduct(
    resolvedLocation.lat,
    resolvedLocation.lng,
    resolvedLocation.city,
  );

  const lines = [];
  for (const item of cart.items) {
    const product = item.productId;
    if (!product) continue;
    const maxQty = Number(process.env.MAX_CART_ITEM_QTY) || 10000;
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > maxQty) {
      return {
        ok: false,
        status: 400,
        message: `The quantity for ${product.name || "an item"} is not valid. Please enter between 1 and ${maxQty.toLocaleString("en-IN")} and try again.`,
      };
    }
    const offer = offers.get(product._id.toString());
    if (!offer) {
      return {
        ok: false,
        status: 400,
        message: `Not available at your delivery location: ${product.name || "an item"}. Remove it or choose another address.`,
      };
    }
    const productWithResolvedPrice = {
      ...product.toObject(),
      price: offer.effectivePrice,
      bulkPricing: offer.bulkPricing ?? product.bulkPricing,
    };
    const { price, isBulkRate } = calculateItemPriceForCheckout(
      productWithResolvedPrice,
      item.quantity,
    );
    const itemSubtotal = price * item.quantity;
    const catId = product.category?.toString();
    if (!catId) {
      return {
        ok: false,
        status: 400,
        message: `Product "${product.name}" has no category; cannot route order.`,
      };
    }
    lines.push({
      categoryId: catId,
      franchiseKey: offer.franchiseId ? String(offer.franchiseId) : `category:${catId}`,
      orderItem: {
        productId: product._id,
        name: product.name,
        image: product.primaryImage,
        quantity: item.quantity,
        unit: product.unit,
        price,
        subtotal: itemSubtotal,
        isBulkRate,
      },
    });
  }

  if (!lines.length) {
    return {
      ok: false,
      status: 400,
      message: "No valid items in your cart",
    };
  }

  // One order per serving franchise
  const groupsMap = new Map();
  for (const line of lines) {
    if (!groupsMap.has(line.franchiseKey)) {
      groupsMap.set(line.franchiseKey, { items: [], categoryIds: new Set() });
    }
    const g = groupsMap.get(line.franchiseKey);
    g.items.push(line.orderItem);
    g.categoryIds.add(line.categoryId);
  }

  const groupEntries = [...groupsMap.values()].map(({ items, categoryIds }) => ({
    // Kept for older reports: the category when the order has only one, otherwise none
    categoryId: categoryIds.size === 1 ? [...categoryIds][0] : null,
    items,
    subtotal: items.reduce((s, i) => s + i.subtotal, 0),
  }));

  const totalSubtotal = groupEntries.reduce((s, g) => s + g.subtotal, 0);

  let totalDiscount = 0;
  let finalDeliveryFee =
    totalSubtotal >= parseFloat(constraints.freeMov)
      ? 0
      : parseFloat(constraints.baseFee);
  let appliedCouponCode = "";
  let couponToIncrement = null;

  if (couponCode) {
    try {
      const coupon = await Coupon.findOne({
        code: String(couponCode).toUpperCase(),
        status: "active",
      });

      if (coupon) {
        const now = new Date();
        let isValid = true;

        if (coupon.startDate && now < coupon.startDate) isValid = false;
        if (coupon.endDate && now > coupon.endDate) isValid = false;
        if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit)
          isValid = false;
        if (totalSubtotal < coupon.minOrderValue) isValid = false;

        const userUsage = await Order.countDocuments({
          userId,
          couponCode: coupon.code,
          orderStatus: { $ne: "Cancelled" },
        });
        if (userUsage >= coupon.usageLimitPerUser) isValid = false;

        if (isValid) {
          if (coupon.type === "free_delivery") {
            finalDeliveryFee = 0;
          } else if (
            [
              "percentage",
              "bulk_discount",
              "category_based",
              "new_partner",
              "min_order_value",
              "monthly_volume",
            ].includes(coupon.type)
          ) {
            totalDiscount = (totalSubtotal * coupon.value) / 100;
            if (coupon.maxDiscount > 0 && totalDiscount > coupon.maxDiscount)
              totalDiscount = coupon.maxDiscount;
          } else if (coupon.type === "fixed") {
            totalDiscount = coupon.value;
          }

          appliedCouponCode = coupon.code;
          totalDiscount = Number(totalDiscount.toFixed(2));
          couponToIncrement = coupon;
        }
      }
    } catch (err) {
      console.error("Coupon processing error in checkout split:", err);
    }
  }

  const taxRate = parseFloat(constraints.tax || 0) / 100;
  const orderGroupId =
    groupEntries.length > 1
      ? new mongoose.Types.ObjectId().toString()
      : null;

  let allocatedDiscount = 0;
  const computedGroups = groupEntries.map((g, idx) => {
    const deliveryFee = idx === 0 ? finalDeliveryFee : 0;
    let groupDiscount = 0;
    if (idx < groupEntries.length - 1) {
      groupDiscount = Number(
        ((totalDiscount * g.subtotal) / totalSubtotal).toFixed(2),
      );
      allocatedDiscount += groupDiscount;
    } else {
      groupDiscount = Number((totalDiscount - allocatedDiscount).toFixed(2));
    }
    const tax = Number(((g.subtotal + deliveryFee) * taxRate).toFixed(2));
    const totalAmount = Number(
      (g.subtotal + deliveryFee + tax - groupDiscount).toFixed(2),
    );
    return {
      ...g,
      deliveryFee,
      discountAmount: groupDiscount,
      tax,
      totalAmount,
    };
  });

  const grandTotal = computedGroups.reduce((s, g) => s + g.totalAmount, 0);

  const userCoords = {
    type: "Point",
    coordinates: [resolvedLocation.lng, resolvedLocation.lat],
  };

  return {
    ok: true,
    payload: {
      userCoords,
      computedGroups,
      grandTotal,
      appliedCouponCode,
      couponToIncrement,
      orderGroupId,
      constraints,
    },
  };
}
