import { createPortalLanguage, PORTAL_LANGUAGES } from '@/lib/portalLanguage';
import { useFranchiseAuth } from './FranchiseAuthContext';

/**
 * Franchise portal language (asked for by the client, Oct 2026): the owner picks a language on first
 * login and can change it from My Profile. Same engine as the vendor portal (src/lib/portalLanguage.jsx);
 * Pages mix English and Hindi (the redesign follows the client's Hindi mockups), so both are translated
 * through /franchise/translate - Hindi too, including into English - and "English / हिन्दी" labels show
 * only the chosen language's half.
 */
export { PORTAL_LANGUAGES };

const { Provider, useLanguage } = createPortalLanguage({
    portal: 'franchise',
    cacheVersion: 3, // bump when server wording (glossary) changes; v2 dropped caches poisoned with English, v3 new Hindi->English wording (Oct 2026)
    useUser: () => useFranchiseAuth().franchise,
    dataKey: 'franchiseData',
    translatePath: '/franchise/translate',
    languagePath: '/franchise/language',
    hindiSource: true,
});

export const FranchiseLanguageProvider = Provider;
export const useFranchiseLanguage = useLanguage;
