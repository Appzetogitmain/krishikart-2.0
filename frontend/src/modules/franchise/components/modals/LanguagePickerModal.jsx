import SharedLanguagePickerModal from '@/components/LanguagePickerModal';
import { useFranchiseLanguage } from '../../contexts/FranchiseLanguageContext';

/** Shown once on the franchise owner's first login, and again from My Profile > Language. */
export default function LanguagePickerModal({ open, onClose, closable = false }) {
    const { lang, setLanguage } = useFranchiseLanguage();
    return <SharedLanguagePickerModal open={open} onClose={onClose} closable={closable} lang={lang} setLanguage={setLanguage} changeHint="My Profile" />;
}
