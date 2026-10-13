import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle, ShoppingBag, Plus, Minus, Search, ArrowRight, User, Truck, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import mockVendors from '../../data/mockVendors.json';

export default function MultiVendorAssignmentDrawer({ isOpen, onClose, po, onFinalize }) {
    const [assignments, setAssignments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeItemId, setActiveItemId] = useState(null);

    // Sync state when PO changes
    useEffect(() => {
        if (po?.items) {
            setAssignments(po.items.map(item => ({
                ...item,
                vendorId: '',
                vendorName: ''
            })));
        }
    }, [po?.id]);

    if (!isOpen || !po) return null;

    const handleAssignVendor = (itemId, vendor) => {
        setAssignments(prev => prev.map(item =>
            item.productId === itemId
                ? { ...item, vendorId: vendor.id, vendorName: vendor.name }
                : item
        ));
        setActiveItemId(null);
    };

    const isAllAssigned = assignments.every(item => item.vendorId);

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
                    className="relative w-full max-w-2xl bg-[#f8fafd] h-full shadow-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="bg-white p-8 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-widest">Replenishment Request</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{po.id}</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">Assign Vendors per Item</h3>
                                <p className="text-slate-500 font-medium text-sm mt-1">Assign specialized vendors for each line item requested by {po.franchiseName}.</p>
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
                        {/* Summary Info */}
                        <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden">
                            <div className="relative z-10 grid grid-cols-2 gap-8">
                                <div>
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-2">Total Shortfall</span>
                                    <div className="text-3xl font-black text-primary">₹{po.totalAmount.toLocaleString()}</div>
                                    <p className="text-xs text-white/60 font-medium mt-2">Across {po.items.length} product categories</p>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <div className="flex items-center gap-2 text-xs font-bold text-white/80">
                                        <Truck size={14} className="text-primary" />
                                        Pickup from multiple vendors
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
                        </div>

                        {/* Items List */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Items Needed</h4>
                            {assignments.map((item) => (
                                <div
                                    key={item.productId}
                                    className={cn(
                                        "bg-white p-6 rounded-[32px] border transition-all duration-300",
                                        activeItemId === item.productId ? "ring-2 ring-primary border-transparent shadow-xl" : "border-slate-100 shadow-sm"
                                    )}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 shadow-inner group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                                                <ShoppingBag size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h5 className="font-extrabold text-slate-900 text-lg tracking-tight">{item.productName}</h5>
                                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                        Needs Stock
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Short by: {item.orderQty} {item.unit}</span>
                                                    <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Rate: ₹{item.pricePerUnit}/{item.unit}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 max-w-[200px]">
                                            {item.vendorId ? (
                                                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between group">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Assigned Vendor</span>
                                                        <span className="text-xs font-black text-emerald-900 truncate">{item.vendorName}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setActiveItemId(item.productId)}
                                                        className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setActiveItemId(item.productId)}
                                                    className="w-full bg-slate-50 border-2 border-dashed border-slate-200 p-4 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                                                >
                                                    <User size={14} />
                                                    Select Vendor
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inline Vendor Picker */}
                                    <AnimatePresence>
                                        {activeItemId === item.productId && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden mt-6 pt-6 border-t border-slate-50"
                                            >
                                                <div className="mb-4">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Filter vendors for this item..."
                                                            className="w-full bg-slate-50 border-none rounded-xl py-2 pl-10 pr-4 text-[10px] font-bold outline-none ring-1 ring-slate-100 focus:ring-primary/20"
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 pb-2">
                                                    {mockVendors
                                                        .filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                        .slice(0, 4).map(vendor => (
                                                            <button
                                                                key={vendor.id}
                                                                onClick={() => handleAssignVendor(item.productId, vendor)}
                                                                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary hover:bg-white transition-all text-left group"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 group-hover:text-primary border border-slate-100">
                                                                    <Truck size={16} />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[10px] font-black text-slate-900 truncate">{vendor.name}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Capacity: {vendor.capacity}%</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-8 bg-white border-t border-slate-100">
                        <div className="flex items-center justify-between mb-8 px-2">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Value</span>
                                <div className="text-3xl font-black text-slate-900 mt-1">₹{po.totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Assignment Status</span>
                                <div className={cn(
                                    "text-lg font-black mt-1 uppercase italic tracking-tighter",
                                    isAllAssigned ? "text-emerald-500" : "text-amber-500"
                                )}>
                                    {assignments.filter(a => a.vendorId).length}/{assignments.length} Assigned
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={onClose}
                                className="py-4 rounded-2xl font-black text-xs text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-100"
                            >
                                Back to Queue
                            </button>
                            <button
                                onClick={() => isAllAssigned && onFinalize(assignments)}
                                disabled={!isAllAssigned}
                                className={cn(
                                    "py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2",
                                    isAllAssigned
                                        ? "bg-primary text-white hover:bg-emerald-600 shadow-emerald-100"
                                        : "bg-slate-100 text-slate-300 shadow-none cursor-not-allowed"
                                )}
                            >
                                {isAllAssigned ? 'Confirm Vendors' : 'Complete Assignment'}
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
