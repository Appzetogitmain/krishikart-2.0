import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Package, X, ArrowRight, Bell } from 'lucide-react';

export default function NewAssignmentAlert({ isOpen, onClose, data }) {
    if (!isOpen || !data) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20"
                >
                    {/* Header */}
                    <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                        {/* Decorative Background Icon */}
                        <div className="absolute -right-8 -bottom-8 text-white/5 transform rotate-12 scale-150">
                            <ShoppingCart size={160} />
                        </div>

                        <div className="flex items-center gap-6 relative z-10">
                            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md animate-bounce">
                                <Bell size={32} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter">
                                    New Order!
                                </h2>
                                <p className="text-white/60 font-medium">The admin has sent you a new order</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-10">
                        <div className="flex items-center justify-between mb-10 p-8 bg-slate-50 rounded-3xl border border-slate-100">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Request ID</p>
                                <p className="text-2xl font-black text-slate-900">
                                    #{data.requestId?.toString().slice(-8).toUpperCase()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Notice</p>
                                <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase ring-2 ring-amber-50">
                                    Action Needed
                                </span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <button
                                onClick={onClose}
                                className="w-full bg-white text-slate-400 py-4 rounded-2xl font-bold hover:text-slate-600 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
