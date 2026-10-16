import mongoose from "mongoose";

const subAdminSchema = new mongoose.Schema(
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
            required: true,
        },

        mobile: {
            type: String,
        },

        password: {
            type: String,
            required: true,
        },

        permissions: {
            type: [String],
            default: [],
        },

        // City price codes this person may edit rates for (e.g. ["JPR"]). Empty = none.
        priceZoneCodes: {
            type: [String],
            default: [],
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
            default: "subadmin",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MasterAdmin",
        },
        fcmTokens: {
            type: [String],
            default: []
        }
    },
    { timestamps: true }
);

export default mongoose.model("SubAdmin", subAdminSchema);
