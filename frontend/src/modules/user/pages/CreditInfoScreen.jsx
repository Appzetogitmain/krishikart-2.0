import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft,
    CreditCard,
    Info,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    Calendar,
    IndianRupee
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '@/lib/utils'

const CreditCardGraphic = ({ limit, used, available }) => {
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    return (
        <div className="relative w-full aspect-[1.6/1] bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[32px] p-8 text-white shadow-2xl overflow-hidden group">
            {/* Glossy overlay */}
            <div className="absolute top-0 right-0 w-full h-full bg-white/5 pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition-all duration-500" />

            <div className="relative h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Kisaankart Credit</p>
                        <h2 className="text-2xl font-black tracking-tight">Business Credit</h2>
                    </div>
                    <CreditCard size={32} className="opacity-40" strokeWidth={1.5} />
                </div>

                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-2">Available Credit</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold opacity-80">₹</span>
                        <span className="text-4xl font-black tracking-tighter">
                            {available.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-white/60"
                        />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="opacity-60">Limit: ₹{limit.toLocaleString()}</span>
                        <span className={cn(percentage > 90 ? "text-amber-300" : "opacity-60")}>
                            {percentage.toFixed(0)}% Used
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function CreditInfoScreen() {
    const navigate = useNavigate()
    const { creditLimit, creditUsed, availableCredit, isLoading, transactions } = useWallet()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const items = [
        {
            icon: TrendingUp,
            label: "Credit Used",
            value: `₹${creditUsed.toLocaleString()}`,
            desc: "Current outstanding balance",
            color: "text-emerald-600",
            bg: "bg-emerald-50"
        },
        {
            icon: Calendar,
            label: "Payment Due",
            value: "Net 7",
            desc: "Payment due every 7 days",
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            icon: ShieldCheck,
            label: "Trust Score",
            value: "Platinum",
            desc: "Based on payment history",
            color: "text-amber-600",
            bg: "bg-amber-50"
        }
    ]

    return (
        <PageTransition>
            <div className="bg-[#fcfdff] min-h-screen">
                {/* Mobile Header (Hidden on Desktop) */}
                <div className="lg:hidden bg-white px-6 py-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-40">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-95 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kisaankart Credit</h1>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
                    {/* Desktop Page Title */}
                    <div className="hidden lg:flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 font-sans">Kisaankart Credit</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Business Credit</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-100">
                            Available: ₹{availableCredit.toLocaleString()}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Main Content Area */}
                        <div className="lg:col-span-2 space-y-10">
                            {/* Main UI Card */}
                            <CreditCardGraphic
                                limit={creditLimit}
                                used={creditUsed}
                                available={availableCredit}
                            />

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {items.map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="bg-white p-5 rounded-[24px] border border-slate-100 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", item.bg, item.color)}>
                                            <item.icon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</h3>
                                            <p className={cn("text-lg font-black tracking-tight", item.color)}>{item.value}</p>
                                            <p className="text-[11px] font-medium text-slate-400 leading-tight mt-1">{item.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Activity Placeholder - Similar to Wallet Page */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Recent Credit Activity</h3>
                                <div className="bg-white rounded-[32px] p-10 border border-dashed border-slate-200 text-center space-y-3">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                        <IndianRupee size={32} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-600">No recent transactions</p>
                                        <p className="text-xs font-medium text-slate-400">Transactions using your business credit will appear here.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Terms / Info Section */}
                            <div className="bg-emerald-600 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-100/50 sticky top-28">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Info size={140} strokeWidth={1} />
                                </div>
                                <div className="relative">
                                    <h4 className="text-lg font-black tracking-tight mb-4">How it works?</h4>
                                    <p className="text-sm font-medium opacity-90 leading-relaxed mb-8">
                                        Kisaankart Credit lets you buy now and pay later. Your limit depends on your order and payment history.
                                    </p>
                                    <ul className="space-y-4">
                                        {[
                                            "Interest-free for up to 7 days",
                                            "Automatic deduction at checkout",
                                            "Increase limit by timely payments",
                                            "Managed by your local admin"
                                        ].map((step, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-[13px] font-bold">
                                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <span className="leading-snug">{step}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mt-10 pt-6 border-t border-white/10">
                                        <button className="w-full py-4 bg-white text-emerald-600 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:bg-emerald-50 transition-colors">
                                            Request Limit Increase
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Trust Badge */}
                            <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Account Security</p>
                                    <p className="text-sm font-bold text-slate-700">Verified Business Partner</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Note */}
                <p className="hidden md:block text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pb-12">
                    Provided by Kisaankart
                </p>
            </div>
        </PageTransition>
    )
}
