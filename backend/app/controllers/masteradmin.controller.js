import Vendor from "../models/vendor.js";
import mongoose from "mongoose";
import Franchise from "../models/franchise.js";
import User from "../models/user.js";
import Product from "../models/product.js";
import Inventory from "../models/inventory.js";
import Order from "../models/order.js";
import FranchiseCommission from "../models/franchiseCommission.js";
import Category from "../models/category.js";
import GlobalSetting from "../models/globalSetting.js";
import LoyaltyConfigHistory from "../models/loyaltyConfigHistory.js";
import DeliveryCodRemittance from "../models/deliveryCodRemittance.js";
import FranchiseAdminPayout from "../models/franchiseAdminPayout.js";
import AdminNotification from "../models/adminNotification.js";
import handleResponse from "../utils/helper.js";
import bcrypt from "bcryptjs";
import Delivery from "../models/delivery.js";
import os from "os";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import {
  isValidFssaiNumber,
  isValidPanNumber,
  normalizeFssaiNumber,
  normalizePanNumber,
  isValidFranchiseGst14,
  normalizeFranchiseGst14,
} from "../utils/gstFranchiseKyc.js";
import { geocodeAddress } from "../utils/geo.js";
import { sendNotificationToUser } from "../utils/pushNotificationHelper.js";
import FAQ from "../models/faq.js";
import { syncInventoryToAssignedProducts } from "../utils/vendorInventorySync.js";
import {
  fetchPayoutOrders,
  aggregatePayoutsFromOrders,
} from "../utils/franchisePayoutReport.js";
import {
  LEGAL_CMS_KEYS,
  LEGAL_CMS_DESCRIPTIONS,
} from "../constants/legalCmsKeys.js";
import { LEGAL_CMS_DEFAULTS } from "../constants/legalCmsDefaults.js";
import { mapAdminNotificationForViewer } from "../utils/adminNotification.js";
import { emitToDelivery } from "../lib/socket.js";

/* ================= VENDOR MANAGEMENT ================= */

export const getAllVendors = async (req, res) => {
  try {
    const { status, productId, productName } = req.query;
    let query = status ? { status } : {};

    if (productName) {
      const product = await Product.findOne({ name: productName });
      if (product) {
        // If product is found by name, use its ID to filter vendors
        query.products = { $in: [product._id] };
      } else {
        // If product name provided but not found, return empty or handle as needed
        // For now, let's return empty to stay consistent with "filter" behavior
        // But if productId is also there, maybe try that?
        // Let's stick to name preference if provided.
        if (!productId)
          return handleResponse(
            res,
            200,
            "No product found with that name",
            [],
          );
      }
    }

    // Only use productId if productName didn't result in a query (or wasn't provided)
    if (productId && !query.products) {
      query.products = { $in: [productId] };
    }

    const vendors = await Vendor.find(query)
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .populate("products", "name category")
      .populate("servedCategories", "name")
      .populate("requestedCategories", "name")
      .sort({ updatedAt: -1 });

    return handleResponse(res, 200, "Vendors fetched successfully", vendors);
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedCategories } = req.body;

    if (!["pending", "active", "blocked"].includes(status)) {
      return handleResponse(res, 400, "Invalid status");
    }

    const vendor = await Vendor.findById(id).select("-password");

    if (!vendor) {
      return handleResponse(res, 404, "Vendor not found");
    }

    vendor.status = status;
    if (status === "active") {
      if (approvedCategories && Array.isArray(approvedCategories)) {
        vendor.servedCategories = approvedCategories;
        vendor.requestedCategories = [];
      } else if (vendor.requestedCategories && vendor.requestedCategories.length > 0) {
        vendor.servedCategories = vendor.requestedCategories;
        vendor.requestedCategories = [];
      }
    }

    await vendor.save();

    return handleResponse(
      res,
      200,
      `Vendor status updated to ${status}`,
      vendor,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getVendorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).select("-password").populate("servedCategories", "name");

    if (!vendor) {
      return handleResponse(res, 404, "Vendor not found");
    }

    return handleResponse(res, 200, "Vendor details fetched", vendor);
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findByIdAndDelete(id);

    if (!vendor) {
      return handleResponse(res, 404, "Vendor not found");
    }

    return handleResponse(res, 200, "Vendor deleted successfully");
  } catch (err) {
    console.error("Delete vendor error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const assignProductsToVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return handleResponse(res, 400, "productIds must be an array");
    }

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { products: productIds },
      { new: true },
    ).select("-password");

    if (!vendor) {
      return handleResponse(res, 404, "Vendor not found");
    }

    await syncInventoryToAssignedProducts(id);

    return handleResponse(
      res,
      200,
      "Products assigned to vendor successfully",
      vendor,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const createVendorByAdmin = async (req, res) => {
  try {
    const { fullName, email, mobile, farmLocation, fssaiLicense, password, servedCategories } =
      req.body;

    if (!fullName || !email || !mobile || !farmLocation) {
      return handleResponse(
        res,
        400,
        "fullName, email, mobile, and farmLocation are required",
      );
    }

    if (!/^[6-9]\d{9}$/.test(String(mobile))) {
      return handleResponse(res, 400, "Invalid mobile number");
    }

    let bankDetails = {};
    if (req.body.bankDetails) {
      try {
        bankDetails =
          typeof req.body.bankDetails === "string"
            ? JSON.parse(req.body.bankDetails)
            : req.body.bankDetails;
      } catch (e) {
        return handleResponse(res, 400, "Invalid bankDetails payload");
      }
    } else {
      bankDetails = {
        accountHolderName:
          req.body["bankDetails[accountHolderName]"] ||
          req.body.accountHolderName,
        accountNumber:
          req.body["bankDetails[accountNumber]"] || req.body.accountNumber,
        ifscCode: req.body["bankDetails[ifscCode]"] || req.body.ifscCode,
        bankName: req.body["bankDetails[bankName]"] || req.body.bankName,
      };
    }

    if (
      !bankDetails?.accountHolderName ||
      !bankDetails?.accountNumber ||
      !bankDetails?.ifscCode ||
      !bankDetails?.bankName
    ) {
      return handleResponse(res, 400, "Bank details are required");
    }

    const exists = await Vendor.findOne({
      $or: [{ email: String(email).toLowerCase() }, { mobile: String(mobile) }],
    });

    if (exists) {
      return handleResponse(
        res,
        409,
        "Vendor with this email or mobile already exists",
      );
    }

    if (
      !req.files?.aadharFile?.[0] ||
      !req.files?.panFile?.[0] ||
      !req.files?.shopProofFile?.[0]
    ) {
      return handleResponse(
        res,
        400,
        "Aadhaar, PAN and Shop Proof files are required",
      );
    }

    const profilePicture = req.files?.profilePicture?.[0]
      ? await uploadToCloudinary(
        req.files.profilePicture[0].buffer,
        "vendors/profiles",
      )
      : "";

    const aadharCard = await uploadToCloudinary(
      req.files.aadharFile[0].buffer,
      "vendors/aadhar",
    );
    const panCard = await uploadToCloudinary(
      req.files.panFile[0].buffer,
      "vendors/pan",
    );
    const shopEstablishmentProof = await uploadToCloudinary(
      req.files.shopProofFile[0].buffer,
      "vendors/shop_proof",
    );
    const fssaiImage = req.files?.fssaiFile?.[0] 
      ? await uploadToCloudinary(
          req.files.fssaiFile[0].buffer,
          "vendors/fssai",
        )
      : "";

    const generatedPassword =
      password?.trim() || `KK@${String(mobile).slice(-6)}`;
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const vendor = await Vendor.create({
      fullName: String(fullName).trim(),
      email: String(email).toLowerCase().trim(),
      mobile: String(mobile).trim(),
      farmLocation: String(farmLocation).trim(),
      password: hashedPassword,
      profilePicture,
      fssaiLicense: fssaiLicense ? String(fssaiLicense).trim() : "",
      fssaiImage,
      bankDetails,
      aadharCard,
      panCard,
      shopEstablishmentProof,
      status: "active",
      servedCategories: servedCategories ? (typeof servedCategories === 'string' ? JSON.parse(servedCategories) : servedCategories) : [],
    });

    const vendorObj = vendor.toObject();
    delete vendorObj.password;

    return handleResponse(res, 201, "Vendor onboarded successfully", {
      vendor: vendorObj,
      loginPassword: generatedPassword,
    });
  } catch (err) {
    console.error("Create vendor by admin error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= FRANCHISE MANAGEMENT ================= */

export const getAllFranchises = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { isActive: { $ne: false } };
    if (status) query.status = status;

    const franchises = await Franchise.find(query)
      .select("-password -resetPasswordToken -resetPasswordExpires")
      .populate("servedCategories", "name")
      .sort({ updatedAt: -1 });

    return handleResponse(
      res,
      200,
      "Franchises fetched successfully",
      franchises,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateFranchiseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "active", "blocked"].includes(status)) {
      return handleResponse(res, 400, "Invalid status");
    }

    const franchise = await Franchise.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).select("-password");

    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    return handleResponse(
      res,
      200,
      `Franchise status updated to ${status}`,
      franchise,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateFranchiseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { franchiseName, ownerName, mobile, email, city, area, state, servedCategories } = req.body;

    const franchise = await Franchise.findById(id);
    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    // Check if mobile or email is already used by another franchise
    if (mobile || email) {
      const exists = await Franchise.findOne({
        $or: [
          mobile ? { mobile } : null,
          email ? { email } : null
        ].filter(Boolean),
        _id: { $ne: id }
      });
      if (exists) {
        return handleResponse(res, 409, "Franchise with this mobile or email already exists");
      }
    }

    if (franchiseName) franchise.franchiseName = franchiseName;
    if (ownerName) franchise.ownerName = ownerName;
    if (mobile) franchise.mobile = mobile;
    if (email) franchise.email = email;
    if (city) franchise.city = city;
    if (area) franchise.area = area;
    if (state) franchise.state = state;
    if (servedCategories) franchise.servedCategories = servedCategories;

    await franchise.save();

    return handleResponse(res, 200, "Franchise details updated successfully", franchise);
  } catch (err) {
    console.error("Update franchise details error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteFranchise = async (req, res) => {
  try {
    const { id } = req.params;
    
    // We'll do a soft delete by setting isActive to false
    const franchise = await Franchise.findByIdAndUpdate(id, { 
      isActive: false,
      status: 'blocked' // Also block it just in case
    }, { new: true });

    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    return handleResponse(res, 200, "Franchise decommissioned and removed from active list");
  } catch (err) {
    console.error("Delete franchise error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateFranchiseServiceArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceHexagons, location, categoryId } = req.body;

    if (serviceHexagons && !Array.isArray(serviceHexagons)) {
      return handleResponse(
        res,
        400,
        "serviceHexagons must be an array of strings",
      );
    }

    const franchise = await Franchise.findById(id);
    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    if (categoryId) {
      // Validate that these hexagons are not already occupied by another franchise for the same category
      if (serviceHexagons && serviceHexagons.length > 0) {
        const overlapping = await Franchise.findOne({
          _id: { $ne: id },
          isActive: true,
          status: "active",
          categoryCoverage: {
            $elemMatch: {
              category: categoryId,
              hexagons: { $in: serviceHexagons },
            },
          },
        });

        if (overlapping) {
          return handleResponse(
            res,
            400,
            `Some territories are already assigned to ${overlapping.franchiseName} for this category`,
          );
        }
      }

      // Update category-specific coverage
      if (!franchise.categoryCoverage) franchise.categoryCoverage = [];
      
      const coverageIndex = franchise.categoryCoverage.findIndex(
        (c) => c.category && c.category.toString() === categoryId
      );

      if (coverageIndex > -1) {
        franchise.categoryCoverage[coverageIndex].hexagons = serviceHexagons || [];
      } else {
        franchise.categoryCoverage.push({
          category: categoryId,
          hexagons: serviceHexagons || [],
        });
      }

      // Ensure it's also in servedCategories
      if (!franchise.servedCategories.includes(categoryId)) {
        franchise.servedCategories.push(categoryId);
      }
    } else if (serviceHexagons) {
      // Legacy support for global coverage
      franchise.serviceHexagons = serviceHexagons;
    }

    if (location && Array.isArray(location.coordinates)) {
      franchise.location = {
        type: "Point",
        coordinates: [
          Number(location.coordinates[0]),
          Number(location.coordinates[1]),
        ],
      };
    }

    await franchise.save();

    return handleResponse(
      res,
      200,
      "Service area and location updated successfully",
      franchise,
    );
  } catch (err) {
    console.error("Update service area error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateFranchiseCategories = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryIds } = req.body;

    const franchise = await Franchise.findById(id);
    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    // Update served categories
    franchise.servedCategories = categoryIds;

    // Optional: We could also update categoryCoverage here if we want to auto-initiate empty coverage 
    // for newly added categories, but keeping it simple for now as per user request.

    await franchise.save();

    return handleResponse(
      res,
      200,
      "Served categories updated successfully",
      franchise,
    );
  } catch (err) {
    console.error("Update franchise categories error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getOccupiedHexagonsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { excludeFranchiseId } = req.query;

    const query = {
      isActive: true,
      status: "active",
      "categoryCoverage.category": categoryId,
    };

    if (excludeFranchiseId) {
      query._id = { $ne: excludeFranchiseId };
    }

    const franchises = await Franchise.find(query).select("categoryCoverage");

    const occupiedHexagons = [];
    franchises.forEach((f) => {
      const coverage = f.categoryCoverage.find(
        (c) => c && c.category && c.category.toString() === categoryId
      );
      if (coverage && coverage.hexagons) {
        occupiedHexagons.push(...coverage.hexagons);
      }
    });

    return handleResponse(res, 200, "Occupied hexagons fetched", {
      occupiedHexagons: [...new Set(occupiedHexagons)],
    });
  } catch (err) {
    console.error("Fetch occupied hexagons error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getFranchiseServiceMap = async (req, res) => {
  try {
    const franchises = await Franchise.find({
      isActive: true,
      status: { $in: ["active", "pending"] },
    }).select(
      "franchiseName ownerName mobile location serviceHexagons city state",
    );

    return handleResponse(
      res,
      200,
      "Franchise service map data fetched",
      franchises,
    );
  } catch (err) {
    console.error("Fetch service map error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getFranchiseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findById(id)
      .select("-password")
      .populate("servedCategories", "name");

    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    return handleResponse(res, 200, "Franchise details fetched", franchise);
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getPendingKYCFranchises = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    let query = { "kyc.status": status };
    if (status === "all") {
      query = { "kyc.status": { $ne: "unsubmitted" } };
    }
    const franchises = await Franchise.find(query)
      .populate("requestedCategories", "name")
      .populate("servedCategories", "name")
      .select("-password")
      .sort({ updatedAt: -1 });
    return handleResponse(res, 200, "KYC franchises fetched", franchises);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const reviewFranchiseKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, approvedCategories } = req.body; // status: verified or rejected

    console.log(`[KYC Review] Franchise ${id} | Status: ${status} | Approved Cats:`, approvedCategories);

    if (!["verified", "rejected"].includes(status)) {
      return handleResponse(res, 400, "Invalid status choice");
    }

    const franchise = await Franchise.findById(id);
    if (!franchise) return handleResponse(res, 404, "Franchise not found");

    franchise.kyc.status = status;
    if (status === "verified") {
      franchise.isVerified = true;
      franchise.kyc.verifiedAt = new Date();
      franchise.status = "active";
      if (approvedCategories && Array.isArray(approvedCategories)) {
        franchise.servedCategories = approvedCategories;
        franchise.requestedCategories = [];
      } else if (franchise.requestedCategories && franchise.requestedCategories.length > 0) {
        // If they didn't explicitly send approvedCategories, just approve all requested
        franchise.servedCategories = franchise.requestedCategories;
        franchise.requestedCategories = [];
      }
    } else {
      franchise.isVerified = false;
      franchise.kyc.rejectionReason = rejectionReason;
    }

    await franchise.save();

    // Notify franchise about the decision
    try {
      const title = status === "verified" ? "Franchise Verified!" : "KYC Update Required";
      const body = status === "verified"
        ? "Congratulations! Your franchise has been verified and is now active."
        : `Your KYC submission was not approved. Reason: ${rejectionReason || 'Please check your documents.'}`;

      await sendNotificationToUser(
        id,
        {
          title,
          body,
          data: {
            type: "kyc_review",
            status
          }
        },
        "franchise"
      );
    } catch (notificationError) {
      console.error("Failed to send KYC review notification:", notificationError);
    }

    return handleResponse(
      res,
      200,
      `Franchise KYC ${status} successfully`,
      franchise,
    );
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const createFranchiseByAdmin = async (req, res) => {
  try {
    const {
      franchiseName,
      ownerName,
      mobile,
      city,
      area,
      state,
      email,
      location,
      servedCategories,
    } = req.body;

    if (!franchiseName || !ownerName || !mobile || !city || !state) {
      return handleResponse(
        res,
        400,
        "franchiseName, ownerName, mobile, city and state are required",
      );
    }

    if (!/^[6-9]\d{9}$/.test(String(mobile))) {
      return handleResponse(res, 400, "Invalid mobile number");
    }

    const exists = await Franchise.findOne({
      $or: [
        { mobile: String(mobile) },
        ...(email ? [{ email: String(email).toLowerCase().trim() }] : [])
      ],
    });

    if (exists) {
      return handleResponse(
        res,
        409,
        "Franchise with this mobile or email already exists",
      );
    }

    // Initialize GeoJSON location
    let locationData = {
      type: "Point",
      coordinates: [0, 0], // [lng, lat]
    };

    // If coordinates provided, use them
    if (location && location.lat && location.lng) {
      locationData.coordinates = [
        parseFloat(location.lng),
        parseFloat(location.lat),
      ];
    }
    // Otherwise, attempt to geocode the city and state
    else {
      const query = `${city}, ${state}, India`;
      const geocoded = await geocodeAddress(query);
      if (geocoded) {
        locationData.coordinates = [geocoded.lng, geocoded.lat];
      }
    }

    const franchiseData = {
      franchiseName: String(franchiseName).trim(),
      ownerName: String(ownerName).trim(),
      mobile: String(mobile).trim(),
      city: String(city).trim(),
      area: area ? String(area).trim() : null,
      state: String(state).trim(),
      email: email ? String(email).toLowerCase().trim() : undefined,
      location: locationData,
      isVerified: true,
      status: "active",
      kyc: {
        status: "verified",
        verifiedAt: new Date(),
      },
      servedCategories: servedCategories ? (typeof servedCategories === 'string' ? JSON.parse(servedCategories) : servedCategories) : [],
    };

    if (req.files?.aadhaarImage?.[0]) {
      franchiseData.kyc.aadhaarImage = await uploadToCloudinary(
        req.files.aadhaarImage[0].buffer,
        "franchise/kyc",
      );
    }

    if (req.files?.panImage?.[0]) {
      franchiseData.kyc.panImage = await uploadToCloudinary(
        req.files.panImage[0].buffer,
        "franchise/kyc",
      );
    }

    if (req.files?.fssaiCertificate?.[0]) {
      franchiseData.kyc.fssaiCertificate = await uploadToCloudinary(
        req.files.fssaiCertificate[0].buffer,
        "franchise/kyc",
      );
    }

    if (req.files?.shopEstablishmentCertificate?.[0]) {
      franchiseData.kyc.shopEstablishmentCertificate = await uploadToCloudinary(
        req.files.shopEstablishmentCertificate[0].buffer,
        "franchise/kyc",
      );
    }

    if (req.files?.gstCertificate?.[0]) {
      franchiseData.kyc.gstCertificate = await uploadToCloudinary(
        req.files.gstCertificate[0].buffer,
        "franchise/kyc",
      );
    }

    if (req.body.aadhaarNumber) {
      const aadhaarDigits = String(req.body.aadhaarNumber).replace(/\D/g, "");
      if (aadhaarDigits.length !== 12) {
        return handleResponse(
          res,
          400,
          "Aadhaar number must be exactly 12 digits",
        );
      }
      franchiseData.kyc.aadhaarNumber = aadhaarDigits;
    }

    if (req.body.panNumber) {
      const panNorm = normalizePanNumber(req.body.panNumber);
      if (!isValidPanNumber(panNorm)) {
        return handleResponse(
          res,
          400,
          "PAN number must be in valid format like ABCDE1234F",
        );
      }
      franchiseData.kyc.panNumber = panNorm;
    }

    if (req.body.fssaiNumber) {
      const fssaiDigits = normalizeFssaiNumber(req.body.fssaiNumber);
      if (!isValidFssaiNumber(fssaiDigits)) {
        return handleResponse(
          res,
          400,
          "FSSAI number must be exactly 14 digits",
        );
      }
      franchiseData.kyc.fssaiNumber = fssaiDigits;
    }

    if (req.body.gstNumber) {
      const gstNorm = normalizeFranchiseGst14(req.body.gstNumber);
      if (!isValidFranchiseGst14(gstNorm)) {
        return handleResponse(
          res,
          400,
          "GST number must be a valid 15-character GSTIN",
        );
      }
      franchiseData.kyc.gstNumber = gstNorm;
    }

    const franchise = await Franchise.create(franchiseData);

    const franchiseObj = franchise.toObject();
    delete franchiseObj.password;

    return handleResponse(
      res,
      201,
      "Franchise onboarded successfully",
      franchiseObj,
    );
  } catch (err) {
    console.error("Create franchise by admin error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= FRANCHISE CATEGORY APPROVALS ================= */

export const getPendingCategoryRequests = async (req, res) => {
  try {
    const franchises = await Franchise.find({
      "requestedCategories.0": { $exists: true },
    })
      .select("franchiseName ownerName city mobile requestedCategories servedCategories")
      .populate("requestedCategories", "name image")
      .populate("servedCategories", "name");

    return handleResponse(
      res,
      200,
      "Pending category requests fetched",
      franchises,
    );
  } catch (err) {
    console.error("Get pending category requests error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const reviewCategoryRequest = async (req, res) => {
  try {
    const { franchiseId } = req.params;
    const { categoryId, status } = req.body; // status: 'approved' or 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return handleResponse(res, 400, "Invalid status choice");
    }

    const franchise = await Franchise.findById(franchiseId);
    if (!franchise) return handleResponse(res, 404, "Franchise not found");

    // Remove from requestedCategories
    franchise.requestedCategories = (franchise.requestedCategories || []).filter(
      (id) => id.toString() !== categoryId,
    );

    if (status === "approved") {
      // Add to servedCategories if not already there
      const alreadyServed = (franchise.servedCategories || []).map((id) =>
        id.toString(),
      );
      if (!alreadyServed.includes(categoryId)) {
        franchise.servedCategories.push(categoryId);
      }
    }

    await franchise.save();

    // Notify franchise about the decision
    try {
      const cat = await Category.findById(categoryId);
      const title = status === "approved" ? "Category Approved" : "Category Request Rejected";
      const body = status === "approved"
        ? `Your request to serve "${cat?.name || 'new category'}" has been approved.`
        : `Your request to serve "${cat?.name || 'new category'}" was not approved at this time.`;

      await sendNotificationToUser(
        franchiseId,
        {
          title,
          body,
          data: {
            type: "category_request_review",
            status,
            categoryId
          }
        },
        "franchise"
      );
    } catch (notificationError) {
      console.error("Failed to send category review notification:", notificationError);
    }

    const hydrated = await Franchise.findById(franchiseId)
      .populate("servedCategories", "name")
      .populate("requestedCategories", "name image");

    return handleResponse(
      res,
      200,
      `Category request ${status} successfully`,
      hydrated,
    );
  } catch (err) {
    console.error("Review category request error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getPendingVendorCategoryRequests = async (req, res) => {
  try {
    const vendors = await Vendor.find({
      "requestedCategories.0": { $exists: true },
    })
      .select("fullName farmLocation mobile requestedCategories servedCategories")
      .populate("requestedCategories", "name image")
      .populate("servedCategories", "name");

    return handleResponse(
      res,
      200,
      "Pending vendor category requests fetched",
      vendors,
    );
  } catch (err) {
    console.error("Get pending vendor category requests error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const reviewVendorCategoryRequest = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { categoryId, status } = req.body; // status: 'approved' or 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return handleResponse(res, 400, "Invalid status choice");
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return handleResponse(res, 404, "Vendor not found");

    // Remove from requestedCategories
    vendor.requestedCategories = (vendor.requestedCategories || []).filter(
      (id) => id.toString() !== categoryId,
    );

    if (status === "approved") {
      // Add to servedCategories if not already there
      const alreadyServed = (vendor.servedCategories || []).map((id) =>
        id.toString(),
      );
      if (!alreadyServed.includes(categoryId)) {
        vendor.servedCategories.push(categoryId);
      }
    }

    await vendor.save();

    // Notify vendor about the decision
    try {
      const cat = await Category.findById(categoryId);
      const title = status === "approved" ? "Category Approved" : "Category Request Rejected";
      const body = status === "approved"
        ? `Your request to serve "${cat?.name || 'new category'}" has been approved.`
        : `Your request to serve "${cat?.name || 'new category'}" was not approved at this time.`;

      await sendNotificationToUser(
        vendorId,
        {
          title,
          body,
          data: {
            type: "vendor_category_request_review",
            status,
            categoryId
          }
        },
        "vendor"
      );
    } catch (notificationError) {
      console.error("Failed to send vendor category review notification:", notificationError);
    }

    const hydrated = await Vendor.findById(vendorId)
      .populate("servedCategories", "name")
      .populate("requestedCategories", "name image");

    return handleResponse(
      res,
      200,
      `Vendor category request ${status} successfully`,
      hydrated,
    );
  } catch (err) {
    console.error("Review vendor category request error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= CUSTOMER MANAGEMENT ================= */

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find()
      .select("-password -otp -otpExpiresAt")
      .sort({ updatedAt: -1 });

    return handleResponse(
      res,
      200,
      "Customers fetched successfully",
      customers,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await User.findById(id).select(
      "-password -otp -otpExpiresAt",
    );

    if (!customer) {
      return handleResponse(res, 404, "Customer not found");
    }

    return handleResponse(res, 200, "Customer details fetched", customer);
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await User.findByIdAndDelete(id);

    if (!customer) {
      return handleResponse(res, 404, "Customer not found");
    }

    return handleResponse(res, 200, "Customer deleted successfully");
  } catch (err) {
    console.error("Delete customer error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateCustomerCredit = async (req, res) => {
  try {
    const { id } = req.params;
    const { creditLimit, usedCredit, resetOverdue } = req.body;

    const updateData = {};
    if (typeof creditLimit === "number" && creditLimit >= 0) {
      updateData.creditLimit = creditLimit;
    }

    if (typeof usedCredit === "number" && usedCredit >= 0) {
      updateData.usedCredit = usedCredit;
      if (usedCredit === 0) {
        updateData.creditOverdueDate = null;
      }
    }

    if (resetOverdue) {
      updateData.creditOverdueDate = null;
    }

    if (Object.keys(updateData).length === 0) {
      return handleResponse(res, 400, "Provide valid fields to update");
    }

    const customer = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password -otp -otpExpiresAt");

    if (!customer) {
      return handleResponse(res, 404, "Customer not found");
    }

    return handleResponse(
      res,
      200,
      "Customer credit updated successfully",
      customer,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= INVENTORY MONITORING ================= */

export const getGlobalInventoryMonitoring = async (req, res) => {
  try {
    const franchises = await Franchise.find({ status: "active" }).select(
      "franchiseName ownerName city",
    );
    const inventories = await Inventory.find().populate(
      "items.productId",
      "name primaryImage unit",
    );

    const monitoringData = franchises.map((f) => {
      const inv = inventories.find(
        (i) => i.franchiseId.toString() === f._id.toString(),
      );
      const items = inv ? inv.items : [];

      return {
        franchiseId: f._id,
        franchiseName: f.franchiseName,
        location: f.city || "N/A",
        stock: items.map((item) => ({
          productId: item.productId?._id,
          productName: item.productId?.name || "Unknown",
          currentStock: item.currentStock,
          mbq: item.mbq,
          unit: item.productId?.unit || "units",
          alertStatus:
            item.currentStock < item.mbq
              ? item.currentStock === 0
                ? "critical"
                : "low"
              : "ok",
        })),
      };
    });

    return handleResponse(
      res,
      200,
      "Global inventory data fetched",
      monitoringData,
    );
  } catch (err) {
    console.error("Global Inventory Monitoring Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getFranchiseInventoryDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findById(id)
      .select("franchiseName ownerName city servedCategories")
      .populate("servedCategories", "name");

    if (!franchise) {
      return handleResponse(res, 404, "Franchise not found");
    }

    const inventory = await Inventory.findOne({ franchiseId: id })
      .populate({
        path: "items.productId",
        select: "name primaryImage unit unitValue category subcategory price",
        populate: [
          { path: "category", select: "name" },
          { path: "subcategory", select: "name" },
        ],
      })
      .populate("franchiseId", "franchiseName ownerName city");

    // Fetch commissions for this franchise
    const commissions = await FranchiseCommission.find({ franchiseId: id });
    const commissionMap = commissions.reduce((acc, c) => {
      acc[c.categoryId.toString()] = c.commissionPercentage;
      return acc;
    }, {});

    const productFilter = { status: "active" };
    if ((franchise.servedCategories || []).length > 0) {
      productFilter.category = { $in: franchise.servedCategories };
    }

    const eligibleProducts = await Product.find(productFilter)
      .select("name skuCode primaryImage unit unitValue category subcategory price stock")
      .populate("category", "name")
      .populate("subcategory", "name")
      .lean();

    const inventoryMap = new Map(
      (inventory?.items || [])
        .filter((item) => item.productId?._id)
        .map((item) => [item.productId._id.toString(), item]),
    );

    const formattedItems = eligibleProducts.map((product) => {
      const savedItem = inventoryMap.get(product._id.toString());
      const currentStock = Number(savedItem?.currentStock || 0);
      const mbq = Number(savedItem?.mbq || product.stock || 5);

      return {
        productId: product._id,
        productName: product.name,
        skuCode: product.skuCode || "",
        image: product.primaryImage,
        currentStock,
        mbq,
        franchisePrice: savedItem?.franchisePrice ?? null,
        globalPrice: product.price || 0,
        unit: product.unit,
        categoryId: product.category?._id,
        categoryName: product.category?.name || "Uncategorized",
        subcategoryId: product.subcategory?._id,
        subcategoryName: product.subcategory?.name || "General",
        alertStatus:
          currentStock < mbq
            ? currentStock === 0
              ? "critical"
              : "low"
            : "ok",
        commissionPercentage:
          (product.category?._id &&
            commissionMap[product.category._id.toString()]) ||
          0,
      };
    });

    const franchisePayload = {
      _id: franchise._id,
      franchiseName:
        inventory?.franchiseId?.franchiseName || franchise.franchiseName,
      ownerName: inventory?.franchiseId?.ownerName || franchise.ownerName,
      city: inventory?.franchiseId?.city || franchise.city,
      servedCategories: franchise.servedCategories || [],
    };

    return handleResponse(res, 200, "Franchise inventory details fetched", {
      franchise: franchisePayload,
      items: formattedItems,
      commissions: commissionMap, // Also send raw map if needed
    });
  } catch (err) {
    console.error("Franchise Inventory Details Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= COMMISSION MANAGEMENT ================= */

export const updateFranchiseCommission = async (req, res) => {
  try {
    const { franchiseId, categoryId, commissionPercentage } = req.body;

    if (!franchiseId || !categoryId || commissionPercentage === undefined) {
      return handleResponse(res, 400, "Missing required fields");
    }

    const commission = await FranchiseCommission.findOneAndUpdate(
      { franchiseId, categoryId },
      { commissionPercentage },
      { new: true, upsert: true },
    );

    return handleResponse(
      res,
      200,
      "Commission updated successfully",
      commission,
    );
  } catch (err) {
    console.error("Update Commission Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getFranchiseCommissions = async (req, res) => {
  try {
    const { id } = req.params; // franchiseId
    const commissions = await FranchiseCommission.find({
      franchiseId: id,
    }).populate("categoryId", "name");

    return handleResponse(
      res,
      200,
      "Franchise commissions fetched successfully",
      commissions,
    );
  } catch (err) {
    console.error("Get Commissions Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateFranchiseInventoryItem = async (req, res) => {
  try {
    const { id } = req.params; // franchiseId
    const { productId, currentStock, mbq, franchisePrice } = req.body;

    if (!productId) {
      return handleResponse(res, 400, "Product ID is required");
    }

    let inventory = await Inventory.findOne({ franchiseId: id });
    if (!inventory) {
      inventory = await Inventory.create({ franchiseId: id, items: [] });
    }

    const existingItem = inventory.items.find(
      (item) => item.productId.toString() === productId.toString(),
    );

    if (existingItem) {
      if (currentStock !== undefined)
        existingItem.currentStock = Number(currentStock);
      if (mbq !== undefined) existingItem.mbq = Number(mbq);
      if (franchisePrice !== undefined) {
        existingItem.franchisePrice =
          franchisePrice === null ? null : Number(franchisePrice);
      }
      existingItem.lastUpdated = new Date();
    } else {
      inventory.items.push({
        productId,
        currentStock:
          currentStock !== undefined ? Number(currentStock) : 0,
        mbq: mbq !== undefined ? Number(mbq) : 5,
        franchisePrice:
          franchisePrice === undefined
            ? null
            : franchisePrice === null
              ? null
              : Number(franchisePrice),
        lastUpdated: new Date(),
      });
    }

    await inventory.save();

    return handleResponse(
      res,
      200,
      "Inventory item updated successfully",
      inventory,
    );
  } catch (err) {
    console.error("Update Inventory Item Error:", err);
    return handleResponse(res, 500, "Server error: " + err.message);
  }
};

export const bulkUpdateFranchiseInventory = async (req, res) => {
  try {
    const { id } = req.params; // franchiseId
    const { items } = req.body; // Array of { productId, currentStock, mbq, franchisePrice }

    if (!Array.isArray(items)) {
      return handleResponse(res, 400, "Items must be an array");
    }

    let inventory = await Inventory.findOne({ franchiseId: id });
    if (!inventory) {
      inventory = await Inventory.create({ franchiseId: id, items: [] });
    }

    for (const update of items) {
      let productId = update.productId;

      // Ensure productId is a valid ObjectId if provided
      if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
        productId = null;
      }

      // Fallback to SKU/ID/Name mapping if productId not directly matched or provided
      if (!productId && update.sku) {
        const product = await Product.findOne({
          $or: [
            { skuCode: update.sku },
            { name: update.sku },
            ...(mongoose.Types.ObjectId.isValid(update.sku)
              ? [{ _id: update.sku }]
              : []),
          ],
        });
        if (product) productId = product._id;
      }

      if (!productId) continue;

      const existingItem = inventory.items.find(
        (item) => item.productId.toString() === productId.toString(),
      );

      if (existingItem) {
        if (update.currentStock !== undefined)
          existingItem.currentStock = Number(update.currentStock);
        if (update.mbq !== undefined) existingItem.mbq = Number(update.mbq);
        if (update.franchisePrice !== undefined) {
          existingItem.franchisePrice =
            update.franchisePrice === null ? null : Number(update.franchisePrice);
        }
        existingItem.lastUpdated = new Date();
      } else {
        inventory.items.push({
          productId,
          currentStock:
            update.currentStock !== undefined ? Number(update.currentStock) : 0,
          mbq: update.mbq !== undefined ? Number(update.mbq) : 5,
          franchisePrice:
            update.franchisePrice === undefined ? null : update.franchisePrice,
          lastUpdated: new Date(),
        });
      }
    }

    inventory.markModified("items");
    await inventory.save();

    return handleResponse(
      res,
      200,
      "Bulk inventory update successful",
      inventory,
    );
  } catch (err) {
    console.error("Bulk Inventory Update Error:", err);
    return handleResponse(res, 500, "Server error: " + err.message);
  }
};

export const getFranchisePayoutsSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const orders = await fetchPayoutOrders({ franchiseId: null, from, to });
    const { summary, franchiseRows } =
      await aggregatePayoutsFromOrders(orders);
    return handleResponse(res, 200, "Franchise payouts calculated", {
      summary,
      franchises: franchiseRows,
    });
  } catch (err) {
    console.error("Get franchise payouts summary error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/** List recorded admin→franchise settlement payments (for admin UI). */
export const listFranchiseAdminPayouts = async (req, res) => {
  try {
    const { id } = req.params;
    const franchise = await Franchise.findById(id).select("_id").lean();
    if (!franchise) return handleResponse(res, 404, "Franchise not found");

    const items = await FranchiseAdminPayout.find({ franchiseId: id })
      .sort({ paidAt: -1 })
      .populate("recordedBy", "fullName email")
      .limit(200)
      .lean();

    const totalPaid = items.reduce(
      (s, x) => s + Number(x.amount || 0),
      0,
    );
    return handleResponse(res, 200, "Admin payouts listed", {
      items,
      totalPaid: Number(totalPaid.toFixed(2)),
    });
  } catch (err) {
    console.error("List franchise admin payouts error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/** Record that admin paid settlement to a franchise (shows on franchise Reports). */
export const recordFranchiseAdminPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note, reference, paidAt } = req.body;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return handleResponse(res, 400, "Valid positive amount is required");
    }

    const franchise = await Franchise.findById(id).select("_id").lean();
    if (!franchise) return handleResponse(res, 404, "Franchise not found");

    let paidAtDate = new Date();
    if (paidAt) {
      const d = new Date(paidAt);
      if (!Number.isNaN(d.getTime())) paidAtDate = d;
    }

    const doc = await FranchiseAdminPayout.create({
      franchiseId: id,
      amount: num,
      note: note != null ? String(note).trim() : "",
      reference: reference != null ? String(reference).trim() : "",
      paidAt: paidAtDate,
      recordedBy: req.masteradmin?._id || null,
    });

    const populated = await FranchiseAdminPayout.findById(doc._id)
      .populate("recordedBy", "fullName email")
      .lean();

    return handleResponse(res, 201, "Payment to franchise recorded", populated);
  } catch (err) {
    console.error("Record franchise admin payout error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getCodRemittances = async (req, res) => {
  try {
    const { status = "submitted" } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;

    const remittances = await DeliveryCodRemittance.find(query)
      .populate("deliveryPartnerId", "fullName mobile vehicleNumber")
      .populate("verifiedBy", "fullName email")
      .sort({ createdAt: -1 })
      .limit(200);

    return handleResponse(res, 200, "COD remittances fetched", remittances);
  } catch (err) {
    console.error("Get COD remittances error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const reviewCodRemittance = async (req, res) => {
  try {
    const { remittanceId } = req.params;
    const { action, reason = "" } = req.body;

    if (!["verify", "reject"].includes(action)) {
      return handleResponse(res, 400, "Action must be verify or reject");
    }

    const remittance = await DeliveryCodRemittance.findById(remittanceId);
    if (!remittance) return handleResponse(res, 404, "Remittance not found");

    if (remittance.status !== "submitted") {
      return handleResponse(
        res,
        400,
        "Only submitted remittances can be reviewed",
      );
    }

    if (action === "verify") {
      remittance.status = "verified";
      remittance.verifiedBy = req.masteradmin?._id || null;
      remittance.verifiedAt = new Date();
      remittance.rejectionReason = "";

      await Order.updateMany(
        { _id: { $in: remittance.orderIds } },
        {
          $set: {
            "codTracking.remittanceStatus": "verified",
            "codTracking.verifiedAt": new Date(),
          },
        },
      );
    } else {
      remittance.status = "rejected";
      remittance.rejectionReason = String(reason || "").trim();

      await Order.updateMany(
        { _id: { $in: remittance.orderIds } },
        {
          $set: {
            "codTracking.remittanceStatus": "pending",
            "codTracking.remittanceId": null,
            "codTracking.remittedAt": null,
          },
        },
      );
    }

    await remittance.save();
    return handleResponse(
      res,
      200,
      `COD remittance ${action}d successfully`,
      remittance,
    );
  } catch (err) {
    console.error("Review COD remittance error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= SYSTEM SETTINGS ================= */

export const getGlobalSettings = async (req, res) => {
  try {
    const settings = await GlobalSetting.find();
    return handleResponse(res, 200, "Settings fetched", settings);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

function buildLegalCmsPayload(docs, opts = {}) {
  const map = Object.fromEntries(docs.map((d) => [d.key, d.value]));

  const textFrom = (stored) => {
    if (stored == null) return "";
    if (typeof stored === "string") return stored;
    if (typeof stored === "object" && stored.content != null) {
      return String(stored.content);
    }
    return "";
  };

  const contactRaw = map[LEGAL_CMS_KEYS.contact];
  const contactObj =
    contactRaw && typeof contactRaw === "object" && !Array.isArray(contactRaw)
      ? contactRaw
      : {};

  const privacyRaw = map[LEGAL_CMS_KEYS.privacy];
  const privacyObj =
    privacyRaw && typeof privacyRaw === "object" && !Array.isArray(privacyRaw)
      ? privacyRaw
      : {};

  const privacyEmail = String(privacyObj.email ?? "").trim();
  const privacyPhone = String(privacyObj.phone ?? "").trim();
  const contactEmail = String(contactObj.email ?? "").trim();
  const contactPhone = String(contactObj.phone ?? "").trim();

  const mergePrivacyContact = Boolean(opts.mergePrivacyContact);

  return {
    terms: { content: textFrom(map[LEGAL_CMS_KEYS.terms]) },
    privacy: {
      content: textFrom(privacyRaw),
      email: mergePrivacyContact
        ? privacyEmail || contactEmail
        : privacyEmail,
      phone: mergePrivacyContact
        ? privacyPhone || contactPhone
        : privacyPhone,
    },
    contact: {
      content: textFrom(contactRaw),
      email: String(contactObj.email ?? ""),
      phone: String(contactObj.phone ?? ""),
      address: String(contactObj.address ?? ""),
    },
  };
}

/** Master admin: load Terms, Privacy, Contact for editing. */
export const getLegalCmsForAdmin = async (req, res) => {
  try {
    const keys = Object.values(LEGAL_CMS_KEYS);
    const docs = await GlobalSetting.find({ key: { $in: keys } }).lean();
    return handleResponse(
      res,
      200,
      "Legal pages content",
      buildLegalCmsPayload(docs),
    );
  } catch (err) {
    console.error("getLegalCmsForAdmin error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/** Public: customer app / landing can read without auth. */
export const getPublicLegalPages = async (req, res) => {
  try {
    const keys = Object.values(LEGAL_CMS_KEYS);
    const docs = await GlobalSetting.find({ key: { $in: keys } }).lean();
    const payload = buildLegalCmsPayload(docs, { mergePrivacyContact: true });

    if (!payload.privacy.email || !payload.privacy.phone) {
      const supportDocs = await GlobalSetting.find({
        key: { $in: ["support_email", "support_phone"] },
      }).lean();
      const supportMap = Object.fromEntries(
        supportDocs.map((d) => [d.key, d.value]),
      );
      if (!payload.privacy.email) {
        payload.privacy.email = String(
          supportMap.support_email || LEGAL_CMS_DEFAULTS.privacy.email,
        ).trim();
      }
      if (!payload.privacy.phone) {
        payload.privacy.phone = String(
          supportMap.support_phone || LEGAL_CMS_DEFAULTS.privacy.phone,
        ).trim();
      }
    }

    if (!payload.privacy.content?.trim()) {
      payload.privacy.content = LEGAL_CMS_DEFAULTS.privacy.content;
    }
    if (!payload.contact.email?.trim()) {
      payload.contact.email = LEGAL_CMS_DEFAULTS.contact.email;
    }
    if (!payload.contact.phone?.trim()) {
      payload.contact.phone = LEGAL_CMS_DEFAULTS.contact.phone;
    }

    return handleResponse(res, 200, "Legal pages", payload);
  } catch (err) {
    console.error("getPublicLegalPages error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/** Save one section (terms | privacy | contact). */
export const saveLegalCmsSection = async (req, res) => {
  try {
    const { section, data } = req.body || {};
    const allowed = ["terms", "privacy", "contact"];
    if (!allowed.includes(section)) {
      return handleResponse(res, 400, "Invalid section", {});
    }

    const key = LEGAL_CMS_KEYS[section];
    let value;
    if (section === "contact") {
      value = {
        content: String(data?.content ?? ""),
        email: String(data?.email ?? "").trim(),
        phone: String(data?.phone ?? "").trim(),
        address: String(data?.address ?? "").trim(),
      };
    } else if (section === "privacy") {
      value = {
        content: String(data?.content ?? ""),
        email: String(data?.email ?? "").trim(),
        phone: String(data?.phone ?? "").trim(),
      };
    } else {
      value = { content: String(data?.content ?? "") };
    }

    await GlobalSetting.findOneAndUpdate(
      { key },
      {
        key,
        value,
        description: LEGAL_CMS_DESCRIPTIONS[key],
      },
      { new: true, upsert: true },
    );

    return handleResponse(res, 200, "Saved", { section });
  } catch (err) {
    console.error("saveLegalCmsSection error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateGlobalSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    const setting = await GlobalSetting.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true },
    );

    if (key === "loyalty_config" && value && typeof value === "object") {
      await LoyaltyConfigHistory.create({
        config: {
          awardRate: Number(value.awardRate ?? 5),
          redemptionRate: Number(value.redemptionRate ?? 10),
          minRedeemPoints: Number(value.minRedeemPoints ?? 100),
        },
        changedById: req.masteradmin?._id || null,
        changedByName: req.masteradmin?.fullName || "Super Admin",
        changeNote: "Loyalty settings updated",
      });
    }

    return handleResponse(res, 200, "Setting updated", setting);
  } catch (err) {
    return handleResponse(res, 500, "Server error");
  }
};

export const getLoyaltyConfigHistory = async (req, res) => {
  try {
    const history = await LoyaltyConfigHistory.find()
      .sort({ createdAt: -1 })
      .limit(20);

    return handleResponse(res, 200, "Loyalty config history fetched", history);
  } catch (err) {
    console.error("Get loyalty config history error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= RETURN REQUEST MONITORING ================= */

export const getAllReturnRequests = async (req, res) => {
  try {
    const orders = await Order.find({ "returnRequests.0": { $exists: true } })
      .populate("userId", "fullName mobile")
      .populate("franchiseId", "shopName franchiseName ownerName mobile city")
      .populate(
        "returnRequests.pickupDeliveryPartnerId",
        "fullName mobile vehicleNumber vehicleType",
      )
      .sort({ updatedAt: -1 });

    return handleResponse(
      res,
      200,
      "Return requests fetched successfully",
      orders,
    );
  } catch (err) {
    console.error("Get all return requests error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= DASHBOARD & ANALYTICS ================= */

export const getAdminDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 1. KPI Metrics
    const [
      ordersToday,
      ordersYesterday,
      activeVendors,
      activeFranchises,
      deliveriesInProgress,
      scheduledOrdersCount,
      revenueToday,
      revenueYesterday,
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ createdAt: { $gte: yesterday, $lt: today } }),
      Vendor.countDocuments({ status: "active" }),
      Franchise.countDocuments({ status: "active" }),
      Order.countDocuments({
        orderStatus: { $in: ["Placed", "Procuring", "Packed", "Dispatched"] },
      }),
      Order.countDocuments({
        isPreOrder: true,
        orderStatus: { $nin: ["Delivered", "Cancelled"] },
      }),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: today },
            orderStatus: { $ne: "Cancelled" },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: yesterday, $lt: today },
            orderStatus: { $ne: "Cancelled" },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const revToday = revenueToday[0]?.total || 0;
    const revYesterday = revenueYesterday[0]?.total || 0;
    const revChange = revYesterday
      ? (((revToday - revYesterday) / revYesterday) * 100).toFixed(1)
      : 0;
    const orderChange = ordersYesterday
      ? (((ordersToday - ordersYesterday) / ordersYesterday) * 100).toFixed(1)
      : 0;

    const kpis = [
      {
        label: "Revenue Summary",
        value: `₹${(revToday / 1000).toFixed(1)}K`,
        change: parseFloat(revChange),
        trend: revChange >= 0 ? "up" : "down",
      },
      {
        label: "Total Orders Today",
        value: ordersToday.toLocaleString(),
        change: parseFloat(orderChange),
        trend: orderChange >= 0 ? "up" : "down",
      },
      {
        label: "Active Vendors",
        value: activeVendors.toLocaleString(),
        change: 0,
        trend: "neutral",
      },
      {
        label: "Deliveries In-Progress",
        value: deliveriesInProgress.toLocaleString(),
        change: 0,
        trend: "neutral",
      },
      {
        label: "Scheduled Orders",
        value: (scheduledOrdersCount || 0).toLocaleString(),
        change: 0,
        trend: "neutral",
      },
      {
        label: "Active Franchises",
        value: activeFranchises.toLocaleString(),
        change: 0,
        trend: "neutral",
      },
    ];

    // 2. Order Flow (Last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      last7Days.push(d);
    }

    const orderFlow = await Promise.all(
      last7Days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const [orders, fulfilled] = await Promise.all([
          Order.countDocuments({ createdAt: { $gte: date, $lt: nextDay } }),
          Order.countDocuments({
            createdAt: { $gte: date, $lt: nextDay },
            orderStatus: { $in: ["Delivered", "Received"] },
          }),
        ]);

        return {
          name: date.toLocaleDateString("en-US", { weekday: "short" }),
          orders,
          fulfillment: fulfilled,
        };
      }),
    );

    // 3. Revenue Flow (Last 7 days)
    const revenueFlow = await Promise.all(
      last7Days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const rev = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: date, $lt: nextDay },
              orderStatus: { $ne: "Cancelled" },
            },
          },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);

        return {
          name: date.toLocaleDateString("en-US", { weekday: "short" }),
          revenue: rev[0]?.total || 0,
        };
      }),
    );

    // 4. Recent Settlements (Using COD Remittances)
    const recentRemittances = await DeliveryCodRemittance.find()
      .populate("deliveryPartnerId", "fullName")
      .sort({ createdAt: -1 })
      .limit(100);

    const recentSettlements = recentRemittances.map((r) => ({
      id: `SET-${r._id.toString().slice(-4).toUpperCase()}`,
      vendor: r.deliveryPartnerId?.fullName || "Agent",
      amount: r.amount,
      status: r.status === "verified" ? "Paid" : "Pending",
      date: r.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    // 5. System Info
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / (24 * 3600));
    const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);

    const system = {
      uptime: `${days}d ${hours}h ${mins}m`,
      load: `${(os.loadavg()[0] * 100).toFixed(0)}%`,
      hostname: os.hostname(),
      status: "Active"
    };

    return handleResponse(res, 200, "Dashboard stats fetched", {
      kpis,
      orderFlow,
      revenueFlow,
      recentSettlements,
      system
    });
  } catch (err) {
    console.error("Get admin dashboard stats error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getAdminAnalyticsStats = async (req, res) => {
  try {
    // 1. Revenue Growth (Last 5 Months)
    const revenueGrowth = [];
    for (let i = 4; i >= 0; i--) {
      const startOfMonth = new Date();
      startOfMonth.setMonth(startOfMonth.getMonth() - i);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      const rev = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth, $lt: endOfMonth },
            orderStatus: { $ne: "Cancelled" },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]);

      revenueGrowth.push({
        month: startOfMonth.toLocaleDateString("en-US", { month: "short" }),
        amount: rev[0]?.total || 0,
      });
    }

    // 2. Category Distribution
    const categoryDist = await Order.aggregate([
      { $match: { orderStatus: { $ne: "Cancelled" } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$categoryInfo.name",
          totalValue: { $sum: "$items.subtotal" },
        },
      },
    ]);

    const totalValue = categoryDist.reduce((acc, c) => acc + c.totalValue, 0);
    const categoryDistribution = categoryDist.map((c) => ({
      category: c._id,
      share: totalValue ? Math.round((c.totalValue / totalValue) * 100) : 0,
    }));

    // 3. Regional Performance
    const [regionalPerfRaw, regionalNodes] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: "$shippingLocation.city",
            orderCount: { $sum: 1 },
            delivered: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
            },
          },
        },
      ]),
      Franchise.aggregate([
        { $group: { _id: "$city", nodeCount: { $sum: 1 } } },
      ]),
    ]);

    const nodeCountMap = new Map(
      regionalNodes.map((rn) => [rn._id, rn.nodeCount]),
    );

    const regionalPerformance = regionalPerfRaw
      .map((r) => ({
        region: r._id || "Hub",
        nodes: nodeCountMap.get(r._id) || 1,
        share: totalOrders
          ? ((r.orderCount / totalOrders) * 100).toFixed(1)
          : 0,
        efficiency: r.orderCount
          ? Math.round((r.delivered / r.orderCount) * 100)
          : 0,
      }))
      .slice(0, 4);

    // 4. Analytics KPIs
    const [totalRevenue, totalFolders, deliveredOrders, totalOrders] =
      await Promise.all([
        Order.aggregate([
          { $match: { orderStatus: { $ne: "Cancelled" } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Franchise.countDocuments({ status: "active" }),
        Order.countDocuments({
          orderStatus: { $in: ["Delivered", "Received"] },
        }),
        Order.countDocuments({}),
      ]);

    const aggRevenue = totalRevenue[0]?.total || 0;
    const uptime = totalOrders
      ? ((deliveredOrders / totalOrders) * 100).toFixed(1)
      : 98.2;

    const kpis = {
      revenue: {
        value:
          aggRevenue > 1000000
            ? `₹${(aggRevenue / 1000000).toFixed(2)}M`
            : `₹${(aggRevenue / 1000).toFixed(1)}K`,
        change: 12.4,
      },
      nodes: {
        value: `${totalFolders} Nodes`,
        change: 5.2,
      },
      uptime: {
        value: `${uptime}%`,
        change: 0.1,
      },
    };

    return handleResponse(res, 200, "Analytics stats fetched", {
      revenueGrowth,
      categoryDistribution,
      regionalPerformance,
      kpis,
    });
  } catch (err) {
    console.error("Get admin analytics stats error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= TEST PUSH NOTIFICATIONS ================= */

export const testPushNotification = async (req, res) => {
  try {
    const { targetId, userType, title, body, data } = req.body;

    if (!targetId || !userType || !title || !body) {
      return handleResponse(
        res,
        400,
        "targetId, userType, title and body are required",
      );
    }

    const validTypes = [
      "user",
      "franchise",
      "delivery",
      "vendor",
      "masteradmin",
      "subadmin",
    ];
    if (!validTypes.includes(userType)) {
      return handleResponse(
        res,
        400,
        `Invalid userType. Must be one of: ${validTypes.join(", ")}`,
      );
    }

    const payload = { title, body, data: data || {} };
    const result = await sendNotificationToUser(targetId, payload, userType);

    if (!result) {
      return handleResponse(
        res,
        404,
        `Failed to send. User not found or has no FCM tokens.`,
      );
    }

    return handleResponse(
      res,
      200,
      "Test notification sent successfully",
      result,
    );
  } catch (err) {
    console.error("Test Push Notification Error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    const limitRaw = Number(req.query?.limit || 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 20;
    const adminId = req.masteradmin?._id;

    const notifications = await AdminNotification.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    const rows = notifications.map((notification) =>
      mapAdminNotificationForViewer(notification, adminId),
    );

    return handleResponse(res, 200, "Admin notifications fetched", {
      notifications: rows,
      unreadCount: rows.filter((row) => !row.read).length,
    });
  } catch (err) {
    console.error("Get admin notifications error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const markAdminNotificationRead = async (req, res) => {
  try {
    const adminId = req.masteradmin?._id;
    const { id } = req.params;

    const notification = await AdminNotification.findByIdAndUpdate(
      id,
      { $addToSet: { readBy: adminId } },
      { new: true },
    );

    if (!notification) {
      return handleResponse(res, 404, "Notification not found");
    }

    return handleResponse(res, 200, "Notification marked as read", {
      notification: mapAdminNotificationForViewer(notification, adminId),
    });
  } catch (err) {
    console.error("Mark admin notification read error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const markAllAdminNotificationsRead = async (req, res) => {
  try {
    const adminId = req.masteradmin?._id;
    await AdminNotification.updateMany(
      { readBy: { $ne: adminId } },
      { $addToSet: { readBy: adminId } },
    );

    return handleResponse(res, 200, "All notifications marked as read");
  } catch (err) {
    console.error("Mark all admin notifications read error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= GLOBAL SEARCH ================= */

export const globalSearch = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) {
      return handleResponse(res, 200, "Search results", {
        products: [],
        orders: [],
        vendors: [],
        franchises: [],
      });
    }

    const regex = new RegExp(query, "i");

    const [products, orders, vendors, franchises] = await Promise.all([
      Product.find({ name: regex })
        .limit(5)
        .select("name primaryImage price unit"),
      Order.find({
        $or: [
          { _id: query.length === 24 ? query : null },
          { orderStatus: regex },
        ],
      })
        .limit(5)
        .select("_id orderStatus totalAmount createdAt"),
      Vendor.find({
        $or: [{ fullName: regex }, { email: regex }, { mobile: regex }],
      })
        .limit(5)
        .select("fullName email mobile profilePicture"),
      Franchise.find({
        $or: [
          { franchiseName: regex },
          { ownerName: regex },
          { mobile: regex },
          { city: regex },
        ],
      })
        .limit(5)
        .select("franchiseName ownerName mobile city"),
    ]);

    return handleResponse(res, 200, "Search results fetched", {
      products,
      orders: orders.filter((o) => o !== null),
      vendors,
      franchises,
    });
  } catch (err) {
    console.error("Global search error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= DELIVERY PARTNER MANAGEMENT ================= */

export const getAllDeliveryPartners = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status === "pending") {
      // Show awaiting initial review OR awaiting document update review
      query = {
        $or: [
          {
            $and: [
              { approvalStatus: { $nin: ["approved", "rejected"] } },
              { isApproved: { $ne: true } },
              {
                $or: [
                  { approvalStatus: "pending" },
                  { approvalStatus: { $exists: false } },
                ],
              },
            ],
          },
          { "pendingDocs.status": "pending" }
        ],
      };
    } else if (status === "verified") {
      query.$or = [{ approvalStatus: "approved" }, { isApproved: true }];
    }

    const partners = await Delivery.find(query)
      .select("-password -otp -otpExpiresAt")
      .sort({ updatedAt: -1 });
    return handleResponse(
      res,
      200,
      "Delivery partners fetched successfully",
      partners,
    );
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved, status } = req.body;

    const updateData = {};
    if (isApproved !== undefined) {
      updateData.isApproved = isApproved;
      updateData.approvalStatus = isApproved ? "approved" : "rejected";
    }
    if (status) updateData.status = status;

    const partner = await Delivery.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");
    if (!partner) return handleResponse(res, 404, "Delivery partner not found");

    if (isApproved === true) {
      await sendNotificationToUser(
        id,
        {
          title: "Account Approved! 🎉",
          body: "Congratulations! Your delivery partner account has been approved. You can now go online and start earning.",
          data: {
            type: "account_approved",
            notificationCategory: "status",
            link: "/delivery/dashboard"
          }
        },
        "delivery"
      );
      
      emitToDelivery(id, "account_status", {
        status: "approved",
        message: "Your account has been approved by the administrator."
      });
    }

    return handleResponse(res, 200, `Delivery partner status updated`, partner);
  } catch (err) {
    console.error(err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= REVIEW DELIVERY DOCUMENTS ================= */
export const reviewDeliveryDocs = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason = "" } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return handleResponse(res, 400, "Action must be approve or reject");
    }

    const partner = await Delivery.findById(id);
    if (!partner) return handleResponse(res, 404, "Delivery partner not found");

    if (!partner.pendingDocs || partner.pendingDocs.status !== "pending") {
      return handleResponse(res, 400, "No pending document update request found");
    }

    if (action === "approve") {
      // Move pending docs to main fields
      if (partner.pendingDocs.aadharNumber) partner.aadharNumber = partner.pendingDocs.aadharNumber;
      if (partner.pendingDocs.aadharImage) partner.aadharImage = partner.pendingDocs.aadharImage;
      if (partner.pendingDocs.panNumber) partner.panNumber = partner.pendingDocs.panNumber;
      if (partner.pendingDocs.panImage) partner.panImage = partner.pendingDocs.panImage;
      if (partner.pendingDocs.licenseNumber) partner.licenseNumber = partner.pendingDocs.licenseNumber;
      if (partner.pendingDocs.licenseImage) partner.licenseImage = partner.pendingDocs.licenseImage;

      partner.pendingDocs.status = "approved";

      // Send notification for document approval
      await sendNotificationToUser(
        id,
        {
          title: "Documents Verified ✅",
          body: "Your submitted documents have been verified and approved by the administrator.",
          data: {
            type: "docs_approved",
            notificationCategory: "compliance",
            link: "/delivery/profile"
          }
        },
        "delivery"
      );

      emitToDelivery(id, "docs_status", {
        status: "approved",
        message: "Your updated documents have been approved."
      });
    } else {
      partner.pendingDocs.status = "rejected";
      partner.pendingDocs.rejectionReason = reason;

      // Send notification for document rejection
      await sendNotificationToUser(
        id,
        {
          title: "Documents Rejected ❌",
          body: `Your document update request was rejected. Reason: ${reason || 'Please check your documents.'}`,
          data: {
            type: "docs_rejected",
            notificationCategory: "compliance",
            link: "/delivery/profile"
          }
        },
        "delivery"
      );

      emitToDelivery(id, "docs_status", {
        status: "rejected",
        message: `Documents rejected: ${reason}`
      });
    }

    await partner.save();

    return handleResponse(res, 200, `Delivery documents ${action}d successfully`, partner);
  } catch (err) {
    console.error("Review delivery docs error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

/* ================= FAQ MANAGEMENT ================= */

export const createFAQ = async (req, res) => {
  try {
    const { question, answer, category, displayOrder, status, audience } = req.body;
    const faq = new FAQ({
      question,
      answer,
      category: category || "General",
      displayOrder: displayOrder ?? 0,
      status: status === "inactive" ? "inactive" : "active",
      audience: audience || "all",
    });
    await faq.save();
    return handleResponse(res, 201, "FAQ created successfully", faq);
  } catch (err) {
    console.error("Create FAQ error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getAllFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ displayOrder: 1, createdAt: -1 });
    return handleResponse(res, 200, "FAQs fetched successfully", faqs);
  } catch (err) {
    console.error("Get all FAQs error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const getPublicFAQs = async (req, res) => {
  try {
    const { audience } = req.query;
    const query = { status: "active" };

    if (audience) {
      query.audience = { $in: [audience, "all"] };
    }

    const faqs = await FAQ.find(query).sort({
      displayOrder: 1,
      createdAt: -1,
    });
    return handleResponse(res, 200, "FAQs fetched successfully", faqs);
  } catch (err) {
    console.error("Get public FAQs error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByIdAndUpdate(id, req.body, { new: true });
    if (!faq) return handleResponse(res, 404, "FAQ not found");
    return handleResponse(res, 200, "FAQ updated successfully", faq);
  } catch (err) {
    console.error("Update FAQ error:", err);
    return handleResponse(res, 500, "Server error");
  }
};

export const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByIdAndDelete(id);
    if (!faq) return handleResponse(res, 404, "FAQ not found");
    return handleResponse(res, 200, "FAQ deleted successfully");
  } catch (err) {
    console.error("Delete FAQ error:", err);
    return handleResponse(res, 500, "Server error");
  }
};
