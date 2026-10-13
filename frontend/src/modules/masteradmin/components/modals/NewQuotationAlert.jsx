import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, 
    X, 
    ShoppingBag, 
    ChevronRight, 
    HandHelping,
    IndianRupee,
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';

export default function NewQuotationAlert() {
    const { isQuotationAlertOpen, setIsQuotationAlertOpen, newQuotationData } = useAdmin();
    const navigate = useNavigate();

    if (!isQuotationAlertOpen || !newQuotationData) return null;

    const handleViewDetails = () => {
        setIsQuotationAlertOpen(false);
        navigate('/masteradmin/quotations');
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 sm:p-6 pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="w-full max-w-lg bg-white rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-slate-100 pointer-events-auto overflow-hidden"
                >
                    <div className="relative p-6 sm:p-8">
                        {/* Status Batch */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">New Quotation Received</span>
                            </div>
                            <button 
                                onClick={() => setIsQuotationAlertOpen(false)}
                                className="p-2 hover:bg-slate-50 rounded-full transition-colors group"
                            >
                                <X size={18} className="text-slate-400 group-hover:text-slate-900" />
                            </button>
                        </div>

                        <div className="flex gap-6">
                            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-slate-200">
                                <HandHelping size={32} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Please review the quotation</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Received from Vendor</p>
                                
                                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShoppingBag size={14} className="text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Request Ref</span>
                                        </div>
                                        <span className="text-[10px] font-black text-primary uppercase tabular-nums">#{(newQuotationData.requestId || '').toString().slice(-6)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <IndianRupee size={14} className="text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Quoted Amount</span>
                                        </div>
                                        <span className="text-[13px] font-black text-slate-900 tabular-nums">₹{newQuotationData.totalQuotedAmount?.toLocaleString() || '---'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button
                                onClick={() => setIsQuotationAlertOpen(false)}
                                className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={handleViewDetails}
                                className="flex-[2] h-12 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                Review Quotation <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
