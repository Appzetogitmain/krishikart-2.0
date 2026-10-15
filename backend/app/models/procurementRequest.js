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
        enum: ["pending_assignment", "assigned", "quoted", "approved", "preparing", "ready_for_pickup", "picked_up", "completed", "rejected"],
        default: "pending_assignment",
    },
    assignedVendorId: {
        type: String, // keeping simple for now, can be ObjectId ref to Vendor model
        default: null,
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Assuming MasterAdmin is a User
        default: null,
    },
    actualWeight: {
        type: Number,
        default: 0
    },
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
