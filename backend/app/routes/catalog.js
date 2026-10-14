import express from "express";
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  createSubcategory,
  getSubcategories,
  updateSubcategory,
  deleteSubcategory,
  getProductsByFranchise,
  getPublicSettings,
} from "../controllers/catalog.controller.js";
import { protectMasterAdmin, requirePermission } from "../middlewares/masteradmin.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

/* ================= CATEGORY ROUTES ================= */
router.post(
  "/categories",
  protectMasterAdmin,
  requirePermission("categories"),
  upload.single("image"),
  createCategory,
);
router.get("/categories", getCategories); // Publicly accessible to show in frontend
router.put(
  "/categories/:id",
  protectMasterAdmin,
  requirePermission("categories"),
  upload.single("image"),
  updateCategory,
);
router.delete("/categories/:id", protectMasterAdmin, requirePermission("categories"), deleteCategory);

/* ================= SUBCATEGORY ROUTES ================= */
router.post(
  "/subcategories",
  protectMasterAdmin,
  requirePermission("categories"),
  upload.single("image"),
  createSubcategory,
);
router.get("/subcategories", getSubcategories); // Publicly accessible
router.put(
  "/subcategories/:id",
  protectMasterAdmin,
  requirePermission("categories"),
  upload.single("image"),
  updateSubcategory,
);
router.delete("/subcategories/:id", protectMasterAdmin, requirePermission("categories"), deleteSubcategory);

/* ================= PRODUCT ROUTES ================= */
router.get("/franchise/:franchiseId/products", getProductsByFranchise);

/* ================= SETTINGS ROUTES ================= */
router.get("/settings", getPublicSettings);

export default router;
