import mongoose from 'mongoose';
import Coupon from '../models/coupon.js';
import Order from '../models/order.js';
import handleResponse from '../utils/helper.js';

// Admin: Create Coupon
export const createCoupon = async (req, res) => {
    try {
        const coupon = new Coupon({
            ...req.body,
            code: req.body.code.toUpperCase(),
            createdBy: {
                adminId: req.masteradmin._id,
                adminName: req.masteradmin.fullName,
                adminRole: req.masteradmin.role
            }
        });
        await coupon.save();
        return handleResponse(res, 201, "Coupon created successfully", coupon);
    } catch (error) {
        if (error.code === 11000) {
            return handleResponse(res, 400, "Coupon code already exists");
        }
        console.error("Create coupon error:", error);
        return handleResponse(res, 500, "Server error");
    }
};

// Admin: List all coupons
export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        return handleResponse(res, 200, "Coupons fetched successfully", coupons);
    } catch (error) {
        return handleResponse(res, 500, "Server error");
    }
};

// Admin/User: Get one coupon
export const getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return handleResponse(res, 404, "Coupon not found");
        return handleResponse(res, 200, "Coupon fetched", coupon);
    } catch (error) {
        return handleResponse(res, 500, "Server error");
    }
};

// Admin: Update Coupon
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const body = { ...req.body };
        if (body.code) body.code = body.code.toUpperCase();

        const coupon = await Coupon.findByIdAndUpdate(id, body, { new: true });
        if (!coupon) return handleResponse(res, 404, "Coupon not found");
        return handleResponse(res, 200, "Coupon updated successfully", coupon);
    } catch (error) {
        return handleResponse(res, 500, "Server error");
    }
};

// Admin: Delete Coupon
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) return handleResponse(res, 404, "Coupon not found");
        return handleResponse(res, 200, "Coupon deleted successfully", coupon);
    } catch (error) {
        return handleResponse(res, 500, "Server error");
    }
};

// User: Get visible coupons
export const getVisibleCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({
            status: 'active',
            isVisible: true,
            $or: [
                { endDate: { $exists: false } },
                { endDate: { $gte: new Date() } },
                { endDate: null }
            ]
        }).sort({ createdAt: -1 });
        return handleResponse(res, 200, "Visible coupons fetched", coupons);
    } catch (error) {
        return handleResponse(res, 500, "Server error");
    }
};

// User: Validate Coupon
export const validateCoupon = async (req, res) => {
    try {
        const { code, cartValue } = req.body;
        const userId = req.user.id || req.user._id;

        const coupon = await Coupon.findOne({ code: code.toUpperCase(), status: 'active' });

        if (!coupon) {
            return handleResponse(res, 400, "Invalid or inactive coupon code");
        }

        // Validity check
        const now = new Date();
        if (coupon.startDate && coupon.startDate > now) return handleResponse(res, 400, "Coupon not yet valid");
        if (coupon.endDate && now > coupon.endDate) return handleResponse(res, 400, "Coupon has expired");

        // Usage limit check
        if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.timesUsed >= coupon.usageLimit) {
            return handleResponse(res, 400, "Coupon total usage limit reached");
        }

        // Usage per user check
        const userUsageCount = await Order.countDocuments({
            $or: [{ userId }, { user: userId }],
            couponCode: code.toUpperCase(),
            orderStatus: { $ne: 'Cancelled' }
        });

        if (userUsageCount >= coupon.usageLimitPerUser) {
            return handleResponse(res, 400, "You have already used this coupon");
        }

        // Minimum order value check
        if (cartValue < coupon.minOrderValue) {
            return handleResponse(res, 400, `Minimum order value for this coupon is ₹${coupon.minOrderValue}`);
        }

        // Logic for specialized types
        if (coupon.type === 'new_partner') {
            const orderCount = await Order.countDocuments({
                $or: [{ userId }, { user: userId }],
                orderStatus: { $ne: 'Cancelled' }
            });
            if (orderCount > 0) return handleResponse(res, 400, "This coupon is only for first-time buyers");
        }

        if (coupon.type === 'monthly_volume') {
            const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
            const monthlyVolume = await Order.aggregate([
                {
                    $match: {
                        $or: [{ userId: new mongoose.Types.ObjectId(String(userId)) }, { user: new mongoose.Types.ObjectId(String(userId)) }],
                        createdAt: { $gte: startOfMonth },
                        orderStatus: 'Delivered'
                    }
                },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]);
            const currentVolume = monthlyVolume[0]?.total || 0;
            if (currentVolume < coupon.monthlyVolumeRequirement) {
                return handleResponse(res, 400, `You need a monthly volume of ₹${coupon.monthlyVolumeRequirement} to use this coupon. Current: ₹${currentVolume}`);
            }
        }

        // Final Calculations
        let discount = 0;
        const type = coupon.type;

        if (['percentage', 'bulk_discount', 'category_based', 'new_partner', 'min_order_value', 'monthly_volume'].includes(coupon.type)) {
            discount = (cartValue * coupon.value) / 100;
            if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        } else if (coupon.type === 'free_delivery') {
            discount = 0; // WAIVER logic handled in checkout
        }

        return handleResponse(res, 200, "Coupon validated", {
            code: coupon.code,
            type: type,
            discount: Number(discount.toFixed(2)),
            message: coupon.description,
            buyQty: coupon.buyQty,
            buyUnit: coupon.buyUnit,
            getQty: coupon.getQty,
            getUnit: coupon.getUnit
        });

    } catch (error) {
        console.error("Validate coupon error:", error);
        return handleResponse(res, 500, "Server error");
    }
};
