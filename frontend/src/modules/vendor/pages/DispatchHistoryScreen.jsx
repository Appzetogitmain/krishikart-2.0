import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    History,
    Search,
    Truck,
    ChevronRight,
    Calendar,
    Package,
    Scale,
    Filter,
    Loader2,
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { toast } from 'sonner';
import VendorBackBar from '../components/navigation/VendorBackBar';

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'ready_for_pickup', label: 'In Transit' }
];

export default function DispatchHistoryScreen() {
    const [dispatches, setDispatches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedDispatch, setSelectedDispatch] = useState(null);
    const filterRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await api.get('/procurement/vendor/my-assignments');
                if (response.data.success) {
                    // Filter for completed or dispatched orders
                    const completed = (response.data.results || []).filter(o =>
                        ['completed', 'ready_for_pickup'].includes(o.status)
                    );
                    setDispatches(completed);
                }
            } catch (error) {
                console.error("History fetch failed", error);
                // 401 = session expired, handled globally by redirecting to login
                if (error.response?.status !== 401) {
                    toast.error(error.response?.data?.message || "Failed to load dispatch history");
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const filteredDispatches = dispatches.filter(d => {
        const matchesSearch =
            (d.invoice?.invoiceNumber || d._id).toLowerCase().includes(searchQuery.toLowerCase()) ||
            (d.franchiseId?.shopName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <VendorBackBar />
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Dispatch History</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All your past dispatches</p>
                    </div>
                </div>
            </header>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                    type="text"
                    placeholder="Search by invoice number or franchise..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.trim())}
                    className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold transition-all outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20"
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Recent Dispatches</h2>
                    <div className="relative" ref={filterRef}>
                        <button
                            type="button"
                            onClick={() => setFilterOpen((o) => !o)}
                            className={cn(
                                "p-2 rounded-xl transition-colors",
                                filterOpen ? "text-slate-900 bg-slate-100" : "text-slate-300 hover:text-slate-900"
                            )}
                            aria-expanded={filterOpen}
                            aria-haspopup="listbox"
                        >
                            <Filter size={16} />
                        </button>
                        <AnimatePresence>
                            {filterOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 py-1 overflow-hidden"
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter(opt.value);
                                                setFilterOpen(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-[11px] font-bold transition-colors",
                                                statusFilter === opt.value ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            <span>{opt.label}</span>
                                            {statusFilter === opt.value && <Check size={14} />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                        <Loader2 className="animate-spin mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Loading...</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredDispatches.map((dispatch, idx) => (
                                <motion.div
                                    key={dispatch._id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedDispatch(dispatch)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDispatch(dispatch); } }}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-5 hover:border-primary/20 transition-all group active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                                                dispatch.status === 'completed' ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
                                            )}>
                                                <Truck size={24} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 tracking-tight">{dispatch.invoice?.invoiceNumber || dispatch._id}</h4>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        dispatch.status === 'completed' ? "bg-emerald-500" : "bg-blue-500 animate-pulse"
                                                    )} />
                                                    <span className={cn(
                                                        "text-[10px] font-black uppercase tracking-widest",
                                                        dispatch.status === 'completed' ? "text-emerald-500" : "text-blue-500"
                                                    )}>{dispatch.status === 'ready_for_pickup' ? 'In Transit' : dispatch.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                                {dispatch.invoice?.invoiceDate ? 'Invoice Date' : 'Updated'}
                                            </p>
                                            <p className="text-xs font-black text-slate-900 tracking-tight">
                                                {new Date(dispatch.invoice?.invoiceDate || dispatch.updatedAt).toLocaleDateString(undefined, {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                            <div className="flex items-center gap-2 mb-1">
                                                <ChevronRight size={10} className="text-slate-300" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Franchise</span>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-600 truncate">{dispatch.franchiseId?.shopName}</p>
                                        </div>
                                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Scale size={10} className="text-slate-300" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight</span>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-600">{dispatch.actualWeight || '0'} KG</p>
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between pt-4 border-t border-slate-50 mt-2">
                                        <div className="flex flex-col gap-2 overflow-hidden mr-4">
                                            {dispatch.items?.filter(item => (item.dispatchedQuantity || item.quantity) > 0).slice(0, 3).map((item, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                                                        <Package size={10} className="text-slate-400" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-700 truncate">{item.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 shrink-0 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{item.dispatchedQuantity || item.quantity} * {item.unit}</span>
                                                </div>
                                            ))}
                                            {dispatch.items?.length > 3 && (
                                                <span className="text-[10px] font-bold text-slate-400 pl-7">+{dispatch.items.length - 3} more items</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setSelectedDispatch(dispatch); }}
                                            className="shrink-0 text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1 group-hover:translate-x-1 transition-transform mb-1"
                                        >
                                            Items <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {filteredDispatches.length === 0 && !isLoading && (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-20">
                    <History size={48} strokeWidth={1} className="mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No dispatches yet</p>
                </div>
            )}

            {/* Dispatch detail / manifest modal */}
            <AnimatePresence>
                {selectedDispatch && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedDispatch(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-[32px] shadow-2xl border border-slate-100"
                        >
                            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
                                <h3 className="text-lg font-black text-slate-900">Dispatch Details</h3>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDispatch(null)}
                                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                                    aria-label="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</p>
                                        <p className="text-base font-black text-slate-900">{selectedDispatch.invoice?.invoiceNumber || selectedDispatch._id}</p>
                                    </div>
                                    <div className={cn(
                                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                        selectedDispatch.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-500"
                                    )}>
                                        {selectedDispatch.status === 'ready_for_pickup' ? 'In Transit' : selectedDispatch.status}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Franchise</p>
                                        <p className="text-sm font-black text-slate-800">{selectedDispatch.franchiseId?.shopName || '—'}</p>
                                    </div>
                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dispatched Weight</p>
                                        <p className="text-sm font-black text-slate-800">{selectedDispatch.actualWeight || '0'} KG</p>
                                    </div>
                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                                        <p className="text-sm font-black text-slate-800">
                                            {new Date(selectedDispatch.invoice?.invoiceDate || selectedDispatch.updatedAt).toLocaleDateString(undefined, {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Items</p>
                                    <div className="space-y-2">
                                        {(selectedDispatch.items || [])
                                            .filter(item => (item.dispatchedQuantity || item.quantity) > 0)
                                            .map((item, i) => (
                                                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                            <Package size={14} className="text-slate-500" />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-600 shrink-0">
                                                        {item.dispatchedQuantity ?? item.quantity} {item.unit}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
