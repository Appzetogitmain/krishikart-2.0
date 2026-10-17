import express from "express";
import {
  createMasterAdmin,
  loginMasterAdmin,
  getMasterAdminMe,
  forgotMasterAdminPassword,
  resetMasterAdminPassword,
  updateMasterAdminProfile,
  changeMasterAdminPassword,
  createSubAdmin,
  listSubAdmins,
  updateSubAdmin,
  deleteSubAdmin,
  saveFCMToken,
} from "../controllers/masteradmin.auth.js";
import {
    createRecommendation,
    getAllRecommendations,
    updateRecommendation,
    deleteRecommendation,
    toggleRecommendationStatus,
    getCartRecommendations
} from "../controllers/recommendation.controller.js";
import {
  createVendorByAdmin,
  getAllVendors,
  updateVendorStatus,
  getVendorDetails,
  deleteVendor,
  createFranchiseByAdmin,
  getAllFranchises,
  getFranchiseDetails,
  updateFranchiseStatus,
  updateFranchiseDetails,
  deleteFranchise,
  updateFranchiseServiceArea,
  getFranchiseServiceMap,
  updateFranchiseCategories,
  getOccupiedHexagonsByCategory,
  getPendingKYCFranchises,
  reviewFranchiseKYC,
  getPendingCategoryRequests,
  reviewCategoryRequest,
  getPendingVendorCategoryRequests,
  reviewVendorCategoryRequest,
  getAllCustomers,
  getCustomerDetails,
  getCustomerCreditHistory,
  updateCustomerCredit,
  deleteCustomer,
  assignProductsToVendor,
  getGlobalInventoryMonitoring,
  getFranchiseInventoryDetails,
  updateFranchiseInventoryItem,
  bulkUpdateFranchiseInventory,
  updateFranchiseCommission,
  getFranchiseCommissions,
  getFranchisePayoutsSummary,
  listFranchiseAdminPayouts,
  recordFranchiseAdminPayout,
  getCodRemittances,
  reviewCodRemittance,
  getGlobalSettings,
  updateGlobalSetting,
  getLegalCmsForAdmin,
  getPublicLegalPages,
  saveLegalCmsSection,
  getAllReturnRequests,
  getLoyaltyConfigHistory,
  getAdminDashboardStats,
  getAdminAnalyticsStats,
  testPushNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  globalSearch,
  getAllDeliveryPartners,
  updateDeliveryStatus,
  reviewDeliveryDocs,
  createFAQ,
  getAllFAQs,
  getPublicFAQs,
  updateFAQ,
  deleteFAQ,
} from "../controllers/masteradmin.controller.js";
import { setMotherFranchise } from "../controllers/motherSupply.controller.js";
import { getComprehensiveReports } from "../controllers/reports.controller.js";

import {
  protectMasterAdmin,
  requirePermission,
  requireSuperAdmin,
} from "../middlewares/masteradmin.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

router.post("/create", createMasterAdmin);
router.post("/login", loginMasterAdmin);
router.get("/me", protectMasterAdmin, getMasterAdminMe);
router.put("/update", protectMasterAdmin, updateMasterAdminProfile);
router.post("/change-password", protectMasterAdmin, changeMasterAdminPassword);
router.post("/forgot-password", forgotMasterAdminPassword);
router.post("/reset-password", resetMasterAdminPassword);
router.post("/fcm-token", protectMasterAdmin, saveFCMToken);
router.get("/notifications", protectMasterAdmin, getAdminNotifications);
router.post(
  "/notifications/read-all",
  protectMasterAdmin,
  markAllAdminNotificationsRead,
);
router.post(
  "/notifications/:id/read",
  protectMasterAdmin,
  markAdminNotificationRead,
);

/* 🏪 Vendor Management */
router.get(
  "/vendors",
  protectMasterAdmin,
  requirePermission("vendors"),
  getAllVendors,
);
router.post(
  "/vendors",
  protectMasterAdmin,
  requirePermission("vendors"),
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "aadharFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
    { name: "shopProofFile", maxCount: 1 },
    { name: "fssaiFile", maxCount: 1 },
  ]),
  createVendorByAdmin,
);
router.get(
  "/vendors/:id",
  protectMasterAdmin,
  requirePermission("vendors"),
  getVendorDetails,
);
router.put(
  "/vendors/:id/status",
  protectMasterAdmin,
  requirePermission("vendors"),
  updateVendorStatus,
);
router.put(
  "/vendors/:id/products",
  protectMasterAdmin,
  requirePermission("products"),
  assignProductsToVendor,
);
router.delete(
  "/vendors/:id",
  protectMasterAdmin,
  requirePermission("vendors"),
  deleteVendor,
);
router.get(
  "/vendors/category-requests/pending",
  protectMasterAdmin,
  requirePermission("approvals"),
  getPendingVendorCategoryRequests,
);
router.put(
  "/vendors/:vendorId/category-review",
  protectMasterAdmin,
  requirePermission("approvals"),
  reviewVendorCategoryRequest,
);

/* 🏪 Franchise Management */
router.get(
  "/franchises",
  protectMasterAdmin,
  requirePermission("franchises"),
  getAllFranchises,
);
router.post(
  "/franchises",
  protectMasterAdmin,
  requirePermission("franchises"),
  upload.fields([
    { name: "aadhaarImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "fssaiCertificate", maxCount: 1 },
    { name: "shopEstablishmentCertificate", maxCount: 1 },
    { name: "gstCertificate", maxCount: 1 },
  ]),
  createFranchiseByAdmin,
);
router.get(
  "/franchises/kyc/pending",
  protectMasterAdmin,
  requirePermission("approvals"),
  getPendingKYCFranchises,
);
router.get(
  "/franchises/:id",
  protectMasterAdmin,
  requirePermission("franchises"),
  getFranchiseDetails,
);
router.put(
  "/franchises/:id/status",
  protectMasterAdmin,
  requirePermission("franchises"),
  updateFranchiseStatus,
);
router.put(
  "/franchises/:id",
  protectMasterAdmin,
  requirePermission("franchises"),
  updateFranchiseDetails,
);
router.delete(
  "/franchises/:id",
  protectMasterAdmin,
  requirePermission("franchises"),
  deleteFranchise,
);
router.put(
  "/franchises/:id/mother",
  protectMasterAdmin,
  requirePermission("franchises"),
  setMotherFranchise,
);
router.put(
  "/franchises/:id/service-area",
  protectMasterAdmin,
  requirePermission("franchises"),
  updateFranchiseServiceArea,
);
router.get(
  "/franchise-service-map",
  protectMasterAdmin,
  requirePermission("franchises"),
  getFranchiseServiceMap,
);
router.put(
  "/franchises/:id/categories",
  protectMasterAdmin,
  requirePermission("franchises"),
  updateFranchiseCategories,
);
router.get(
  "/franchises/occupied-hexagons/:categoryId",
  protectMasterAdmin,
  requirePermission("franchises"),
  getOccupiedHexagonsByCategory,
);
router.put(
  "/franchises/:id/kyc-review",
  protectMasterAdmin,
  requirePermission("approvals"),
  reviewFranchiseKYC,
);
router.get(
  "/franchises/category-requests/pending",
  protectMasterAdmin,
  requirePermission("approvals"),
  getPendingCategoryRequests,
);
router.put(
  "/franchises/:franchiseId/category-review",
  protectMasterAdmin,
  requirePermission("approvals"),
  reviewCategoryRequest,
);

/* 🚚 Delivery Partner Management */
router.get(
  "/delivery-partners",
  protectMasterAdmin,
  requirePermission("approvals"),
  getAllDeliveryPartners,
);
router.put(
  "/delivery-partners/:id/status",
  protectMasterAdmin,
  requirePermission("approvals"),
  updateDeliveryStatus,
);
router.put(
  "/delivery-partners/:id/docs-review",
  protectMasterAdmin,
  requirePermission("approvals"),
  reviewDeliveryDocs,
);

/* 👥 Customer Management */
router.get(
  "/customers",
  protectMasterAdmin,
  requirePermission("credit"),
  getAllCustomers,
);
router.get(
  "/customers/:id",
  protectMasterAdmin,
  requirePermission("credit"),
  getCustomerDetails,
);
router.get(
  "/customers/:id/credit-history",
  protectMasterAdmin,
  requirePermission("credit"),
  getCustomerCreditHistory,
);
router.put(
  "/customers/:id/credit",
  protectMasterAdmin,
  requirePermission("credit"),
  updateCustomerCredit,
);
router.delete(
  "/customers/:id",
  protectMasterAdmin,
  requirePermission("credit"),
  deleteCustomer,
);

/* 📊 Inventory Monitoring */
router.get(
  "/inventory/monitoring",
  protectMasterAdmin,
  requirePermission("stock-monitoring"),
  getGlobalInventoryMonitoring,
);
router.get(
  "/inventory/franchise/:id",
  protectMasterAdmin,
  requirePermission("stock-monitoring"),
  getFranchiseInventoryDetails,
);
router.put(
  "/inventory/franchise/:id/item",
  protectMasterAdmin,
  requirePermission("stock-monitoring"),
  updateFranchiseInventoryItem,
);
router.post(
  "/inventory/franchise/:id/bulk-update",
  protectMasterAdmin,
  requirePermission("stock-monitoring"),
  bulkUpdateFranchiseInventory,
);

/* 💰 Commission Management */
router.get(
  "/franchise/:id/commissions",
  protectMasterAdmin,
  requirePermission("commission"),
  getFranchiseCommissions,
);
router.post(
  "/commissions/update",
  protectMasterAdmin,
  requirePermission("commission"),
  updateFranchiseCommission,
);
router.get(
  "/franchise-payouts",
  protectMasterAdmin,
  requirePermission("franchise-payouts"),
  getFranchisePayoutsSummary,
);
router.get(
  "/franchises/:id/admin-payouts",
  protectMasterAdmin,
  requirePermission("franchise-payouts"),
  listFranchiseAdminPayouts,
);
router.post(
  "/franchises/:id/admin-payouts",
  protectMasterAdmin,
  requirePermission("franchise-payouts"),
  recordFranchiseAdminPayout,
);
router.get("/cod/remittances", protectMasterAdmin, requirePermission("cod-remittance"), getCodRemittances);
router.put(
  "/cod/remittances/:remittanceId/review",
  protectMasterAdmin,
  requirePermission("cod-remittance"),
  reviewCodRemittance,
);

/* ⚙️ System Settings */
router.get(
  "/settings",
  protectMasterAdmin,
  requirePermission("settings"),
  getGlobalSettings,
);
router.post(
  "/settings/update",
  protectMasterAdmin,
  requirePermission("settings"),
  updateGlobalSetting,
);
router.get("/loyalty/history", protectMasterAdmin, requirePermission("loyalty"), getLoyaltyConfigHistory);
router.get("/public-settings", getGlobalSettings); // Public route for user app
router.get("/public-faqs", getPublicFAQs); // Public route for user app
router.get("/public/legal-pages", getPublicLegalPages);

/* Terms, Privacy, Contact — master admin CMS */
router.get(
  "/legal-cms",
  protectMasterAdmin,
  requirePermission("settings"),
  getLegalCmsForAdmin,
);
router.post(
  "/legal-cms",
  protectMasterAdmin,
  requirePermission("settings"),
  saveLegalCmsSection,
);

/* ❓ FAQ Management */
router.get(
  "/faqs",
  protectMasterAdmin,
  requirePermission("settings"),
  getAllFAQs,
);
router.post(
  "/faqs",
  protectMasterAdmin,
  requirePermission("settings"),
  createFAQ,
);
router.put(
  "/faqs/:id",
  protectMasterAdmin,
  requirePermission("settings"),
  updateFAQ,
);
router.delete(
  "/faqs/:id",
  protectMasterAdmin,
  requirePermission("settings"),
  deleteFAQ,
);
/* 👥 Sub-Admin Management (SuperAdmin Only) */
// Team members and their access: main admin only (a sub-admin must not be able to grant itself access)
router.get("/subadmins", protectMasterAdmin, requireSuperAdmin, listSubAdmins);
router.post("/subadmins", protectMasterAdmin, requireSuperAdmin, createSubAdmin);
router.put("/subadmins/:id", protectMasterAdmin, requireSuperAdmin, updateSubAdmin);
router.delete("/subadmins/:id", protectMasterAdmin, requireSuperAdmin, deleteSubAdmin);

/* 💡 Product Recommendations */
router.get("/recommendations", protectMasterAdmin, requirePermission("products"), getAllRecommendations);
router.post("/recommendations", protectMasterAdmin, requirePermission("products"), createRecommendation);
router.put("/recommendations/:id", protectMasterAdmin, requirePermission("products"), updateRecommendation);
router.delete("/recommendations/:id", protectMasterAdmin, requirePermission("products"), deleteRecommendation);
router.patch("/recommendations/:id/toggle", protectMasterAdmin, requirePermission("products"), toggleRecommendationStatus);

router.get("/returns", protectMasterAdmin, requirePermission("returns"), getAllReturnRequests);
router.get("/reports/comprehensive", protectMasterAdmin, requirePermission("dashboard"), getComprehensiveReports);
router.get("/dashboard/stats", protectMasterAdmin, getAdminDashboardStats);
router.get("/search", protectMasterAdmin, globalSearch);
router.post("/test-notification", protectMasterAdmin, requireSuperAdmin, testPushNotification);

export default router;
