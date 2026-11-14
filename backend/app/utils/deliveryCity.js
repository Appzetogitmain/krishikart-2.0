import Franchise from "../models/franchise.js";
import { cityKeyOf } from "./pricing.js";
import { getDistance } from "./geo.js";

/**
 * Delivery partners work in one city (client, Nov 2026: "a partner from Ujjain getting requests from a Jaipur
 * franchise makes no sense"). A partner's city is the one they chose (Delivery.city); older accounts without one
 * fall back to the city of the nearest store within NEAR_KM of their last known location; with neither, the
 * partner has no city and gets no requests until they choose one.
 */
const NEAR_KM = 40;

const hasCoords = (c) => Array.isArray(c) && c.length === 2 && !(Number(c[0]) === 0 && Number(c[1]) === 0);
const titleCase = (s) => s.replace(/\b\w/g, (ch) => ch.toUpperCase());

/** Cities that have a franchise: [{ name, key }] sorted by name */
export async function franchiseCities() {
  const rows = await Franchise.find({ city: { $nin: [null, ""] } }).select("city").lean();
  const byKey = new Map();
  for (const r of rows) {
    const key = cityKeyOf(r.city);
    if (key && !byKey.has(key)) byKey.set(key, titleCase(String(r.city).split(",")[0].trim().replace(/\s+/g, " ").toLowerCase()));
  }
  return [...byKey.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** The city a valid choice refers to (case-insensitive), or null */
export async function matchFranchiseCity(text) {
  const key = cityKeyOf(text);
  if (!key) return null;
  return (await franchiseCities()).find((c) => c.key === key) || null;
}

/** Franchises with a city and a location, for the nearest-store fallback */
export const storesForCityLookup = () => Franchise.find({}).select("city location").lean();

/** City key of a partner: their own choice, else the nearest store's city (within NEAR_KM), else null */
export function partnerCityKey(partner, stores = []) {
  if (partner?.city) return cityKeyOf(partner.city);
  const c = partner?.location?.coordinates;
  if (!hasCoords(c)) return null;
  let best = null;
  let bestKm = Infinity;
  for (const s of stores) {
    const sc = s.location?.coordinates;
    if (!s.city || !hasCoords(sc)) continue;
    const km = getDistance(c[1], c[0], sc[1], sc[0]);
    if (km < bestKm) { bestKm = km; best = s; }
  }
  return best && bestKm <= NEAR_KM ? cityKeyOf(best.city) : null;
}
