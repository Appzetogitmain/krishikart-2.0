import mongoose from "mongoose";

const vendorInventorySchema = new mongoose.Schema({
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true,
            },
            currentStock: {
                type: Number,
                default: 0,
            },
            available: {
                type: Boolean,
                default: true
            },
            // The vendor's own selling rate (per product unit). The admin assigns franchise orders at this rate.
            rate: {
                type: Number,
                default: 0,
                min: 0,
            },
            rateUpdatedAt: Date,
            lastUpdated: {
                type: Date,
                default: Date.now,
            }
        }
    ]
}, { timestamps: true });

// Ensure one inventory record per vendor
vendorInventorySchema.index({ vendorId: 1 }, { unique: true });

const VendorInventory = mongoose.model("VendorInventory", vendorInventorySchema);

export default VendorInventory;
