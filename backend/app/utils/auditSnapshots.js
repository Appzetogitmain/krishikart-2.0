import {
    M, isId, money, per, yesNo, onOff, pct, num, date, human, short, list, orderRef, fingerprint, namesOf, nameOf, flattenSetting,
} from "./auditFormat.js";

/**
 * Snapshots: read one record and describe it as {label, values: {Field: text}}.
 * The audit log compares the snapshot taken before a change with the one taken after.
 */

const byId = async (modelName, id, populate) => {
    const Model = M(modelName);
    if (!Model || !isId(id)) return null;
    let q = Model.findById(id);
    if (populate) q = q.populate(populate);
    return q.lean();
};

export const productSnap = async (id) => {
    const p = await byId("Product", id, [{ path: "category", select: "name" }, { path: "subcategory", select: "name" }]);
    if (!p) return null;
    const unit = p.unit || "";
    const bulk = Array.isArray(p.bulkPricing) && p.bulkPricing.length
        ? p.bulkPricing.map((b) => `${num(b.minQty)}+ ${unit}: ${per(b.price, unit)}`).join(", ")
        : "None";
    return {
        label: p.name,
        values: {
            Name: p.name,
            Price: per(p.price, unit),
            MRP: per(p.comparePrice, unit),
            "Best rate": p.bestPrice ? per(p.bestPrice, unit) : "",
            Stock: num(p.stock, unit),
            "Sold in": [num(p.unitValue), unit].filter(Boolean).join(" "),
            "Minimum quantity": num(p.minQty),
            "Bulk prices": bulk,
            Category: p.category?.name || "",
            Subcategory: p.subcategory?.name || "",
            Status: human(p.status || "active"),
            Visible: yesNo(p.isVisible ?? true),
            "Shown on customer app": yesNo(p.showOnStorefront ?? true),
            "Available in store billing (POS)": yesNo(p.showOnPOS ?? true),
            "Home page sections": list((p.homeSections || []).map(human)),
            Type: human(p.dietaryType),
            "SKU code": p.skuCode || "",
            Description: short(p.description),
            Photo: fingerprint(p.primaryImage),
            "Other photos": fingerprint(p.images),
        },
    };
};

export const categorySnap = async (id) => {
    const c = await byId("Category", id);
    if (!c) return null;
    return {
        label: c.name,
        values: {
            Name: c.name,
            Description: short(c.description),
            Visible: yesNo(c.isVisible ?? true),
            "Admin commission": pct(c.adminCommission),
            Photo: fingerprint(c.image),
        },
    };
};

export const subcategorySnap = async (id) => {
    const s = await byId("Subcategory", id, { path: "category", select: "name" });
    if (!s) return null;
    return {
        label: s.name,
        values: { Name: s.name, Category: s.category?.name || "", Visible: yesNo(s.isVisible), Photo: fingerprint(s.image) },
    };
};

export const couponSnap = async (id) => {
    const c = await byId("Coupon", id);
    if (!c) return null;
    const isPct = /percent/i.test(c.type || "");
    return {
        label: c.code,
        values: {
            Code: c.code,
            Title: c.title || "",
            Type: human(c.type),
            Discount: c.value === undefined ? "" : isPct ? pct(c.value) : money(c.value),
            "Minimum order": money(c.minOrderValue),
            "Maximum discount": money(c.maxDiscount),
            "Starts on": date(c.startDate),
            "Ends on": date(c.endDate),
            "Total uses allowed": num(c.usageLimit),
            "Uses per customer": num(c.usageLimitPerUser),
            "First order only": yesNo(c.isFirstTimeUserOnly),
            "Shown to customers": yesNo(c.isVisible ?? true),
            Status: human(c.status),
        },
    };
};

export const recommendationSnap = async (id) => {
    const r = await byId("ProductRecommendation", id);
    if (!r) return null;
    const source = await nameOf("Product", r.sourceProduct);
    return {
        label: source ? `Suggestions for ${source}` : "Product suggestions",
        values: {
            Product: source,
            "Suggested products": list(await namesOf("Product", r.recommendedProducts)),
            Heading: r.label || "",
            Active: yesNo(r.isActive ?? true),
        },
    };
};

export const vendorSnap = async (id) => {
    const v = await byId("Vendor", id);
    if (!v) return null;
    return {
        label: v.fullName,
        values: {
            Name: v.fullName,
            Email: v.email || "",
            Mobile: v.mobile || "",
            "Farm location": short(v.farmLocation, 80),
            Status: human(v.status),
            "Approved categories": list(await namesOf("Category", v.servedCategories)),
            "Requested categories": list(await namesOf("Category", v.requestedCategories)),
            "Assigned products": `${(v.products || []).length} products`,
            "Bank details": fingerprint(v.bankDetails),
            "Profile photo": fingerprint(v.profilePicture),
            Documents: fingerprint([v.aadharCard, v.panCard, v.fssaiLicense, v.fssaiImage, v.shopEstablishmentProof]),
        },
    };
};

export const vendorProductsSnap = async (id) => {
    const v = await byId("Vendor", id);
    if (!v) return null;
    return { label: v.fullName, values: { "Assigned products": list(await namesOf("Product", v.products), 25) } };
};

export const franchiseSnap = async (id) => {
    const f = await byId("Franchise", id);
    if (!f) return null;
    return {
        label: f.franchiseName || f.ownerName,
        values: {
            "Store name": f.franchiseName || "",
            Owner: f.ownerName || "",
            Mobile: f.mobile || "",
            Email: f.email || "",
            Area: f.area || "",
            City: f.city || "",
            State: f.state || "",
            Address: short(f.formattedAddress, 120),
            Status: human(f.status),
            "Approved by admin": yesNo(f.isVerified),
            "KYC status": human(f.kyc?.status),
            Active: yesNo(f.isActive),
            "Taking orders": yesNo(f.isOnline),
            "Approved categories": list(await namesOf("Category", f.servedCategories)),
            "Requested categories": list(await namesOf("Category", f.requestedCategories)),
            "Delivery area": `${(f.serviceHexagons || []).length} zones`,
            "Payment QR code": fingerprint(f.storeQRCode),
            "Profile photo": fingerprint(f.profilePicture),
            Documents: fingerprint([f.documents, f.kyc?.aadhaarImage, f.kyc?.panImage, f.kyc?.fssaiCertificate, f.kyc?.shopEstablishmentCertificate]),
            "GST number": f.kyc?.gstNumber || "",
            "FSSAI number": f.kyc?.fssaiNumber || "",
        },
    };
};

export const deliverySnap = async (id) => {
    const d = await byId("Delivery", id);
    if (!d) return null;
    return {
        label: d.fullName,
        values: {
            Name: d.fullName,
            Mobile: d.mobile || "",
            Vehicle: [human(d.vehicleType), d.vehicleNumber].filter(Boolean).join(" · "),
            Status: human(d.status),
            Approved: yesNo(d.isApproved),
            "Approval status": human(d.approvalStatus),
            Availability: onOff(d.isOnline),
            "Documents waiting for review": d.pendingDocs && Object.values(d.pendingDocs).some(Boolean) ? "Yes" : "No",
            Documents: fingerprint([d.aadharImage, d.panImage, d.licenseImage]),
        },
    };
};

export const deliveryAvailabilitySnap = async (id) => {
    const d = await byId("Delivery", id);
    return d ? { label: d.fullName, values: { Availability: onOff(d.isOnline) } } : null;
};

export const franchiseAvailabilitySnap = async (id) => {
    const f = await byId("Franchise", id);
    return f ? { label: f.franchiseName, values: { "Taking orders": yesNo(f.isOnline) } } : null;
};

export const customerSnap = async (id) => {
    const u = await byId("User", id);
    if (!u) return null;
    return {
        label: u.fullName || u.mobile,
        values: {
            Name: u.fullName || "",
            Mobile: u.mobile || "",
            "Credit limit": money(u.creditLimit),
            "Credit used": money(u.usedCredit),
            "Credit due date": date(u.creditOverdueDate),
            "Credit status": u.creditBlocked ? `Blocked${u.creditBlockedReason ? ` (${u.creditBlockedReason})` : ""}` : "Active",
            "Wallet balance": money(u.walletBalance),
        },
    };
};

export const subAdminSnap = async (id) => {
    const s = await byId("SubAdmin", id);
    if (!s) return null;
    return {
        label: s.fullName,
        values: {
            Name: s.fullName,
            Email: s.email || "",
            Mobile: s.mobile || "",
            Access: list((s.permissions || []).map(human), 30),
            Status: human(s.status),
        },
    };
};

export const adminProfileSnap = async (id) => {
    const a = (await byId("MasterAdmin", id)) || (await byId("SubAdmin", id));
    if (!a) return null;
    return {
        label: a.fullName,
        values: { Name: a.fullName || "", Email: a.email || "", Mobile: a.mobile || "", "Operational zone": a.operationalZone || "" },
    };
};

export const faqSnap = async (id) => {
    const f = await byId("FAQ", id);
    if (!f) return null;
    return {
        label: short(f.question, 80),
        values: {
            Question: short(f.question, 200),
            Answer: short(f.answer, 200),
            Section: f.category || "",
            "Shown to": human(f.audience),
            Position: num(f.displayOrder),
            Status: human(f.status),
        },
    };
};

export const settingSnap = async (key) => {
    const Model = M("GlobalSetting");
    if (!Model || !key) return null;
    const s = await Model.findOne({ key }).lean();
    return { label: human(key), values: flattenSetting(s?.value) };
};

const ORDER_POPULATE = [
    { path: "deliveryPartnerId", select: "fullName" },
    { path: "franchiseId", select: "franchiseName" },
    { path: "userId", select: "fullName mobile" },
];

export const orderSnap = async (id) => {
    const o = await byId("Order", id, ORDER_POPULATE);
    if (!o) return null;
    return {
        label: `Order ${orderRef(o._id)}`,
        values: {
            Status: o.orderStatus || "",
            Store: o.franchiseId?.franchiseName || "",
            "Delivery partner": o.deliveryPartnerId?.fullName || "Not assigned",
            "Payment status": human(o.paymentStatus),
            "Partial delivery allowed": yesNo(o.allowPartialFulfillment),
        },
        extra: [
            { label: "Customer", value: [o.userId?.fullName, o.userId?.mobile].filter(Boolean).join(" · ") },
            { label: "Order value", value: money(o.totalAmount) },
            { label: "Payment method", value: human(o.paymentMethod) },
        ],
    };
};

export const returnSnap = async (id, index) => {
    const o = await byId("Order", id);
    if (!o) return null;
    const r = (o.returnRequests || [])[Number(index)];
    if (!r) return { label: `Order ${orderRef(o._id)} return`, values: {} };
    const pickup = r.pickupDeliveryPartnerId ? await nameOf("Delivery", r.pickupDeliveryPartnerId, "fullName") : "";
    return {
        label: `Order ${orderRef(o._id)} return`,
        values: {
            "Return status": human(r.status),
            "Pickup partner": pickup || "Not assigned",
            "Store's note": short(r.franchiseReviewReason),
        },
        extra: [{ label: "Reason given", value: short(r.reason) }],
    };
};

export const procurementSnap = async (id) => {
    const p = await byId("ProcurementRequest", id, [
        { path: "assignedVendorId", select: "fullName" },
        { path: "franchiseId", select: "franchiseName" },
    ]);
    if (!p) return null;
    return {
        label: `Stock request ${orderRef(p._id)}`,
        values: {
            Status: human(p.status || "active"),
            Vendor: p.assignedVendorId?.fullName || "Not assigned",
            Items: `${(p.items || []).length} items`,
            "Estimated total": money(p.totalEstimatedAmount),
            "Quoted total": money(p.totalQuotedAmount || p.vendorQuoteTotal),
            "Actual weight": p.actualWeight ? num(p.actualWeight, "kg") : "",
        },
        extra: [{ label: "Store", value: p.franchiseId?.franchiseName || "" }],
    };
};

export const remittanceSnap = async (id) => {
    const r = await byId("DeliveryCodRemittance", id, [
        { path: "deliveryPartnerId", select: "fullName" },
        { path: "franchiseId", select: "franchiseName" },
    ]);
    if (!r) return null;
    const to = r.franchiseId?.franchiseName ? ` to ${r.franchiseId.franchiseName}` : "";
    return {
        label: `Cash deposit of ${money(r.amount)} by ${r.deliveryPartnerId?.fullName || "delivery partner"}${to}`,
        values: {
            Status: human(r.status),
            Amount: money(r.amount),
            "Rejection reason": short(r.rejectionReason),
        },
        extra: [
            { label: "Orders", value: `${(r.orderIds || []).length} orders` },
            { label: "Paid by", value: human(r.paymentMethod) },
            { label: "Reference", value: r.referenceNo || "" },
        ],
    };
};

/** Stock and price of selected products in one franchise's inventory. */
export const franchiseInventorySnap = async (franchiseId, productIds) => {
    const Inventory = M("Inventory");
    if (!Inventory || !isId(franchiseId)) return null;
    const ids = (productIds || []).map(String).filter((x) => isId(x));
    const [inv, store, products] = await Promise.all([
        Inventory.findOne({ franchiseId }).lean(),
        nameOf("Franchise", franchiseId, "franchiseName"),
        M("Product") ? M("Product").find({ _id: { $in: ids } }).select("name unit").lean() : [],
    ]);
    const values = {};
    for (const p of products) {
        const item = (inv?.items || []).find((i) => String(i.productId) === String(p._id)) || {};
        const prefix = products.length > 1 ? `${p.name} – ` : "";
        values[`${prefix}Stock`] = num(item.currentStock ?? 0, p.unit);
        values[`${prefix}Minimum stock`] = num(item.mbq, p.unit);
        values[`${prefix}Store price`] = item.franchisePrice ? per(item.franchisePrice, p.unit) : "";
    }
    const label = products.length === 1 ? `${products[0].name} at ${store}` : `${products.length} products at ${store}`;
    return { label, values };
};

export const vendorStockSnap = async (vendorId, productId) => {
    const VendorInventory = M("VendorInventory");
    if (!VendorInventory || !isId(vendorId) || !isId(productId)) return null;
    const [inv, product] = await Promise.all([
        VendorInventory.findOne({ vendorId }).lean(),
        M("Product")?.findById(productId).select("name unit").lean(),
    ]);
    const item = (inv?.items || []).find((i) => String(i.productId) === String(productId)) || {};
    return {
        label: product?.name || "Product",
        values: { Stock: num(item.currentStock ?? 0, product?.unit), Available: yesNo(item.available ?? true) },
    };
};

export const commissionSnap = async (franchiseId, categoryId) => {
    const FranchiseCommission = M("FranchiseCommission");
    if (!FranchiseCommission || !isId(franchiseId) || !isId(categoryId)) return null;
    const [c, store, category] = await Promise.all([
        FranchiseCommission.findOne({ franchiseId, categoryId }).lean(),
        nameOf("Franchise", franchiseId, "franchiseName"),
        nameOf("Category", categoryId),
    ]);
    return { label: `${store} – ${category}`, values: { Commission: c ? pct(c.commissionPercentage) : "Not set" } };
};

export const priceZoneSnap = async (code) => {
    const Z = M("PriceZone");
    if (!Z || !code) return null;
    const z = await Z.findOne({ code: String(code).toUpperCase() }).lean();
    if (!z) return null;
    return {
        label: `${z.code} – ${z.name}`,
        values: { Code: z.code, Name: z.name, Cities: list((z.cities || []).map(human)), Active: yesNo(z.isActive) },
    };
};

/** City rates of the products being saved, e.g. "Tomato – Rate: ₹30/kg". */
export const zoneRatesSnap = async (code, productIds) => {
    const ZP = M("ZonePrice");
    const P = M("Product");
    if (!ZP || !P || !code) return null;
    const ids = (productIds || []).map(String).filter((x) => isId(x));
    const [rows, products, zone] = await Promise.all([
        ZP.find({ zoneCode: String(code).toUpperCase(), productId: { $in: ids } }).lean(),
        P.find({ _id: { $in: ids } }).select("name unit price").lean(),
        M("PriceZone")?.findOne({ code: String(code).toUpperCase() }).lean(),
    ]);
    const rowBy = new Map(rows.map((r) => [String(r.productId), r]));
    const values = {};
    for (const p of products) {
        const r = rowBy.get(String(p._id));
        const prefix = products.length > 1 ? `${p.name} – ` : "";
        values[`${prefix}Rate`] = r?.price != null ? per(r.price, p.unit) : `Main rate (${per(p.price, p.unit)})`;
        values[`${prefix}MRP`] = r?.comparePrice != null ? per(r.comparePrice, p.unit) : "Main MRP";
        values[`${prefix}Bulk rates`] = Array.isArray(r?.bulkPricing)
            ? (r.bulkPricing.length ? r.bulkPricing.map((t) => `${num(t.minQty)}+ ${p.unit}: ${per(t.price, p.unit)}`).join(", ") : "None")
            : "Main bulk rates";
    }
    const where = zone ? `${zone.code} (${zone.name})` : String(code).toUpperCase();
    return { label: products.length === 1 ? `${products[0].name} in ${where}` : `${products.length} products in ${where}`, values };
};
