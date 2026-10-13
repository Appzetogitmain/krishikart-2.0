import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../../contexts/VendorAuthContext';
import { vendorNavItems, isVendorNavActive } from './vendorNavConfig';

export default function Sidebar() {
    const { logout } = useVendorAuth();
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="h-full bg-white border-r border-slate-100 flex flex-col p-6">
            <div className="flex items-center gap-3 px-2 mb-10">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <Sprout size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-black tracking-tight leading-none text-slate-900">Vendor Portal</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fresh Marketplace</p>
                </div>
            </div>

            <nav className="flex-1 space-y-2">
                {vendorNavItems.map((item) => {
                    const isActive = isVendorNavActive(location.pathname, item.path);
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group",
                                isActive
                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                    : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            <item.icon size={20} className={cn("transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400")} />
                            <span className="text-sm font-black tracking-tight">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="pt-6 border-t border-slate-50">
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all group"
                >
                    <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-black tracking-tight">Log Out</span>
                </button>
            </div>
        </div>
    );
}
