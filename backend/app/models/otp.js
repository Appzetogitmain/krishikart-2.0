import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
    {
        mobile: {
            type: String,
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: ["user", "delivery", "franchise", "vendor"],
            required: true,
        },
        otp: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }, // Automatically delete when expired
        },
        verified: {
            type: Boolean,
            default: false,
        },
        // Wrong guesses for the current code (see verifyOtpRecord)
        attempts: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Issuing a new code (any update that sets `otp`) resets the wrong-attempt counter
otpSchema.pre("findOneAndUpdate", function () {
    const update = this.getUpdate() || {};
    const sets = update.$set || update;
    if (sets && Object.prototype.hasOwnProperty.call(sets, "otp")) {
        this.set({ attempts: 0 });
    }
});

// Compound index for faster lookups
otpSchema.index({ mobile: 1, role: 1 });

const OTP = mongoose.model("OTP", otpSchema);

export default OTP;
