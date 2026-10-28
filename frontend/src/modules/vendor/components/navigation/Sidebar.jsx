import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandLogo from '@/components/BrandLogo';
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
            <div className="px-3 mb-8">
                <BrandLogo label={<>Vendor<br />Portal</>} />
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
