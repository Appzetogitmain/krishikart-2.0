import mongoose from "mongoose";
import AuditLog from "../models/auditLog.js";
import { AUDIT_RULES } from "./auditRules.js";
import { diffValues, valuesAsDetails, deviceOf, human } from "./auditFormat.js";

/**
 * Records who changed what, for admins, sub-admins, franchises, vendors and delivery partners.
 * Mounted once in front of all /api routes. For each write request that matches a rule in
 * auditRules.js it snapshots the record before the change, lets the request run, snapshots it
 * again afterwards and stores the difference. Customer activity is never recorded, and the log
 * can never break or slow down the request it describes (all work happens after the response).
 */

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const compiled = AUDIT_RULES.map((rule) => {
    const keys = [];
    const pattern = rule.p
        .replace(/\/+$/, "")
        .split("/")
        .map((seg) => {
            if (seg.startsWith(":")) {
                keys.push(seg.slice(1));
                return "([^/]+)";
            }
            return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/");
    return { rule, keys, regex: new RegExp(`^${pattern}/?$`, "i") };
});

const matchRule = (method, path) => {
    for (const c of compiled) {
        if (c.rule.m !== method) continue;
        const hit = c.regex.exec(path);
        if (!hit) continue;
        const params = {};
        c.keys.forEach((k, i) => { params[k] = decodeURIComponent(hit[i + 1]); });
        return { rule: c.rule, params };
    }
    return null;
};

const ADMIN_ROLES = { superadmin: "Super Admin", masteradmin: "Main Admin", subadmin: "Sub-admin" };

/** The signed-in staff member or partner who made the request, if any. */
const actorFromRequest = (req) => {
    if (req.masteradmin) {
        const a = req.masteradmin;
        return { type: "admin", id: a._id, name: a.fullName || a.email, role: ADMIN_ROLES[String(a.role).toLowerCase()] || "Admin", contact: a.email || a.mobile || "" };
    }
    if (req.franchise) {
        const f = req.franchise;
        return { type: "franchise", id: f._id, name: f.ownerName ? `${f.ownerName} (${f.franchiseName})` : f.franchiseName, role: "Franchise", contact: f.mobile || f.email || "" };
    }
    if (req.vendor) {
        const v = req.vendor;
        return { type: "vendor", id: v._id, name: v.fullName, role: "Vendor", contact: v.mobile || v.email || "" };
    }
    if (req.delivery) {
        const d = req.delivery;
        return { type: "delivery", id: d._id, name: d.fullName, role: "Delivery partner", contact: d.mobile || "" };
    }
    return null;
};

/** For sign-in, registration and password reset the account is found from what was typed. */
const actorFromIdentifier = async (type, body = {}, result) => {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const mobile = String(body.mobile || body.phone || "").replace(/\D/g, "").slice(-10);
    const resultId = result?._id || result?.id || result?.user?._id || result?.vendor?._id || result?.franchise?._id || result?.delivery?._id || result?.admin?._id;
    const lookups = {
        admin: ["MasterAdmin", "SubAdmin"],
        franchise: ["Franchise"],
        vendor: ["Vendor"],
        delivery: ["Delivery"],
    }[type] || [];
    for (const modelName of lookups) {
        const Model = mongoose.models[modelName];
        if (!Model) continue;
        let doc = null;
        if (resultId && mongoose.isValidObjectId(resultId)) doc = await Model.findById(resultId).lean();
        if (!doc && email) doc = await Model.findOne({ email }).lean();
        if (!doc && mobile) doc = await Model.findOne({ mobile: { $regex: `${mobile}$` } }).lean();
        if (!doc) continue;
        const req = { [type === "admin" ? "masteradmin" : type]: doc };
        return actorFromRequest(req);
    }
    const typed = email || (mobile ? `+91 ${mobile}` : "");
    return { type: "unknown", id: null, name: typed || "Unknown", role: human(type === "delivery" ? "delivery partner" : type), contact: typed };
};

const resolve = async (value, args) => (typeof value === "function" ? value(args) : value);

const clientIp = (req) => {
    const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return (fwd || req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
};

const record = async ({ req, res, rule, params, before }) => {
    const status = res.statusCode;
    const ok = status >= 200 && status < 300;
    const body = res.locals.__auditBody;
    const result = body?.result ?? body?.results ?? body?.data ?? null;

    let actor = actorFromRequest(req);
    // Customer requests are never recorded
    if (!actor && req.user) return;

    if (rule.kind === "login") {
        actor = await actorFromIdentifier(rule.actorType, req.body, result);
    } else if (!actor && rule.actorType) {
        // Public routes (registration, password reset, first admin): only successful ones
        if (!ok) return;
        actor = await actorFromIdentifier(rule.actorType, req.body, result);
    }
    if (!actor) return;

    // Failed requests are recorded only when they are sign-ins or access was refused
    let outcome = "success";
    if (!ok) {
        if (rule.kind === "login") outcome = "failed";
        else if (status === 403) outcome = "denied";
        else return;
    }

    const ctx = { req, params, body: req.body || {}, result, actor, ok };

    let after = null;
    let targetId = "";
    if (rule.target && ok) {
        targetId = await resolve(rule.target.id, ctx);
        if (rule.kind !== "delete" && targetId) after = await rule.target.snap(String(targetId), ctx);
    } else if (rule.target) {
        targetId = await resolve(rule.target.id, ctx);
    }

    const changes = rule.kind === "update" && before && after ? diffValues(before.values, after.values) : [];
    if (rule.kind === "update" && ok && rule.quietIfUnchanged && changes.length === 0) return;

    const args = { changes, ctx, before, after };
    let details = [];
    if (rule.kind === "create" && after) details = valuesAsDetails(after.values);
    if (rule.kind === "delete" && before) details = valuesAsDetails(before.values);
    details = details.concat(before?.extra || after?.extra || []);
    if (rule.details) details = details.concat((await rule.details(ctx)) || []);
    details = details.filter((d) => d && d.value !== "" && d.value !== undefined && d.value !== null);

    let title = await resolve(rule.title, args);
    if (outcome === "denied") title = `Tried to make a change without permission: ${title}`;

    await AuditLog.create({
        actorType: actor.type,
        actorId: actor.id && mongoose.isValidObjectId(actor.id) ? actor.id : null,
        actorName: actor.name || "",
        actorRole: actor.role || "",
        actorContact: actor.contact || "",
        module: rule.module,
        action: rule.action,
        title,
        severity: outcome === "failed" || outcome === "denied" ? "important" : (await resolve(rule.severity, args)) || "info",
        targetType: rule.target?.type || "",
        targetId: targetId ? String(targetId) : "",
        targetLabel: after?.label || before?.label || "",
        changes,
        details,
        outcome,
        message: ok
            ? ""
            : outcome === "denied"
                ? "Their account does not have access to this section, so nothing was changed."
                : String(body?.message || "").slice(0, 300),
        ip: clientIp(req),
        device: deviceOf(req.headers["user-agent"]),
        method: req.method,
        path: req.originalUrl.split("?")[0].slice(0, 200),
    });
};

export const auditTrail = async (req, res, next) => {
    if (!WRITE_METHODS.has(req.method)) return next();
    const hit = matchRule(req.method, req.path);
    if (!hit) return next();

    const { rule, params } = hit;

    // Capture the response body so the log can read ids of newly created records
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
        res.locals.__auditBody = payload;
        return originalJson(payload);
    };

    // The actor is only known after the route's own auth middleware runs, so "before" is
    // taken here for every matching request; the cost is one small read per staff write.
    let before = null;
    if (rule.target && (rule.kind === "update" || rule.kind === "delete")) {
        try {
            const pre = { req, params, body: req.body || {}, result: null, actor: null };
            // Routes that act on "my own" record need the actor id, which is not known yet:
            // read the token's id directly for those.
            pre.actor = { id: tokenSubject(req) };
            const id = await resolve(rule.target.id, pre);
            if (id) before = await rule.target.snap(String(id), pre);
        } catch (err) {
            console.error("[audit] before-snapshot failed:", rule.action, err?.message);
        }
    }

    res.on("finish", () => {
        record({ req, res, rule, params, before }).catch((err) => {
            console.error("[audit] could not record", rule.action, err?.message);
        });
    });
    next();
};

/** Id inside the bearer token, without verifying it (used only to pick the record to snapshot). */
const tokenSubject = (req) => {
    try {
        const token = String(req.headers.authorization || "").split(" ")[1];
        if (!token) return null;
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
        return payload?.id || null;
    } catch {
        return null;
    }
};

export default auditTrail;
