import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
    franchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Franchise",
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
            mbq: {
                type: Number, // Minimum Base Quantity
                default: 5,
            },
            franchisePrice: {
                type: Number,
                default: null, // If null, fallback to global product price
            },
            // Weighted-average price actually paid for this stock (vendor rate, or the mother
            // franchise's own cost). Used to value goods sold in the financial reports.
            avgCost: {
                type: Number,
                default: null,
            },
            lastUpdated: {
                type: Date,
                default: Date.now,
            }
        }
    ]
}, { timestamps: true });

// Ensure one inventory record per franchise
inventorySchema.index({ franchiseId: 1 }, { unique: true });

// Never persist negative stock (async hook for Mongoose 9+ compatibility; no next() needed)
inventorySchema.pre('save', async function () {
    if (this.items && Array.isArray(this.items)) {
        this.items.forEach(item => {
            if (typeof item.currentStock === 'number' && item.currentStock < 0) {
                item.currentStock = 0;
            }
        });
    }
});

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
