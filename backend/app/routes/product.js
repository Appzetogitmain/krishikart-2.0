import express from "express";
import {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    importProductsFromExcel
} from "../controllers/product.controller.js";
import { protectMasterAdmin, requirePermission } from "../middlewares/masteradmin.auth.js";
import upload from "../middlewares/upload.js";

const router = express.Router();

// Public / Protected Routes
router.get("/", getProducts);
router.get("/:id", getProductById);

// Master Admin Protected Routes
router.post(
    "/",
    protectMasterAdmin,
    requirePermission("products"),
    upload.fields([
        { name: 'primaryImage', maxCount: 1 },
        { name: 'images', maxCount: 5 }
    ]),
    createProduct
);

router.put(
    "/:id",
    protectMasterAdmin,
    requirePermission("products"),
    upload.fields([
        { name: 'primaryImage', maxCount: 1 },
        { name: 'images', maxCount: 5 }
    ]),
    updateProduct
);

router.post("/import", protectMasterAdmin, requirePermission("products"), upload.single("file"), importProductsFromExcel);
router.delete("/:id", protectMasterAdmin, requirePermission("products"), deleteProduct);

export default router;
