import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      match: [/^[a-zA-Z\s]+$/, "Name should only contain alphabets"],
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Invalid mobile number. Must be 10 digits starting with 6-9."],
    },

    vehicleNumber: {
      type: String,
      required: true,
      uppercase: true,
      match: [/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/, "Vehicle number must be like MP09CS1234"],
    },

    vehicleType: {
      type: String,
      enum: ["bike", "scooter", "auto", "four_wheeler"],
      required: true,
    },

    otp: String,
    otpExpiresAt: Date,
    otpAttempts: { type: Number, default: 0 },

    isVerified: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    aadharNumber: {
      type: String,
    },

    panNumber: {
      type: String,
      uppercase: true,
    },

    licenseNumber: {
      type: String,
      uppercase: true,
    },

    aadharImage: String,
    panImage: String,
    licenseImage: String,

    isApproved: {
      type: Boolean,
      default: false,
    },
    /** pending = awaiting review, approved = verified, rejected = rejected by admin */
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [0, 0]
      }
    },
    isOnline: {
      type: Boolean,
      default: true
    },
    fcmTokens: {
      type: [String],
      default: []
    },

    pendingDocs: {
      aadharNumber: String,
      aadharImage: String,
      panNumber: String,
      panImage: String,
      licenseNumber: String,
      licenseImage: String,
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none"
      },
      rejectionReason: String,
      submittedAt: Date
    }
  },
  { timestamps: true }
);

deliverySchema.index({ location: "2dsphere" });

export default mongoose.model("Delivery", deliverySchema);
