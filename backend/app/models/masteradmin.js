import mongoose from "mongoose";

const masterAdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },

    fullName: {
      type: String,
      default: "Kisaankart Global Root",
    },

    mobile: {
      type: String,
      default: "+91 80000 00001",
    },

    operationalZone: {
      type: String,
      default: "ASIA-SOUTH-IND-01",
    },

    password: {
      type: String,
      required: true,
    },

    otp: String,
    otpExpiresAt: Date,

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    role: {
      type: String,
      enum: ["superadmin", "subadmin", "masteradmin"],
      default: "superadmin",
    },
    fcmTokens: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("MasterAdmin", masterAdminSchema);
