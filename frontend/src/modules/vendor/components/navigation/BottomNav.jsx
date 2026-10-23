import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Grid3x3, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../../contexts/VendorAuthContext';
import { useVendorLanguage } from '../../contexts/VendorLanguageContext';
import { vendorNavItems, isVendorNavActive } from './vendorNavConfig';

// Day-to-day destinations stay on the bar; everything else is under "More"
const BAR_IDS = ['dashboard', 'quotations', 'dispatch', 'orders'];

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useVendorAuth();
    const { t } = useVendorLanguage();
    const [moreOpen, setMoreOpen] = useState(false);

    const barItems = BAR_IDS.map((id) => vendorNavItems.find((i) => i.id === id)).filter(Boolean);
    const moreItems = vendorNavItems.filter((i) => !BAR_IDS.includes(i.id));
    const moreActive = moreItems.some((i) => isVendorNavActive(location.pathname, i.path));

    const go = (path) => { setMoreOpen(false); navigate(path); };

    const tab = (key, Icon, label, active, onClick) => (
        <button
            key={key}
            type="button"
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 min-w-0 active:scale-95 transition-transform"
        >
            <Icon size={26} strokeWidth={active ? 2.4 : 1.8} className={active ? 'text-green-700' : 'text-slate-500'} />
            <span className={cn('text-xs leading-tight text-center line-clamp-1 px-0.5', active ? 'text-green-700 font-bold' : 'text-slate-600 font-medium')}>
                {label}
            </span>
        </button>
    );

    return (
        <>
            <nav
                className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_16px_rgba(0,0,0,0.06)]"
                style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
            >
                <div className="flex items-stretch px-1 pt-1.5 min-h-[60px]">
                    {barItems.map((item) => tab(item.id, item.icon, t(item.shortLabel || item.label), isVendorNavActive(location.pathname, item.path), () => go(item.path)))}
                    {tab('more', Grid3x3, t('More'), moreActive || moreOpen, () => setMoreOpen(true))}
                </div>
            </nav>

            {moreOpen && (
                <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/40" onClick={() => setMoreOpen(false)}>
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-900">{t('More')}</h3>
                            <button type="button" onClick={() => setMoreOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-600" aria-label="Close">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {moreItems.map((item) => {
                                const active = isVendorNavActive(location.pathname, item.path);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => go(item.path)}
                                        className={cn('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center', active ? 'border-green-600 bg-green-50' : 'border-slate-200')}
                                    >
                                        <item.icon size={26} className={active ? 'text-green-700' : 'text-slate-600'} />
                                        <span className="text-sm font-semibold text-slate-800 leading-tight">{t(item.label)}</span>
                                    </button>
                                );
                            })}
                            <button type="button" onClick={logout} className="flex flex-col items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-center">
                                <LogOut size={26} className="text-red-600" />
                                <span className="text-sm font-semibold text-red-700 leading-tight">{t('Log Out')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
