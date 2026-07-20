import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Invalid mobile number"],
    },

    farmLocation: {
      type: String,
      required: true,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    aadharCard: {
      type: String,
      default: "",
    },

    panCard: {
      type: String,
      default: "",
    },

    fssaiLicense: {
      type: String,
      default: "",
    },

    fssaiImage: {
      type: String,
      default: "",
    },

    shopEstablishmentProof: {
      type: String,
      default: "",
    },

    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
    },

    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],

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

    password: {
      type: String,
      required: true,
    },

    /** Hashed static OTP for staging/dev login (seeded in DB; no SMS needed). */
    staticOtpHash: {
      type: String,
      default: null,
      select: false,
    },

    status: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "pending",
    },

    role: {
      type: String,
      default: "vendor",
    },

    resetPasswordToken: String,
    resetPasswordExpires: Date,
    fcmTokens: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);
