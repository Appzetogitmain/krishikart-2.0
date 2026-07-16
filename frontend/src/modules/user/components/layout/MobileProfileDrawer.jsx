import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User,
    Package,
    Wallet,
    Bell,
    Heart,
    Power,
    ChevronRight,
    MessageCircle,
    CircleDot,
    Info,
    CreditCard,
    Trash2
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/axios'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useWallet } from '../../contexts/WalletContext'
import { useUserAuth } from '../../contexts/UserAuthContext'
import { cn } from '@/lib/utils'

const HamburgerIcon = () => (
    <div className="flex flex-col gap-1 items-start pl-0.5">
        <span className="w-4 h-[1.8px] bg-slate-900 rounded-full" />
        <span className="w-2.5 h-[1.8px] bg-slate-900 rounded-full" />
        <span className="w-1.5 h-[1.8px] bg-slate-900 rounded-full" />
    </div>
)

const SectionHeader = ({ title }) => (
    <div className="flex items-center gap-3 mb-3 px-2">
        <div className="w-1 h-5 bg-emerald-600 rounded-full" />
        <h4 className="text-[15px] font-bold text-slate-900 tracking-tight">{title}</h4>
    </div>
)

const MenuItem = ({ icon: Icon, label, path, badge, isNew, hasToggle, isActive, onToggle, isFirst, isLast }) => {
    const navigate = useNavigate();
    const Tag = hasToggle ? 'div' : 'button';
    return (
        <Tag
            onClick={() => !hasToggle && path && navigate(path)}
            className={cn(
                "w-full flex items-center justify-between py-3.5 px-4 bg-white transition-all group text-left",
                !isFirst && "border-t border-slate-100",
                !hasToggle && "active:bg-slate-50 cursor-pointer"
            )}
        >
            <div className="flex items-center gap-3">
                <Icon size={17} className={cn("text-slate-500", label === "Veg mode" && "text-emerald-600")} strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-[13.5px] font-medium text-slate-700 tracking-tight">{label}</span>
            </div>

            <div className="flex items-center gap-2">
                {badge && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        {badge}
                    </span>
                )}
                {isNew && (
                    <span className="bg-emerald-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        NEW
                    </span>
                )}
                {hasToggle ? (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle?.();
                        }}
                        className={cn(
                            "w-10 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer shadow-inner",
                            isActive ? "bg-emerald-600" : "bg-slate-200"
                        )}
                    >
                        <motion.div
                            animate={{ x: isActive ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                    </div>
                ) : (
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-transform group-hover:translate-x-0.5" />
                )}
            </div>
        </Tag>
    )
}

export default function MobileProfileDrawer() {
    const navigate = useNavigate()
    const location = useLocation()
    const { balance, creditLimit, availableCredit } = useWallet()
    const { user, logout } = useUserAuth()
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setIsOpen(false)
    }, [location])

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
            try {
                await api.delete('/user/delete-account');
                alert("Account deleted successfully.");
                logout();
                navigate('/login');
            } catch (error) {
                console.error("Failed to delete account", error);
                alert(error.response?.data?.message || "Failed to delete account. Please try again.");
            }
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <button className="w-11 h-11 rounded-full border border-slate-100 flex items-center justify-center bg-white shadow-sm active:scale-95 transition-all hover:bg-slate-50">
                    <HamburgerIcon />
                </button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="p-0 border-none w-full max-w-[320px] sm:max-w-[380px] bg-transparent shadow-none"
            >
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full h-full bg-slate-50 shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex flex-col h-full overflow-y-auto no-scrollbar outline-none">
                                {/* Header */}
                                <div className="bg-white p-6 pt-12 pb-6 border-b border-slate-100 relative">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
                                            <span className="text-2xl font-black text-white uppercase">
                                                {user?.fullName && !['dev user', 'guest user'].includes(user.fullName.toLowerCase()) ? user.fullName.charAt(0) : 'G'}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <SheetTitle className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-1 text-left">
                                                {user?.fullName && !['dev user', 'guest user'].includes(user.fullName.toLowerCase()) ? user.fullName.split(' ')[0] : 'Guest'}
                                            </SheetTitle>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 space-y-6">
                                    {/* Orders & statements */}
                                    <div>
                                        <SectionHeader title="Orders" />
                                        <div className="bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-sm">
                                            <MenuItem icon={Package} label="Your orders" path="/orders" isFirst />
                                            <MenuItem icon={MessageCircle} label="Need help" path="/help-support" isLast />
                                        </div>
                                    </div>

                                    {/* Wallet & payment */}
                                    <div>
                                        <SectionHeader title="Wallet & payment" />
                                        <div className="bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-sm">
                                            <MenuItem
                                                icon={Wallet}
                                                label="Kisaan Kart wallet"
                                                path="/wallet"
                                                badge={`₹${balance.toLocaleString()}`}
                                                isFirst
                                                isLast={creditLimit <= 0}
                                            />
                                            {creditLimit > 0 && (
                                                <MenuItem
                                                    icon={CreditCard}
                                                    label="Kisaan Kart Credit"
                                                    path="/credit-info"
                                                    badge={`₹${availableCredit.toLocaleString()}`}
                                                    isLast
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Others */}
                                    <div>
                                        <SectionHeader title="Others" />
                                        <div className="bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-sm">
                                            <MenuItem icon={User} label="Profile settings" path="/edit-profile" isFirst />
                                            <MenuItem icon={Bell} label="Notifications" path="/notifications" />
                                            <MenuItem icon={Heart} label="My list" path="/wishlist" />
                                            <MenuItem icon={Info} label="Contact us" path="/help-support" isLast />
                                        </div>
                                    </div>

                                    {/* Logout Account */}
                                    <div className="pb-8 space-y-3">
                                        <button
                                            onClick={() => {
                                                logout();
                                                navigate('/login');
                                            }}
                                            className="w-full h-14 rounded-[20px] flex items-center gap-4 px-6 text-emerald-600 font-bold hover:bg-slate-50 transition-colors bg-white border border-slate-100 shadow-sm group active:scale-[0.98]"
                                        >
                                            <Power size={18} strokeWidth={2.5} />
                                            <span className="text-[15px]">Logout</span>
                                        </button>

                                        <button
                                            onClick={handleDeleteAccount}
                                            className="w-full h-14 rounded-[20px] flex items-center gap-4 px-6 text-red-600 font-bold hover:bg-red-50 transition-colors bg-red-50 border border-red-100 shadow-sm group active:scale-[0.98]"
                                        >
                                            <Trash2 size={18} strokeWidth={2.5} />
                                            <span className="text-[15px]">Delete Account</span>
                                        </button>
                                        <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-8">Version 2.4.0 (Stable)</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SheetContent>
        </Sheet>
    )
}
