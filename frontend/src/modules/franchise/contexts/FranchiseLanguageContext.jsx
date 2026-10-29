import { createPortalLanguage, PORTAL_LANGUAGES } from '@/lib/portalLanguage';
import { useFranchiseAuth } from './FranchiseAuthContext';

/**
 * Franchise portal language (asked for by the client, Oct 2026): the owner picks a language on first
 * login and can change it from My Profile. Same engine as the vendor portal (src/lib/portalLanguage.jsx);
 * English text on the pages is translated through /franchise/translate, Hindi text stays as written.
 */
export { PORTAL_LANGUAGES };

const { Provider, useLanguage } = createPortalLanguage({
    portal: 'franchise',
    cacheVersion: 2, // bump when server wording (glossary) changes; v2 drops caches poisoned with English (Oct 2026)
    useUser: () => useFranchiseAuth().franchise,
    dataKey: 'franchiseData',
    translatePath: '/franchise/translate',
    languagePath: '/franchise/language',
});

export const FranchiseLanguageProvider = Provider;
export const useFranchiseLanguage = useLanguage;
