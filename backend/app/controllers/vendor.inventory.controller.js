import VendorInventory from "../models/vendorInventory.js";
import { handleResponse } from "../utils/helper.js";
import {
    isProductAssignedToVendor,
    syncInventoryToAssignedProducts,
} from "../utils/vendorInventorySync.js";

/**
 * @desc Get Vendor Inventory (only products assigned by admin)
 * @route GET /vendor/inventory
 * @access Private (Vendor)
 */
export const getVendorInventory = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        console.log(`[Debug] Fetching inventory for Vendor ID: ${vendorId}`);

        const inventory = await syncInventoryToAssignedProducts(vendorId);
        console.log(`[Debug] Sync result for ${vendorId}:`, inventory ? 'Success' : 'Failed (null)');
        if (!inventory) {
            return handleResponse(res, 404, "Vendor not found");
        }

        const items = (inventory.items || []).filter((row) => row.productId != null);

        return handleResponse(res, 200, "Vendor inventory fetched successfully", items);
    } catch (err) {
        console.error("Get Vendor Inventory Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Update Product Stock in Vendor Inventory
 * @route PUT /vendor/inventory/stock
 * @access Private (Vendor)
 */
export const updateVendorStock = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { productId, stock } = req.body;

        if (!productId || stock === undefined) {
            return handleResponse(res, 400, "Product ID and stock are required");
        }

        const assigned = await isProductAssignedToVendor(vendorId, productId);
        if (!assigned) {
            return handleResponse(res, 403, "This product is not assigned to your account");
        }

        await syncInventoryToAssignedProducts(vendorId);

        const inventory = await VendorInventory.findOne({ vendorId });
        if (!inventory) {
            return handleResponse(res, 404, "Inventory not found");
        }

        const itemIndex = inventory.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex > -1) {
            inventory.items[itemIndex].currentStock = stock;
            inventory.items[itemIndex].lastUpdated = new Date();
            await inventory.save();
            return handleResponse(res, 200, "Stock updated successfully");
        }

        return handleResponse(res, 404, "Product not found in inventory");
    } catch (err) {
        console.error("Update Vendor Stock Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Toggle Product Availability
 * @route PUT /vendor/inventory/toggle-availability
 * @access Private (Vendor)
 */
export const toggleProductAvailability = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { productId } = req.body;

        if (!productId) {
            return handleResponse(res, 400, "Product ID is required");
        }

        const assigned = await isProductAssignedToVendor(vendorId, productId);
        if (!assigned) {
            return handleResponse(res, 403, "This product is not assigned to your account");
        }

        await syncInventoryToAssignedProducts(vendorId);

        const inventory = await VendorInventory.findOne({ vendorId });
        if (!inventory) {
            return handleResponse(res, 404, "Inventory not found");
        }

        const itemIndex = inventory.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex > -1) {
            inventory.items[itemIndex].available = !inventory.items[itemIndex].available;
            inventory.items[itemIndex].lastUpdated = new Date();
            await inventory.save();

            return handleResponse(res, 200, `Product is now ${inventory.items[itemIndex].available ? 'live' : 'hidden'}`);
        }

        return handleResponse(res, 404, "Product not found in inventory");
    } catch (err) {
        console.error("Toggle Availability Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Set the vendor's own rates. Body: { rates: [{ productId, rate }] } (rate per product unit, 0 = no rate)
 * @route PUT /vendor/inventory/rates
 * @access Private (Vendor)
 */
export const updateVendorRates = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const rates = Array.isArray(req.body?.rates) ? req.body.rates : [];
        if (!rates.length) {
            return handleResponse(res, 400, "Enter at least one rate");
        }
        if (rates.length > 500) {
            return handleResponse(res, 400, "Too many rates in one go");
        }
        for (const r of rates) {
            const rate = Number(r?.rate);
            if (!r?.productId || !Number.isFinite(rate) || rate < 0 || rate > 1000000) {
                return handleResponse(res, 400, "Rate must be a number of 0 or more");
            }
        }

        const inventory = await syncInventoryToAssignedProducts(vendorId);
        if (!inventory) {
            return handleResponse(res, 404, "Vendor not found");
        }
        const doc = await VendorInventory.findOne({ vendorId });
        const now = new Date();
        let changed = 0;
        for (const r of rates) {
            const row = doc.items.find((i) => String(i.productId) === String(r.productId));
            if (!row) {
                return handleResponse(res, 403, "This product is not assigned to your account");
            }
            const rate = Math.round(Number(r.rate) * 100) / 100;
            if (Number(row.rate || 0) !== rate) {
                row.rate = rate;
                row.rateUpdatedAt = now;
                changed += 1;
            }
        }
        if (changed) await doc.save();
        return handleResponse(res, 200, changed ? "Rates saved" : "No change", { changed });
    } catch (err) {
        console.error("Update Vendor Rates Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};
