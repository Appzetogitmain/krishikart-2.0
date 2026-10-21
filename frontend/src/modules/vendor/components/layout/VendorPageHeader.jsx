import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, Languages, Leaf, UserCircle } from 'lucide-react';
import { useVendorAuth } from '../../contexts/VendorAuthContext';
import { PORTAL_LANGUAGES, useVendorLanguage } from '../../contexts/VendorLanguageContext';
import LanguagePickerModal from '../modals/LanguagePickerModal';

export function formatDay(date, locale) {
    try {
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    } catch {
        return new Date(date).toDateString();
    }
}

export function formatTime(date, locale) {
    try {
        return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
    } catch {
        return new Date(date).toLocaleTimeString();
    }
}

function LanguageButton({ compact = false }) {
    const { lang } = useVendorLanguage();
    const [open, setOpen] = useState(false);
    const current = PORTAL_LANGUAGES.find((l) => l.code === lang);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 h-10 px-3 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-semibold"
                title="Change language"
            >
                <Languages size={18} className="text-green-700" />
                {!compact && <span>{current?.name || 'English'}</span>}
            </button>
            <LanguagePickerModal open={open} closable onClose={() => setOpen(false)} />
        </>
    );
}

/** Mobile app bar: brand on the left, language + notifications on the right. */
export function VendorMobileTopBar() {
    const navigate = useNavigate();
    return (
        <div className="lg:hidden flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
                <Leaf size={38} className="text-green-600 fill-green-600" strokeWidth={1.5} />
                <div className="leading-tight" translate="no">
                    <p className="text-xl font-bold text-slate-900">Vendor Portal</p>
                    <p className="text-xs font-semibold tracking-wider text-slate-500">KISAANKART</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <LanguageButton compact />
                <button
                    type="button"
                    onClick={() => navigate('/vendor/orders')}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700"
                    aria-label="Notifications"
                >
                    <Bell size={24} />
                </button>
            </div>
        </div>
    );
}

/** Desktop page header: icon + title on the left, today's date and the vendor on the right. */
export function VendorDesktopHeader({ icon: Icon, title, subtitle, dateSlot }) {
    const { vendor } = useVendorAuth();
    const { t, locale } = useVendorLanguage();
    return (
        <div className="hidden lg:flex items-center gap-5 mb-6">
            {Icon && (
                <div className="w-16 h-16 rounded-full bg-green-50 text-green-700 flex items-center justify-center shrink-0">
                    <Icon size={30} />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold text-slate-900 leading-tight">{title}</h1>
                {subtitle && <p className="text-base text-slate-600 mt-1">{subtitle}</p>}
            </div>
            {dateSlot || (
                <div className="flex items-center gap-3 h-16 px-5 rounded-2xl border border-slate-200 bg-white">
                    <CalendarDays size={24} className="text-slate-700" />
                    <div className="leading-tight">
                        <p className="text-xs text-slate-500">{t('Today')}</p>
                        <p className="text-base font-semibold text-slate-900">{formatDay(new Date(), locale)}</p>
                    </div>
                </div>
            )}
            <div className="flex items-center gap-3 pl-5 border-l border-slate-200">
                {vendor?.profilePicture ? (
                    <img src={vendor.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                    <UserCircle size={44} className="text-slate-400" />
                )}
                <div className="leading-tight max-w-[160px]">
                    <p className="text-base font-bold text-slate-900 truncate" translate="no">{vendor?.fullName || 'Vendor'}</p>
                    <p className="text-sm text-slate-500">{t('Vendor')}</p>
                </div>
                <LanguageButton />
            </div>
        </div>
    );
}
