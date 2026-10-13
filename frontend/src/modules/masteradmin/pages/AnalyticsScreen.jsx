import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    TrendingUp,
    Calendar,
    Download,
    ArrowUpRight,
    IndianRupee,
    Users,
    Globe,
    Filter,
    ChevronDown,
    Activity,
    Home,
    ChevronRight,
    Target,
    Layers,
    FileText,
    PieChart as PieChartIcon,
    RefreshCw
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import mockAnalytics from '../data/mockAnalytics.json';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import ChartPanel from '../components/cards/ChartPanel';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';
import ProfessionalTooltip from '../components/common/ProfessionalTooltip';

const COLORS = ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#0284c7'];

export default function AnalyticsScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState({
        revenueGrowth: [],
        regionalPerformance: [],
        categoryDistribution: []
    });

    const fetchAnalyticsStats = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/masteradmin/analytics/stats');
            if (response.data.success && response.data.result) {
                setAnalyticsData(response.data.result);
            }
        } catch (error) {
            console.error('Failed to fetch analytics stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalyticsStats();
    }, []);

    const { revenueGrowth, regionalPerformance, categoryDistribution } = analyticsData;

    const revenueColumns = [
        { header: 'Reporting Period', key: 'month', render: (val) => <span className="font-bold text-slate-900">{val} 2026</span> },
        { header: 'Gross Revenue', key: 'amount', align: 'right', render: (val) => <span className="font-bold text-slate-900">₹{val.toLocaleString()}</span> },
        {
            header: 'Growth vs Prev.', key: 'growth', align: 'right', render: (_, row, idx) => {
                const prev = idx > 0 ? revenueGrowth[idx - 1].amount : row.amount;
                const growth = ((row.amount - prev) / prev * 100).toFixed(1);
                return (
                    <div className={cn(
                        "flex items-center justify-end gap-1 font-bold tabular-nums text-xs",
                        parseFloat(growth) >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                        <span>{parseFloat(growth) >= 0 ? '↑' : '↓'}</span>
                        <span>{Math.abs(growth)}%</span>
                    </div>
                );
            }
        },
        {
            header: 'Performance Score', key: 'index', render: (_, row) => (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                        <div className="h-full bg-slate-400" style={{ width: `${(row.amount / 65000) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{(row.amount / 650).toFixed(0)} pts</span>
                </div>
            )
        }
    ];

    const regionalColumns = [
        { header: 'Market Region', key: 'region', render: (val) => <span className="font-bold text-slate-900">{val}</span> },
        { header: 'Franchises', key: 'nodes', render: (val) => <span className="text-slate-600 font-medium">{val || 1}</span> },
        {
            header: 'On-Time Rate', key: 'efficiency', align: 'right', render: (val) => (
                <div className="flex items-center justify-end gap-3">
                    <span className={cn(
                        "text-xs font-bold tabular-nums",
                        val > 90 ? "text-emerald-600" : "text-blue-600"
                    )}>{val}%</span>
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full", val > 90 ? "bg-emerald-500" : "bg-blue-500")}
                            style={{ width: `${val}%` }}
                        />
                    </div>
                </div>
            )
        },
        { header: 'Market Share', key: 'share', align: 'right', render: (val) => <span className="text-slate-400 font-bold">{val || 0}%</span> }
    ];

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-50 border border-slate-200" />
                <div className="h-[500px] bg-slate-50 border border-slate-200" />
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
                            <span>Master Admin</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900">Analytics</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Performance</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                            <Calendar size={13} className="text-slate-400" />
                            <span>Q1 FY2026</span>
                            <ChevronDown size={12} className="text-slate-300" />
                        </button>
                        <button className="bg-slate-900 text-white px-3 py-1.5 rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                            <Download size={13} />
                            Download Data
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI scorecard - Inline Row */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 lg:grid-cols-3">
                <MetricRow
                    label="Total Revenue"
                    value={analyticsData.kpis?.revenue?.value || '₹0.00'}
                    change={analyticsData.kpis?.revenue?.change || 0}
                    trend="up"
                    icon={IndianRupee}
                    sparklineData={[30, 35, 32, 38, 42, 45, 48].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Capacity"
                    value={analyticsData.kpis?.nodes?.value || '0 Franchises'}
                    change={analyticsData.kpis?.nodes?.change || 0}
                    trend="up"
                    icon={Users}
                    sparklineData={[1100, 1150, 1180, 1200, 1220, 1240, 1248].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Uptime"
                    value={analyticsData.kpis?.uptime?.value || '98.2%'}
                    change={analyticsData.kpis?.uptime?.change || 0}
                    trend="up"
                    icon={Activity}
                    sparklineData={[97.8, 98.0, 97.9, 98.1, 98.2, 98.1, 98.2].map(v => ({ value: v }))}
                />
            </div>

            {/* Main Intelligence Grid */}
            <div className="flex flex-col gap-px">
                <FilterBar
                    actions={
                        <div className="flex items-center gap-1">
                            <button className="px-3 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded">Trend Analysis</button>
                            <button className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded">Comparative View</button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-px bg-slate-200">
                    <div className="bg-white flex flex-col">
                        <DataGrid
                            title="Revenue Over Time"
                            columns={revenueColumns}
                            data={revenueGrowth}
                            density="compact"
                        />
                        <ChartPanel
                            title="Revenue trend"
                            height={250}
                            collapsible={false}
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueGrowth} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <RechartsTooltip content={<ProfessionalTooltip currency="₹" />} />
                                    <Bar dataKey="amount" fill="#475569" radius={[2, 2, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    </div>

                    <div className="bg-white flex flex-col">
                        <ChartPanel
                            title="Category Market Share"
                            subtitle="Revenue distribution by produce type"
                        >
                            <div className="flex items-center justify-around h-full px-8">
                                <div className="w-1/2 h-full py-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={4}
                                                dataKey="share"
                                            >
                                                {categoryDistribution.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<ProfessionalTooltip currency="" />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-1/2 space-y-3">
                                    {categoryDistribution.map((cat, idx) => (
                                        <div key={idx} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                                                <span className="text-xs font-bold text-slate-600">{cat.category}</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-900 tabular-nums">{cat.share}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ChartPanel>

                        <DataGrid
                            title="Sales by Region"
                            columns={regionalColumns}
                            data={regionalPerformance}
                            density="compact"
                        />
                    </div>
                </div>

                {/* Footer Intelligence Bar */}
                <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-blue-400" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">Sales trend</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/50">
                            <TrendingUp size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-widest">+12.4% Annualized Growth</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                            Reports
                        </button>
                        <div className="h-3 w-px bg-white/10" />
                        <button className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#0284c7]">
                            <Layers size={12} />
                            Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
