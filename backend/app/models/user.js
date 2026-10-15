import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    txnId: { type: String, required: true },
    type: {
      type: String,
      enum: ["Added", "Paid", "Refund", "Credit Used", "Credit Refunded", "Adjustment", "Loyalty Bonus", "Redemption"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, default: "Success" },
    note: { type: String, default: "" },
    referenceOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Invalid mobile number"],
    },

    panNumber: {
      type: String,
      trim: true,
    },

    legalEntityName: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
    },

    // Delivery addresses the customer has used or saved (shown at checkout on any device)
    savedAddresses: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, required: true },
            tag: { type: String, enum: ["home", "work", "other"], default: "other" },
            label: { type: String, default: "Other" },
            details: {
              flat: { type: String, default: "" },
              floor: { type: String, default: "" },
              colony: { type: String, default: "" },
              landmark: { type: String, default: "" },
              city: { type: String, default: "" },
              state: { type: String, default: "" },
              pincode: { type: String, default: "" },
            },
            fullAddress: { type: String, default: "" },
            location: {
              lat: { type: Number },
              lng: { type: Number },
            },
            lastUsedAt: { type: Date },
            updatedAt: { type: Date, default: Date.now },
          },
          { _id: false, id: false }
        ),
      ],
      default: undefined,
    },

    // Optional additional contact numbers for the user
    additionalNumbers: [
      {
        phone: { type: String, trim: true },
        name: { type: String, trim: true },
      },
    ],

    profileImage: {
      type: String,
      default: "",
    },

    preferences: {
      whatsappUpdates: { type: Boolean, default: false },
      showTaxInclusive: { type: Boolean, default: false },
      paperInvoice: { type: Boolean, default: false },
    },

    otp: {
      type: String,
    },

    otpExpiresAt: {
      type: Date,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    password: {
      type: String,
    },

    walletBalance: {
      type: Number,
      default: 0
    },

    loyaltyPoints: {
      type: Number,
      default: 0
    },

    creditLimit: {
      type: Number,
      default: 0
    },

    usedCredit: {
      type: Number,
      default: 0
    },
    creditOverdueDate: {
      type: Date,
      default: null
    },

    walletTransactions: {
      type: [walletTransactionSchema],
      default: []
    },

    businessType: {
      type: String,
      enum: ['registered', 'unregistered'],
      default: null,
    },

    gstNumber: {
      type: String,
      trim: true,
      default: null,
    },

    fssaiNumber: {
      type: String,
      trim: true,
      default: null,
    },

    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    fcmTokens: {
      type: [String],
      default: []
    },
    mobile_fcm: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
