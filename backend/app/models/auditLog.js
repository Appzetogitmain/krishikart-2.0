import mongoose from "mongoose";

/** How long audit entries are kept before MongoDB deletes them automatically. */
export const AUDIT_RETENTION_DAYS = 30;

const changeSchema = new mongoose.Schema(
    {
        field: { type: String, required: true },
        from: { type: String, default: "" },
        to: { type: String, default: "" },
    },
    { _id: false }
);

const detailSchema = new mongoose.Schema(
    {
        label: { type: String, required: true },
        value: { type: String, default: "" },
    },
    { _id: false }
);

/**
 * One change made by a staff member or partner (admin, sub-admin, franchise, vendor,
 * delivery partner). Customer activity is not recorded.
 */
const auditLogSchema = new mongoose.Schema(
    {
        // Who
        actorType: {
            type: String,
            enum: ["admin", "franchise", "vendor", "delivery", "unknown"],
            required: true,
        },
        actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
        actorName: { type: String, default: "" },
        actorRole: { type: String, default: "" }, // e.g. "Super Admin", "Sub-admin", "Franchise"
        actorContact: { type: String, default: "" },

        // What
        module: { type: String, required: true }, // e.g. "Product Management"
        action: { type: String, required: true }, // short key, e.g. "product.update"
        title: { type: String, required: true }, // e.g. "Product price has been changed"
        severity: { type: String, enum: ["info", "important", "critical"], default: "info" },

        // On what
        targetType: { type: String, default: "" }, // e.g. "Product"
        targetId: { type: String, default: "" },
        targetLabel: { type: String, default: "" }, // e.g. "Tomato"

        changes: { type: [changeSchema], default: [] },
        details: { type: [detailSchema], default: [] },

        outcome: { type: String, enum: ["success", "failed", "denied"], default: "success" },
        message: { type: String, default: "" },

        ip: { type: String, default: "" },
        device: { type: String, default: "" },
        method: { type: String, default: "" },
        path: { type: String, default: "" },

        createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_RETENTION_DAYS * 24 * 60 * 60 });
auditLogSchema.index({ actorType: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
