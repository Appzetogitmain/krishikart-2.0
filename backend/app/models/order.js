import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: String,
    image: String,
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unit: String,
    price: {
        type: Number,
        required: true
    },
    subtotal: {
        type: Number,
        required: true
    },
    isBulkRate: {
        type: Boolean,
        default: false
    },
    isShortage: {
        type: Boolean,
        default: false
    },
    shortageQty: {
        type: Number,
        default: 0
    },
    packedQuantity: {
        type: Number,
        default: 0
    }
}, { _id: false });

const returnItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: String,
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unit: String
}, { _id: false });

const returnRequestSchema = new mongoose.Schema({
    items: {
        type: [returnItemSchema],
        default: []
    },
    reason: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'pickup_assigned', 'picked_up', 'completed'],
        default: 'pending'
    },
    reviewedByFranchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Franchise',
        default: null
    },
    franchiseReviewReason: {
        type: String,
        default: ''
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    pickupDeliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        default: null
    },
    pickupAssignedAt: {
        type: Date,
        default: null
    },
    pickupPickedAt: {
        type: Date,
        default: null
    },
    pickupCompletedAt: {
        type: Date,
        default: null
    },
    requestedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Relaxed for legacy support
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    franchiseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Franchise',
        default: null
    },
    /** True when the current assignee was chosen by nearest-franchise auto-assignment (reject → reassign flow). */
    franchiseAutoAccepted: {
        type: Boolean,
        default: false
    },
    allowPartialFulfillment: {
        type: Boolean,
        default: false
    },
    partialFulfillmentApprovedAt: {
        type: Date,
        default: null
    },
    /** Same value on all sibling orders when checkout was split by product category. */
    orderGroupId: {
        type: String,
        default: null,
    },
    /** Category this fulfillment slice belongs to (split orders). */
    fulfillmentCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
    },
    deliveryPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        default: null
    },
    items: [orderItemSchema],
    numberOfPackages: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    subtotal: {
        type: Number,
        required: true
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    platformFee: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ['Wallet', 'Credit', 'UPI', 'Card', 'COD', 'Wallet + Online', 'Credit + Online'],
        required: true
    },
    walletAmountUsed: {
        type: Number,
        default: 0
    },
    creditAmountUsed: {
        type: Number,
        default: 0
    },
    onlineAmountPaid: {
        type: Number,
        default: 0
    },
    codTracking: {
        isCollected: {
            type: Boolean,
            default: false
        },
        collectedAmount: {
            type: Number,
            default: 0
        },
        collectedAt: {
            type: Date,
            default: null
        },
        collectedByDeliveryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Delivery',
            default: null
        },
        // cash = the delivery partner took cash (to be handed to the franchise);
        // upi_franchise_qr = the customer paid by UPI straight to the franchise's QR, so there is no cash to hand over
        collectionMode: {
            type: String,
            enum: ['cash', 'upi_franchise_qr'],
            default: 'cash'
        },
        remittanceStatus: {
            type: String,
            enum: ['pending', 'submitted', 'verified'],
            default: 'pending'
        },
        remittanceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryCodRemittance',
            default: null
        },
        remittedAt: {
            type: Date,
            default: null
        },
        verifiedAt: {
            type: Date,
            default: null
        }
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    orderStatus: {
        type: String,
        enum: ['Placed', 'Assigned', 'Accepted', 'Packed', 'Procuring', 'Ready', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled', 'Received', 'pending'],
        default: 'Placed'
    },
    statusHistory: [
        {
            status: String,
            updatedAt: { type: Date, default: Date.now },
            updatedBy: String // role like 'user', 'franchise', 'delivery'
        }
    ],
    shippingAddress: {
        type: String,
        required: true
    },
    shippingLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        },
        city: String,
        area: String
    },
    assignmentAttempts: [
        {
            franchiseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Franchise' },
            attemptedAt: { type: Date, default: Date.now },
            reason: { type: String, enum: ['unresponsive', 'rejected', 'auto-assigned'], default: 'unresponsive' }
        }
    ],
    deliveryShift: {
        type: String,
        required: true
    },
    estimatedDelivery: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    returnRequests: {
        type: [returnRequestSchema],
        default: []
    },
    bilty: {
        biltyNumber: String,
        generatedAt: Date,
        numberOfPackages: Number,
        items: [{
            name: String,
            quantity: Number,
            unit: String
        }],
        totalWeight: String,
        fromFranchise: String,
        toCustomer: String,
        toAddress: String,
        deliveryPartner: String,
        vehicleNumber: String,
        vehicleType: String
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    couponCode: {
        type: String,
        default: ''
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    scheduledDate: {
        type: Date,
        default: null
    },
    isPreOrder: {
        type: Boolean,
        default: false
    },
    scheduleReminderSentAt: {
        type: Date,
        default: null
    },
    // Set once when a cancelled order's refund has been processed (guards double refunds)
    refundProcessedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

orderSchema.index({ shippingLocation: "2dsphere" });

const Order = mongoose.model('Order', orderSchema);

export default Order;
