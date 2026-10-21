import { useNavigate, useLocation } from 'react-router-dom';
import { Leaf, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../../contexts/VendorAuthContext';
import { useVendorLanguage } from '../../contexts/VendorLanguageContext';
import { vendorNavItems, isVendorNavActive } from './vendorNavConfig';

export default function Sidebar() {
    const { logout } = useVendorAuth();
    const { t } = useVendorLanguage();
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="h-full bg-white border-r border-slate-100 flex flex-col px-4 py-6">
            <div className="flex items-center gap-3 px-3 mb-8">
                <Leaf size={44} className="text-green-600 fill-green-600 shrink-0" strokeWidth={1.5} />
                <div>
                    <h2 className="text-2xl font-bold tracking-tight leading-none text-slate-900">Vendor Portal</h2>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.15em] mt-1.5">KisaanKart</p>
                </div>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
                {vendorNavItems.map((item) => {
                    const isActive = isVendorNavActive(location.pathname, item.path);
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors text-left",
                                isActive
                                    ? "bg-green-700 text-white shadow-md shadow-green-700/20"
                                    : "text-slate-700 hover:bg-slate-50"
                            )}
                        >
                            <item.icon size={22} className={isActive ? "text-white" : "text-slate-500"} />
                            <span className="text-base font-semibold">{t(item.label)}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="pt-4 border-t border-slate-100">
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                    <LogOut size={22} />
                    <span className="text-base font-semibold">{t('Log Out')}</span>
                </button>
            </div>
        </div>
    );
}
