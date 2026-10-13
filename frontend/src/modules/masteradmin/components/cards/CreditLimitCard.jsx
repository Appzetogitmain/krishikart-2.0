import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, History, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CreditLimitCard({ hotel, onOverride, onViewHistory, onToggleFreeze }) {
    const {
        hotelName,
        creditLimit,
        usedCredit,
        remainingCredit,
        utilizationPercent,
        isFrozen
    } = hotel;

    const getStatusColor = (percent) => {
        if (percent >= 90) return 'text-red-600';
        if (percent >= 70) return 'text-amber-600';
        return 'text-emerald-600';
    };

    const getProgressColor = (percent) => {
        if (percent >= 90) return 'bg-red-500';
        if (percent >= 70) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50"
        >
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        isFrozen ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-500"
                    )}>
                        {isFrozen ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 leading-tight">{hotelName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                isFrozen ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                                {isFrozen ? 'Frozen' : 'Active'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                    <button
                        onClick={() => onViewHistory(hotel)}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-all"
                        title="View Transactions"
                    >
                        <History size={16} />
                    </button>
                    <button
                        onClick={() => onOverride(hotel)}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-all"
                        title="Change Limit"
                    >
                        <Edit3 size={16} />
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Limit</span>
                        <div className="text-lg font-black text-slate-900 mt-1">₹{(creditLimit / 1000).toFixed(0)}K</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining</span>
                        <div className={cn("text-lg font-black mt-1", getStatusColor(utilizationPercent))}>
                            ₹{(remainingCredit / 1000).toFixed(0)}K
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-slate-400">Used</span>
                        <span className={getStatusColor(utilizationPercent)}>{utilizationPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${utilizationPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={cn("h-full rounded-full", getProgressColor(utilizationPercent))}
                        />
                    </div>
                </div>
            </div>

            <button
                onClick={() => onToggleFreeze(hotel)}
                className={cn(
                    "w-full mt-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95",
                    isFrozen
                        ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200"
                        : "bg-red-50 text-red-600 hover:bg-red-100"
                )}
            >
                {isFrozen ? 'Unfreeze Credit' : 'Freeze Credit'}
            </button>
        </motion.div>
    );
}
