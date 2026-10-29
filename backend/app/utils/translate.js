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
        "Rejected Stock": "रिजेक्ट स्टॉक",
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
        "Franchises that rejected goods": "जिन फ्रेंचाइज़ी ने सामान रिजेक्ट किया है",
        "Namaste": "नमस्ते",
        "Here is today's work.": "आज का काम यहाँ है।",
        "New requests": "नए ऑर्डर",
        "Enter your rates": "रेट भरें",
        "Enter rates": "रेट भरें",
        "To pack": "पैक करना है",
        "Ready for pickup": "पिकअप के लिए तैयार",
        "Waiting for delivery": "डिलीवरी का इंतज़ार",
        "Payment pending": "पेमेंट बाकी",
        "To be paid to you": "आपको मिलना है",
        "Today's work": "आज का काम",
        "New orders": "नए ऑर्डर",
        "Recent orders": "हाल के ऑर्डर",
        "Requests from franchises": "फ्रेंचाइज़ी से आए ऑर्डर",
        "New request": "नया ऑर्डर",
        "Quote sent": "रेट भेजा",
        "Admin offer": "एडमिन का ऑफर",
        "Reply to the offer": "ऑफर का जवाब दें",
        "Waiting for admin": "एडमिन का इंतज़ार",
        "Pack the goods": "माल पैक करें",
        "Waiting for pickup": "पिकअप का इंतज़ार",
        "Reply": "जवाब दें",
        "Your quote": "आपका रेट",
        "Final price": "फाइनल रेट",
        "Total quotations": "कुल कोटेशन",
        "Approved": "मंज़ूर",
        "Approved value": "मंज़ूर वैल्यू",
        "reduced": "कम हुआ",
        "raised": "बढ़ा",
        "Amount": "रकम",
        "Completed": "पूरे हुए",
        "New": "नए",
        "Quotations": "कोटेशन",
        "Rotten": "सड़ा हुआ",
        "Overripe / mushy": "गल सड़ा",
        "Small size": "छोटे आकार",
        "Dried / wilted": "सूखी / मुरझाई",
        "Damaged / crushed": "खराब / दबा हुआ",
        "Total franchises": "कुल फ्रेंचाइज़ी",
        "Total deduction": "कुल कटौती",
        "Total deducted value": "कुल कटौती",
        "Total rejected": "कुल रिजेक्ट",
        "Item details": "आइटम विवरण",
        "Photos": "तस्वीरें",
        "Rejected quantity": "रिजेक्ट मात्रा",
        "Rejected qty": "रिजेक्ट मात्रा",
        "Rejection reason": "रिजेक्ट कारण",
        "Rejection date": "रिजेक्ट दिनांक",
        "Rejection time": "रिजेक्ट समय",
        "Reason": "कारण",
        "Rate": "दर",
        "Value": "वैल्यू",
        "Images": "तस्वीरें",
        "My Rates": "मेरे रेट",
        "Rates": "रेट",
        "Save Rates": "रेट सेव करें",
        "Rates saved": "रेट सेव हो गए",
        "No rate yet": "रेट नहीं भरा",
        "Available": "उपलब्ध",
        "Not available": "उपलब्ध नहीं",
        "Products with rate": "रेट वाले प्रोडक्ट",
        "My Products & Rates": "मेरे प्रोडक्ट और रेट",
        "Set your own rate. The admin gives you orders at this rate.": "अपना रेट खुद भरें। एडमिन इसी रेट पर ऑर्डर देगा।",
        "Set your own rates": "अपने रेट खुद भरें",
        "Open orders": "चालू ऑर्डर",
        "orders": "ऑर्डर",
        "Order": "ऑर्डर",
        "Total of": "कुल",
        "Total": "कुल",
        "Franchise-wise total of all orders": "फ्रेंचाइज़ी के हिसाब से सभी ऑर्डर का टोटल",
        "Franchise orders with the same items added up.": "फ्रेंचाइज़ी के ऑर्डर, एक जैसा सामान जोड़कर।",
        "Same items from all orders are added up. Tap an item to see each order.": "सभी ऑर्डर का एक जैसा सामान जोड़ दिया गया है। हर ऑर्डर देखने के लिए सामान पर टैप करें।",
        "Old requests waiting for your rate": "पुराने ऑर्डर जिनका रेट बाकी है",
        "Orders appear here when the admin gives you a franchise order.": "एडमिन जब फ्रेंचाइज़ी का ऑर्डर देगा, वह यहाँ दिखेगा।",
        "Enter a correct rate": "सही रेट भरें",
        "Quotation": "कोटेशन",
        "Past Quotations": "पुराने कोटेशन",
        "Quotation / Rate Negotiation": "कोटेशन / रेट बातचीत",
        "Send your rates for today's list. Admin will review and respond.": "आज की लिस्ट के रेट भेजें। एडमिन देखकर जवाब देगा।",
        "Today's Total Requirement": "आज की कुल आवश्यकता",
        "Send your rates": "अपने रेट भेजें",
        "So that we can confirm and proceed with packing.": "ताकि हम कन्फर्म करके पैकिंग शुरू कर सकें।",
        "Negotiation": "बातचीत",
        "Final": "फाइनल",
        "Required Qty": "ज़रूरी मात्रा",
        "My Quotation": "मेरा कोटेशन",
        "Rate I am giving": "मेरा दिया रेट",
        "Admin Response": "एडमिन का जवाब",
        "Status": "स्टेटस",
        "Not sent": "नहीं भेजा",
        "Send": "भेजें",
        "Update": "अपडेट करें",
        "Send All Rates": "सभी रेट भेजें",
        "Send Updated Quotation": "अपडेटेड रेट भेजें",
        "Update rates for pending items and send to admin. Accepted items will be removed from this list.": "बाकी आइटम के रेट अपडेट करके एडमिन को भेजें। फाइनल हुए आइटम लिस्ट से हट जाएंगे।",
        "Negotiation Progress": "बातचीत की प्रगति",
        "Items Finalized": "आइटम फाइनल",
        "Total Quotation Value": "कुल कोटेशन वैल्यू",
        "Recent Messages": "हाल के संदेश",
        "No messages yet": "अभी कोई संदेश नहीं",
        "Admin": "एडमिन",
        "You": "आप",
        "e.g. Can you do a little less?": "जैसे - थोड़ा और कम कर सकते हैं?",
        "After accepting all items, quotation will be finalized.": "सभी आइटम स्वीकार होने के बाद कोटेशन फाइनल हो जाएगा।",
        "Today's Quotation List": "आज की कोटेशन लिस्ट",
        "items finalized": "आइटम फाइनल हो चुके हैं",
        "They have been removed from this list.": "ये लिस्ट से हट गए हैं।",
        "All rates agreed": "सभी रेट फाइनल",
        "Agreed items are in Pack & Dispatch.": "फाइनल आइटम पैक & डिस्पैच में हैं।",
        "Admin has replied": "एडमिन ने जवाब दिया",
        "Accept the admin rate or send your new rate.": "एडमिन का रेट मानें या अपना नया रेट भेजें।",
        "Admin will review and respond.": "एडमिन देखकर जवाब देगा।",
        "No item finalized today": "आज कोई आइटम फाइनल नहीं हुआ",
        "No items waiting for your rate": "रेट के लिए कोई आइटम बाकी नहीं",
        "Items appear here when the admin gives you franchise orders.": "एडमिन जब फ्रेंचाइज़ी के ऑर्डर देगा, आइटम यहाँ दिखेंगे।",
        "Rates sent to admin": "रेट एडमिन को भेज दिए",
        "Rate agreed — item moved to packing": "रेट फाइनल — आइटम पैकिंग में गया",
        "Rate accepted": "रेट स्वीकार हुआ",
        "Enter a rate for at least one item": "कम से कम एक आइटम का रेट भरें",
        "Today's List": "आज की लिस्ट",
        "In negotiation": "बातचीत चल रही",
        "Finalized": "फाइनल हुए",
        "Send rates": "रेट भेजें",
        "Send Rates": "रेट भेजें",
        "Still to send": "अभी भेजना बाकी",
        "All sent": "सब भेज दिए",
        "Send today's rates": "आज के लिए रेट भेज दें",
        "The franchise total requirement list is ready.": "फ्रेंचाइज़ी की कुल आवश्यकता की लिस्ट तैयार है।",
        "Open negotiation": "बातचीत खोलें",
        "Recent Activity": "हाल की गतिविधि",
        "Payments": "पेमेंट",
        "to pack": "पैक करना है",
        "to be paid to you": "आपको मिलना है",
        "Orders waiting for rate agreement": "रेट फाइनल होने बाकी ऑर्डर",
        "Send your rates on the Quotation page.": "कोटेशन पेज पर अपने रेट भेजें।",
    },
};

// Kept as-is in every language: vendors read "KG" off the scale
const KEEP = new Set(["KG"]);

// Text written in Hindi (the franchise pages follow the client's Hindi mockups) is translated from Hindi
const isHindi = (t) => /[ऀ-ॿ]/.test(t);
const sourceOf = (t) => (isHindi(t) ? "hi" : "en");

// Hindi page text where Google's English reads wrong ("सामान" -> "stuff", "तैयार करने हैं" -> "have to prepare")
const FROM_HINDI = {
    en: {
        "नमस्ते! आज का काम": "Namaste! Today's work",
        "तैयार करने हैं": "To prepare",
        "रास्ते में हैं": "On the way",
        "दोबारा मंगवाएँ": "Reorder",
        "सामान पर \"+ जोड़ें\" दबाएं": "Tap \"+ Add\" on an item",
        "खराब माल वापस भेजें और उसका हिसाब देखें": "Send back damaged goods and keep track of them",
        "चेक करना है": "To check",
        "+ जोड़ें": "+ Add",
        "ज़रूरी:": "Important:",
        "स्टॉक की कुल कीमत": "Total stock value",
    },
};
// Words swapped before Google sees the Hindi, so they come out as the portal says them
const HINDI_WORDS = { en: [[/सामान/g, "items"]] };
const forGoogle = (t, from, lang) => (from === "hi" ? (HINDI_WORDS[lang] || []).reduce((s, [re, w]) => s.replace(re, w), t) : t);
// Google gives "new orders" for "नए ऑर्डर": portal labels start with a capital
const tidy = (text, from, lang) => (from === "hi" && lang === "en" ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * Translate portal texts into `lang`. Returns { [text]: translated }. Texts are English, or Hindi when
 * they contain Devanagari; a text already in `lang` comes back as it is.
 * Cached in memory and in Mongo. A text Google could not translate is returned as the original English,
 * unless `keepMissing` is false: then it is left out, so a portal can ask again later instead of caching
 * the English as if it were the translation (that cache made the franchise language switch look broken).
 */
export async function translateTexts(texts, lang, { keepMissing = true } = {}) {
    const unique = [...new Set((texts || [])
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t && t.length <= MAX_LENGTH))].slice(0, MAX_TEXTS);
    const out = {};
    if (!PORTAL_LANGUAGES.includes(lang)) {
        unique.forEach((t) => { out[t] = t; });
        return out;
    }
    unique.forEach((t) => { if (sourceOf(t) === lang) out[t] = t; });

    // "3 KG", "5 KG + 20 bundle": translate only the words around KG, so KG stays as on the scale
    const withKg = unique.filter((t) => out[t] === undefined && sourceOf(t) === "en" && t !== "KG" && /\bKG\b/.test(t));
    if (withKg.length) {
        const parts = withKg.map((t) => t.split(/(\bKG\b)/));
        const words = parts.flat().filter((s) => s !== "KG" && /[A-Za-z]/.test(s)).map((s) => s.trim());
        const done = words.length ? await translateTexts(words, lang, { keepMissing }) : {};
        withKg.forEach((t, k) => {
            out[t] = parts[k].map((s) => (s === "KG" || !/[A-Za-z]/.test(s) ? s : s.replace(s.trim(), done[s.trim()] ?? s.trim()))).join("");
        });
    }

    let missing = unique.filter((t) => {
        if (out[t] !== undefined) return false; // already in this language, or done above (KG texts)
        const hit = KEEP.has(t) ? t : (sourceOf(t) === "en" ? GLOSSARY : FROM_HINDI)[lang]?.[t] ?? memory.get(key(lang, t));
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

    const save = async (pairs) => {
        if (!pairs.length) return;
        await TranslationCache.bulkWrite(pairs.map(([text, translated]) => (
            { updateOne: { filter: { lang, text }, update: { $set: { translated } }, upsert: true } }
        )), { ordered: false });
    };
    const keep = (t, translated) => { out[t] = translated; memory.set(key(lang, t), translated); };

    const chunks = [];
    for (const from of ["en", "hi"]) {
        const list = missing.filter((t) => sourceOf(t) === from);
        for (let i = 0; i < list.length; i += BATCH) chunks.push([from, list.slice(i, i + BATCH)]);
    }
    for (const [from, chunk] of chunks) {
        try {
            // One phrase Google rejects must not fail the whole batch (it comes back null instead)
            const res = await translate(chunk.map((t) => forGoogle(t, from, lang)), { from, to: lang, forceBatch: true, rejectOnPartialFail: false });
            const pairs = [];
            chunk.forEach((t, j) => {
                const translated = res?.[j]?.text && tidy(res[j].text, from, lang);
                if (translated) { keep(t, translated); pairs.push([t, translated]); }
            });
            await save(pairs);
        } catch (err) {
            console.error("[translate] Google Translate batch failed:", err.message);
        }
    }

    // Whatever the batch could not do: one at a time (a few, so a Google outage doesn't stall the request)
    const retry = missing.filter((t) => out[t] === undefined).slice(0, 15);
    for (const t of retry) {
        try {
            const from = sourceOf(t);
            const res = await translate(forGoogle(t, from, lang), { from, to: lang, forceBatch: false });
            if (res?.text) { const done = tidy(res.text, from, lang); keep(t, done); await save([[t, done]]); }
        } catch (err) {
            console.error("[translate] Google Translate failed for one text:", err.message);
        }
    }

    if (keepMissing) unique.forEach((t) => { if (out[t] === undefined) out[t] = t; });
    return out;
}
