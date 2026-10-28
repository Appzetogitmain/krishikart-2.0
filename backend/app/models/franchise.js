import mongoose from "mongoose";
import { PORTAL_LANGUAGES } from "../utils/portalLanguages.js";

const franchiseSchema = new mongoose.Schema(
  {
    franchiseName: {
      type: String,
      required: true,
      trim: true,
    },

    ownerName: {
      type: String,
      required: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Invalid mobile number"],
    },

    city: {
      type: String,
      required: true,
    },
    area: {
      type: String,
      default: null,
    },
    state: {
      type: String,
      default: null,
    },

    formattedAddress: {
      type: String,
      default: null,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // allows multiple null values (old records without email)
    },

    profilePicture: {
      type: String,
      default: null,
    },

    password: {
      type: String,
      select: false,
    },

    otp: String,
    otpExpiresAt: Date,
    otpAttempts: { type: Number, default: 0 },

    /** Set to true only by master admin (KYC / profile approval); never by OTP or self-service upload. */
    isVerified: {
      type: Boolean,
      default: false,
    },

    kyc: {
      aadhaarNumber: String,
      aadhaarImage: String,
      panNumber: String,
      panImage: String,
      fssaiNumber: String,
      fssaiCertificate: String,
      shopEstablishmentCertificate: String,
      gstNumber: String,
      gstCertificate: String,
      status: {
        type: String,
        enum: ["unsubmitted", "pending", "verified", "rejected"],
        default: "unsubmitted",
      },
      submittedAt: Date,
      verifiedAt: Date,
      rejectionReason: String,
    },

    status: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "pending",
    },

    // Language the owner picked on first login (null = not chosen yet); same list as the vendor portal
    preferredLanguage: {
      type: String,
      enum: [...PORTAL_LANGUAGES, null],
      default: null,
    },

    /** Set by the admin: this franchise also supplies stock to other franchises (acts as a dark store). */
    isMotherFranchise: {
      type: Boolean,
      default: false,
      index: true,
    },

    role: {
      type: String,
      default: "franchise",
    },
    storeQRCode: {
      type: String,
      default: null, // URL to the franchise's UPI/Payment QR code
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0],
      },
    },
    servedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: [],
      },
    ],
    requestedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        default: [],
      },
    ],
    serviceHexagons: {
      type: [String],
      default: [],
    },
    categoryCoverage: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        hexagons: {
          type: [String],
          default: [],
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    capacityAvailable: {
      type: Boolean,
      default: true,
    },
    workingHours: {
      start: { type: String, default: "09:00" },
      end: { type: String, default: "21:00" },
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    mobile_fcm: {
      type: [String],
      default: [],
    },
    documents: [
      {
        name: String,
        url: String,
        status: { type: String, default: "pending" },
      },
    ],
  },
  { timestamps: true },
);

franchiseSchema.index({ location: "2dsphere" });

export default mongoose.model("Franchise", franchiseSchema);
