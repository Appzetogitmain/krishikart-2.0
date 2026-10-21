import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { useVendorAuth } from './VendorAuthContext';

/**
 * Vendor portal language. Text is written in English and translated on the fly through the
 * backend (/vendor/translate -> google-translate-api-x, cached on the server and in this browser).
 */
export const PORTAL_LANGUAGES = [
    { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
    { code: 'en', name: 'English', english: 'English' },
    { code: 'mr', name: 'मराठी', english: 'Marathi' },
    { code: 'gu', name: 'ગુજરાતી', english: 'Gujarati' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
    { code: 'bn', name: 'বাংলা', english: 'Bengali' },
    { code: 'ta', name: 'தமிழ்', english: 'Tamil' },
    { code: 'te', name: 'తెలుగు', english: 'Telugu' },
    { code: 'kn', name: 'ಕನ್ನಡ', english: 'Kannada' },
    { code: 'ml', name: 'മലയാളം', english: 'Malayalam' },
];
const CODES = PORTAL_LANGUAGES.map((l) => l.code);

const cacheKey = (lang) => `vendorTr:v6:${lang}`; // bump the version when server wording changes
const langKey = (vendorId) => `vendorLang:${vendorId || ''}`;

const readCache = (lang) => {
    try { return JSON.parse(localStorage.getItem(cacheKey(lang)) || '{}'); } catch { return {}; }
};

/* ---------- whole-page translation ----------
 * Pages written before the language option have their English in the JSX. Instead of editing every
 * string, translate the text the portal actually shows: each English text node (and placeholder) is
 * swapped for its translation, and the English is kept so React updates and switching back still work.
 * Mark anything that must stay as typed (names, IDs) with translate="no" or data-no-translate.
 */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG']);

// Worth translating: has a real word, and isn't a code/ID/amount like "#436EF218", "INV-2026-0099", "30426m"
const translatable = (s) => /[A-Za-z]{2,}/.test(s) && !/^[#₹]?[\w./:@-]*\d[\w./:@-]*$/.test(s) && !/\S+@\S+\.\S+/.test(s) && !/^https?:/.test(s);

function skipped(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (SKIP_TAGS.has(n.tagName?.toUpperCase())) return true;
        if (n.getAttribute?.('translate') === 'no' || n.hasAttribute?.('data-no-translate') || n.isContentEditable) return true;
    }
    return false;
}

function useAutoTranslate(lang, dict, request) {
    const texts = useRef(new Map()); // text node -> { original, shown }
    const holders = useRef(new Map()); // element -> { original, shown } for placeholders
    const dictRef = useRef(dict);
    const applyRef = useRef(() => {});

    useEffect(() => {
        dictRef.current = dict;
        applyRef.current();
    }, [dict]);

    useEffect(() => {
        const restore = () => {
            texts.current.forEach((v, node) => { if (node.nodeValue === v.shown) node.nodeValue = v.original; });
            holders.current.forEach((v, el) => { if (el.getAttribute('placeholder') === v.shown) el.setAttribute('placeholder', v.original); });
            texts.current = new Map();
            holders.current = new Map();
        };
        if (lang === 'en') { restore(); applyRef.current = () => {}; return undefined; }

        const swap = (current, entry) => {
            // React (or the page) wrote new text since our last swap: that is the new English
            const original = entry && current === entry.shown ? entry.original : current;
            const lead = original.match(/^\s*/)[0];
            const trail = original.match(/\s*$/)[0];
            const core = original.trim();
            if (!core || !translatable(core)) return { original, shown: original };
            const hit = dictRef.current[core];
            if (hit === undefined) { request(core); return { original, shown: original }; }
            return { original, shown: lead + hit + trail };
        };

        const visitText = (node) => {
            if (!node.parentElement || skipped(node.parentElement)) return;
            const entry = texts.current.get(node);
            const current = node.nodeValue;
            if (entry && current === entry.shown && entry.shown !== entry.original) return;
            const next = swap(current, entry);
            texts.current.set(node, next);
            if (next.shown !== current) node.nodeValue = next.shown;
        };

        const visitHolder = (el) => {
            if (skipped(el.parentElement || el)) return;
            const entry = holders.current.get(el);
            const current = el.getAttribute('placeholder') || '';
            if (entry && current === entry.shown && entry.shown !== entry.original) return;
            const next = swap(current, entry);
            holders.current.set(el, next);
            if (next.shown !== current) el.setAttribute('placeholder', next.shown);
        };

        const scan = (root) => {
            if (root.nodeType === Node.TEXT_NODE) { visitText(root); return; }
            if (root.nodeType !== Node.ELEMENT_NODE) return;
            if (root.hasAttribute('placeholder')) visitHolder(root);
            root.querySelectorAll?.('[placeholder]').forEach(visitHolder);
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) visitText(n);
        };

        // Re-apply everything we know (after new translations arrive); forget nodes that left the page
        // (iterate over a copy: visiting re-adds entries, and a live Map would loop forever)
        applyRef.current = () => {
            [...texts.current].forEach(([node, v]) => {
                if (!node.isConnected) { texts.current.delete(node); return; }
                if (v.shown === v.original) { texts.current.delete(node); visitText(node); }
            });
            [...holders.current].forEach(([el, v]) => {
                if (!el.isConnected) { holders.current.delete(el); return; }
                if (v.shown === v.original) { holders.current.delete(el); visitHolder(el); }
            });
        };

        let queued = new Set();
        let frame = 0;
        const run = () => {
            frame = 0;
            const batch = queued;
            queued = new Set();
            batch.forEach((n) => { if (n.isConnected) scan(n); });
        };
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'characterData') queued.add(m.target);
                else if (m.type === 'attributes') queued.add(m.target);
                else m.addedNodes.forEach((n) => queued.add(n));
            }
            if (!frame) frame = requestAnimationFrame(run);
        });
        scan(document.body);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder'] });
        return () => {
            observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
            restore();
        };
    }, [lang, request]);
}

const VendorLanguageContext = createContext({ lang: 'en', t: (s) => s, setLanguage: async () => {}, needsChoice: false });

export function VendorLanguageProvider({ children }) {
    const { vendor } = useVendorAuth();
    const vendorId = vendor?._id || vendor?.id;

    const initial = () => {
        const saved = vendorId && localStorage.getItem(langKey(vendorId));
        const lang = vendor?.preferredLanguage || saved;
        return CODES.includes(lang) ? lang : null;
    };
    const [chosen, setChosen] = useState(initial);
    const lang = chosen || 'en';
    const [dict, setDict] = useState(() => (lang === 'en' ? {} : readCache(lang)));

    const pending = useRef(new Set());
    const requested = useRef(new Set());
    const timer = useRef(null);

    // Vendor changed (login/logout) or the server has a language this browser doesn't know yet
    useEffect(() => { setChosen(initial()); }, [vendorId, vendor?.preferredLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setDict(lang === 'en' ? {} : readCache(lang));
        pending.current = new Set();
        requested.current = new Set();
    }, [lang]);

    // Chosen on this device before the server knew about it: tell the server once
    useEffect(() => {
        if (vendorId && chosen && !vendor?.preferredLanguage) {
            api.put('/vendor/language', { language: chosen }).catch(() => {});
        }
    }, [vendorId, chosen, vendor?.preferredLanguage]);

    const flush = useCallback(async () => {
        timer.current = null;
        const texts = [...pending.current];
        pending.current = new Set();
        if (!texts.length || lang === 'en') return;
        // the server takes up to 200 phrases per call
        for (let i = 0; i < texts.length; i += 150) {
            const chunk = texts.slice(i, i + 150);
            try {
                const res = await api.post('/vendor/translate', { texts: chunk, lang });
                const found = res.data?.result?.translations || {};
                setDict((prev) => {
                    const next = { ...prev, ...found };
                    try { localStorage.setItem(cacheKey(lang), JSON.stringify(next)); } catch { /* storage full */ }
                    return next;
                });
            } catch {
                // show English for now; try again on a later render
                chunk.forEach((t) => requested.current.delete(t));
            }
        }
    }, [lang]);

    // Ask the server for a phrase we don't have yet (batched)
    const request = useCallback((s) => {
        if (requested.current.has(s)) return;
        requested.current.add(s);
        pending.current.add(s);
        if (!timer.current) timer.current = setTimeout(flush, 60);
    }, [flush]);

    const t = useCallback((text) => {
        if (lang === 'en' || typeof text !== 'string') return text;
        const s = text.trim();
        if (!s || !/[A-Za-z]/.test(s)) return text;
        if (dict[s] !== undefined) return dict[s];
        request(s);
        return text;
    }, [lang, dict, request]);

    useAutoTranslate(lang, dict, request);

    // Indian scripts break apart with the wide letter-spacing used on small headings (see index.css)
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('portal-indic', lang !== 'en');
        return () => root.classList.remove('portal-indic');
    }, [lang]);

    const setLanguage = useCallback(async (code) => {
        if (!CODES.includes(code)) return;
        setChosen(code);
        if (vendorId) localStorage.setItem(langKey(vendorId), code);
        try {
            await api.put('/vendor/language', { language: code });
            const data = JSON.parse(localStorage.getItem('vendorData') || 'null');
            if (data) localStorage.setItem('vendorData', JSON.stringify({ ...data, preferredLanguage: code }));
        } catch { /* saved on this device; synced on next load */ }
    }, [vendorId]);

    const locale = `${lang}-IN`;

    return (
        <VendorLanguageContext.Provider value={{ lang, locale, t, setLanguage, needsChoice: !!vendorId && !chosen }}>
            {children}
        </VendorLanguageContext.Provider>
    );
}

export const useVendorLanguage = () => useContext(VendorLanguageContext);
