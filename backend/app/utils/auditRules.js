import * as S from "./auditSnapshots.js";
import { money, human, num, orderRef, short, nameOf, namesOf, list, date } from "./auditFormat.js";

/**
 * Every staff/partner action the audit log records.
 *
 *  m, p       HTTP method and path (relative to /api; ":name" matches one segment)
 *  module     section shown in the admin panel
 *  action     stable key used for filtering
 *  kind       "update" (before → after), "create", "delete", "event" (no record to compare) or "login"
 *  target     { type, id(ctx), snap(id, ctx) }  how to find and describe the record
 *  title      text or ({ changes, ctx, before, after }) => text
 *  details    (ctx) => [{label, value}]  extra lines (amounts, reasons…)
 *  severity   "info" | "important" | "critical"
 *  quietIfUnchanged  do not record an update that changed nothing
 *
 * ctx = { req, params, body, result (response data), actor }
 */

const P = (ctx, k) => ctx.params[k];
const B = (ctx, k) => ctx.body?.[k];
const R = (ctx) => ctx.result?._id || ctx.result?.id;

const changed = (changes, ...fields) => changes.some((c) => fields.includes(c.field));
const onlyChanged = (changes, ...fields) => changes.length > 0 && changes.every((c) => fields.includes(c.field));
const valueOf = (changes, field) => changes.find((c) => c.field === field);

const statusTitle = (noun) => ({ changes }) => {
    const s = valueOf(changes, "Status");
    return s ? `${noun} status changed to "${s.to}"` : `${noun} updated`;
};

const reviewTitle = (noun) => ({ ctx }) => {
    const v = String(B(ctx, "status") || B(ctx, "action") || "").toLowerCase();
    if (/approv|verif|accept|activ/.test(v)) return `${noun} approved`;
    if (/reject|declin/.test(v)) return `${noun} rejected`;
    return `${noun} reviewed`;
};

// ── Sign-in & account ────────────────────────────────────────────────────────
const loginRule = (m, p, actorType, how) => ({
    m, p, module: "Sign-in & Security", action: `${actorType}.login`, kind: "login", actorType,
    title: ({ ctx }) => (ctx.ok ? `Signed in${how ? ` ${how}` : ""}` : "Failed sign-in attempt"),
    severity: "info",
});

const passwordRule = (m, p, actorType, title) => ({
    m, p, module: "Sign-in & Security", action: `${actorType}.password`, kind: "event", actorType,
    title, severity: "important",
});

export const AUDIT_RULES = [
    // Sign-in (staff and partners only — customers are not recorded)
    loginRule("POST", "/masteradmin/login", "admin", "to the admin panel"),
    loginRule("POST", "/franchise/login", "franchise", "with password"),
    loginRule("POST", "/franchise/verify-otp", "franchise", "with OTP"),
    loginRule("POST", "/vendor/login", "vendor", "with password"),
    loginRule("POST", "/vendor/verify-otp", "vendor", "with OTP"),
    loginRule("POST", "/delivery/verify-otp", "delivery", "with OTP"),

    passwordRule("POST", "/masteradmin/change-password", "admin", "Changed own password"),
    passwordRule("POST", "/masteradmin/reset-password", "admin", "Reset password using OTP"),
    passwordRule("POST", "/franchise/change-password", "franchise", "Changed own password"),
    passwordRule("POST", "/franchise/reset-password", "franchise", "Reset password using OTP"),
    passwordRule("POST", "/vendor/change-password", "vendor", "Changed own password"),
    passwordRule("POST", "/vendor/reset-password", "vendor", "Reset password using OTP"),
    passwordRule("POST", "/delivery/reset-password", "delivery", "Reset password using OTP"),

    {
        m: "POST", p: "/masteradmin/create", module: "Team & Access", action: "admin.create", kind: "create", actorType: "admin",
        title: "Main admin account created", severity: "critical",
        details: (ctx) => [{ label: "Email", value: B(ctx, "email") || "" }],
    },

    // Registrations by partners themselves
    {
        m: "POST", p: "/franchise/register", module: "Franchise Management", action: "franchise.register", kind: "create", actorType: "franchise",
        target: { type: "Franchise", id: R, snap: S.franchiseSnap }, title: "New franchise registered", severity: "important",
    },
    {
        m: "POST", p: "/vendor/register", module: "Vendor Management", action: "vendor.register", kind: "create", actorType: "vendor",
        target: { type: "Vendor", id: R, snap: S.vendorSnap }, title: "New vendor registered", severity: "important",
    },
    {
        m: "POST", p: "/delivery/register", module: "Delivery Partners", action: "delivery.register", kind: "create", actorType: "delivery",
        target: { type: "Delivery partner", id: R, snap: S.deliverySnap }, title: "New delivery partner registered", severity: "important",
    },

    // Own profile changes
    {
        m: "PUT", p: "/masteradmin/update", module: "Team & Access", action: "admin.profile", kind: "update",
        target: { type: "Admin", id: (ctx) => ctx.actor?.id, snap: S.adminProfileSnap }, title: "Updated own admin profile", severity: "info",
    },
    {
        m: "PUT", p: "/franchise/update", module: "Franchise Management", action: "franchise.profile", kind: "update",
        target: { type: "Franchise", id: (ctx) => ctx.actor?.id, snap: S.franchiseSnap }, title: "Franchise updated its profile", severity: "info",
    },
    {
        m: "POST", p: "/franchise/upload-documents", module: "Franchise Management", action: "franchise.documents", kind: "update",
        target: { type: "Franchise", id: (ctx) => ctx.actor?.id, snap: S.franchiseSnap }, title: "Franchise uploaded documents", severity: "info",
    },
    {
        m: "POST", p: "/franchise/kyc/submit", module: "Franchise Management", action: "franchise.kyc", kind: "update",
        target: { type: "Franchise", id: (ctx) => ctx.actor?.id, snap: S.franchiseSnap }, title: "Franchise submitted KYC for approval", severity: "important",
    },
    {
        m: "PUT", p: "/franchise/qr-code", module: "Franchise Management", action: "franchise.qr", kind: "update",
        target: { type: "Franchise", id: (ctx) => ctx.actor?.id, snap: S.franchiseSnap }, title: "Store payment QR code changed", severity: "important",
    },
    {
        m: "POST", p: "/franchise/availability", module: "Franchise Management", action: "franchise.availability", kind: "update", quietIfUnchanged: true,
        target: { type: "Franchise", id: (ctx) => ctx.actor?.id, snap: S.franchiseAvailabilitySnap },
        title: ({ changes }) => (valueOf(changes, "Taking orders")?.to === "Yes" ? "Store started taking orders" : "Store stopped taking orders"),
    },
    {
        m: "PUT", p: "/vendor/update", module: "Vendor Management", action: "vendor.profile", kind: "update",
        target: { type: "Vendor", id: (ctx) => ctx.actor?.id, snap: S.vendorSnap }, title: "Vendor updated their profile",
    },
    {
        m: "DELETE", p: "/vendor/delete-account", module: "Vendor Management", action: "vendor.delete_self", kind: "delete",
        target: { type: "Vendor", id: (ctx) => ctx.actor?.id, snap: S.vendorSnap }, title: "Vendor deleted their own account", severity: "critical",
    },
    {
        m: "PUT", p: "/delivery/profile", module: "Delivery Partners", action: "delivery.profile", kind: "update",
        target: { type: "Delivery partner", id: (ctx) => ctx.actor?.id, snap: S.deliverySnap }, title: "Delivery partner updated their profile",
    },
    {
        m: "PUT", p: "/delivery/profile/documents", module: "Delivery Partners", action: "delivery.documents", kind: "update",
        target: { type: "Delivery partner", id: (ctx) => ctx.actor?.id, snap: S.deliverySnap }, title: "Delivery partner sent new documents for review", severity: "important",
    },
    {
        m: "DELETE", p: "/delivery/delete-account", module: "Delivery Partners", action: "delivery.delete_self", kind: "delete",
        target: { type: "Delivery partner", id: (ctx) => ctx.actor?.id, snap: S.deliverySnap }, title: "Delivery partner deleted their own account", severity: "critical",
    },
    {
        m: "PUT", p: "/delivery/availability", module: "Delivery Partners", action: "delivery.availability", kind: "update", quietIfUnchanged: true,
        target: { type: "Delivery partner", id: (ctx) => ctx.actor?.id, snap: S.deliveryAvailabilitySnap },
        title: ({ changes }) => (valueOf(changes, "Availability")?.to === "Online" ? "Went online for deliveries" : "Went offline"),
    },

    // ── Products & catalogue ────────────────────────────────────────────────────
    {
        m: "POST", p: "/products/import", module: "Product Management", action: "product.import", kind: "event",
        title: "Products imported from Excel", severity: "important",
        details: (ctx) => {
            const r = ctx.result || {};
            return [
                { label: "File", value: ctx.req.file?.originalname || "" },
                { label: "Added", value: num(r.created ?? r.inserted ?? r.createdCount) },
                { label: "Updated", value: num(r.updated ?? r.updatedCount) },
                { label: "Skipped", value: num(r.skipped ?? r.failed ?? (Array.isArray(r.errors) ? r.errors.length : undefined)) },
            ];
        },
    },
    {
        m: "POST", p: "/products", module: "Product Management", action: "product.create", kind: "create",
        target: { type: "Product", id: R, snap: S.productSnap }, title: "New product added", severity: "important",
    },
    {
        m: "PUT", p: "/products/:id", module: "Product Management", action: "product.update", kind: "update",
        target: { type: "Product", id: (ctx) => P(ctx, "id"), snap: S.productSnap },
        severity: ({ changes }) => (changed(changes, "Price", "MRP", "Best rate", "Bulk prices") ? "important" : "info"),
        title: ({ changes }) => {
            if (onlyChanged(changes, "Price", "MRP", "Best rate", "Bulk prices")) return "Product price has been changed";
            if (onlyChanged(changes, "Stock")) return "Product stock has been changed";
            if (onlyChanged(changes, "Status", "Visible", "Shown on customer app", "Available in store billing (POS)", "Home page sections")) return "Product visibility has been changed";
            if (onlyChanged(changes, "Photo", "Other photos")) return "Product photos have been changed";
            if (changed(changes, "Price", "MRP", "Best rate", "Bulk prices")) return "Product price and details have been changed";
            return "Product details have been changed";
        },
    },
    {
        m: "DELETE", p: "/products/:id", module: "Product Management", action: "product.delete", kind: "delete",
        target: { type: "Product", id: (ctx) => P(ctx, "id"), snap: S.productSnap }, title: "Product deleted", severity: "critical",
    },
    {
        m: "POST", p: "/catalog/categories", module: "Categories", action: "category.create", kind: "create",
        target: { type: "Category", id: R, snap: S.categorySnap }, title: "New category added",
    },
    {
        m: "PUT", p: "/catalog/categories/:id", module: "Categories", action: "category.update", kind: "update",
        target: { type: "Category", id: (ctx) => P(ctx, "id"), snap: S.categorySnap },
        title: ({ changes }) => (onlyChanged(changes, "Admin commission") ? "Category commission changed" : "Category updated"),
        severity: ({ changes }) => (changed(changes, "Admin commission") ? "important" : "info"),
    },
    {
        m: "DELETE", p: "/catalog/categories/:id", module: "Categories", action: "category.delete", kind: "delete",
        target: { type: "Category", id: (ctx) => P(ctx, "id"), snap: S.categorySnap }, title: "Category deleted", severity: "critical",
    },
    {
        m: "POST", p: "/catalog/subcategories", module: "Categories", action: "subcategory.create", kind: "create",
        target: { type: "Subcategory", id: R, snap: S.subcategorySnap }, title: "New subcategory added",
    },
    {
        m: "PUT", p: "/catalog/subcategories/:id", module: "Categories", action: "subcategory.update", kind: "update",
        target: { type: "Subcategory", id: (ctx) => P(ctx, "id"), snap: S.subcategorySnap }, title: "Subcategory updated",
    },
    {
        m: "DELETE", p: "/catalog/subcategories/:id", module: "Categories", action: "subcategory.delete", kind: "delete",
        target: { type: "Subcategory", id: (ctx) => P(ctx, "id"), snap: S.subcategorySnap }, title: "Subcategory deleted", severity: "important",
    },
    {
        m: "POST", p: "/masteradmin/recommendations", module: "Product Management", action: "recommendation.create", kind: "create",
        target: { type: "Product suggestions", id: R, snap: S.recommendationSnap }, title: "Product suggestions added",
    },
    {
        m: "PUT", p: "/masteradmin/recommendations/:id", module: "Product Management", action: "recommendation.update", kind: "update",
        target: { type: "Product suggestions", id: (ctx) => P(ctx, "id"), snap: S.recommendationSnap }, title: "Product suggestions changed",
    },
    {
        m: "PATCH", p: "/masteradmin/recommendations/:id/toggle", module: "Product Management", action: "recommendation.toggle", kind: "update",
        target: { type: "Product suggestions", id: (ctx) => P(ctx, "id"), snap: S.recommendationSnap },
        title: ({ changes }) => (valueOf(changes, "Active")?.to === "Yes" ? "Product suggestions turned on" : "Product suggestions turned off"),
    },
    {
        m: "DELETE", p: "/masteradmin/recommendations/:id", module: "Product Management", action: "recommendation.delete", kind: "delete",
        target: { type: "Product suggestions", id: (ctx) => P(ctx, "id"), snap: S.recommendationSnap }, title: "Product suggestions removed",
    },

    // ── Coupons ─────────────────────────────────────────────────────────────────
    {
        m: "POST", p: "/coupons/admin", module: "Coupons & Offers", action: "coupon.create", kind: "create",
        target: { type: "Coupon", id: R, snap: S.couponSnap }, title: "New coupon created", severity: "important",
    },
    {
        m: "PUT", p: "/coupons/admin/:id", module: "Coupons & Offers", action: "coupon.update", kind: "update",
        target: { type: "Coupon", id: (ctx) => P(ctx, "id"), snap: S.couponSnap },
        title: ({ changes }) => (onlyChanged(changes, "Discount", "Maximum discount", "Minimum order") ? "Coupon discount has been changed" : "Coupon updated"),
        severity: "important",
    },
    {
        m: "DELETE", p: "/coupons/admin/:id", module: "Coupons & Offers", action: "coupon.delete", kind: "delete",
        target: { type: "Coupon", id: (ctx) => P(ctx, "id"), snap: S.couponSnap }, title: "Coupon deleted", severity: "important",
    },

    // ── Vendors ─────────────────────────────────────────────────────────────────
    {
        m: "POST", p: "/masteradmin/vendors", module: "Vendor Management", action: "vendor.create", kind: "create",
        target: { type: "Vendor", id: R, snap: S.vendorSnap }, title: "Vendor added by admin", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/vendors/:id/status", module: "Vendor Management", action: "vendor.status", kind: "update",
        target: { type: "Vendor", id: (ctx) => P(ctx, "id"), snap: S.vendorSnap }, title: statusTitle("Vendor"), severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/vendors/:id/products", module: "Vendor Management", action: "vendor.products", kind: "update",
        target: { type: "Vendor", id: (ctx) => P(ctx, "id"), snap: S.vendorProductsSnap }, title: "Products assigned to vendor changed", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/vendors/:vendorId/category-review", module: "Approvals", action: "vendor.category_review", kind: "update",
        target: { type: "Vendor", id: (ctx) => P(ctx, "vendorId"), snap: S.vendorSnap }, title: reviewTitle("Vendor category request"), severity: "important",
        details: async (ctx) => [{ label: "Category", value: await nameOf("Category", B(ctx, "categoryId")) }],
    },
    {
        m: "DELETE", p: "/masteradmin/vendors/:id", module: "Vendor Management", action: "vendor.delete", kind: "delete",
        target: { type: "Vendor", id: (ctx) => P(ctx, "id"), snap: S.vendorSnap }, title: "Vendor deleted", severity: "critical",
    },
    {
        m: "PUT", p: "/vendor/inventory/stock", module: "Vendor Stock", action: "vendor.stock", kind: "update",
        target: { type: "Product", id: (ctx) => B(ctx, "productId"), snap: (id, ctx) => S.vendorStockSnap(ctx.actor?.id, id) },
        title: "Vendor stock has been changed",
    },
    {
        m: "PUT", p: "/vendor/inventory/toggle-availability", module: "Vendor Stock", action: "vendor.availability", kind: "update",
        target: { type: "Product", id: (ctx) => B(ctx, "productId"), snap: (id, ctx) => S.vendorStockSnap(ctx.actor?.id, id) },
        title: ({ changes }) => (valueOf(changes, "Available")?.to === "Yes" ? "Vendor marked product as available" : "Vendor marked product as unavailable"),
    },

    // ── Franchises ──────────────────────────────────────────────────────────────
    {
        m: "POST", p: "/masteradmin/franchises", module: "Franchise Management", action: "franchise.create", kind: "create",
        target: { type: "Franchise", id: R, snap: S.franchiseSnap }, title: "Franchise added by admin", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/franchises/:id/status", module: "Franchise Management", action: "franchise.status", kind: "update",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: S.franchiseSnap }, title: statusTitle("Franchise"), severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/franchises/:id/service-area", module: "Franchise Management", action: "franchise.service_area", kind: "update",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: S.franchiseSnap }, title: "Franchise delivery area changed", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/franchises/:id/categories", module: "Franchise Management", action: "franchise.categories", kind: "update",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: S.franchiseSnap }, title: "Franchise categories changed", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/franchises/:id/kyc-review", module: "Approvals", action: "franchise.kyc_review", kind: "update",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: S.franchiseSnap }, title: reviewTitle("Franchise KYC"), severity: "important",
        details: (ctx) => [{ label: "Reason", value: short(B(ctx, "rejectionReason")) }],
    },
    {
        m: "PUT", p: "/masteradmin/franchises/:franchiseId/category-review", module: "Approvals", action: "franchise.category_review", kind: "update",
        target: { type: "Franchise", id: (ctx) => P(ctx, "franchiseId"), snap: S.franchiseSnap }, title: reviewTitle("Franchise category request"), severity: "important",
        details: async (ctx) => [{ label: "Category", value: await nameOf("Category", B(ctx, "categoryId")) }],
    },
    {
        m: "PUT", p: "/masteradmin/franchises/:id", module: "Franchise Management", action: "franchise.update", kind: "update",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: S.franchiseSnap }, title: "Franchise details changed by admin", severity: "important",
    },
    {
        m: "DELETE", p: "/masteradmin/franchises/:id", module: "Franchise Management", action: "franchise.delete", kind: "delete",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: S.franchiseSnap }, title: "Franchise deleted", severity: "critical",
    },
    {
        m: "POST", p: "/masteradmin/commissions/update", module: "Payments & Payouts", action: "franchise.commission", kind: "update",
        target: { type: "Franchise commission", id: (ctx) => B(ctx, "franchiseId"), snap: (id, ctx) => S.commissionSnap(id, B(ctx, "categoryId")) },
        title: "Franchise commission has been changed", severity: "important",
    },
    {
        m: "POST", p: "/masteradmin/franchises/:id/admin-payouts", module: "Payments & Payouts", action: "franchise.payout", kind: "event",
        target: { type: "Franchise", id: (ctx) => P(ctx, "id"), snap: async (id) => ({ label: await nameOf("Franchise", id, "franchiseName"), values: {} }) },
        title: "Payout recorded for franchise", severity: "important",
        details: (ctx) => [
            { label: "Amount", value: money(B(ctx, "amount")) },
            { label: "Paid on", value: date(B(ctx, "paidAt") || new Date()) },
            { label: "Reference", value: B(ctx, "reference") || "" },
            { label: "Note", value: short(B(ctx, "note")) },
        ],
    },

    // ── Franchise stock (changed by admin) ─────────────────────────────────────
    {
        m: "PUT", p: "/masteradmin/inventory/franchise/:id/item", module: "Franchise Stock", action: "franchise.stock", kind: "update",
        target: { type: "Franchise stock", id: (ctx) => P(ctx, "id"), snap: (id, ctx) => S.franchiseInventorySnap(id, [B(ctx, "productId")]) },
        title: ({ changes }) => (onlyChanged(changes, "Store price") ? "Store price has been changed" : "Franchise stock has been changed"),
        severity: "important",
    },
    {
        m: "POST", p: "/masteradmin/inventory/franchise/:id/bulk-update", module: "Franchise Stock", action: "franchise.stock_bulk", kind: "update",
        target: {
            type: "Franchise stock", id: (ctx) => P(ctx, "id"),
            snap: (id, ctx) => S.franchiseInventorySnap(id, (B(ctx, "items") || []).map((i) => i?.productId)),
        },
        title: "Franchise stock updated in bulk", severity: "important",
    },

    // ── Delivery partners (admin) ───────────────────────────────────────────────
    {
        m: "PUT", p: "/masteradmin/delivery-partners/:id/status", module: "Delivery Partners", action: "delivery.status", kind: "update",
        target: { type: "Delivery partner", id: (ctx) => P(ctx, "id"), snap: S.deliverySnap },
        title: ({ changes }) => {
            const a = valueOf(changes, "Approved");
            if (a) return a.to === "Yes" ? "Delivery partner approved" : "Delivery partner approval removed";
            return statusTitle("Delivery partner")({ changes });
        },
        severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/delivery-partners/:id/docs-review", module: "Approvals", action: "delivery.docs_review", kind: "update",
        target: { type: "Delivery partner", id: (ctx) => P(ctx, "id"), snap: S.deliverySnap }, title: reviewTitle("Delivery partner documents"), severity: "important",
        details: (ctx) => [{ label: "Reason", value: short(B(ctx, "reason")) }],
    },

    // ── Customers (changed by admin) ────────────────────────────────────────────
    {
        m: "PUT", p: "/masteradmin/customers/:id/credit", module: "Customer Credit", action: "customer.credit", kind: "update",
        target: { type: "Customer", id: (ctx) => P(ctx, "id"), snap: S.customerSnap },
        title: ({ changes }) => {
            const status = (changes || []).find((c) => c.field === "Credit status");
            if (status) return String(status.to).startsWith("Blocked") ? "Customer credit has been blocked" : "Customer credit has been unblocked";
            return onlyChanged(changes, "Credit limit") ? "Customer credit limit has been changed" : "Customer credit has been changed";
        },
        details: (ctx) => [{ label: "Reason", value: short(B(ctx, "reason") || B(ctx, "creditBlockReason")) }],
        severity: "critical",
    },
    {
        m: "DELETE", p: "/masteradmin/customers/:id", module: "Customer Credit", action: "customer.delete", kind: "delete",
        target: { type: "Customer", id: (ctx) => P(ctx, "id"), snap: S.customerSnap }, title: "Customer account deleted", severity: "critical",
    },

    // ── Cash (COD) deposits ─────────────────────────────────────────────────────
    {
        m: "POST", p: "/delivery/cod/remittance", module: "Cash Deposits", action: "cod.submit", kind: "create",
        target: { type: "Cash deposit", id: R, snap: S.remittanceSnap }, title: "Cash collected from customers deposited", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/cod/remittances/:remittanceId/review", module: "Cash Deposits", action: "cod.review", kind: "update",
        target: { type: "Cash deposit", id: (ctx) => P(ctx, "remittanceId"), snap: S.remittanceSnap }, title: reviewTitle("Cash deposit"), severity: "important",
    },

    // ── Settings & content ─────────────────────────────────────────────────────
    {
        m: "POST", p: "/masteradmin/settings/update", module: "Settings", action: "settings.update", kind: "update",
        target: { type: "Setting", id: (ctx) => B(ctx, "key"), snap: S.settingSnap },
        title: ({ ctx }) => `Setting changed: ${human(B(ctx, "key"))}`, severity: "critical",
    },
    {
        m: "POST", p: "/masteradmin/legal-cms", module: "Settings", action: "settings.legal", kind: "event",
        title: ({ ctx }) => `${human(B(ctx, "section")) || "Legal page"} text updated`, severity: "important",
    },
    {
        m: "POST", p: "/masteradmin/faqs", module: "Settings", action: "faq.create", kind: "create",
        target: { type: "FAQ", id: R, snap: S.faqSnap }, title: "FAQ added",
    },
    {
        m: "PUT", p: "/masteradmin/faqs/:id", module: "Settings", action: "faq.update", kind: "update",
        target: { type: "FAQ", id: (ctx) => P(ctx, "id"), snap: S.faqSnap }, title: "FAQ changed",
    },
    {
        m: "DELETE", p: "/masteradmin/faqs/:id", module: "Settings", action: "faq.delete", kind: "delete",
        target: { type: "FAQ", id: (ctx) => P(ctx, "id"), snap: S.faqSnap }, title: "FAQ deleted",
    },

    // ── Team (sub-admins) ──────────────────────────────────────────────────────
    {
        m: "POST", p: "/masteradmin/subadmins", module: "Team & Access", action: "subadmin.create", kind: "create",
        target: { type: "Team member", id: R, snap: S.subAdminSnap }, title: "New team member added", severity: "critical",
    },
    {
        m: "PUT", p: "/masteradmin/subadmins/:id", module: "Team & Access", action: "subadmin.update", kind: "update",
        target: { type: "Team member", id: (ctx) => P(ctx, "id"), snap: S.subAdminSnap },
        title: ({ changes }) => (onlyChanged(changes, "Access") ? "Team member's access changed" : changed(changes, "Status") ? statusTitle("Team member")({ changes }) : "Team member details changed"),
        severity: "critical",
        details: (ctx) => (B(ctx, "password") ? [{ label: "Password", value: "Changed by admin" }] : []),
    },
    {
        m: "DELETE", p: "/masteradmin/subadmins/:id", module: "Team & Access", action: "subadmin.delete", kind: "delete",
        target: { type: "Team member", id: (ctx) => P(ctx, "id"), snap: S.subAdminSnap }, title: "Team member removed", severity: "critical",
    },

    // ── Orders ──────────────────────────────────────────────────────────────────
    {
        m: "PUT", p: "/orders/admin/:id/status", module: "Orders", action: "order.status", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: statusTitle("Order"),
        severity: ({ changes }) => (valueOf(changes, "Status")?.to === "Cancelled" ? "critical" : "important"),
    },
    {
        m: "PUT", p: "/orders/franchise/:id/accept", module: "Orders", action: "order.accept", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: "Store accepted the order",
    },
    {
        m: "PUT", p: "/orders/franchise/:id/reject", module: "Orders", action: "order.reject", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: "Store rejected the order", severity: "important",
        details: (ctx) => [{ label: "Reason", value: short(B(ctx, "reason")) }],
    },
    {
        m: "PUT", p: "/orders/franchise/:id/assign-delivery", module: "Orders", action: "order.assign", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: "Delivery partner assigned to order",
    },
    {
        m: "PUT", p: "/orders/franchise/:id/status", module: "Orders", action: "order.status", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: statusTitle("Order"),
        severity: ({ changes }) => (valueOf(changes, "Status")?.to === "Cancelled" ? "critical" : "info"),
    },
    {
        m: "PUT", p: "/orders/franchise/:id/returns/:requestIndex/review", module: "Returns", action: "return.review", kind: "update",
        target: { type: "Return", id: (ctx) => P(ctx, "id"), snap: (id, ctx) => S.returnSnap(id, P(ctx, "requestIndex")) },
        title: reviewTitle("Return request"), severity: "important",
    },
    {
        m: "PUT", p: "/orders/franchise/:id/returns/:requestIndex/assign-pickup", module: "Returns", action: "return.assign", kind: "update",
        target: { type: "Return", id: (ctx) => P(ctx, "id"), snap: (id, ctx) => S.returnSnap(id, P(ctx, "requestIndex")) },
        title: "Pickup partner assigned to return",
    },
    {
        m: "PUT", p: "/orders/delivery/:id/reject", module: "Orders", action: "order.delivery_reject", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: "Delivery partner declined the order",
        details: (ctx) => [{ label: "Reason", value: short(B(ctx, "reason")) }],
    },
    {
        m: "PUT", p: "/orders/delivery/:id/status", module: "Orders", action: "order.status", kind: "update",
        target: { type: "Order", id: (ctx) => P(ctx, "id"), snap: S.orderSnap }, title: statusTitle("Order"),
    },
    {
        m: "PUT", p: "/orders/delivery/return-pickups/:id/:requestIndex/status", module: "Returns", action: "return.pickup", kind: "update",
        target: { type: "Return", id: (ctx) => P(ctx, "id"), snap: (id, ctx) => S.returnSnap(id, P(ctx, "requestIndex")) },
        title: ({ changes }) => {
            const s = valueOf(changes, "Return status");
            return s ? `Return pickup marked "${s.to}"` : "Return pickup updated";
        },
    },

    // ── Stock requests (procurement) ───────────────────────────────────────────
    {
        m: "POST", p: "/procurement/franchise/create", module: "Stock Requests", action: "procurement.create", kind: "create",
        target: { type: "Stock request", id: R, snap: S.procurementSnap }, title: "Store requested new stock",
    },
    {
        m: "PUT", p: "/procurement/franchise/:requestId/receive", module: "Stock Requests", action: "procurement.receive", kind: "update",
        target: { type: "Stock request", id: (ctx) => P(ctx, "requestId"), snap: S.procurementSnap }, title: "Store confirmed stock received", severity: "important",
    },
    {
        m: "POST", p: "/procurement/vendor/:requestId/quote", module: "Stock Requests", action: "procurement.quote", kind: "update",
        target: { type: "Stock request", id: (ctx) => P(ctx, "requestId"), snap: S.procurementSnap },
        title: ({ before }) => (before?.values?.Status === "Negotiating" ? "Vendor sent a counter-offer" : "Vendor sent a price quote"),
        severity: "important",
    },
    {
        m: "POST", p: "/procurement/vendor/:requestId/offer/accept", module: "Stock Requests", action: "procurement.offer_accept", kind: "update",
        target: { type: "Stock request", id: (ctx) => P(ctx, "requestId"), snap: S.procurementSnap },
        title: "Vendor accepted the admin's rate", severity: "important",
    },
    {
        m: "POST", p: "/procurement/vendor/:requestId/offer/decline", module: "Stock Requests", action: "procurement.offer_decline", kind: "update",
        target: { type: "Stock request", id: (ctx) => P(ctx, "requestId"), snap: S.procurementSnap },
        title: "Vendor declined the admin's rate", severity: "important",
        details: (ctx) => [{ label: "Note", value: short(B(ctx, "note")) }],
    },
    {
        m: "PUT", p: "/procurement/vendor/:requestId/status", module: "Stock Requests", action: "procurement.vendor_status", kind: "update",
        target: { type: "Stock request", id: (ctx) => P(ctx, "requestId"), snap: S.procurementSnap }, title: statusTitle("Stock request"),
    },
    {
        m: "PUT", p: "/procurement/admin/:requestId/status", module: "Stock Requests", action: "procurement.admin_status", kind: "update",
        target: { type: "Stock request", id: (ctx) => P(ctx, "requestId"), snap: S.procurementSnap },
        title: ({ changes }) => {
            if (valueOf(changes, "Status")?.to === "Negotiating") return "Admin offered the vendor a different rate";
            return changed(changes, "Vendor") && !changed(changes, "Status") ? "Vendor assigned to stock request" : statusTitle("Stock request")({ changes });
        },
        severity: "important",
    },
    {
        m: "POST", p: "/procurement/admin/from-order/:orderId", module: "Stock Requests", action: "procurement.from_order", kind: "create",
        target: { type: "Stock request", id: R, snap: S.procurementSnap }, title: "Stock request created from a customer order",
        details: (ctx) => [{ label: "Order", value: orderRef(P(ctx, "orderId")) }],
    },

    // ── City rates (price codes) ─────────────────────────────────────────────────
    {
        m: "POST", p: "/masteradmin/city-rates/zones", module: "City Rates", action: "zone.create", kind: "create",
        target: { type: "City code", id: (ctx) => B(ctx, "code") && String(B(ctx, "code")).toUpperCase(), snap: S.priceZoneSnap },
        title: "New city price code created", severity: "important",
    },
    {
        m: "PUT", p: "/masteradmin/city-rates/zones/:code", module: "City Rates", action: "zone.update", kind: "update",
        target: { type: "City code", id: (ctx) => P(ctx, "code"), snap: S.priceZoneSnap },
        title: "City price code changed", severity: "important",
    },
    {
        m: "DELETE", p: "/masteradmin/city-rates/zones/:code", module: "City Rates", action: "zone.delete", kind: "delete",
        target: { type: "City code", id: (ctx) => P(ctx, "code"), snap: S.priceZoneSnap },
        title: "City price code deleted (its franchises now use the main rates)", severity: "critical",
    },
    {
        m: "PUT", p: "/masteradmin/city-rates/zones/:code/rates", module: "City Rates", action: "zone.rates", kind: "update",
        target: {
            type: "City rates", id: (ctx) => P(ctx, "code"),
            snap: (code, ctx) => S.zoneRatesSnap(code, (B(ctx, "items") || []).map((i) => i?.productId)),
        },
        title: ({ changes }) => (changes.every((c) => /Rate$/.test(c.field)) ? "City rate has been changed" : "City rates have been changed"),
        severity: "important",
    },

    // ── Store billing (POS) ─────────────────────────────────────────────────────
    {
        m: "POST", p: "/franchise/pos/sale", module: "Store Billing (POS)", action: "pos.sale", kind: "event",
        title: "Walk-in sale billed at store",
        details: async (ctx) => {
            const r = ctx.result || {};
            const items = Array.isArray(r.items) ? r.items : Array.isArray(B(ctx, "items")) ? B(ctx, "items") : [];
            const names = items.map((i) => i.name).filter(Boolean);
            const fallback = names.length ? names : await namesOf("Product", items.map((i) => i.productId));
            return [
                { label: "Bill total", value: money(r.totalAmount ?? r.total ?? r.grandTotal) },
                { label: "Paid by", value: human(B(ctx, "paymentMethod")) },
                { label: "Items", value: list(fallback) },
            ];
        },
    },
];

