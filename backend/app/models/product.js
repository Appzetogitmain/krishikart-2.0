import mongoose from 'mongoose';
import { capitalizeFirst } from '../utils/helper.js';

const bulkPricingSchema = new mongoose.Schema({
    minQty: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    }
}, { _id: false });

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        set: capitalizeFirst
    },
    skuCode: {
        type: String,
        trim: true,
        uppercase: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category mapping is required']
    },
    subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory'
    },
    price: {
        type: Number,
        required: [true, 'Standard price is required'],
        min: 0
    },
    comparePrice: {
        type: Number,
        min: 0
    },
    bestPrice: {
        type: Number,
        min: 0
    },
    stock: {
        type: Number,
        default: 0
    },
    unit: {
        type: String,
        enum: ['kg', 'gm', 'pcs', 'ltr', 'ml', 'box', 'dz'],
        default: 'kg'
    },
    unitValue: {
        type: Number,
        default: 1
    },
    // Approx. weight of ONE unit when sold by piece / dozen / box (kg). Caps the packed weight a franchise can
    // enter; empty = 1 kg a piece, 2 kg a dozen, 20 kg a box (backend/app/constants/delivery.js)
    unitWeightKg: {
        type: Number,
        default: null
    },
    bulkUnit: {
        type: String,
        enum: ['kg', 'gm', 'pcs', 'ltr', 'ml', 'box', 'dz'],
        default: 'kg'
    },
    description: {
        type: String,
        trim: true
    },
    shortDescription: {
        type: String,
        trim: true
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    dietaryType: {
        type: String,
        enum: ['veg', 'non-veg', 'none'],
        default: 'none'
    },
    primaryImage: {
        type: String,
        default: ''
    },
    images: [{
        type: String
    }],
    bulkPricing: [bulkPricingSchema],
    status: {
        type: String,
        enum: ['draft', 'active', 'inactive'],
        default: 'active'
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    showOnPOS: {
        type: Boolean,
        default: true
    },
    showOnStorefront: {
        type: Boolean,
        default: true
    },
    homeSections: [{
        type: String,
        enum: ['flash_deals', 'bulk_saving', 'seasonal_picks', 'exotic_finds', 'daily_essentials', 'best_sellers'],
        trim: true
    }]
}, {
    timestamps: true
});

// Indexing for faster searches
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ skuCode: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;
