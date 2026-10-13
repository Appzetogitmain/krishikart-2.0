import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle, IndianRupee, ShieldCheck, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function CreditOverrideModal({ isOpen, onClose, customer, onSave }) {
    const [limit, setLimit] = useState(customer?.creditLimit || 0);
    const [reason, setReason] = useState('');
    const [resetBalance, setResetBalance] = useState(false);

    if (!isOpen) return null;

    const hasOutstanding = (customer?.usedCredit || 0) > 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
                >
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Change Limit</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    Updating limit for {customer?.fullName || customer?.mobile}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Credit Limit</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-focus-within:text-primary transition-colors font-bold">
                                        ₹
                                    </div>
                                    <input
                                        type="number"
                                        value={limit}
                                        onChange={(e) => setLimit(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 pl-14 pr-4 outline-none text-lg font-black text-slate-900 transition-all"
                                        placeholder="Enter amount"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Adjustment</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-primary/20 rounded-2xl p-4 outline-none text-sm font-medium text-slate-900 transition-all resize-none"
                                    placeholder="Brief explanation for the record..."
                                />
                            </div>

                            {hasOutstanding && (
                                <div
                                    onClick={() => setResetBalance(!resetBalance)}
                                    className={cn(
                                        "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                                        resetBalance
                                            ? "bg-emerald-50 border-emerald-500 shadow-md shadow-emerald-100"
                                            : "bg-slate-50 border-transparent hover:border-slate-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                            resetBalance ? "bg-emerald-500 text-white" : "bg-white text-slate-400 group-hover:text-slate-900"
                                        )}>
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <p className={cn("text-xs font-black uppercase tracking-tight", resetBalance ? "text-emerald-700" : "text-slate-900")}>
                                                Mark as Fully Paid
                                            </p>
                                            <p className="text-[10px] font-medium text-slate-400">Clear ₹{customer.usedCredit.toLocaleString()} balance</p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                        resetBalance ? "bg-emerald-500 border-emerald-500" : "border-slate-200"
                                    )}>
                                        {resetBalance && <Check size={14} className="text-white" />}
                                    </div>
                                </div>
                            )}

                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                                <AlertCircle size={20} className="text-amber-500 shrink-0" />
                                <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                                    This change is saved in the history and applies immediately.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-10">
                            <button
                                onClick={onClose}
                                className="py-4 rounded-2xl font-black text-sm text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-tight"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onSave({ limit, reason, resetBalance })}
                                className="py-4 bg-primary text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-primary/20 uppercase tracking-tight"
                            >
                                <Save size={18} />
                                Confirm
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
