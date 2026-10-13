import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CreditCard, ArrowRight, ShieldAlert, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '../../contexts/WalletContext';

export default function CreditOverdueModal({ isOpen, usedCredit, dueDate }) {
    const { repayCredit } = useWallet();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleRepay = async () => {
        setLoading(true);
        try {
            const result = await repayCredit();
            if (!result.success) {
                alert(result.message || "Payment failed");
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
                >
                    <div className="bg-red-500 p-8 flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                            <ShieldAlert size={32} className="text-white" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-white text-xl font-black uppercase tracking-wider">Account Locked</h2>
                            <p className="text-white/80 text-xs font-bold font-sans uppercase tracking-widest">Payment Overdue • 7+ Days</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="space-y-4 text-center">
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                Your **KK Credit** balance of <span className="text-red-600 font-black">₹{usedCredit.toLocaleString()}</span> is overdue.
                                <br /><br />
                                Please clear this amount to continue shopping.
                            </p>

                            <div className="flex flex-col gap-2 pt-2">
                                <div className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Due</span>
                                    <span className="text-lg font-black text-slate-900">₹{usedCredit.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center px-4 py-3 bg-red-50/50 rounded-xl border border-red-100/50">
                                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Due On</span>
                                    <span className="text-xs font-bold text-red-600">
                                        {new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Button
                                onClick={handleRepay}
                                disabled={loading}
                                className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold tracking-tight shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CreditCard size={18} />
                                        Clear Balance Now
                                    </>
                                )}
                            </Button>

                            <p className="text-[10px] text-slate-400 text-center uppercase font-black tracking-widest italic leading-relaxed">
                                This message will close once your payment is received.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-6">
                            <div className="flex flex-col items-center gap-1 opacity-50">
                                <PhoneCall size={14} className="text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
