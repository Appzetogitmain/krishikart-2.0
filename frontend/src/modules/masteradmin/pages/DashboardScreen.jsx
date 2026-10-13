import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    Filter,
    Calendar,
    ChevronDown,
    IndianRupee,
    Users,
    ShoppingCart,
    Clock,
    Home,
    ChevronRight,
    Search,
    RefreshCw,
    Activity,
    Layers,
    FileText,
    ExternalLink,
    AlertCircle,
    BarChart3,
    Terminal,
    Cpu,
    Store,
    Truck
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar
} from 'recharts';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getSocket, joinAdminDeliveryTracking } from '@/lib/socket';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import ChartPanel from '../components/cards/ChartPanel';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';
import ComparisonChart from '../components/cards/ComparisonChart';
import ProfessionalTooltip from '../components/common/ProfessionalTooltip';

export default function DashboardScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [showMetrics, setShowMetrics] = useState(true);
    const [settlementSearch, setSettlementSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [dashboardData, setDashboardData] = useState({
        kpis: [],
        orderFlow: [],
        revenueFlow: [],
        recentSettlements: []
    });

    const fetchDashboardStats = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/masteradmin/dashboard/stats');
            if (response.data.success && response.data.result) {
                setDashboardData(response.data.result);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardStats();

        // Socket Integration
        const socket = getSocket();
        joinAdminDeliveryTracking();

        const handleUpdate = () => {
            fetchDashboardStats();
        };

        socket.on('new_order_placed', handleUpdate);
        socket.on('order_status_updated', handleUpdate);
        socket.on('procurement_quote_received', handleUpdate);
        socket.on('procurement_status_updated', handleUpdate);

        return () => {
            socket.off('new_order_placed', handleUpdate);
            socket.off('order_status_updated', handleUpdate);
            socket.off('procurement_quote_received', handleUpdate);
            socket.off('procurement_status_updated', handleUpdate);
        };
    }, []);

    const { kpis, orderFlow, revenueFlow, recentSettlements } = dashboardData;

    const filteredSettlements = recentSettlements.filter(s =>
        s.vendor.toLowerCase().includes(settlementSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(settlementSearch.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filteredSettlements.length / itemsPerPage));
    const paginatedSettlements = filteredSettlements.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [settlementSearch]);

    const settlementColumns = [
        {
            header: 'Vendor Details',
            key: 'vendor',
            width: '20%',
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-sm bg-slate-100 flex items-center justify-center text-slate-400">
                        <Users size={12} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-[11px] leading-tight">{val}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ENT-{row.id.split('-')[1]}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Status',
            key: 'status',
            width: '20%',
            render: (val) => (
                <div className={cn(
                    "px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest border w-fit",
                    val === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                    {val}
                </div>
            )
        },
        {
            header: 'Amount',
            key: 'amount',
            width: '20%',
            align: 'right',
            render: (val) => <span className="font-bold text-slate-900 tabular-nums text-[11px]">₹{val.toLocaleString()}</span>
        },
        {
            header: 'Net Payable',
            key: 'netPayable',
            width: '20%',
            align: 'right',
            render: (_, row) => <span className="font-bold text-blue-600 tabular-nums text-[11px]">₹{(row.amount * 0.95).toLocaleString()}</span>
        },
        {
            header: 'Date',
            key: 'date',
            width: '20%',
            align: 'right',
            render: (val) => <span className="text-[10px] text-slate-400 font-bold uppercase tabular-nums">{val}</span>
        }
    ];

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-20 bg-slate-50 border border-slate-200" />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="h-[400px] bg-slate-50 border border-slate-200 rounded-sm" />
                    <div className="h-[400px] bg-slate-50 border border-slate-200 rounded-sm" />
                </div>
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
                            <span>Admin Panel</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Dashboard</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Dashboard Overview</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-sm mr-2 px-3 py-1 font-bold text-slate-900 shadow-sm uppercase tracking-widest text-[10px]">
                            Live
                        </div>
                        <button
                            onClick={fetchDashboardStats}
                            className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-400 transition-colors"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Performance Strip */}
            <div className="bg-white border-b border-slate-200">
                <div
                    className="px-4 py-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                    onClick={() => setShowMetrics(!showMetrics)}
                >
                    <div className="flex items-center gap-2">
                        {showMetrics ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Key Metrics</span>
                    </div>
                    {!showMetrics && (
                        <div className="flex gap-4">
                            {kpis.slice(0, 3).map((kpi, i) => (
                                <span key={i} className="text-[10px] font-bold tabular-nums text-slate-500">
                                    {kpi.label}: <span className="text-slate-900">{kpi.value}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {showMetrics && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-6 border-t border-slate-200 overflow-hidden"
                        >
                            {kpis.map((kpi, idx) => (
                                <MetricRow
                                    key={idx}
                                    {...kpi}
                                    icon={
                                        idx === 0 ? IndianRupee : 
                                        idx === 1 ? ShoppingCart : 
                                        idx === 2 ? Users : 
                                        idx === 3 ? Truck : 
                                        idx === 4 ? Calendar : Store
                                    }
                                    sparklineData={
                                        idx === 0 ? (revenueFlow || []).map(d => ({ value: d.revenue })) :
                                        idx === 1 ? (orderFlow || []).map(d => ({ value: d.orders })) :
                                        [30, 35, 32, 38, 42, 45, 48].map(v => ({ value: v }))
                                    }
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Operational Grid */}
            <div className="flex flex-col gap-0">                {/* Visual Analytics */}
                <div className="grid grid-cols-1 xl:grid-cols-2 bg-slate-200 gap-px border-b border-slate-200">
                    <ChartPanel
                        title="Order Statistics"
                        subtitle="Order fulfillment rate"
                        height={340}
                        data={orderFlow}
                    >
                        <ComparisonChart
                            data={orderFlow}
                            type="composed"
                            metrics={[
                                { key: "orders", name: "Orders", color: "#0f172a", type: "area" },
                                { key: "fulfillment", name: "Fulfillment", color: "#64748b", type: "bar" }
                            ]}
                            height={300}
                            targetValue={80}
                            targetLabel="SLA Threshold"
                        />
                    </ChartPanel>
 
                    <ChartPanel
                        title="Revenue Trends"
                        subtitle="Daily revenue (Last 24 hours)"
                        height={340}
                        data={revenueFlow}
                    >
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
                            <AreaChart data={revenueFlow} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                                />
                                <RechartsTooltip content={<ProfessionalTooltip currency="₹" />} />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#0284c7"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartPanel>
                </div>

                {/* Ledger Management */}
                <div className="bg-white">
                    <FilterBar
                        onSearch={(v) => setSettlementSearch(typeof v === 'string' ? v.trim() : v)}
                        onRefresh={fetchDashboardStats}
                    />
                    <DataGrid
                        title="Recent Settlements"
                        columns={settlementColumns}
                        data={paginatedSettlements}
                        density="compact"
                    />

                    {/* Pipeline Summary Footer */}
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-sm">
                                <AlertCircle size={10} className="text-amber-500" />
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                                    {recentSettlements.filter(s => s.status === 'Pending').length} Pending Items
                                </span>
                            </div>
                            <div className="h-3 w-px bg-slate-200" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest underline decoration-slate-200 underline-offset-4 cursor-help">
                                Total Amount: <span className="text-slate-900 tabular-nums">₹{recentSettlements?.reduce((acc, s) => acc + s.amount, 0).toLocaleString()}.00</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage <= 1}
                                className={cn(
                                    "px-2 py-1 text-[10px] font-bold transition-colors uppercase rounded-sm",
                                    currentPage <= 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                                )}
                            >
                                Prev
                            </button>
                            <span className="text-[10px] font-bold px-2 tabular-nums">Page {String(currentPage).padStart(2, '0')} // {String(totalPages).padStart(2, '0')}</span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage >= totalPages}
                                className={cn(
                                    "px-2 py-1 text-[10px] font-bold transition-colors uppercase rounded-sm",
                                    currentPage >= totalPages ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                                )}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
