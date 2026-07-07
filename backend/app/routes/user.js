
import express from "express";
import {
    sendOTP,
    verifyOTP,
    forgotPassword,
    resetPassword,
    getMe,
    updateUserProfile,
    changeUserPassword,
    createWalletRechargeOrder,
    verifyWalletRecharge,
    createCreditRepaymentOrder,
    verifyCreditRepayment,
    redeemLoyaltyPoints,
    saveFCMToken,
    testPushByToken,
    makeOverdueTest,
    deleteUserAccount
} from "../controllers/user.auth.js";
import { getCartRecommendations } from "../controllers/recommendation.controller.js";
import {
    getCart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    getWishlist,
    toggleWishlist,
    removeFromWishlist
} from "../controllers/user.action.controller.js";
import {
    getUserNotifications,
    markUserNotificationRead,
    markAllUserNotificationsRead
} from "../controllers/user.notification.controller.js";
import { protect } from "../middlewares/authmiddleware.js";

const router = express.Router();

router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateUserProfile);
router.post("/change-password", protect, changeUserPassword);
router.post("/wallet/recharge", protect, createWalletRechargeOrder); // backward-compatible alias
router.post("/wallet/recharge/create-order", protect, createWalletRechargeOrder);
router.post("/wallet/recharge/verify", protect, verifyWalletRecharge);
router.post("/wallet/repay-credit/create-order", protect, createCreditRepaymentOrder);
router.post("/wallet/repay-credit/verify", protect, verifyCreditRepayment);
router.post("/wallet/redeem-loyalty", protect, redeemLoyaltyPoints);

// Cart Routes
router.get("/cart", protect, getCart);
router.post("/cart/add", protect, addToCart);
router.put("/cart/update", protect, updateCartQuantity);
router.delete("/cart/remove/:productId", protect, removeFromCart);
router.get("/cart/recommendations", getCartRecommendations);

// Wishlist Routes
router.get("/wishlist", protect, getWishlist);
router.post("/wishlist/toggle", protect, toggleWishlist);
router.delete("/wishlist/remove/:productId", protect, removeFromWishlist);
router.get("/notifications", protect, getUserNotifications);
router.post("/notifications/read-all", protect, markAllUserNotificationsRead);
router.post("/notifications/:id/read", protect, markUserNotificationRead);
router.post("/fcm-token", protect, saveFCMToken);
router.post("/test-notification", protect, testPushByToken);
router.get("/test/make-overdue", protect, makeOverdueTest);
router.delete("/delete-account", protect, deleteUserAccount);

export default router;
