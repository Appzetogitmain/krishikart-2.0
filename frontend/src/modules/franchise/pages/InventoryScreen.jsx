import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PackageSearch,
    Plus,
    Search,
    Filter,
    ArrowUpRight,
    AlertTriangle,
    Home,
    ChevronRight,
    Settings2,
    Download,
    RefreshCw,
    ShieldCheck,
    ChevronDown,
    Zap,
    Scale
} from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { cn } from '@/lib/utils';

import { toast } from 'sonner';
import api from '@/lib/axios';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';

export default function InventoryScreen() {
    const navigate = useNavigate();
    const { inventory, categories, getStockStats, loading: inventoryLoading, refreshInventory } = useInventory();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [isResetting, setIsResetting] = useState(false);
    // Latest deliveries from vendors and what happened to their stock
    const [receipts, setReceipts] = useState([]);

    const loadReceipts = async () => {
        try {
            const res = await api.get('/procurement/franchise/my-requests');
            const list = (res.data?.results || res.data?.result || [])
                .filter((r) => r.receiptSummary?.at)
                .sort((a, b) => new Date(b.receiptSummary.at) - new Date(a.receiptSummary.at))
                .slice(0, 5);
            setReceipts(list);
        } catch {
            setReceipts([]);
        }
    };

    useEffect(() => {
        loadReceipts();
    }, []);

    // Reloads the real stock from the server (the old "Reset All" testing button that
    // overwrote every product to 100 units has been removed)
    const handleRefresh = async () => {
        setIsResetting(true);
        try {
            await Promise.all([refreshInventory(), loadReceipts()]);
        } finally {
            setIsResetting(false);
        }
    };

    const stats = getStockStats();

    const filteredItems = inventory.filter(item => {
        const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
        // Match the name or the item code shown under it (e.g. "9E291951")
        const term = searchQuery.trim().toLowerCase();
        const matchesSearch = !term ||
            (item.name || '').toLowerCase().includes(term) ||
            String(item.id || '').toLowerCase().includes(term.replace(/^#/, ''));
        return matchesCategory && matchesSearch;
    });

    const inventoryColumns = [
        {
            header: 'Item Name',
            key: 'name',
            align: 'left',
            render: (val, row) => (
                <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100/50 group-hover:border-slate-300 transition-all shrink-0">
                        {row.image ? (
                            <img src={row.image} alt={val} className="w-full h-full object-cover" />
                        ) : (
                            <Scale size={16} />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-black text-slate-900 text-[11px] tracking-tight leading-none mb-1 truncate">{val}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{row.id?.slice(-8).toUpperCase()}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Category',
            key: 'category',
            align: 'left',
            render: (val) => <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-sm border border-slate-200 uppercase tracking-tight inline-block text-left">{val}</span>
        },
        {
            header: 'Current Stock',
            key: 'currentStock',
            align: 'right',
            render: (val, row) => (
                <div className="flex items-center justify-end gap-2 w-full">
                    <span className={cn(
                        "text-[11px] font-black tabular-nums text-right",
                        val < 10 ? "text-rose-600" : "text-slate-900"
                    )}>
                        {val} <span className="text-[10px] font-bold text-slate-400 ml-0.5">{row.unit}</span>
                    </span>
                    <span className="w-4 flex justify-center shrink-0">{val < 10 ? <AlertTriangle size={10} className="text-rose-500 animate-pulse" /> : null}</span>
                </div>
            )
        },
        {
            header: 'Stock Level',
            key: 'usageRate',
            align: 'right',
            render: (_, row) => {
                const targetStock = row.mbq * 5 || 50;
                const percentage = Math.round((row.currentStock / targetStock) * 100);
                return (
                    <div className="flex items-center gap-2 w-full min-w-[120px]">
                        <div className="flex-1 min-w-[60px] h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full", percentage < 20 ? "bg-rose-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums w-8 text-right shrink-0">{Math.min(percentage, 100)}%</span>
                    </div>
                );
            }
        },
        {
            header: 'Price',
            key: 'price',
            align: 'right',
            render: (val) => <span className="text-[11px] font-black text-slate-900 tabular-nums block text-right">₹{(val || 0).toLocaleString()}</span>
        },
    ];

    if (inventoryLoading && inventory.length === 0) {
        return (
            <div className="p-4 space-y-4 animate-pulse bg-slate-50 min-h-screen">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-16 bg-white border border-slate-200" />
                <div className="h-[500px] bg-white border border-slate-200" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Inventory</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">All Items</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Stock Status</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isResetting}
                            className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm uppercase tracking-widest disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={cn(isResetting && "animate-spin")} />
                            Refresh
                        </button>
                        <button
                            onClick={() => navigate('/franchise/procurement')}
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm uppercase tracking-widest"
                        >
                            <Plus size={14} />
                            Add Stock
                        </button>
                    </div>
                </div>
            </div>

            {/* Performance Strip */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Stock Health"
                    value={`${stats.healthPercentage}%`}
                    trend="Stable"
                    icon={ShieldCheck}
                />
                <MetricRow
                    label="Low Stock"
                    value={stats.lowStockCount}
                    trend={stats.lowStockCount > 2 ? 'down' : 'Stable'}
                    icon={AlertTriangle}
                    sub="Items to reorder"
                />
                <MetricRow
                    label="Total Value"
                    value={`₹${(stats.totalValue || 0).toLocaleString()}`}
                    trend="Stable"
                    icon={RefreshCw}
                />
                <MetricRow
                    label="Total Items"
                    value={stats.totalItems}
                    sub="Total Products"
                    icon={Zap}
                />
            </div>

            {receipts.length > 0 && (
                <div className="bg-white border-b border-slate-200 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Recently received from vendors</p>
                    <ul className="space-y-1.5">
                        {receipts.map((r) => {
                            const s = r.receiptSummary;
                            const lines = (s.lines || []).filter((l) => l.added > 0 || l.received > 0 || l.rejected);
                            return (
                                <li key={r._id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 text-[12px] text-slate-600 bg-slate-50 border border-slate-100 rounded-sm px-3 py-2">
                                    <div className="space-y-0.5">
                                        {lines.map((l, i) => (
                                            <p key={i}>
                                                <span className="font-bold text-slate-900">{l.name}</span>{': '}
                                                {l.rejected
                                                    ? 'rejected, not added to stock'
                                                    : <><span className="font-bold text-emerald-700">+{l.added} {l.unit} added to stock</span>
                                                        {l.damaged > 0 && <span className="text-amber-700">, {l.damaged} damaged</span>}
                                                        {l.usedForOrder > 0 && <span>, <b>{l.usedForOrder} {l.unit}</b> used right away to pack customer order <b>#{String(s.orderId || '').slice(-6).toUpperCase()}</b></span>}</>}
                                            </p>
                                        ))}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">
                                        {new Date(s.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-[11px] text-slate-400 mt-2">Stock that arrives for a waiting customer order is used for that order straight away, so the number on this page can show 0.</p>
                </div>
            )}

            <div className="p-px bg-slate-200">
                {/* Search sits on its own row so it is always visible, however many categories there are */}
                <div className="bg-white px-4 py-3 space-y-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                        <input
                            type="search"
                            placeholder="Search items by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-sm py-2.5 pl-10 pr-24 outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 bg-slate-100 rounded-sm"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-sm overflow-x-auto">
                        {['All', ...categories].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => {
                                    setActiveCategory(cat);
                                }}
                                className={cn(
                                    "shrink-0 whitespace-nowrap px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeCategory === cat
                                        ? "bg-white text-slate-900 shadow-sm rounded-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    {searchQuery.trim() && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found for "{searchQuery.trim()}"
                            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                        </p>
                    )}
                </div>

                <div className="bg-white border-t border-slate-200">
                    <AnimatePresence mode="wait">
                        {inventoryLoading && inventory.length === 0 ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-8 space-y-4"
                            >
                                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                    <div key={i} className="h-12 bg-slate-50 rounded-sm animate-pulse" />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="grid"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <DataGrid
                                    columns={inventoryColumns}
                                    data={filteredItems}
                                    density="compact"
                                    showSearch={false}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
