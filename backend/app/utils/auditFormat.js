import mongoose from "mongoose";

/** Small formatting helpers shared by the audit-log rules. Everything returns plain text. */

export const M = (name) => mongoose.models[name];

export const isId = (v) => typeof v === "string" ? mongoose.isValidObjectId(v) : !!v && mongoose.isValidObjectId(String(v));

export const money = (n) => {
    if (n === null || n === undefined || n === "") return "";
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export const per = (amount, unit) => {
    const m = money(amount);
    return m && unit ? `${m}/${unit}` : m;
};

export const yesNo = (v) => (v === undefined || v === null ? "" : v ? "Yes" : "No");

export const onOff = (v) => (v === undefined || v === null ? "" : v ? "Online" : "Offline");

export const pct = (v) => (v === undefined || v === null || v === "" ? "" : `${Number(v)}%`);

export const num = (v, unit = "") => {
    if (v === undefined || v === null || v === "") return "";
    const n = Number(v);
    const text = Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : String(v);
    return unit ? `${text} ${unit}` : text;
};

export const date = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};

/** "pending_review" / "out for delivery" → "Pending review" / "Out for delivery" */
export const human = (v) => {
    if (v === undefined || v === null) return "";
    const s = String(v).replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
};

export const short = (v, max = 140) => {
    if (v === undefined || v === null) return "";
    const s = String(v).replace(/\s+/g, " ").trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export const list = (arr, max = 12) => {
    if (!Array.isArray(arr) || !arr.length) return "None";
    const items = arr.filter((x) => x !== undefined && x !== null && x !== "").map(String);
    if (!items.length) return "None";
    const sorted = [...items].sort((a, b) => a.localeCompare(b));
    return sorted.length > max ? `${sorted.slice(0, max).join(", ")} +${sorted.length - max} more` : sorted.join(", ");
};

export const orderRef = (id) => (id ? `#${String(id).slice(-6)}` : "");

/** Opaque values (photos, documents, bank details): the log says "updated" without storing them. */
export const fingerprint = (v) => {
    if (v === undefined || v === null || v === "") return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return `~${h}`;
};

/** Look up display names for a list of ids in one query. */
export const namesOf = async (modelName, ids, field = "name") => {
    const Model = M(modelName);
    const clean = (ids || []).map((x) => (x && x._id ? x._id : x)).filter((x) => isId(x));
    if (!Model || !clean.length) return [];
    const docs = await Model.find({ _id: { $in: clean } }).select(field).lean();
    return docs.map((d) => d[field]).filter(Boolean);
};

export const nameOf = async (modelName, id, field = "name") => (await namesOf(modelName, [id], field))[0] || "";

/** Turn a settings value into readable lines, one per key. */
export const flattenSetting = (value, prefix = "") => {
    const out = {};
    if (value === null || value === undefined) return out;
    if (typeof value !== "object" || Array.isArray(value)) {
        out[prefix || "Value"] = Array.isArray(value) ? short(value.map((x) => (typeof x === "object" ? JSON.stringify(x) : x)).join(", "), 200) : short(value, 200);
        return out;
    }
    for (const [k, v] of Object.entries(value)) {
        const label = prefix ? `${prefix} › ${human(k)}` : human(k);
        if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flattenSetting(v, label));
        else out[label] = Array.isArray(v) ? short(v.map((x) => (typeof x === "object" ? JSON.stringify(x) : x)).join(", "), 200) : short(v, 200);
    }
    return out;
};

/** Compare two {field: text} snapshots and return the fields that differ. */
export const diffValues = (before = {}, after = {}) => {
    const changes = [];
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const key of keys) {
        const a = before?.[key] ?? "";
        const b = after?.[key] ?? "";
        if (String(a) === String(b)) continue;
        const opaque = String(a).startsWith("~") || String(b).startsWith("~");
        changes.push(opaque
            ? { field: key, from: a ? "Previous" : "Not set", to: b ? "Updated" : "Removed" }
            : { field: key, from: String(a), to: String(b) });
    }
    return changes;
};

/** Values of a snapshot as display rows (used for created / deleted records). */
export const valuesAsDetails = (values = {}) =>
    Object.entries(values)
        .filter(([, v]) => v !== "" && v !== undefined && v !== null)
        .map(([label, v]) => ({ label, value: String(v).startsWith("~") ? "Provided" : String(v) }));

export const deviceOf = (ua = "") => {
    const s = String(ua);
    if (!s) return "";
    const os = /Android/i.test(s) ? "Android" : /iPhone|iPad|iOS/i.test(s) ? "iPhone/iPad" : /Windows/i.test(s) ? "Windows" : /Mac OS/i.test(s) ? "Mac" : /Linux/i.test(s) ? "Linux" : "";
    const app = /; wv\)/.test(s) || /Flutter|Dart/i.test(s) ? "App" : /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : /PostmanRuntime|curl|axios|node/i.test(s) ? "API tool" : "Browser";
    return [os, app].filter(Boolean).join(" · ");
};
