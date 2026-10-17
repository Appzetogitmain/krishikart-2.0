import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    User,
    PackageCheck,
    Truck,
    Undo2,
    Wallet,
    FileText,
    BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext';

const DOC_PATH = '/franchise/documentation';

const fullNavItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/franchise/dashboard' },
    { icon: ShoppingBag, label: 'Orders', path: '/franchise/orders' },
    { icon: BarChart3, label: 'Reports', path: '/franchise/reports' },
    { icon: Package, label: 'Inventory', path: '/franchise/inventory' },
    { icon: PackageCheck, label: 'Receiving', path: '/franchise/receiving' },
    { icon: Undo2, label: 'Returns', path: '/franchise/returns' },
    { icon: Truck, label: 'Delivery', path: '/franchise/dispatch' },
    { icon: Wallet, label: 'Cash', path: '/franchise/cash' },
    { icon: User, label: 'Profile', path: '/franchise/profile' },
];

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { franchise } = useFranchiseAuth();
    const isVerified = !!franchise?.isVerified;

    const navItems = isVerified
        ? fullNavItems
        : [{ icon: FileText, label: 'Documents', path: DOC_PATH }];

    return (
        <div
            className={cn(
                'bg-white/80 backdrop-blur-xl border-t border-slate-100 px-3 py-3 pb-8 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]',
                isVerified ? 'flex justify-between items-center' : 'flex justify-center items-center'
            )}
        >
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={cn(
                            'relative flex flex-col items-center gap-1 group',
                            !isVerified && 'min-w-[120px]'
                        )}
                    >
                        <div
                            className={cn(
                                'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300',
                                isActive
                                    ? 'bg-primary text-white shadow-lg shadow-green-200 scale-110'
                                    : 'text-slate-400 group-hover:text-slate-600'
                            )}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span
                            className={cn(
                                'text-[10px] font-black uppercase tracking-widest transition-colors duration-300',
                                isActive ? 'text-primary' : 'text-slate-400'
                            )}
                        >
                            {item.label}
                        </span>
                        {isActive && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute -top-3 w-1 h-1 bg-primary rounded-full"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
