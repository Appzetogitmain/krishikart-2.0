import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle, ShoppingBag, Plus, Minus, Search, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export default function POCreationDrawer({ isOpen, onClose, onSave }) {
    const [step, setStep] = useState(1);
    const [selectedItems, setSelectedItems] = useState([
        { id: 1, name: 'Tomatoes', qty: 20, price: 40, unit: 'kg' },
        { id: 2, name: 'Onions', qty: 50, price: 30, unit: 'kg' }
    ]);

    if (!isOpen) return null;

    const totalAmount = selectedItems.reduce((acc, item) => acc + (item.qty * item.price), 0);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex justify-end">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col"
                >
                    <div className="p-8 border-b border-slate-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Create Purchase Order</h3>
                                <div className="flex items-center gap-6 mt-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-slate-100'}`} />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-slate-100'}`} />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-slate-100'}`} />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Review</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Add products to PO..."
                                        className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none text-sm font-medium placeholder:text-slate-400"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selected Items</h4>
                                    {selectedItems.map((item) => (
                                        <div key={item.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary border border-slate-100 shadow-sm">
                                                    <ShoppingBag size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900">{item.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">₹{item.price}/{item.unit}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                    <button className="p-1 hover:text-primary transition-colors"><Minus size={14} /></button>
                                                    <span className="text-sm font-black text-slate-900 w-8 text-center">{item.qty}</span>
                                                    <button className="p-1 hover:text-primary transition-colors"><Plus size={14} /></button>
                                                </div>
                                                <div className="text-right min-w-[80px]">
                                                    <div className="font-black text-slate-900 text-sm">₹{(item.qty * item.price).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-primary/5 p-6 rounded-[32px] border border-primary/10 flex items-center justify-between">
                                    <span className="font-bold text-primary italic">Stock Note:</span>
                                    <span className="font-black text-primary uppercase text-xs tracking-widest">3 items below minimum stock</span>
                                </div>
                            </div>
                        )}

                        {/* Summary Section ALWAYS Visible at bottom */}
                    </div>

                    <div className="p-8 bg-slate-50 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-8 px-2">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Payable</span>
                                <div className="text-3xl font-black text-slate-900 mt-1">₹{totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PO Items</span>
                                <div className="text-lg font-black text-slate-900 mt-1">{selectedItems.length} Products</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={onClose}
                                className="py-4 rounded-2xl font-black text-xs text-slate-400 uppercase tracking-widest hover:bg-white transition-all"
                            >
                                Save Draft
                            </button>
                            <button
                                onClick={() => step < 3 ? setStep(step + 1) : onSave()}
                                className="py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                            >
                                {step === 3 ? 'Confirm Order' : 'Next Step'}
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
