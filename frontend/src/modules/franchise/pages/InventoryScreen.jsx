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

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';

export default function InventoryScreen() {
    const navigate = useNavigate();
    const { inventory, categories, getStockStats, loading: inventoryLoading, refreshInventory } = useInventory();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [isResetting, setIsResetting] = useState(false);

    // Reloads the real stock from the server (the old "Reset All" testing button that
    // overwrote every product to 100 units has been removed)
    const handleRefresh = async () => {
        setIsResetting(true);
        try {
            await refreshInventory();
        } finally {
            setIsResetting(false);
        }
    };

    const stats = getStockStats();

    const filteredItems = inventory.filter(item => {
        const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
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

            <div className="p-px bg-slate-200">
                <FilterBar
                    actions={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-sm mr-4">
                                {['All', ...categories].map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            setActiveCategory(cat);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                            activeCategory === cat
                                                ? "bg-white text-slate-900 shadow-sm rounded-sm"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <div className="relative group w-full max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.trim())}
                                    className="bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:border-slate-400 transition-all font-sans min-w-[240px]"
                                />
                            </div>
                        </div>
                    }
                />

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
