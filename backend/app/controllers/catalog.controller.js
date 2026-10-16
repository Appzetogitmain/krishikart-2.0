import Category from "../models/category.js";
import Subcategory from "../models/subcategory.js";
import Product from "../models/product.js";
import Inventory from "../models/inventory.js";
import Franchise from "../models/franchise.js";
import { buildPriceResolver } from "../utils/pricing.js";
import handleResponse, { capitalizeFirst } from "../utils/helper.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import GlobalSetting from "../models/globalSetting.js";
import { getStorefrontCategoryIdsForLocation } from "../utils/storefrontAvailability.js";

/* ================= CATEGORY CONTROLLERS ================= */

export const createCategory = async (req, res) => {
  try {
    const { name, description, adminCommission } = req.body;

    if (!name) {
      return handleResponse(res, 400, "Category name is required");
    }

    const nameNorm = capitalizeFirst(name.trim());
    const exists = await Category.findOne({ name: nameNorm });
    if (exists) {
      return handleResponse(res, 400, "A category with this name already exists. Please choose a unique name.");
    }

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer, "categories");
    }

    const category = await Category.create({
      name: nameNorm,
      description,
      image: imageUrl,
      adminCommission: adminCommission || 0,
    });

    return handleResponse(res, 201, "Category created successfully", category);
  } catch (err) {
    console.error("Create Category Error:", err);
    if (err.code === 11000) {
      return handleResponse(res, 400, "A category with this name already exists. Please choose a unique name.");
    }
    return handleResponse(res, 500, "Server error: " + err.message);
  }
};

export const getCategories = async (req, res) => {
  try {
    const lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
    const lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
    const city = req.query.city || null;
    const useLocation =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    if (!useLocation) {
      const categories = await Category.find().sort({ createdAt: -1 });
      return handleResponse(res, 200, "Categories fetched", categories);
    }

    const catIds = await getStorefrontCategoryIdsForLocation(lat, lng, city);
    if (!catIds.length) {
      return handleResponse(res, 200, "Categories fetched", []);
    }

    const categories = await Category.find({ _id: { $in: catIds } }).sort({
      createdAt: -1,
    });
    return handleResponse(res, 200, "Categories fetched", categories);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isVisible, adminCommission } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return handleResponse(res, 404, "Category not found");
    }

    if (name) {
      const nameNorm = capitalizeFirst(name.trim());
      const exists = await Category.findOne({ name: nameNorm, _id: { $ne: id } });
      if (exists) {
        return handleResponse(res, 400, "A category with this name already exists. Please choose a unique name.");
      }
      category.name = nameNorm;
    }
    if (description !== undefined) category.description = description;
    if (isVisible !== undefined) category.isVisible = isVisible;
    if (adminCommission !== undefined)
      category.adminCommission = adminCommission;

    if (req.file) {
      category.image = await uploadToCloudinary(req.file.buffer, "categories");
    }

    await category.save();

    return handleResponse(res, 200, "Category updated", category);
  } catch (err) {
    console.error("Update Category Error:", err);
    if (err.code === 11000) {
      return handleResponse(res, 400, "A category with this name already exists. Please choose a unique name.");
    }
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if subcategories exist
    const subExists = await Subcategory.findOne({ category: id });
    if (subExists) {
      return handleResponse(
        res,
        400,
        "Cannot delete category with active subcategories",
      );
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return handleResponse(res, 404, "Category not found");
    }

    return handleResponse(res, 200, "Category deleted successfully");
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= SUBCATEGORY CONTROLLERS ================= */

export const createSubcategory = async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return handleResponse(res, 400, "Name and primary category are required");
    }

    // Check if parent category exists
    const parent = await Category.findById(category);
    if (!parent) {
      return handleResponse(res, 404, "Primary category not found");
    }

    const nameNorm = capitalizeFirst(name);
    const exists = await Subcategory.findOne({ name: nameNorm, category });
    if (exists) {
      return handleResponse(
        res,
        400,
        "Subcategory already exists in this category",
      );
    }

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer, "subcategories");
    }

    const subcategory = await Subcategory.create({
      name: nameNorm,
      category,
      image: imageUrl,
    });

    return handleResponse(
      res,
      201,
      "Subcategory created successfully",
      subcategory,
    );
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const getSubcategories = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    const subcategories = await Subcategory.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 });

    return handleResponse(res, 200, "Subcategories fetched", subcategories);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, isVisible } = req.body;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return handleResponse(res, 404, "Subcategory not found");
    }

    if (name) subcategory.name = capitalizeFirst(name);
    
    const oldCategory = subcategory.category.toString();
    if (category && category.toString() !== oldCategory) {
        subcategory.category = category;
        // Update all products in this subcategory to the new parent category
        await Product.updateMany(
            { subcategory: id },
            { $set: { category: category } }
        );
    }

    if (isVisible !== undefined) subcategory.isVisible = isVisible;

    if (req.file) {
      subcategory.image = await uploadToCloudinary(
        req.file.buffer,
        "subcategories",
      );
    }

    await subcategory.save();

    return handleResponse(res, 200, "Subcategory updated", subcategory);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if products exist in this subcategory
    const productExists = await Product.findOne({ subcategory: id });
    if (productExists) {
        return handleResponse(
            res,
            400,
            "Cannot delete subcategory with active products. Please reassign products first.",
        );
    }

    const subcategory = await Subcategory.findByIdAndDelete(id);
    if (!subcategory) {
      return handleResponse(res, 404, "Subcategory not found");
    }

    return handleResponse(res, 200, "Subcategory deleted successfully");
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= SETTINGS CONTROLLERS ================= */

export const getProductsByFranchise = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    const { category, subcategory, search } = req.query;

    const filter = { status: "active" };
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { tags: searchRegex },
        { shortDescription: searchRegex },
      ];
    }

    const [products, inventory, franchise] = await Promise.all([
      Product.find(filter)
        .populate("category", "name")
        .populate("subcategory", "name")
        .lean(),
      Inventory.findOne({ franchiseId }).lean(),
      Franchise.findById(franchiseId).select("city").lean(),
    ]);
    const resolvePrice = await buildPriceResolver(franchise ? [franchise] : [], products.map((p) => p._id));

    const inventoryItems = inventory?.items || [];
    const inventoryMap = new Map(
      inventoryItems.map((item) => [item.productId.toString(), item]),
    );

    const results = products.map((product) => {
      const invItem = inventoryMap.get(product._id.toString());
      const selling = franchise ? resolvePrice(franchise, product, invItem) : null;
      return {
        ...product,
        // Store override, else city rate (price code), else main rate
        price: selling ? selling.price : (invItem?.franchisePrice || product.price),
        comparePrice: selling ? selling.comparePrice : product.comparePrice,
        bulkPricing: selling ? selling.bulkPricing : product.bulkPricing,
        cityPrice: selling ? selling.listPrice : product.price,
        priceZoneCode: selling?.zoneCode || null,
        globalPrice: product.price,
        franchisePrice: invItem?.franchisePrice || null,
        stock: invItem?.currentStock || 0,
        isOutOfStock: (invItem?.currentStock || 0) <= 0,
      };
    });

    return handleResponse(res, 200, "Franchise products fetched", results);
  } catch (err) {
    console.error("Get Franchise Products Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await GlobalSetting.find();
    return handleResponse(res, 200, "Settings fetched", settings);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};
