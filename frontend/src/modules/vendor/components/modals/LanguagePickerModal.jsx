import SharedLanguagePickerModal from '@/components/LanguagePickerModal';
import { useVendorLanguage } from '../../contexts/VendorLanguageContext';

/** Shown once, on a vendor's first login, so they can use the portal in the language they are comfortable with. */
export default function LanguagePickerModal({ open, onClose, closable = false }) {
    const { lang, setLanguage } = useVendorLanguage();
    return <SharedLanguagePickerModal open={open} onClose={onClose} closable={closable} lang={lang} setLanguage={setLanguage} changeHint="Account Settings" />;
}
