import POSSale from "../models/posSale.js";
import { takeStock, addStock } from "../utils/stock.js";
import handleResponse from "../utils/helper.js";

/**
 * @desc Create a new POS Sale
 * @route POST /franchise/pos/sale
 * @access Private (Franchise)
 */
export const createPOSSale = async (req, res) => {
    try {
        const { items, paymentMethod } = req.body;
        const franchiseId = req.franchise._id;

        if (!Array.isArray(items) || items.length === 0) {
            return handleResponse(res, 400, "Cart is empty");
        }
        if (!["Cash", "QR Scan"].includes(paymentMethod)) {
            return handleResponse(res, 400, "Please choose Cash or QR Scan as the payment method");
        }
        for (const item of items) {
            const q = Number(item.quantity);
            const p = Number(item.price);
            if (!item.productId || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) {
                return handleResponse(res, 400, `Invalid quantity or price for ${item.name || "an item"}`);
            }
        }

        // 1. Take the stock atomically, item by item; undo everything if one item is short
        const taken = [];
        for (const item of items) {
            const ok = await takeStock(franchiseId, item.productId, Number(item.quantity));
            if (!ok) {
                for (const t of taken) await addStock(franchiseId, t.productId, t.quantity);
                return handleResponse(res, 400, `Not enough stock for ${item.name || "an item"}`);
            }
            taken.push({ productId: item.productId, quantity: Number(item.quantity) });
        }

        // Totals are worked out on the server from price x quantity (not trusted from the browser)
        const saleItems = items.map(item => {
            const quantity = Number(item.quantity);
            const price = Number(item.price);
            return { productId: item.productId, name: item.name, unit: item.unit, quantity, price, subtotal: Math.round(quantity * price * 100) / 100 };
        });
        const totalAmount = Math.round(saleItems.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

        // 3. Generate Unique Sale ID
        let saleId;
        let isUnique = false;
        while (!isUnique) {
            saleId = `POS-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
            const existing = await POSSale.findOne({ saleId });
            if (!existing) isUnique = true;
        }

        // 4. Create POS Sale record
        const newSale = new POSSale({
            franchiseId,
            items: saleItems,
            totalAmount,
            paymentMethod,
            saleId
        });

        try {
            await newSale.save();
        } catch (saveErr) {
            // Sale not recorded: give the stock back
            for (const t of taken) await addStock(franchiseId, t.productId, t.quantity);
            throw saveErr;
        }

        return handleResponse(res, 201, "Sale recorded successfully", newSale);
    } catch (err) {
        console.error("POS Sale Error Details:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};

/**
 * @desc Get POS Sale History
 * @route GET /franchise/pos/history
 * @access Private (Franchise)
 */
export const getPOSHistory = async (req, res) => {
    try {
        const franchiseId = req.franchise._id;
        const sales = await POSSale.find({ franchiseId }).sort({ createdAt: -1 });
        return handleResponse(res, 200, "POS history fetched", sales);
    } catch (err) {
        console.error("POS History Error:", err);
        return handleResponse(res, 500, "Internal server error");
    }
};
