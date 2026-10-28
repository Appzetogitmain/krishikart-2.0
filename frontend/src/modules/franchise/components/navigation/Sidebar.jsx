import { useNavigate, useLocation } from 'react-router-dom';
import {
    Home,
    ClipboardList,
    ShoppingCart,
    ShoppingBasket,
    Package,
    User,
    LogOut,
    ChevronLeft,
    ChevronRight,
    PackageCheck,
    Truck,
    Wallet,
    Settings,
    CreditCard,
    Undo2,
    Send,
    Lock,
    BarChart3,
    Headphones,
    PackageX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext';

const DOC_PATH = '/franchise/documentation';

/** Kisaankart leaf mark (green), used in the franchise portal header. */
export function KisaanLeaf({ size = 36 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 42C10 36 6 22 10 8c9 2 17 8 18 20-1-9-6-15-12-18 3 9 4 20 8 32z" fill="#15803d" />
            <path d="M24 42c14-6 18-20 14-34-9 2-17 8-18 20 1-9 6-15 12-18-3 9-4 20-8 32z" fill="#22c55e" />
        </svg>
    );
}

export default function Sidebar({ isCollapsed, setIsCollapsed }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { franchise } = useFranchiseAuth();
    const isVerified = !!franchise?.isVerified;

    const mainItems = [
        { icon: Home, label: 'Home', path: '/franchise/dashboard' },
        { icon: ClipboardList, label: 'Hotel Orders', path: '/franchise/orders', also: ['/franchise/orders/'] },
        { icon: ShoppingCart, label: 'Counter Sale', path: '/franchise/pos' },
        { icon: ShoppingBasket, label: 'Request Stock', path: '/franchise/procurement' },
        { icon: PackageCheck, label: 'Vendor Receiving', path: '/franchise/receiving' },
        { icon: Truck, label: 'Deliveries', path: '/franchise/dispatch' },
        { icon: Wallet, label: 'COD Cash', path: '/franchise/cash' },
        ...(franchise?.isMotherFranchise ? [{ icon: Send, label: 'Supply to Franchises', path: '/franchise/supply' }] : []),
        { icon: Package, label: 'Stock', path: '/franchise/inventory' },
        { icon: Undo2, label: 'Returns', path: '/franchise/returns' },
        { icon: PackageX, label: 'Return to Supplier', path: '/franchise/stock-returns' },
        { icon: BarChart3, label: 'Reports', path: '/franchise/reports' },
    ];
    const settingsItems = [
        { icon: User, label: 'My Profile', path: '/franchise/profile' },
        { icon: CreditCard, label: 'Payment Settings', path: '/franchise/payment-settings' },
        { icon: Settings, label: 'Documentation', path: DOC_PATH },
    ];

    const isActiveItem = (item) => location.pathname === item.path || (item.also || []).some((p) => location.pathname.startsWith(p));

    const renderItem = (item, small = false) => {
        const isActive = isActiveItem(item);
        const locked = !isVerified && item.path !== DOC_PATH;
        return (
            <button
                key={item.path}
                type="button"
                disabled={locked}
                title={locked ? 'Available after admin verifies your franchise' : item.label}
                onClick={() => { if (!locked) navigate(item.path); }}
                className={cn(
                    'w-full flex items-center gap-3 rounded-xl transition-colors relative text-left',
                    small ? 'px-3 py-2' : 'px-3 py-2.5',
                    isCollapsed && 'justify-center',
                    locked && 'opacity-40 cursor-not-allowed',
                    !locked && isActive ? 'bg-green-50 text-green-800 font-semibold' : !locked && 'text-slate-700 hover:bg-slate-50',
                )}
            >
                {isActive && !locked && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-green-600" />}
                <item.icon size={small ? 18 : 20} className={cn('shrink-0', isActive && !locked ? 'text-green-700' : 'text-slate-500')} />
                {!isCollapsed && (
                    <span className={cn('flex-1 truncate', small ? 'text-[13px]' : 'text-[15px]')}>{item.label}</span>
                )}
                {locked && !isCollapsed && <Lock size={12} className="text-slate-300 shrink-0" aria-hidden />}
            </button>
        );
    };

    return (
        <aside className={cn(
            'h-full bg-white border-r border-slate-100 z-10 hidden lg:flex flex-col relative transition-all duration-300 shrink-0',
            isCollapsed ? 'w-20' : 'w-64',
        )}>
            {/* Brand */}
            <div className={cn('h-20 flex items-center gap-2.5 border-b border-slate-100', isCollapsed ? 'justify-center px-2' : 'px-5')}>
                <KisaanLeaf size={isCollapsed ? 32 : 38} />
                {!isCollapsed && (
                    <div className="leading-tight">
                        <p className="font-extrabold text-[17px] tracking-wide text-slate-900">KISAANKART</p>
                        <p className="text-[11px] font-semibold tracking-wider text-green-700">FRANCHISE PORTAL</p>
                    </div>
                )}
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
                {mainItems.map((item) => renderItem(item))}
                <div className={cn('pt-4 mt-3 border-t border-slate-100 space-y-0.5', isCollapsed && 'pt-2')}>
                    {!isCollapsed && <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400">Settings</p>}
                    {settingsItems.map((item) => renderItem(item, true))}
                </div>
            </nav>

            {/* Help + logout */}
            <div className="p-3 space-y-2">
                {!isCollapsed && (
                    <button type="button" onClick={() => navigate('/franchise/help-support')}
                        className="w-full flex items-center gap-3 rounded-2xl bg-green-50 px-3 py-3 text-left hover:bg-green-100 transition-colors">
                        <Headphones size={26} className="text-green-700 shrink-0" />
                        <span>
                            <span className="block text-sm font-bold text-slate-900">Need Help?</span>
                            <span className="block text-xs text-slate-600">Contact support</span>
                        </span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => navigate('/franchise/login')}
                    className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors', isCollapsed && 'justify-center')}
                >
                    <LogOut size={18} />
                    {!isCollapsed && <span className="text-sm font-semibold">Log Out</span>}
                </button>
            </div>

            <div className="absolute top-24 -right-3 z-[60]">
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-6 h-6 bg-green-700 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white"
                    aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>
        </aside>
    );
}
