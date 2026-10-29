import { createPortalLanguage, PORTAL_LANGUAGES } from '@/lib/portalLanguage';
import { useVendorAuth } from './VendorAuthContext';

/**
 * Vendor portal language: the shared engine in src/lib/portalLanguage.jsx, wired to the vendor login and
 * the /vendor/translate + /vendor/language endpoints. Storage keys: vendorTr:v<cacheVersion>, vendorLang.
 */
export { PORTAL_LANGUAGES };

const { Provider, useLanguage } = createPortalLanguage({
    portal: 'vendor',
    cacheVersion: 10, // bump when server wording (glossary) changes; v10 drops caches poisoned with English (Oct 2026)
    useUser: () => useVendorAuth().vendor,
    dataKey: 'vendorData',
    translatePath: '/vendor/translate',
    languagePath: '/vendor/language',
});

export const VendorLanguageProvider = Provider;
export const useVendorLanguage = useLanguage;
