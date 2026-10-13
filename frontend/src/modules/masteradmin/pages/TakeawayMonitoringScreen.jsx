import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Monitor,
    ShoppingBag,
    Clock,
    Wifi,
    WifiOff,
    Zap,
    CheckCircle2,
    Search,
    IndianRupee,
    Store,
    ArrowRight,
    Home,
    ChevronRight,
    Download,
    Calendar,
    ChevronDown,
    Activity,
    Target,
    Layers,
    Terminal
} from 'lucide-react';
import mockOrders from '../data/mockAdminOrders.json';
import { cn } from '@/lib/utils';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import ChartPanel from '../components/cards/ChartPanel';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';

export default function TakeawayMonitoringScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const takeawayOrders = mockOrders.filter(o => o.type === 'takeaway' || o.type === 'Takeaway');

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 700);
        return () => clearTimeout(timer);
    }, []);

    const kiosks = [
        { id: 'K-01', name: 'West Wing Station', status: 'online', load: 12, uptime: '99.8%' },
        { id: 'K-02', name: 'Central Plaza', status: 'online', load: 45, uptime: '98.2%' },
        { id: 'K-03', name: 'North Gate Kiosk', status: 'offline', load: 0, uptime: '92.4%' },
        { id: 'K-04', name: 'South Transit Hub', status: 'online', load: 28, uptime: '99.9%' }
    ];

    const queueColumns = [
        {
            header: 'Order Reference',
            key: 'id',
            render: (val) => <span className="font-bold text-slate-900 tabular-nums">#{val}</span>
        },
        {
            header: 'Counter',
            key: 'franchise',
            render: (val) => (
                <div className="flex items-center gap-2">
                    <Monitor size={12} className="text-slate-400" />
                    <span className="font-medium text-slate-600">{val}</span>
                </div>
            )
        },
        {
            header: 'Customer',
            key: 'customer',
            render: (val) => <span className="font-medium text-slate-800">{val}</span>
        },
        {
            header: 'Status',
            key: 'status',
            render: () => (
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                        <div className="h-full bg-slate-400 animate-pulse w-full origin-left" />
                    </div>
                </div>
            )
        },
        {
            header: 'Type',
            key: 'type',
            render: () => <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-100 uppercase">Quick</span>
        },
        {
            header: 'Invoice',
            key: 'total',
            align: 'right',
            render: (val) => <span className="font-bold text-slate-900 leading-none tabular-nums">₹{val.toLocaleString()}</span>
        }
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
                            <span className="text-slate-900 uppercase tracking-widest">Counter Sales</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Takeaway Orders</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                            <Terminal size={13} className="text-slate-400" />
                            <span>Status</span>
                        </button>
                        <button className="bg-slate-900 text-white px-3 py-1.5 rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                            <Zap size={13} />
                            Clear Queue
                        </button>
                    </div>
                </div>
            </div>

            {/* Infrastructure KPIs */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Active Systems"
                    value="3 / 4"
                    change={-25}
                    trend="down"
                    icon={Monitor}
                    sparklineData={[1, 1, 1, 1, 1, 0, 1].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Load Capacity"
                    value="64.2%"
                    change={14.8}
                    trend="up"
                    icon={Activity}
                    sparklineData={[40, 45, 52, 58, 64, 62, 64].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Mean Uptime"
                    value="99.4%"
                    change={0.1}
                    trend="up"
                    icon={Clock}
                    sparklineData={[99, 99.2, 99.3, 99.4, 99.2, 99.4, 99.4].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Fulfillment Rate"
                    value="97.8%"
                    change={1.2}
                    trend="up"
                    icon={CheckCircle2}
                    sparklineData={[96, 96.5, 97, 97.2, 97.5, 97.8, 97.8].map(v => ({ value: v }))}
                />
            </div>

            <div className="flex flex-col gap-px">
                <FilterBar
                    actions={
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-100">LIVE</span>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 xl:grid-cols-4 bg-slate-200 gap-px">
                    {/* Main Queue Ledger */}
                    <div className="xl:col-span-3 bg-white">
                        <DataGrid
                            title="Takeaway Order Queue"
                            columns={queueColumns}
                            data={takeawayOrders}
                            density="compact"
                        />
                    </div>

                    {/* Kiosk Health Summary */}
                    <div className="bg-white flex flex-col">
                        <ChartPanel
                            title="Franchise Status"
                            collapsible={false}
                        >
                            <div className="p-4 space-y-4">
                                {kiosks.map(kiosk => (
                                    <div key={kiosk.id} className="border border-slate-200 rounded-sm p-3 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kiosk.id}</p>
                                                <h4 className="text-xs font-bold text-slate-900">{kiosk.name}</h4>
                                            </div>
                                            <div className={cn(
                                                "px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border",
                                                kiosk.status === 'online'
                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                    : "bg-rose-50 text-rose-600 border-rose-100"
                                            )}>
                                                {kiosk.status}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-slate-500 font-medium">Busy Level</span>
                                                <span className="text-slate-900 font-bold tabular-nums">{kiosk.load}%</span>
                                            </div>
                                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full", kiosk.load > 40 ? "bg-amber-400" : "bg-slate-400")}
                                                    style={{ width: `${kiosk.load}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                                                <div className="flex items-center gap-1">
                                                    <Wifi size={10} />
                                                    <span>{kiosk.uptime} Stability</span>
                                                </div>
                                                <Zap size={10} className={cn(kiosk.status === 'online' ? "text-amber-400" : "text-slate-200")} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartPanel>

                        <div className="mt-auto p-4 bg-slate-900">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Status</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Feed</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400">Total Time</span>
                                    <span className="text-[10px] font-bold text-white tabular-nums">1.4s</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400">Connection</span>
                                    <span className="text-[10px] font-bold text-white tabular-nums">99.98%</span>
                                </div>
                                <div className="h-px bg-white/5 my-2" />
                                <button className="w-full py-2 bg-white/5 border border-white/10 rounded-sm text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-colors">
                                    Open Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
