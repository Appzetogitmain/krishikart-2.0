import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    Search,
    ChevronDown,
    ChevronLeft,
    IndianRupee,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    Calendar,
    Download,
    Users,
    Briefcase,
    Info,
    Home,
    ChevronRight,
    Filter,
    ArrowRight
} from 'lucide-react';
import mockVendors from '../data/mockVendors.json';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/exportToCSV';

export default function VendorTurnoverScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVendorId, setSelectedVendorId] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'detail'
    const [selectedFY, setSelectedFY] = useState('2025-26');
    const [isFYLoading, setIsFYLoading] = useState(false);

    const handleExport = () => {
        const columns = [
            { header: 'Vendor ID', key: 'id' },
            { header: 'Vendor Name', key: 'name' },
            { header: 'Category', key: 'category' },
            { header: 'Total Turnover', key: 'totalTurnover' },
            { header: 'Growth %', key: 'growth' },
            { header: 'Status', key: 'status' }
        ];

        const data = filteredVendors.map(v => ({
            ...v,
            totalTurnover: `₹${v.totalTurnover.toLocaleString()}`,
            growth: '12.5%' // Mock growth
        }));

        exportToCSV(`Vendor_Turnover_FY${selectedFY}`, columns, data);
    };

    const toggleFY = () => {
        setIsFYLoading(true);
        setTimeout(() => {
            setSelectedFY(prev => prev === '2025-26' ? '2024-25' : '2025-26');
            setIsFYLoading(false);
        }, 500);
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 600);
        return () => clearTimeout(timer);
    }, [selectedVendorId, viewMode]);

    const filteredVendors = mockVendors.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeVendor = selectedVendorId
        ? mockVendors.find(v => v.id === selectedVendorId)
        : null;

    const aggregateStats = {
        totalTurnover: mockVendors.reduce((acc, v) => acc + v.totalTurnover, 0),
        avgGrowth: 12.5,
        activeVendors: mockVendors.filter(v => v.status === 'active').length,
        highestEarner: mockVendors.reduce((prev, current) => (prev.totalTurnover > current.totalTurnover) ? prev : current)
    };

    const handleVendorClick = (id) => {
        setIsLoading(true);
        setSelectedVendorId(id);
        setViewMode('detail');
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Financials</span>
                            {viewMode === 'detail' && (
                                <>
                                    <ChevronRight size={10} />
                                    <button onClick={() => setViewMode('grid')} className="hover:text-slate-900 transition-colors">Vendor Sales</button>
                                </>
                            )}
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">{viewMode === 'grid' ? 'Vendor Turnover' : activeVendor?.id}</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                            {viewMode === 'grid' ? 'Vendor performance' : `Audit: ${activeVendor?.name}`}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors border border-slate-200 rounded-sm bg-white"
                        >
                            <Download size={14} />
                        </button>
                        <div
                            onClick={toggleFY}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 bg-slate-900 text-white text-[10px] font-black rounded-sm uppercase tracking-widest cursor-pointer transition-all active:scale-95",
                                isFYLoading && "opacity-50 pointer-events-none"
                            )}
                        >
                            <Calendar size={12} />
                            {isFYLoading ? 'Switching...' : `FY ${selectedFY}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Corridor (KPI Strip) */}
            <div className="bg-white border-b border-slate-200 flex overflow-x-auto no-scrollbar">
                {viewMode === 'grid' ? (
                    <>
                        <MetricStripItem
                            label="Total Turnover"
                            value={`₹${(aggregateStats.totalTurnover / 1000000).toFixed(2)}M`}
                            trend="+14.2%"
                            isPositive={true}
                            icon={IndianRupee}
                        />
                        <MetricStripItem
                            label="Average Growth"
                            value={`${aggregateStats.avgGrowth}%`}
                            trend="Stable"
                            isPositive={true}
                            icon={TrendingUp}
                        />
                        <MetricStripItem
                            label="Active Vendors"
                            value={aggregateStats.activeVendors}
                            sub="Active Partners"
                            icon={Users}
                        />
                        <MetricStripItem
                            label="Top Vendor"
                            value={aggregateStats.highestEarner.name.split(' ')[0]}
                            sub="Top Contributor"
                            icon={Briefcase}
                        />
                    </>
                ) : (
                    <>
                        <MetricStripItem
                            label="Cumulative Revenue"
                            value={`₹${(activeVendor.totalTurnover / 1000).toFixed(1)}K`}
                            trend="+11.4%"
                            isPositive={true}
                            icon={IndianRupee}
                        />
                        <MetricStripItem
                            label="Average"
                            value={`₹${((activeVendor.totalTurnover / activeVendor.monthlyTurnover.length) / 1000).toFixed(1)}K`}
                            sub="Avg Monthly"
                            icon={BarChart3}
                        />
                        <MetricStripItem
                            label="Growth"
                            value="+12.0%"
                            trend="Target Met"
                            isPositive={true}
                            icon={TrendingUp}
                        />
                    </>
                )}
            </div>

            <div className="p-6">
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <div className="h-96 bg-white border border-slate-200 rounded-sm flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                        </div>
                    ) : viewMode === 'grid' ? (
                        <motion.div
                            key="grid-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            {/* Filter/Search Bar */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Filter by Vendor ID, Name, or Category..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value.trim())}
                                        className="w-full bg-white border border-slate-200 rounded-sm py-2 pl-10 pr-4 outline-none text-[11px] font-bold text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-slate-900 transition-all font-sans"
                                    />
                                </div>
                                <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
                                    <Filter size={12} />
                                    Filter
                                </button>
                            </div>

                            {/* Dense Table */}
                            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vendor</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Peak Volume (Monthly)</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Sales</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Turnover</th>
                                                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredVendors.map((vendor) => {
                                                const monthlyMax = Math.max(...vendor.monthlyTurnover.map(m => m.amount));
                                                const currentMonth = vendor.monthlyTurnover[vendor.monthlyTurnover.length - 1].amount;

                                                return (
                                                    <tr key={vendor.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => handleVendorClick(vendor.id)}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900 text-xs tracking-tight">{vendor.name}</span>
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-0.5">{vendor.id} • {vendor.category}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-slate-600 tabular-nums">
                                                            ₹{monthlyMax.toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-slate-900 tabular-nums">₹{currentMonth.toLocaleString()}</span>
                                                                <div className="px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600 text-[10px] font-black flex items-center gap-0.5 tabular-nums">
                                                                    <ArrowUpRight size={10} /> 8.0%
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm font-black text-slate-900 tabular-nums">₹{vendor.totalTurnover.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="p-1 text-slate-400 hover:text-slate-900 transition-colors opacity-0 group-hover:opacity-100">
                                                                <ArrowRight size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="detail-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            {/* Detailed Visualization */}
                            <div className="bg-white border border-slate-200 rounded-sm p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-10 pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Monthly Revenue</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Monthly trend (FY 2025)</p>
                                    </div>
                                    <div className="flex gap-8">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Busiest Month</p>
                                            <p className="text-lg font-black text-slate-900 tabular-nums">₹{Math.max(...activeVendor.monthlyTurnover.map(m => m.amount)).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-end justify-between h-48 gap-3 px-2">
                                    {activeVendor.monthlyTurnover.map((item, idx) => {
                                        const maxAmount = Math.max(...activeVendor.monthlyTurnover.map(m => m.amount));
                                        const height = (item.amount / maxAmount) * 100;

                                        return (
                                            <div key={item.month} className="flex-1 flex flex-col items-center gap-3 group relative">
                                                <div className="relative w-full flex justify-center h-48 flex-col justify-end">
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${height}%` }}
                                                        className={cn(
                                                            "w-full rounded-sm transition-all duration-300",
                                                            idx === activeVendor.monthlyTurnover.length - 1 ? "bg-slate-900" : "bg-slate-100 group-hover:bg-slate-200"
                                                        )}
                                                    />
                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black py-0.5 px-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity tabular-nums whitespace-nowrap z-10">
                                                        ₹{(item.amount / 1000).toFixed(1)}K
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.month}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Secondary Analytics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <BarChart3 size={14} className="text-slate-400" />
                                        Forecast
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Expected M+1</span>
                                            <span className="text-lg font-black text-slate-900 tabular-nums">₹2.1L</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Annualized Projection</span>
                                            <span className="text-lg font-black text-slate-900 tabular-nums">₹24.8L</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 text-white overflow-hidden relative shadow-sm">
                                    <div className="relative z-10">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-white/60">Tax & Payments</h4>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-sm flex items-center justify-center">
                                                    <ShieldCheckIcon size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Taxation Status</p>
                                                    <p className="text-xs font-bold text-white">Fully Compliant</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white/5 text-white/40 rounded-sm flex items-center justify-center">
                                                    <Info size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Last Settlement</p>
                                                    <p className="text-xs font-bold text-white">48h Ago</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <Briefcase size={80} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function MetricStripItem({ label, value, trend, isPositive, sub, icon: Icon }) {
    return (
        <div className="flex items-center gap-4 px-6 py-4 border-r border-slate-200 last:border-r-0 min-w-[240px]">
            <div className="w-8 h-8 rounded-sm bg-slate-50 flex items-center justify-center text-slate-400">
                {Icon && <Icon size={16} />}
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight tabular-nums">{value}</h3>
                    {trend && (
                        <span className={cn(
                            "text-[10px] font-bold tabular-nums",
                            isPositive ? "text-emerald-500" : "text-red-500"
                        )}>
                            {trend}
                        </span>
                    )}
                    {sub && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {sub}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function ShieldCheckIcon({ size }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .52-.88l7.1-4a1 1 0 0 1 .79 0l7.1 4A1 1 0 0 1 20 6v7z" /><path d="m9 12 2 2 4-4" /></svg>
    );
}
