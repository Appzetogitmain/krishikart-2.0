import { createPortalLanguage, PORTAL_LANGUAGES } from '@/lib/portalLanguage';
import { useVendorAuth } from './VendorAuthContext';

/**
 * Vendor portal language: the shared engine in src/lib/portalLanguage.jsx, wired to the vendor login and
 * the /vendor/translate + /vendor/language endpoints. Storage keys are unchanged (vendorTr:v9, vendorLang).
 */
export { PORTAL_LANGUAGES };

const { Provider, useLanguage } = createPortalLanguage({
    portal: 'vendor',
    cacheVersion: 9, // bump when server wording (glossary) changes
    useUser: () => useVendorAuth().vendor,
    dataKey: 'vendorData',
    translatePath: '/vendor/translate',
    languagePath: '/vendor/language',
});

export const VendorLanguageProvider = Provider;
export const useVendorLanguage = useLanguage;
