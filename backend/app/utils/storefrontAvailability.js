import mongoose from "mongoose";
import Inventory from "../models/inventory.js";
import Product from "../models/product.js";
import { findFranchisesServingLocation } from "./assignment.js";
import { buildPriceResolver } from "./pricing.js";

/** Franchise lists categories it serves; empty means all (legacy). */
export function franchiseServesCategory(franchise, categoryId) {
  if (!categoryId) return false;
  const sc = franchise.servedCategories || [];
  if (!sc.length) return true;
  return sc.some((c) => c.toString() === categoryId.toString());
}

/**
 * Nearest franchise wins per product: first covering node (distance-sorted) with stock
 * that serves the product category. Values are plain numbers / ObjectIds.
 * @returns {Map<string, { franchiseId, listPrice, effectivePrice, comparePrice, bulkPricing, zoneCode }>}
 */
export async function getStorefrontOffersByProduct(lat, lng, city = null) {
  const franchises = await findFranchisesServingLocation(lat, lng, city);
  if (!franchises.length) return new Map();

  const franchiseIds = franchises.map((f) => f._id);
  const inventories = await Inventory.find({
    franchiseId: { $in: franchiseIds },
  }).lean();

  const invByFranchise = new Map();
  for (const inv of inventories) {
    invByFranchise.set(inv.franchiseId.toString(), inv);
  }

  const explicitCategoryIds = new Set();
  const legacyProductIdStrs = new Set();

  for (const franchise of franchises) {
    const served = franchise.servedCategories || [];
    if (served.length > 0) {
      served.forEach((id) => {
        if (id) explicitCategoryIds.add(id.toString());
      });
      continue;
    }

    const inv = invByFranchise.get(franchise._id.toString());
    if (!inv) continue;
    for (const row of inv.items || []) {
      if (row.currentStock > 0 && row.productId) {
        legacyProductIdStrs.add(row.productId.toString());
      }
    }
  }

  const explicitCategoryObjectIds = [...explicitCategoryIds]
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const legacyProductObjectIds = [...legacyProductIdStrs]
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const productOrFilters = [];
  if (explicitCategoryObjectIds.length > 0) {
    productOrFilters.push({ category: { $in: explicitCategoryObjectIds } });
  }
  if (legacyProductObjectIds.length > 0) {
    productOrFilters.push({ _id: { $in: legacyProductObjectIds } });
  }
  if (!productOrFilters.length) return new Map();

  const productDocs = await Product.find({
    status: "active",
    $or: productOrFilters,
  })
    .select("_id category price comparePrice bulkPricing")
    .lean();

  // City rates (by price code) and franchise overrides, decided in one place
  const resolvePrice = await buildPriceResolver(franchises, productDocs.map((p) => p._id));

  const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));
  const productsByCategory = new Map();
  for (const product of productDocs) {
    const categoryId = product.category?.toString();
    if (!categoryId) continue;
    if (!productsByCategory.has(categoryId)) {
      productsByCategory.set(categoryId, []);
    }
    productsByCategory.get(categoryId).push(product);
  }

  const offerMap = new Map();
  for (const f of franchises) {
    const inv = invByFranchise.get(f._id.toString());
    const inventoryRows = new Map(
      (inv?.items || [])
        .filter((row) => row.productId)
        .map((row) => [row.productId.toString(), row]),
    );

    const served = f.servedCategories || [];
    if (served.length > 0) {
      for (const categoryId of served) {
        const products = productsByCategory.get(categoryId.toString()) || [];
        for (const prod of products) {
          const pid = prod._id.toString();
          if (offerMap.has(pid)) continue;
          const row = inventoryRows.get(pid);
          const r = resolvePrice(f, prod, row);
          offerMap.set(pid, {
            franchiseId: f._id,
            listPrice: r.listPrice,
            effectivePrice: r.price,
            comparePrice: r.comparePrice,
            bulkPricing: r.bulkPricing,
            zoneCode: r.zoneCode,
          });
        }
      }
      continue;
    }

    for (const row of inv?.items || []) {
      if (!row.productId || row.currentStock <= 0) continue;
      const pid = row.productId.toString();
      if (offerMap.has(pid)) continue;
      const prod = productMap.get(pid);
      if (!prod) continue;
      const catId = prod.category?.toString();
      if (!catId || !franchiseServesCategory(f, catId)) continue;
      const r = resolvePrice(f, prod, row);
      offerMap.set(pid, {
        franchiseId: f._id,
        listPrice: r.listPrice,
        effectivePrice: r.price,
        comparePrice: r.comparePrice,
        bulkPricing: r.bulkPricing,
        zoneCode: r.zoneCode,
      });
    }
  }
  return offerMap;
}

export async function getStorefrontProductIdsForLocation(lat, lng, city = null) {
  const m = await getStorefrontOffersByProduct(lat, lng, city);
  return [...m.keys()];
}

export async function getStorefrontCategoryIdsForLocation(lat, lng, city = null) {
  const franchises = await findFranchisesServingLocation(lat, lng, city);
  if (!franchises.length) return [];

  const explicitCategoryIds = new Set();
  const legacyFranchiseIds = [];

  for (const franchise of franchises) {
    const served = franchise.servedCategories || [];
    if (served.length > 0) {
      served.forEach((id) => {
        if (id) explicitCategoryIds.add(id.toString());
      });
    } else {
      legacyFranchiseIds.push(franchise._id);
    }
  }

  if (legacyFranchiseIds.length > 0) {
    const inventories = await Inventory.find({
      franchiseId: { $in: legacyFranchiseIds },
    }).lean();

    const productIdStrs = new Set();
    for (const inv of inventories) {
      for (const row of inv.items || []) {
        if (row.currentStock > 0 && row.productId) {
          productIdStrs.add(row.productId.toString());
        }
      }
    }

    if (productIdStrs.size > 0) {
      const oids = [...productIdStrs]
        .map((id) => {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const fallbackCats = await Product.distinct("category", {
        _id: { $in: oids },
        status: "active",
      });

      fallbackCats.filter(Boolean).forEach((id) => {
        explicitCategoryIds.add(id.toString());
      });
    }
  }

  return [...explicitCategoryIds];
}
