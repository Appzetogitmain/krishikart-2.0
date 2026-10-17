import jwt from "jsonwebtoken";
import SubAdmin from "../models/subAdmin.js";
import Franchise from "../models/franchise.js";
import Vendor from "../models/vendor.js";
import Order from "../models/order.js";
import ProcurementRequest from "../models/procurementRequest.js";
import handleResponse from "./helper.js";
import {
    computeAdminScope,
    franchiseInScope,
    vendorInScope,
    orderInScope,
    deliveryIdsInScope,
    customerIdsInScope,
} from "./adminScope.js";

/**
 * Keeps city admins (sub-admins with city codes) inside their own cities. Runs before the admin
 * routes:
 *   1. head-office pages (money, global catalogue and settings, team, activity log) are refused
 *   2. a record from another city opened directly by id is refused
 *   3. lists are trimmed to the admin's cities
 * The main admin and team members without a city code are not affected.
 */

const HEAD_OFFICE_MSG = "This is managed by the main admin (head office).";
const OTHER_CITY_MSG = "This belongs to another city. You can only work on your own city.";

const ADMIN_PREFIXES = ["/masteradmin", "/orders/admin", "/procurement/admin", "/stock-returns/admin", "/reports/admin", "/coupons/admin", "/catalog/categories", "/catalog/subcategories", "/products"];

const compile = (pattern) => {
    const keys = [];
    const re = pattern.replace(/\/+$/, "").split("/").map((seg) => {
        if (seg === "*") return ".*";
        if (seg.startsWith(":")) { keys.push(seg.slice(1)); return "([^/]+)"; }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("/");
    return { keys, regex: new RegExp(`^${re}/?$`, "i") };
};
const rule = (methods, pattern, extra = {}) => ({ methods: methods === "*" ? null : methods.split(","), ...compile(pattern), ...extra });
const match = (rules, method, path) => {
    for (const r of rules) {
        if (r.methods && !r.methods.includes(method)) continue;
        const m = r.regex.exec(path);
        if (m) {
            const params = {};
            r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
            return { rule: r, params };
        }
    }
    return null;
};

// 1. Head-office only
const BLOCKED = [
    rule("*", "/masteradmin/franchise-payouts"),
    rule("*", "/masteradmin/franchises/:id/admin-payouts"),
    rule("*", "/masteradmin/cod/*"),
    rule("POST", "/masteradmin/commissions/update"),
    rule("POST", "/masteradmin/settings/update"),
    rule("POST", "/masteradmin/legal-cms"),
    rule("POST,PUT,DELETE", "/masteradmin/faqs/*"),
    rule("POST", "/masteradmin/faqs"),
    rule("*", "/masteradmin/loyalty/*"),
    rule("PUT", "/masteradmin/customers/:id/credit"),
    rule("DELETE", "/masteradmin/customers/:id"),
    rule("DELETE", "/masteradmin/franchises/:id"),
    rule("DELETE", "/masteradmin/vendors/:id"),
    rule("*", "/masteradmin/audit-logs/*"),
    rule("*", "/masteradmin/audit-logs"),
    rule("*", "/masteradmin/reports/comprehensive"),
    rule("*", "/masteradmin/subadmins/*"),
    rule("*", "/masteradmin/subadmins"),
    rule("POST,PUT,PATCH,DELETE", "/masteradmin/recommendations/*"),
    rule("POST", "/masteradmin/recommendations"),
    rule("POST,PUT,PATCH,DELETE", "/coupons/admin/*"),
    rule("POST", "/coupons/admin"),
    rule("POST,PUT,PATCH,DELETE", "/products/*"),
    rule("POST", "/products"),
    rule("POST,PUT,PATCH,DELETE", "/catalog/categories/*"),
    rule("POST", "/catalog/categories"),
    rule("POST,PUT,PATCH,DELETE", "/catalog/subcategories/*"),
    rule("POST", "/catalog/subcategories"),
];

// 2. Records opened by id
const RECORDS = [
    rule("GET,PUT", "/masteradmin/franchises/:id", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/franchises/:id/status", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/franchises/:id/service-area", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/franchises/:id/mother", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/franchises/:id/categories", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/franchises/:id/kyc-review", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/franchises/:franchiseId/category-review", { check: "franchise", param: "franchiseId" }),
    rule("GET", "/masteradmin/franchise/:id/commissions", { check: "franchise", param: "id" }),
    rule("GET,PUT,POST", "/masteradmin/inventory/franchise/:id", { check: "franchise", param: "id" }),
    rule("PUT", "/masteradmin/inventory/franchise/:id/item", { check: "franchise", param: "id" }),
    rule("POST", "/masteradmin/inventory/franchise/:id/bulk-update", { check: "franchise", param: "id" }),
    rule("GET", "/masteradmin/vendors/:id", { check: "vendor", param: "id" }),
    rule("PUT", "/masteradmin/vendors/:id/status", { check: "vendor", param: "id" }),
    rule("PUT", "/masteradmin/vendors/:id/products", { check: "vendor", param: "id" }),
    rule("PUT", "/masteradmin/vendors/:vendorId/category-review", { check: "vendor", param: "vendorId" }),
    rule("PUT", "/masteradmin/delivery-partners/:id/status", { check: "delivery", param: "id" }),
    rule("PUT", "/masteradmin/delivery-partners/:id/docs-review", { check: "delivery", param: "id" }),
    rule("GET", "/masteradmin/customers/:id", { check: "customer", param: "id" }),
    rule("GET", "/masteradmin/customers/:id/credit-history", { check: "customer", param: "id" }),
    rule("GET,PUT", "/orders/admin/:id", { check: "order", param: "id" }),
    rule("PUT", "/orders/admin/:id/status", { check: "order", param: "id" }),
    rule("POST", "/procurement/admin/from-order/:orderId", { check: "order", param: "orderId" }),
    rule("PUT", "/procurement/admin/:requestId/status", { check: "procurement", param: "requestId" }),
    rule("PUT", "/procurement/admin/:requestId/assign-mother", { check: "procurement", param: "requestId" }),
];

// 3. Lists trimmed to the admin's cities: `kind` says how to read each item; `path` where the list is
const LISTS = [
    rule("GET", "/masteradmin/franchises", { kind: "franchise" }),
    rule("GET", "/masteradmin/franchises/kyc/pending", { kind: "franchise" }),
    rule("GET", "/masteradmin/franchises/category-requests/pending", { kind: "franchise" }),
    rule("GET", "/masteradmin/franchise-service-map", { kind: "franchise" }),
    rule("GET", "/masteradmin/vendors", { kind: "vendor" }),
    rule("GET", "/masteradmin/vendors/category-requests/pending", { kind: "vendor" }),
    rule("GET", "/masteradmin/delivery-partners", { kind: "delivery" }),
    rule("GET", "/masteradmin/inventory/monitoring", { kind: "franchiseRef" }),
    rule("GET", "/masteradmin/returns", { kind: "order" }),
    rule("GET", "/masteradmin/search", { kind: "search" }),
    rule("GET", "/orders/admin/all", { kind: "order" }),
    rule("GET", "/orders/admin/delivery-tracking", { kind: "order" }),
    rule("GET", "/procurement/admin/all", { kind: "franchiseRef" }),
    rule("GET", "/procurement/admin/reports", { kind: "franchiseRef" }),
    rule("GET", "/procurement/admin/rejected-stock", { kind: "franchiseRef" }),
];

const idOf = (v) => (v && typeof v === "object" ? String(v._id || v.id || "") : String(v || ""));

async function recordAllowed(scope, check, id) {
    if (!id) return true;
    switch (check) {
        case "franchise": {
            const f = await Franchise.findById(id).select("city").lean().catch(() => null);
            return !f || franchiseInScope(scope, f);
        }
        case "vendor": {
            const v = await Vendor.findById(id).select("farmLocation").lean().catch(() => null);
            return !v || vendorInScope(scope, v);
        }
        case "order": {
            const o = await Order.findById(id).select("franchiseId shippingLocation").lean().catch(() => null);
            return !o || orderInScope(scope, o);
        }
        case "procurement": {
            const p = await ProcurementRequest.findById(id).select("franchiseId").lean().catch(() => null);
            return !p || scope.franchiseIdSet.has(idOf(p.franchiseId));
        }
        case "delivery":
            return (await deliveryIdsInScope(scope)).has(String(id));
        case "customer":
            return (await customerIdsInScope(scope)).has(String(id));
        default:
            return true;
    }
}

function itemAllowed(scope, kind, item, deliverySet) {
    if (!item || typeof item !== "object") return false;
    switch (kind) {
        case "franchise": return franchiseInScope(scope, item);
        case "vendor": return vendorInScope(scope, item);
        case "delivery": return deliverySet.has(idOf(item));
        case "franchiseRef": return scope.franchiseIdSet.has(idOf(item.franchiseId || item.franchise));
        case "order": {
            if (item.franchiseId || item.shippingLocation) return orderInScope(scope, item);
            if (item.franchise?.id) return scope.franchiseIdSet.has(idOf(item.franchise.id));
            return false;
        }
        default: return true;
    }
}

function filterPayload(scope, kind, body, deliverySet) {
    const filterArr = (arr, k = kind) => arr.filter((x) => itemAllowed(scope, k, x, deliverySet));
    if (!body || typeof body !== "object") return body;
    const out = { ...body };
    if (kind === "search" && out.result && typeof out.result === "object") {
        const r = { ...out.result };
        if (Array.isArray(r.franchises)) r.franchises = filterArr(r.franchises, "franchise");
        if (Array.isArray(r.vendors)) r.vendors = filterArr(r.vendors, "vendor");
        if (Array.isArray(r.orders)) r.orders = filterArr(r.orders, "order");
        out.result = r;
        return out;
    }
    if (Array.isArray(out.results)) out.results = filterArr(out.results);
    if (Array.isArray(out.result)) out.result = filterArr(out.result);
    if (out.result && typeof out.result === "object" && !Array.isArray(out.result)) {
        const r = { ...out.result };
        for (const key of ["items", "franchises", "vendors", "orders", "partners", "requests", "rows"]) {
            if (Array.isArray(r[key])) r[key] = filterArr(r[key]);
        }
        out.result = r;
    }
    return out;
}

const tokenAdminId = (req) => {
    try {
        const token = String(req.headers.authorization || "").split(" ")[1];
        if (!token) return null;
        return jwt.verify(token, process.env.JWT_SECRET)?.id || null;
    } catch {
        return null;
    }
};

export const cityScopeGuard = async (req, res, next) => {
    try {
        if (!ADMIN_PREFIXES.some((p) => req.path.toLowerCase().startsWith(p))) return next();
        const id = tokenAdminId(req);
        if (!id) return next(); // the route's own login check answers
        const admin = await SubAdmin.findById(id).select("role priceZoneCodes status").lean();
        const scope = await computeAdminScope(admin);
        if (!scope) return next();
        req.cityScope = scope;

        const method = req.method;
        if (match(BLOCKED, method, req.path)) return handleResponse(res, 403, HEAD_OFFICE_MSG);

        const rec = match(RECORDS, method, req.path);
        if (rec && !(await recordAllowed(scope, rec.rule.check, rec.params[rec.rule.param]))) {
            return handleResponse(res, 403, OTHER_CITY_MSG);
        }

        const list = method === "GET" ? match(LISTS, method, req.path) : null;
        if (list) {
            const deliverySet = list.rule.kind === "delivery" ? await deliveryIdsInScope(scope) : null;
            const originalJson = res.json.bind(res);
            res.json = (body) => originalJson(res.statusCode < 300 ? filterPayload(scope, list.rule.kind, body, deliverySet) : body);
        }
        return next();
    } catch (error) {
        console.error("[cityScopeGuard]", error?.message);
        // City admins fail closed (never show other cities because of an error); everyone else continues
        if (req.cityScope) return handleResponse(res, 500, "Could not check your city access. Please try again.");
        return next();
    }
};

export default cityScopeGuard;
