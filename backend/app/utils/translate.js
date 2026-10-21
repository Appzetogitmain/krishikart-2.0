import translate from "google-translate-api-x";
import TranslationCache from "../models/translationCache.js";
import { PORTAL_LANGUAGES } from "./portalLanguages.js";

const MAX_TEXTS = 200;
const MAX_LENGTH = 500;
const BATCH = 50;
const memory = new Map(); // `${lang}\u0000${text}` -> translated

const key = (lang, text) => `${lang}\u0000${text}`;

// Portal words where Google's literal choice reads wrong to vendors (e.g. "Quotations" -> उद्धरण);
// these use the everyday words from the client's screens. Everything else goes to Google.
const GLOSSARY = {
    hi: {
        "Home": "होम",
        "Dashboard": "डैशबोर्ड",
        "Pack & Dispatch": "पैक & डिस्पैच",
        "Quotes": "कोटेशन",
        "My Quotations": "मेरे कोटेशन",
        "Dispatch History": "डिस्पैच हिस्ट्री",
        "More": "और",
        "To be packed": "तैयार करना है",
        "Pending": "पेंडिंग",
        "Packing": "पैकिंग चालू",
        "Ready": "तैयार है",
        "Dispatched": "डिस्पैच हो चुका",
        "Packed": "पैक किया गया",
        "Cancelled": "रद्द हुआ",
        "Received": "फ्रेंचाइज़ी को मिला",
        "Edit List": "लिस्ट एडिट करें",
        "Goods are ready for delivery": "सामान डिलीवरी के लिए तैयार है",
        "Send for delivery": "डिलीवरी के लिए भेजें",
        "Sent for delivery": "डिलीवरी के लिए भेज दिया",
        "Franchises you are preparing goods for today": "आज जिन फ्रेंचाइज़ी के लिए माल तैयार करना है",
        "All orders you have packed and dispatched.": "जितने भी ऑर्डर पैक और डिस्पैच हो चुके हैं।",
        "items": "आइटम",
        "Item": "सामान",
        "Quantity": "मात्रा",
        "Total items": "कुल आइटम",
        "Total Items": "कुल आइटम",
        "Total Orders": "कुल ऑर्डर",
        "Total quantity": "कुल मात्रा",
        "Total Quantity": "कुल मात्रा",
        "Total Value": "कुल वैल्यू",
        "Order Details": "ऑर्डर डिटेल",
        "Order ID": "ऑर्डर ID",
        "Franchise": "फ्रेंचाइज़",
        "All Franchises": "सभी फ्रेंचाइज़",
        "pcs": "पीस",
        "Filter": "फ़िल्टर करें",
        "Reset": "रीसेट",
        "Apply": "लागू करें",
        "Save": "सेव करें",
        "Cancel": "कैंसल करें",
        "Edit": "एडिट",
        "Done": "हो गया",
        "Save Changes": "बदलाव सेव करें",
        "Ordered": "ऑर्डर था",
        "Vendor": "वेंडर",
        "Today's Orders": "आज के ऑर्डर",
        "franchises": "फ्रेंचाइज़ी",
        "Manage Orders": "ऑर्डर मैनेज करें",
        "Inventory": "स्टॉक",
        "Reports": "रिपोर्ट",
        "Rejected Stock": "रिजेक्टेड स्टॉक",
        "Returns": "रिटर्न",
        "Account Settings": "अकाउंट सेटिंग",
        "Help & Support": "मदद और सपोर्ट",
        "Log Out": "लॉग आउट",
        "Action": "एक्शन",
        "View": "देखें",
        "Different items": "अलग-अलग सामान",
        "Orders": "ऑर्डर",
        "Dispatch": "डिस्पैच",
        "History": "हिस्ट्री",
        "Profile": "प्रोफ़ाइल",
        "Order Activity": "ऑर्डर एक्टिविटी",
        "Manage requests": "रिक्वेस्ट मैनेज करें",
        "Orders to dispatch": "डिस्पैच के लिए ऑर्डर",
        "Stock levels": "स्टॉक लेवल",
        "Stock Level": "स्टॉक लेवल",
        "Past orders": "पुराने ऑर्डर",
        "Active Orders": "एक्टिव ऑर्डर",
        "Open Orders": "खुले ऑर्डर",
        "Payment Pending": "पेमेंट बाकी",
        "Pickup Pending": "पिकअप बाकी",
        "Payment Time": "पेमेंट का समय",
        "Fulfillment": "फुलफिलमेंट",
        "Business Overview": "बिज़नेस ओवरव्यू",
        "Products Listed": "लिस्टेड प्रोडक्ट",
        "Market Ready": "मार्केट के लिए तैयार",
        "Last Updated": "आखिरी अपडेट",
        "Verified": "वेरिफ़ाइड",
        "Active": "एक्टिव",
        "Go to Dispatch": "डिस्पैच पर जाएं",
        "Recent Quotations": "हाल के कोटेशन",
        "View All": "सभी देखें",
        "Returns": "रिटर्न",
        "Goods franchises are sending back to you": "फ्रेंचाइज़ी से वापस आने वाले सामान की सूची",
        "Return details": "रिटर्न डिटेल",
        "Reason for return": "वापसी का कारण",
        "Item list": "आइटम सूची",
        "Accept": "स्वीकार",
        "Reject": "रिजेक्ट",
        "Accepted": "स्वीकार किया",
        "Partly accepted": "कुछ स्वीकार",
        "Rejected": "रिजेक्ट हुआ",
        "On the way": "रास्ते में",
        "Accept selected": "चयनित रिटर्न स्वीकार करें",
        "Item photo": "आइटम की फोटो",
        "Accept this item": "यह आइटम स्वीकार करें",
        "Reject this item": "यह आइटम रिजेक्ट करें",
        "Quantity you accept": "स्वीकार की गई मात्रा",
        "Review return": "रिटर्न समीक्षा करें",
        "Selected items": "चयनित आइटम",
        "Confirm return": "रिटर्न स्वीकार करें",
        "Reject return": "रिटर्न रिजेक्ट करें",
        "Return accepted": "रिटर्न स्वीकृत हो गया",
        "Return partly accepted": "रिटर्न कुछ हद तक स्वीकृत",
        "Return rejected": "रिटर्न रिजेक्ट हो गया",
        "Credit note": "क्रेडिट नोट",
        "OK": "ठीक है",
        "Damaged": "खराब",
        "Good": "अच्छा",
        "Damaged / spoiled": "खराब / सड़ा हुआ",
        "Note (optional)": "नोट (वैकल्पिक)",
        "Damaged goods": "खराब सामान",
    },
};

// Kept as-is in every language: vendors read "KG" off the scale
const KEEP = new Set(["KG"]);

/**
 * Translate English texts into `lang`. Returns { [text]: translated }.
 * Cached in memory and in Mongo; if Google can't be reached the original text is returned (and not cached).
 */
export async function translateTexts(texts, lang) {
    const unique = [...new Set((texts || [])
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t && t.length <= MAX_LENGTH))].slice(0, MAX_TEXTS);
    const out = {};
    if (lang === "en" || !PORTAL_LANGUAGES.includes(lang)) {
        unique.forEach((t) => { out[t] = t; });
        return out;
    }

    // "3 KG", "5 KG + 20 bundle": translate only the words around KG, so KG stays as on the scale
    const withKg = unique.filter((t) => t !== "KG" && /\bKG\b/.test(t));
    if (withKg.length) {
        const parts = withKg.map((t) => t.split(/(\bKG\b)/));
        const words = parts.flat().filter((s) => s !== "KG" && /[A-Za-z]/.test(s)).map((s) => s.trim());
        const done = words.length ? await translateTexts(words, lang) : {};
        withKg.forEach((t, k) => {
            out[t] = parts[k].map((s) => (s === "KG" || !/[A-Za-z]/.test(s) ? s : s.replace(s.trim(), done[s.trim()] ?? s.trim()))).join("");
        });
    }

    let missing = unique.filter((t) => {
        if (out[t] !== undefined) return false; // done above (KG texts)
        const hit = KEEP.has(t) ? t : GLOSSARY[lang]?.[t] ?? memory.get(key(lang, t));
        if (hit !== undefined) out[t] = hit;
        return hit === undefined;
    });

    if (missing.length) {
        const saved = await TranslationCache.find({ lang, text: { $in: missing } }).lean();
        for (const s of saved) {
            out[s.text] = s.translated;
            memory.set(key(lang, s.text), s.translated);
        }
        missing = missing.filter((t) => out[t] === undefined);
    }

    for (let i = 0; i < missing.length; i += BATCH) {
        const chunk = missing.slice(i, i + BATCH);
        try {
            const res = await translate(chunk, { from: "en", to: lang, forceBatch: true });
            const docs = [];
            chunk.forEach((t, j) => {
                const translated = res[j]?.text;
                if (!translated) return;
                out[t] = translated;
                memory.set(key(lang, t), translated);
                docs.push({ updateOne: { filter: { lang, text: t }, update: { $set: { translated } }, upsert: true } });
            });
            if (docs.length) await TranslationCache.bulkWrite(docs, { ordered: false });
        } catch (err) {
            console.error("[translate] Google Translate failed:", err.message);
        }
    }

    unique.forEach((t) => { if (out[t] === undefined) out[t] = t; });
    return out;
}
