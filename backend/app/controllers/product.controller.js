import mongoose from "mongoose";
import Product from "../models/product.js";
import Category from "../models/category.js";
import Subcategory from "../models/subcategory.js";
import handleResponse, { capitalizeFirst } from "../utils/helper.js";
import { getStorefrontOffersByProduct } from "../utils/storefrontAvailability.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import * as xlsx from 'xlsx';

/* ================= PRODUCT CONTROLLERS ================= */
const normalizeTags = (tagsInput) => {
    if (tagsInput === undefined || tagsInput === null || tagsInput === '') {
        return [];
    }

    let parsedTags = tagsInput;

    if (typeof tagsInput === 'string') {
        try {
            parsedTags = JSON.parse(tagsInput);
        } catch {
            parsedTags = tagsInput.split(',');
        }
    }

    if (!Array.isArray(parsedTags)) {
        parsedTags = [parsedTags];
    }

    return [...new Set(
        parsedTags
            .map((tag) => String(tag).trim().toLowerCase())
            .filter(Boolean)
    )];
};

const normalizeSkuCode = (skuInput) => {
    if (skuInput === undefined || skuInput === null) return '';
    return String(skuInput).trim().toUpperCase();
};

export const createProduct = async (req, res) => {
    try {
        const {
            name,
            skuCode,
            category,
            subcategory,
            price,
            comparePrice,
            bestPrice,
            stock,
            unit,
            description,
            shortDescription,
            tags,
            dietaryType,
            status,
            bulkPricing,
            homeSections,
            showOnPOS,
            showOnStorefront
        } = req.body;

        const isNull = (val) => val === undefined || val === null || val === "" || val === "null" || val === "undefined";

        if (!name || !category || !price) {
            return handleResponse(res, 400, "Required fields: name, category, and price");
        }

        const nameNorm = capitalizeFirst(name.trim());
        const existsName = await Product.findOne({ name: nameNorm, category });
        if (existsName) {
            return handleResponse(res, 400, "A product with this name already exists in this category. Please choose a unique name.");
        }

        if (skuCode) {
            const skuNorm = normalizeSkuCode(skuCode);
            const existsSku = await Product.findOne({ skuCode: skuNorm });
            if (existsSku) {
                return handleResponse(res, 400, "A product with this SKU code already exists. Please choose a unique SKU code.");
            }
        }

        let primaryImageUrl = "";
        let galleryImages = [];

        // Handle File Uploads
        if (req.files) {
            // Primary Image from 'primaryImage' field
            if (req.files.primaryImage && req.files.primaryImage[0]) {
                primaryImageUrl = await uploadToCloudinary(req.files.primaryImage[0].buffer, "products");
            }

            // Gallery Images from 'images' field
            if (req.files.images) {
                const uploadPromises = req.files.images.map(img =>
                    uploadToCloudinary(img.buffer, "products/gallery")
                );
                galleryImages = await Promise.all(uploadPromises);
            }
        }

        // Parse bulk pricing if it's sent as a string (FormData case)
        let parsedBulk = [];
        if (bulkPricing) {
            try {
                const rawBulk = typeof bulkPricing === 'string' ? JSON.parse(bulkPricing) : bulkPricing;
                // Filter only valid tiers
                parsedBulk = (rawBulk || []).filter(tier => tier.minQty != null && tier.price != null && tier.minQty !== '' && tier.price !== '');
            } catch (e) {
                console.error("Bulk Pricing Parse Error:", e);
            }
        }

        // Parse homeSections
        let parsedHomeSections = [];
        if (homeSections) {
            try {
                parsedHomeSections = typeof homeSections === 'string' ? JSON.parse(homeSections) : homeSections;
            } catch (e) {
                console.error("Home Sections Parse Error:", e);
            }
        }

        const product = await Product.create({
            name: nameNorm,
            skuCode: normalizeSkuCode(skuCode) || undefined,
            category: isNull(category) ? null : category,
            subcategory: isNull(subcategory) ? null : subcategory,
            price: Number(price),
            comparePrice: comparePrice ? Number(comparePrice) : undefined,
            bestPrice: bestPrice ? Number(bestPrice) : undefined,
            stock: stock ? Number(stock) : 0,
            unit: unit || 'kg',
            description,
            shortDescription,
            tags: normalizeTags(tags),
            dietaryType: dietaryType || 'none',
            status: 'active', // Forces status to active on creation
            primaryImage: primaryImageUrl,
            images: galleryImages,
            bulkPricing: parsedBulk,
            homeSections: parsedHomeSections,
            showOnPOS: showOnPOS === 'true' || showOnPOS === true,
            showOnStorefront: showOnStorefront === 'true' || showOnStorefront === true,
        });

        // AUTO-ACTIVATION ACROSS NETWORK: Add to all franchise inventories
        try {
            const Franchise = (await import('../models/franchise.js')).default;
            const Inventory = (await import('../models/inventory.js')).default;
            const franchises = await Franchise.find({});

            for (const franchise of franchises) {
                await Inventory.findOneAndUpdate(
                    { franchiseId: franchise._id },
                    {
                        $addToSet: {
                            items: {
                                productId: product._id,
                                currentStock: 50, // Default stock as requested for availability
                                mbq: 5,
                                lastUpdated: new Date()
                            }
                        }
                    },
                    { upsert: true }
                );
            }
            console.log(`[Automation] Product ${product.name} synced to ${franchises.length} franchise nodes.`);
        } catch (syncErr) {
            console.error("Auto-inventory sync failed:", syncErr);
            // Non-blocking for product creation
        }

        return handleResponse(res, 201, "Product created and activated across network", product);
    } catch (err) {
        console.error("Create Product Error:", err);
        if (err.code === 11000) {
            return handleResponse(res, 400, "A product with this name or SKU code already exists. Please choose unique values.");
        }
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

export const getProducts = async (req, res) => {
    try {
        const { category, subcategory, status, search, showOnPOS, showOnStorefront } = req.query;
        const filter = {};

        if (category) filter.category = category;
        if (subcategory) filter.subcategory = subcategory;
        if (status) filter.status = status;
        if (showOnPOS === 'true') filter.showOnPOS = { $ne: false };
        if (showOnPOS === 'false') filter.showOnPOS = false;
        if (showOnStorefront === 'true') filter.showOnStorefront = { $ne: false };
        if (showOnStorefront === 'false') filter.showOnStorefront = false;
        if (search && search !== 'null' && search !== 'undefined') {
            const keywords = search.trim().split(/\s+/).filter(k => k.length > 0);
            if (keywords.length > 0) {
                const searchConditions = keywords.map(word => {
                    const searchRegex = { $regex: word, $options: 'i' };
                    return {
                        $or: [
                            { name: searchRegex },
                            { skuCode: searchRegex },
                            { description: searchRegex },
                            { shortDescription: searchRegex },
                            { tags: searchRegex }
                        ]
                    };
                });
                filter.$and = searchConditions; // Matches all words (intersection)
            }
        }

        const lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
        const lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
        const city = req.query.city || null;
        const useLocationFilter =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180;

        let offersByProduct = null;
        if (useLocationFilter) {
            offersByProduct = await getStorefrontOffersByProduct(lat, lng, city);
            const allowedIds = [...offersByProduct.keys()];
            if (!allowedIds.length) {
                return handleResponse(res, 200, "SKU inventory fetched", []);
            }
            const oids = allowedIds
                .map((id) => {
                    try {
                        return new mongoose.Types.ObjectId(id);
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
            filter._id = { $in: oids };
        }

        const products = await Product.find(filter)
            .populate("category", "name")
            .populate("subcategory", "name")
            .sort({ createdAt: -1 })
            .lean();

        const enriched = products.map((p) => {
            const pid = p._id.toString();
            const offer = offersByProduct?.get(pid);
            if (!offer) return p;
            return {
                ...p,
                ...storefrontPriceFields(offer, p),
            };
        });

        return handleResponse(res, 200, "SKU inventory fetched", enriched);
    } catch (err) {
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

/** Price fields for the customer app: the serving franchise's rate (city rate / override). */
const storefrontPriceFields = (offer, product) => ({
    effectiveStorefrontPrice: offer.effectivePrice,
    storefrontListPrice: offer.listPrice,
    storefrontServingFranchiseId: offer.franchiseId,
    storefrontZoneCode: offer.zoneCode || null,
    // City MRP and bulk rates replace the main ones so every screen shows the local values
    comparePrice: offer.comparePrice ?? product.comparePrice,
    bulkPricing: offer.bulkPricing ?? product.bulkPricing,
});

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
        const lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
        const city = req.query.city || null;
        const useLocationFilter =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180;

        const product = await Product.findById(id)
            .populate("category", "name")
            .populate("subcategory", "name")
            .lean();

        if (!product) {
            return handleResponse(res, 404, "Product not found in system");
        }

        let payload = product;
        if (useLocationFilter) {
            const offers = await getStorefrontOffersByProduct(lat, lng, city);
            const offer = offers.get(id);
            if (offer) {
                payload = {
                    ...product,
                    ...storefrontPriceFields(offer, product),
                };
            }
        }

        return handleResponse(res, 200, "Product details verified", payload);
    } catch (err) {
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        const product = await Product.findById(id);
        if (!product) {
            return handleResponse(res, 404, "Product entry not found");
        }

        const isNull = (val) => val === undefined || val === null || val === "" || val === "null" || val === "undefined";

        // Check for duplicates
        if (updateData.skuCode) {
            const skuNorm = normalizeSkuCode(updateData.skuCode);
            const existsSku = await Product.findOne({ skuCode: skuNorm, _id: { $ne: id } });
            if (existsSku) {
                return handleResponse(res, 400, "A product with this SKU code already exists. Please choose a unique SKU code.");
            }
        }

        if (updateData.name !== undefined || updateData.category !== undefined) {
            const nameToCheck = updateData.name !== undefined ? capitalizeFirst(updateData.name.trim()) : product.name;
            const categoryToCheck = updateData.category !== undefined ? (isNull(updateData.category) ? null : updateData.category) : product.category;
            
            if (nameToCheck && categoryToCheck) {
                const existsName = await Product.findOne({ 
                    name: nameToCheck, 
                    category: categoryToCheck, 
                    _id: { $ne: id } 
                });
                if (existsName) {
                    return handleResponse(res, 400, "A product with this name already exists in this category. Please choose a unique name.");
                }
            }
        }

        // Handle File Uploads for Updates
        if (req.files) {
            if (req.files.primaryImage && req.files.primaryImage[0]) {
                updateData.primaryImage = await uploadToCloudinary(req.files.primaryImage[0].buffer, "products");
            }

            if (req.files.images) {
                const uploadPromises = req.files.images.map(img =>
                    uploadToCloudinary(img.buffer, "products/gallery")
                );
                const galleryImages = await Promise.all(uploadPromises);
                // Can choose to replace or append. Let's append if specific meta says so, but for now replace.
                updateData.images = galleryImages;
            }
        }

        // Parse bulk pricing
        if (updateData.bulkPricing) {
            try {
                const rawBulk = typeof updateData.bulkPricing === 'string'
                    ? JSON.parse(updateData.bulkPricing)
                    : updateData.bulkPricing;
                // Filter only valid tiers
                updateData.bulkPricing = (rawBulk || []).filter(tier => tier.minQty != null && tier.price != null && tier.minQty !== '' && tier.price !== '');
            } catch (e) {
                console.error("Bulk Pricing Parse Error:", e);
            }
        }

        if (updateData.tags !== undefined) {
            updateData.tags = normalizeTags(updateData.tags);
        }
        if (updateData.skuCode !== undefined) {
            updateData.skuCode = normalizeSkuCode(updateData.skuCode) || undefined;
        }

        // Normalize booleans
        if (updateData.showOnPOS !== undefined) {
            updateData.showOnPOS = updateData.showOnPOS === 'true' || updateData.showOnPOS === true;
        }
        if (updateData.showOnStorefront !== undefined) {
            updateData.showOnStorefront = updateData.showOnStorefront === 'true' || updateData.showOnStorefront === true;
        }

        // Parse homeSections for update
        if (updateData.homeSections) {
            try {
                updateData.homeSections = typeof updateData.homeSections === 'string' 
                    ? JSON.parse(updateData.homeSections) 
                    : updateData.homeSections;
            } catch (e) {
                console.error("Home Sections Update Parse Error:", e);
            }
        }

        // Sanitize ObjectId fields to prevent CastError for empty/null strings. Only when the
        // field was actually sent: a partial update (e.g. the show/hide toggle) must not clear them.
        if ("category" in updateData && isNull(updateData.category)) updateData.category = null;
        if ("subcategory" in updateData && isNull(updateData.subcategory)) updateData.subcategory = null;

        if (updateData.name !== undefined) updateData.name = capitalizeFirst(updateData.name.trim());

        const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });

        return handleResponse(res, 200, "Product record updated", updatedProduct);
    } catch (err) {
        console.error("Update Product Error:", err);
        if (err.code === 11000) {
            return handleResponse(res, 400, "A product with this name or SKU code already exists. Please choose unique values.");
        }
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return handleResponse(res, 404, "SKU not found");
        }

        return handleResponse(res, 200, "Product purged from inventory");
    } catch (err) {
        return handleResponse(res, 500, "Server error: " + err.message);
    }
};

export const importProductsFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return handleResponse(res, 400, "Excel file is required");
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            return handleResponse(res, 400, "Excel sheet is empty");
        }

        let updatedCount = 0;
        let createdCount = 0;
        let errorCount = 0;
        const errors = [];

        // Pre-fetch categories and subcategories to avoid repeated DB calls
        const allCategories = await Category.find({});
        const allSubcategories = await Subcategory.find({});

        for (const [index, row] of data.entries()) {
            try {
                const {
                    name,
                    skuCode,
                    categoryName,
                    subcategoryName,
                    price,
                    comparePrice,
                    stock,
                    unit,
                    description,
                    tags,
                    dietaryType,
                    status
                } = row;

                if (!name || !categoryName || price === undefined) {
                    throw new Error(`Row ${index + 2}: Name, Category Name and Price are required`);
                }

                // Find Category by Name
                const category = allCategories.find(c => c.name.toLowerCase() === categoryName.toString().trim().toLowerCase());
                if (!category) {
                    throw new Error(`Row ${index + 2}: Category '${categoryName}' not found`);
                }

                // Find Subcategory by Name (if provided)
                let subcategory = null;
                if (subcategoryName) {
                    subcategory = allSubcategories.find(s =>
                        s.name.toLowerCase() === subcategoryName.toString().trim().toLowerCase() &&
                        s.category.toString() === category._id.toString()
                    );
                }

                const productData = {
                    name: capitalizeFirst(name.toString().trim()),
                    skuCode: skuCode ? skuCode.toString().trim().toUpperCase() : undefined,
                    category: category._id,
                    subcategory: subcategory ? subcategory._id : null,
                    price: Number(price),
                    comparePrice: comparePrice ? Number(comparePrice) : undefined,
                    stock: stock ? Number(stock) : 0,
                    unit: unit || 'kg',
                    description: description || '',
                    tags: normalizeTags(tags),
                    dietaryType: dietaryType || 'none',
                    status: status || 'active',
                };

                let product;
                if (skuCode) {
                    // Try to find existing product by SKU
                    product = await Product.findOne({ skuCode: skuCode.toString().trim().toUpperCase() });
                }

                if (product) {
                    // Update existing
                    Object.assign(product, productData);
                    await product.save();
                    updatedCount++;
                } else {
                    // Create new
                    product = await Product.create(productData);
                    createdCount++;
                }

                // Auto-sync inventory for new products or stock updates
                try {
                    const Franchise = (await import('../models/franchise.js')).default;
                    const Inventory = (await import('../models/inventory.js')).default;
                    const franchises = await Franchise.find({});

                    for (const franchise of franchises) {
                        await Inventory.findOneAndUpdate(
                            { franchiseId: franchise._id },
                            {
                                $addToSet: {
                                    items: {
                                        productId: product._id,
                                        currentStock: product.stock || 50,
                                        mbq: 5,
                                        lastUpdated: new Date()
                                    }
                                }
                            },
                            { upsert: true }
                        );
                    }
                } catch (syncErr) {
                    console.error("Auto-sync failed for row", index, syncErr);
                }

            } catch (rowErr) {
                errorCount++;
                errors.push(rowErr.message);
            }
        }

        return handleResponse(res, 200, `Import complete: ${createdCount} created, ${updatedCount} updated, ${errorCount} errors`, {
            summary: { createdCount, updatedCount, errorCount },
            errors
        });

    } catch (err) {
        console.error("Import Error:", err);
        return handleResponse(res, 500, "Import failed: " + err.message);
    }
};
