import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    TrendingUp,
    Download,
    Store,
    Users,
    ShoppingCart,
    PackageSearch,
    ChevronRight,
    Home,
    Filter,
    Calendar,
    Activity
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import DataGrid from '../components/tables/DataGrid';
import ChartPanel from '../components/cards/ChartPanel';
import MetricRow from '../components/cards/MetricRow';
import ProfessionalTooltip from '../components/common/ProfessionalTooltip';

const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

export default function GlobalReportsScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('franchise_procurement');
    const [reportData, setReportData] = useState(null);

    // Date range filtering
    const [dateRange, setDateRange] = useState('month');

    const tabs = [
        { id: 'franchise_procurement', label: 'Franchise Procurement', icon: Store },
        { id: 'vendor_procurement', label: 'Vendor Supply', icon: PackageSearch },
        { id: 'franchise_sales', label: 'Franchise Sales', icon: TrendingUp },
        { id: 'vendor_sales', label: 'Vendor Sales', icon: ShoppingCart },
    ];

    useEffect(() => {
        // Mock data fetch for reports
        // Replace with actual API endpoints when ready
        const fetchReports = async () => {
            setIsLoading(true);
            try {
                const response = await api.get(`/masteradmin/reports/comprehensive?range=${dateRange}`);
                if (response.data && response.data.result) {
                    setReportData(response.data.result);
                }
            } catch (error) {
                console.error("Failed to load reports", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReports();
    }, [dateRange]);


    const franchiseProcurementColumns = [
        { header: 'Franchise', key: 'franchiseName', render: (val) => <span className="font-black text-slate-900">{val}</span> },
        { header: 'Total Procured', key: 'amount', align: 'right', render: (val) => <span className="font-bold text-slate-900">₹{val.toLocaleString()}</span> },
        { header: 'Procurement Orders', key: 'orders', align: 'right', render: (val) => <span className="text-slate-600 font-bold tabular-nums">{val}</span> },
        { header: 'Top Procured Item', key: 'topItem', render: (val) => <span className="text-slate-500 font-bold text-xs bg-slate-100 px-2 py-1 rounded-sm uppercase">{val}</span> },
    ];

    const vendorSupplyColumns = [
        { header: 'Vendor Name', key: 'vendorName', render: (val) => <span className="font-black text-slate-900">{val}</span> },
        { header: 'Total Supplied', key: 'amount', align: 'right', render: (val) => <span className="font-bold text-slate-900">₹{val.toLocaleString()}</span> },
        { header: 'Items Supplied', key: 'items', align: 'right', render: (val) => <span className="text-slate-600 font-bold tabular-nums">{val}</span> },
        { header: 'Reliability Score', key: 'reliability', align: 'right', render: (val) => (
            <span className={cn("font-black px-2 py-0.5 rounded-sm text-[10px]", val > 90 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                {val}%
            </span>
        ) },
    ];

    const franchiseSalesColumns = [
        { header: 'Franchise', key: 'franchiseName', render: (val) => <span className="font-black text-slate-900">{val}</span> },
        { header: 'Gross Sales', key: 'amount', align: 'right', render: (val) => <span className="font-bold text-slate-900 tabular-nums text-sm">₹{val.toLocaleString()}</span> },
        { header: 'Total Orders', key: 'orders', align: 'right', render: (val) => <span className="text-slate-600 font-bold tabular-nums">{val}</span> },
        { header: 'Growth (MoM)', key: 'growth', align: 'right', render: (val) => (
            <span className={cn("font-black text-xs", val > 0 ? "text-emerald-600" : "text-rose-600")}>
                {val > 0 ? '+' : ''}{val}%
            </span>
        ) },
    ];

    const vendorSalesColumns = [
        { header: 'Vendor Name', key: 'vendorName', render: (val) => <span className="font-black text-slate-900">{val}</span> },
        { header: 'Generated Sales', key: 'generatedSales', align: 'right', render: (val) => <span className="font-bold text-slate-900 tabular-nums">₹{val.toLocaleString()}</span> },
        { header: 'Revenue Share', key: 'share', align: 'right', render: (val) => (
            <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500 font-bold text-xs">{val}%</span>
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900" style={{ width: `${val}%` }} />
                </div>
            </div>
        ) },
    ];

    if (isLoading || !reportData) {
        return (
            <div className="p-8 space-y-6 animate-pulse">
                <div className="h-10 w-64 bg-slate-200 rounded-sm" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-sm" />)}
                </div>
                <div className="h-96 bg-slate-50 border border-slate-100 rounded-sm" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-10 font-sans">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Master Admin</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900">Reports</span>
                        </div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sales and purchase reports</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <select 
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="h-9 px-3 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider rounded-sm focus:border-slate-400 outline-none cursor-pointer"
                        >
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="quarter">This Quarter</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>
                </div>

                {/* KPI Ribbon */}
                <div className="grid grid-cols-2 md:grid-cols-4 border-t border-slate-100 bg-slate-900 text-white divide-x divide-slate-800">
                    <div className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Franchise Sales</span>
                        <span className="text-xl font-black tracking-tighter">₹{reportData.kpis.totalSales.toLocaleString()}</span>
                    </div>
                    <div className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Procured Value</span>
                        <span className="text-xl font-black tracking-tighter text-blue-400">₹{reportData.kpis.totalProcured.toLocaleString()}</span>
                    </div>
                    <div className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Franchises</span>
                        <span className="text-xl font-black tracking-tighter">{reportData.kpis.activeFranchises} Franchises</span>
                    </div>
                    <div className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Vendors</span>
                        <span className="text-xl font-black tracking-tighter text-emerald-400">{reportData.kpis.activeVendors} Suppliers</span>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex px-4 pt-4 gap-2 overflow-x-auto no-scrollbar bg-slate-100 border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-t-sm transition-all whitespace-nowrap border-b-2",
                                activeTab === tab.id 
                                    ? "bg-white text-slate-900 border-slate-900 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]" 
                                    : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-200"
                            )}
                        >
                            <tab.icon size={14} className={activeTab === tab.id ? "text-slate-900" : "text-slate-400"} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Report Content Area */}
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                
                {/* Global Trend Chart (Visible across all tabs for context) */}
                <ChartPanel title="Global Procurement vs Sales Trend" subtitle={`Data resolution: ${dateRange}`}>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={reportData.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorProcurement" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(val) => `₹${val/1000}k`} />
                            <RechartsTooltip content={<ProfessionalTooltip currency="₹" />} />
                            <Area type="monotone" dataKey="sales" name="Total Sales" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            <Area type="monotone" dataKey="procurement" name="Total Procurement" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorProcurement)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartPanel>

                {/* Tab Specific Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 xl:grid-cols-3 gap-6"
                    >
                        {/* Tab 1: Franchise Procurement */}
                        {activeTab === 'franchise_procurement' && (
                            <>
                                <div className="xl:col-span-2 bg-white rounded-sm border border-slate-200 overflow-hidden shadow-sm">
                                    <DataGrid 
                                        title="Franchise Stock Purchases"
                                        columns={franchiseProcurementColumns}
                                        data={reportData.franchiseProcurement}
                                    />
                                </div>
                                <div className="bg-white rounded-sm border border-slate-200 p-5 shadow-sm flex flex-col">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-6">Procurement Distribution</h3>
                                    <div className="flex-1 flex items-center justify-center min-h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={reportData.franchiseProcurement}
                                                    cx="50%" cy="50%"
                                                    innerRadius={60} outerRadius={90}
                                                    paddingAngle={2}
                                                    dataKey="amount"
                                                    nameKey="franchiseName"
                                                >
                                                    {reportData.franchiseProcurement.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                                </Pie>
                                                <RechartsTooltip content={<ProfessionalTooltip currency="₹" />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Tab 2: Vendor Supply */}
                        {activeTab === 'vendor_procurement' && (
                            <>
                                <div className="xl:col-span-2 bg-white rounded-sm border border-slate-200 overflow-hidden shadow-sm">
                                    <DataGrid 
                                        title="Vendor Supply Metrics"
                                        columns={vendorSupplyColumns}
                                        data={reportData.vendorSupply}
                                    />
                                </div>
                                <div className="bg-white rounded-sm border border-slate-200 p-5 shadow-sm">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider mb-6">Top Supplier Volume</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={reportData.vendorSupply} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="vendorName" type="category" hide />
                                            <RechartsTooltip content={<ProfessionalTooltip currency="₹" />} />
                                            <Bar dataKey="amount" fill="#0f172a" radius={[0, 4, 4, 0]} barSize={24} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        )}

                        {/* Tab 3: Franchise Sales */}
                        {activeTab === 'franchise_sales' && (
                            <div className="xl:col-span-3 bg-white rounded-sm border border-slate-200 overflow-hidden shadow-sm">
                                <DataGrid 
                                    title="Franchise Revenue Generation"
                                    columns={franchiseSalesColumns}
                                    data={reportData.franchiseSales}
                                />
                            </div>
                        )}

                        {/* Tab 4: Vendor Sales Impact */}
                        {activeTab === 'vendor_sales' && (
                            <div className="xl:col-span-3 bg-white rounded-sm border border-slate-200 overflow-hidden shadow-sm">
                                <DataGrid 
                                    title="Vendor Sales"
                                    columns={vendorSalesColumns}
                                    data={reportData.vendorSalesImpact}
                                />
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
