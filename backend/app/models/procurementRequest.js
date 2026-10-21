import mongoose from "mongoose";

const procurementRequestSchema = new mongoose.Schema({
    franchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Franchise",
        required: true,
    },
    items: [
        {
            productId: {
                type: String, // Or ObjectId if you have a Product model and want strict linking
                required: true,
            },
            name: String,
            quantity: Number,
            unit: String,
            price: Number, // Estimated price
            quotedPrice: {
                type: Number, // Vendor's current quoted price (can be edited by admin)
                default: 0
            },
            originalQuotedPrice: {
                type: Number, // Original price quoted by vendor
                default: 0
            },
            image: String,
            dispatchedQuantity: {
                type: Number,
                default: 0
            },
            receivedQuantity: {
                type: Number,
                default: 0
            },
            damagedQuantity: {
                type: Number,
                default: 0
            },
            rejected: {
                type: Boolean,
                default: false
            }
        },
    ],
    totalEstimatedAmount: Number,
    totalQuotedAmount: {
        type: Number, // Final/Authorized total
        default: 0
    },
    vendorQuoteTotal: {
        type: Number, // Original total submitted by vendor
        default: 0
    },
    status: {
        type: String,
        // "negotiating" = admin offered a different rate; waiting for the vendor to accept, counter or decline
        enum: ["pending_assignment", "assigned", "quoted", "negotiating", "approved", "preparing", "ready_for_pickup", "picked_up", "completed", "rejected"],
        default: "pending_assignment",
    },
    assignedVendorId: {
        type: String, // keeping simple for now, can be ObjectId ref to Vendor model
        default: null,
    },
    // Where the franchise wants the stock from: a vendor, or a mother franchise (another franchise
    // that keeps stock for others). The admin decides the actual supplier.
    source: {
        type: String,
        enum: ["vendor", "mother_franchise"],
        default: "vendor",
    },
    // The mother franchise the admin assigned (instead of a vendor)
    supplierFranchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    supplierDispatchedAt: { type: Date, default: null },
    supplierNote: { type: String, default: "" },
    // Last time a mother franchise said it cannot supply this request
    lastDecline: {
        franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: "Franchise", default: null },
        reason: { type: String, default: "" },
        at: { type: Date, default: null },
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Assuming MasterAdmin is a User
        default: null,
    },
    // Rate bargaining between admin and vendor: every offer in order (quote, counter, accept, decline)
    offers: {
        type: [
            {
                by: { type: String, enum: ["vendor", "admin"], required: true },
                byName: { type: String, default: "" },
                action: { type: String, enum: ["quote", "counter", "accept", "decline"], required: true },
                items: [
                    {
                        productId: String,
                        name: String,
                        unit: String,
                        quantity: Number,
                        price: Number,
                        _id: false,
                    },
                ],
                total: { type: Number, default: 0 },
                note: { type: String, default: "" },
                at: { type: Date, default: Date.now },
            },
        ],
        default: [],
    },
    // Whose reply the bargaining is waiting for (null when nothing is pending)
    awaitingFrom: { type: String, enum: ["vendor", "admin", null], default: null },
    // What happened to the stock when the franchise confirmed receipt (shown on the franchise's Stock page)
    receiptSummary: {
        at: Date,
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
        message: String,
        lines: [
            {
                name: String,
                unit: String,
                received: Number,
                damaged: Number,
                rejected: Boolean,
                added: Number, // good stock added to the franchise's inventory
                usedForOrder: Number, // taken straight away to pack the customer order waiting for it
                _id: false,
            },
        ],
    },
    actualWeight: {
        type: Number,
        default: 0
    },
    dispatchNote: { type: String, default: "" }, // vendor's note when sending the goods
    dispatchedAt: Date, // when the vendor marked the goods ready for delivery
    invoice: {
        invoiceNumber: String,
        invoiceDate: Date,
        fileUrl: String, // PDF URL
        generatedAt: Date
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    }
}, { timestamps: true });

const ProcurementRequest = mongoose.model("ProcurementRequest", procurementRequestSchema);

export default ProcurementRequest;
