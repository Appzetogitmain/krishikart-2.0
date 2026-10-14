import mongoose from "mongoose";
import * as XLSX from "xlsx";
import AuditLog, { AUDIT_RETENTION_DAYS } from "../models/auditLog.js";
import handleResponse from "../utils/helper.js";

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** IST calendar day "YYYY-MM-DD" → UTC Date at the start (or end) of that day. */
const istDay = (value, endOfDay = false) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
};

const buildFilter = (q) => {
    const filter = {};
    if (q.actorType && q.actorType !== "all") filter.actorType = q.actorType;
    if (q.module && q.module !== "all") filter.module = q.module;
    if (q.severity && q.severity !== "all") filter.severity = q.severity;
    if (q.outcome === "problems") filter.outcome = { $in: ["failed", "denied"] };
    else if (q.outcome && q.outcome !== "all") filter.outcome = q.outcome;
    if (q.actorId && mongoose.isValidObjectId(q.actorId)) filter.actorId = q.actorId;
    if (q.targetId) filter.targetId = String(q.targetId);

    const from = istDay(q.from);
    const to = istDay(q.to, true);
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lte = to;
    }

    const search = String(q.q || "").trim().slice(0, 80);
    if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        filter.$or = [
            { title: rx }, { actorName: rx }, { actorContact: rx }, { targetLabel: rx },
            { "changes.field": rx }, { "changes.from": rx }, { "changes.to": rx }, { "details.value": rx },
        ];
    }
    return filter;
};

/** GET /masteradmin/audit-logs?page=&limit=&q=&actorType=&module=&severity=&outcome=&from=&to= */
export const getAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
        const filter = buildFilter(req.query);

        const [items, total] = await Promise.all([
            AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            AuditLog.countDocuments(filter),
        ]);

        return handleResponse(res, 200, "Audit log", {
            items,
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
            retentionDays: AUDIT_RETENTION_DAYS,
        });
    } catch (error) {
        console.error("getAuditLogs:", error);
        return handleResponse(res, 500, "Could not load the activity log");
    }
};

/** GET /masteradmin/audit-logs/summary — counts for the cards and the filter lists. */
export const getAuditSummary = async (req, res) => {
    try {
        const since = new Date();
        since.setHours(since.getHours() - 24);
        const [modules, byType, last24h, critical24h, denied24h, people] = await Promise.all([
            AuditLog.distinct("module"),
            AuditLog.aggregate([{ $group: { _id: "$actorType", count: { $sum: 1 } } }]),
            AuditLog.countDocuments({ createdAt: { $gte: since } }),
            AuditLog.countDocuments({ createdAt: { $gte: since }, severity: "critical" }),
            AuditLog.countDocuments({ createdAt: { $gte: since }, outcome: { $in: ["failed", "denied"] } }),
            AuditLog.aggregate([
                { $match: { createdAt: { $gte: since }, actorId: { $ne: null } } },
                { $group: { _id: "$actorId", name: { $first: "$actorName" }, role: { $first: "$actorRole" }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),
        ]);
        return handleResponse(res, 200, "Audit summary", {
            modules: modules.sort(),
            byActorType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
            last24h,
            critical24h,
            problems24h: denied24h,
            mostActive24h: people,
            retentionDays: AUDIT_RETENTION_DAYS,
        });
    } catch (error) {
        console.error("getAuditSummary:", error);
        return handleResponse(res, 500, "Could not load the activity summary");
    }
};

/** GET /masteradmin/audit-logs/export — same filters, as an Excel file (up to 10,000 rows). */
export const exportAuditLogs = async (req, res) => {
    try {
        const items = await AuditLog.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(10000).lean();
        const when = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const rows = items.map((l) => [
            when(l.createdAt),
            l.title,
            l.module,
            l.actorName,
            l.actorRole,
            l.actorContact,
            [l.targetType, l.targetLabel].filter(Boolean).join(": "),
            (l.changes || []).map((c) => `${c.field}: ${c.from || "—"} → ${c.to || "—"}`).join("\n"),
            (l.details || []).map((d) => `${d.label}: ${d.value}`).join("\n"),
            l.outcome === "success" ? "Done" : l.outcome === "denied" ? "Blocked (no permission)" : "Failed",
            l.severity === "critical" ? "High" : l.severity === "important" ? "Medium" : "Normal",
            l.ip,
            l.device,
        ]);
        const header = ["Date & time (IST)", "What happened", "Section", "Changed by", "Role", "Contact", "Record", "Changes (before → after)", "Details", "Result", "Importance", "IP address", "Device"];
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws["!cols"] = [20, 40, 22, 26, 16, 22, 30, 50, 40, 14, 12, 16, 18].map((wch) => ({ wch }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Activity log");
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        const stamp = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="kisaankart-activity-log-${stamp}.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        console.error("exportAuditLogs:", error);
        return handleResponse(res, 500, "Could not export the activity log");
    }
};
