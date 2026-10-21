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

const cacheKey = (lang) => `vendorTr:v1:${lang}`; // bump the version when server wording changes
const langKey = (vendorId) => `vendorLang:${vendorId || ''}`;

const readCache = (lang) => {
    try { return JSON.parse(localStorage.getItem(cacheKey(lang)) || '{}'); } catch { return {}; }
};

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
        try {
            const res = await api.post('/vendor/translate', { texts, lang });
            const found = res.data?.result?.translations || {};
            setDict((prev) => {
                const next = { ...prev, ...found };
                try { localStorage.setItem(cacheKey(lang), JSON.stringify(next)); } catch { /* storage full */ }
                return next;
            });
        } catch {
            // show English for now; try again on a later render
            texts.forEach((t) => requested.current.delete(t));
        }
    }, [lang]);

    const t = useCallback((text) => {
        if (lang === 'en' || typeof text !== 'string') return text;
        const s = text.trim();
        if (!s || !/[A-Za-z]/.test(s)) return text;
        if (dict[s] !== undefined) return dict[s];
        if (!requested.current.has(s)) {
            requested.current.add(s);
            pending.current.add(s);
            if (!timer.current) timer.current = setTimeout(flush, 40);
        }
        return text;
    }, [lang, dict, flush]);

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
