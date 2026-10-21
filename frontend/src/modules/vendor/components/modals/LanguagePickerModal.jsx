import { useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PORTAL_LANGUAGES, useVendorLanguage } from '../../contexts/VendorLanguageContext';

/** Shown once, on a vendor's first login, so they can use the portal in the language they are comfortable with. */
export default function LanguagePickerModal({ open, onClose, closable = false }) {
    const { lang, setLanguage } = useVendorLanguage();
    const [selected, setSelected] = useState(closable ? lang : 'hi');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const save = async () => {
        setSaving(true);
        await setLanguage(selected);
        setSaving(false);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-6">
            <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center">
                        <Languages size={26} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">अपनी भाषा चुनें</h2>
                        <p className="text-base text-slate-500">Choose your language</p>
                    </div>
                </div>
                <p className="text-sm text-slate-500 mt-3 mb-4">
                    पूरा पोर्टल इसी भाषा में दिखेगा। बाद में Account Settings से बदल सकते हैं।
                </p>

                <div className="grid grid-cols-2 gap-3">
                    {PORTAL_LANGUAGES.map((l) => {
                        const active = selected === l.code;
                        return (
                            <button
                                key={l.code}
                                type="button"
                                onClick={() => setSelected(l.code)}
                                className={cn(
                                    'relative flex flex-col items-start rounded-2xl border-2 px-4 py-3 text-left transition-colors',
                                    active ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
                                )}
                            >
                                <span className="text-lg font-bold text-slate-900">{l.name}</span>
                                <span className="text-sm text-slate-500">{l.english}</span>
                                {active && (
                                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                                        <Check size={16} strokeWidth={3} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-3 mt-6">
                    {closable && (
                        <button type="button" onClick={onClose} className="flex-1 h-14 rounded-2xl border-2 border-slate-200 text-lg font-semibold text-slate-700">
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="flex-[2] h-14 rounded-2xl bg-green-700 text-white text-lg font-bold disabled:opacity-60"
                    >
                        {saving ? '...' : 'आगे बढ़ें / Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
}
