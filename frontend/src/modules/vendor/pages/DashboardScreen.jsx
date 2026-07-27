import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
    Truck,
    TrendingUp,
    Clock,
    IndianRupee,
    Wallet,
    ChevronRight,
    ArrowUpRight,
    Settings,
    Home,
    Package,
    Activity,
    ClipboardList
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import MetricCard from '../components/cards/MetricCard';
import DataGrid from '../components/tables/DataGrid';
import api from '@/lib/axios';
import { useVendorAuth } from '../contexts/VendorAuthContext';

export default function DashboardScreen() {
    const navigate = useNavigate();
    const { vendor, isAuthenticated, newAssignmentData, statusAlertData } = useVendorAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [activeDispatches, setActiveDispatches] = useState([]);
    const [dashboardStats, setDashboardStats] = useState({
        activeOps: 0,
        pendingSettlement: 0,
        totalTurnover: 0,
        payoutCycleDays: 0,
        verificationStatus: 'Pending Verification',
        syncMinutes: 0,
        trends: {
            pendingSettlement: 0,
            yieldDelta: 0,
            totalTurnover: 0
        },
        inventory: {
            stockQuantity: 0,
            availableProduce: 0
        },
        performance: {
            fulfillmentRate: 0,
            avgPrepTime: '0.0 Days',
            archiveVol: 0,
            yieldDelta: 0
        }
    });



    const fetchDashboardData = async () => {
        try {
            const [dispatchRes, statsRes] = await Promise.all([
                api.get('/procurement/vendor/active-dispatch'),
                api.get('/procurement/vendor/dashboard-stats')
            ]);

            if (dispatchRes.data.success) {
                setActiveDispatches(dispatchRes.data.results || []);
            }
            if (statsRes.data.success) {
                console.log("Dashboard Stats Received:", statsRes.data.result);
                setDashboardStats(statsRes.data.result || statsRes.data.results || {});
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
            toast.error("Dashboard Sync Failed", {
                description: "The logistics matrix could not be synchronized."
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchDashboardData();
        }
    }, [isAuthenticated, newAssignmentData, statusAlertData]);

    const {
        activeOps = 0,
        pendingSettlement = 0,
        totalTurnover = 0,
        payoutCycleDays = 0,
        verificationStatus = 'Pending Verification',
        syncMinutes = 0,
        trends = {},
        performance = {},
        recentRequests = [],
        inventory = { stockQuantity: 0, availableProduce: 0 },
        topFranchise = null
    } = dashboardStats || {};

    const safePayoutDays = isNaN(Number(payoutCycleDays)) ? 0 : Number(payoutCycleDays);

    const dispatchColumns = [
        {
            header: 'Dispatch Ref',
            key: '_id',
            render: (val) => <span className="text-primary font-black uppercase tracking-widest">{val.slice(-6)}</span>
        },
        {
            header: 'Franchise Node',
            key: 'franchiseId',
            render: (val) => <span className="text-slate-900 font-bold">{val?.franchiseName || val?.ownerName || 'Node'}</span>
        },
        {
            header: 'Payload',
            key: 'actualWeight',
            render: (val) => <span className="text-slate-600 font-black tabular-nums">{val ? `${val} KG` : 'TBD'}</span>
        },
        {
            header: 'Cycle Status',
            key: 'status',
            align: 'right',
            render: (val) => (
                <span className={cn(
                    "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter",
                    val === 'ready_for_pickup' ? "bg-emerald-100 text-emerald-600" :
                        val === 'approved' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                )}>
                    {val.replace('_', ' ')}
                </span>
            )
        }
    ];

    if (isLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="h-10 w-48 bg-slate-100 rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-slate-100 rounded-[32px]" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">Procurement Pulse</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] sm:tracking-[0.2em]">
                            Operational Status: <span className={cn(vendor?.status === 'active' ? "text-emerald-500" : "text-amber-500")}>{vendor?.status || 'Active'}</span>
                        </p>

                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:justify-end sm:shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/vendor/profile')}
                        className="h-10 sm:h-11 min-h-[44px] px-3 sm:px-4 bg-white border border-slate-200 text-slate-900 rounded-xl sm:rounded-2xl inline-flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:bg-slate-50 transition-all font-black text-[9px] sm:text-[10px] uppercase tracking-wide sm:tracking-widest active:scale-[0.98]"
                    >
                        <Settings className="h-4 w-4 sm:h-[17px] sm:w-[17px] text-slate-600 shrink-0" strokeWidth={2} />
                        Profile
                    </button>
                </div>
            </header>

            {/* Quick navigation — Home → Orders & related ops */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                    { label: 'Orders', path: '/vendor/orders', icon: ClipboardList, hint: 'Manage requests' },
                    { label: 'Dispatch', path: '/vendor/dispatch', icon: Truck, hint: 'Active logistics' },
                    { label: 'Inventory', path: '/vendor/inventory', icon: Package, hint: 'Stock levels' },
                    { label: 'History', path: '/vendor/dispatch-history', icon: Clock, hint: 'Past cycles' },
                ].map((item) => (
                    <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="group flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-slate-900 hover:shadow-md transition-all text-left active:scale-[0.98]"
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-colors shrink-0">
                            <item.icon size={18} strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{item.label}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.hint}</p>
                        </div>
                        <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-slate-900 shrink-0" />
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">

                <button
                    type="button"
                    onClick={() => navigate('/vendor/orders')}
                    className="text-left rounded-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                >
                    <MetricCard
                        label="Active Ops"
                        value={activeOps}
                        icon={Activity}
                        color="amber"
                        index={0}
                    />
                </button>
                <MetricCard
                    label="Escrow Settlement"
                    value={`₹${pendingSettlement.toLocaleString()}`}
                    icon={Wallet}
                    color="emerald"
                    trend={{ value: Math.abs(trends.pendingSettlement || 0), positive: (trends.pendingSettlement || 0) >= 0 }}
                    index={1}
                />

                <MetricCard
                    label="Payout Cycle"
                    value={`${safePayoutDays.toFixed(1)} Days`}
                    icon={Clock}
                    color="slate"
                    index={2}
                />

                <MetricCard
                    label="Fulfillment"
                    value={`${performance.fulfillmentRate}%`}
                    icon={Activity}
                    color="amber"
                    index={3}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-slate-900 rounded-2xl sm:rounded-[40px] p-5 sm:p-8 text-white relative overflow-hidden group shadow-2xl shadow-slate-900/20"
                >
                    <div className="relative z-10">
                        <div className="flex justify-between items-start gap-3 mb-6 sm:mb-10">
                            <div className="min-w-0">
                                <h3 className="text-lg sm:text-xl font-black tracking-tight mb-1 sm:mb-2">Operational Health</h3>
                                <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">Real-time Inventory & Performance</p>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl backdrop-blur-md border border-white/5 shrink-0">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest">{verificationStatus}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-8">
                            <div className="min-w-0">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Stock Level</p>
                                <p className="text-xl sm:text-2xl font-black tabular-nums leading-none">{inventory.stockQuantity} Units</p>
                                <p className="text-[8px] text-slate-400 mt-2 uppercase tracking-widest font-black">Gross Payload</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">SKU Coverage</p>
                                <p className="text-xl sm:text-2xl font-black tabular-nums leading-none">{inventory.availableProduce} Active</p>
                                <p className="text-[8px] text-emerald-400 mt-2 uppercase tracking-widest font-black">Market Ready</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Fulfillment</p>
                                <p className="text-xl sm:text-2xl font-black tabular-nums leading-none">{performance.fulfillmentRate}%</p>
                                <div className="mt-2 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${performance.fulfillmentRate}%` }} />
                                </div>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Sync Rate</p>
                                <p className="text-xl sm:text-2xl font-black tabular-nums leading-none">{syncMinutes}m</p>
                                <p className="text-[8px] text-blue-400 mt-2 uppercase tracking-widest font-black">Matrix Latency</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 }}
                        className="bg-white rounded-2xl sm:rounded-[32px] p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-b-4 border-b-primary"
                    >
                        <div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center text-primary mb-4 border border-primary/10 shadow-sm">
                                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                            </div>
                            <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight uppercase">Manage <br /> Orders</h4>
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Procurement requests &amp; audits</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/vendor/orders')}
                            className="mt-5 group w-full bg-primary text-white rounded-xl sm:rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-all hover:bg-primary/90"
                        >
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">Open Orders</span>
                            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white rounded-2xl sm:rounded-[32px] p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-b-4 border-b-slate-900"
                    >
                        <div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-900 mb-4 border border-slate-100 shadow-sm">
                                <Truck className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                            </div>
                            <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight uppercase">Dispatch <br /> Control</h4>
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Next cycle window open</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/vendor/dispatch')}
                            className="mt-5 group w-full bg-slate-900 text-white rounded-xl sm:rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-all hover:bg-slate-800"
                        >
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">Enter Logistics</span>
                            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                    </motion.div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl sm:rounded-[40px] p-5 sm:p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">Active Logistics</h3>
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-1">Handoff Pending</p>
                        </div>
                    </div>
                    <DataGrid
                        columns={dispatchColumns}
                        data={activeDispatches}
                        onRowClick={(row) => navigate(`/vendor/dispatch?order=${row._id}`)}
                        className="border-none shadow-none"
                    />
                </div>

                <div className="bg-white rounded-2xl sm:rounded-[40px] p-5 sm:p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">Recent Proposals</h3>
                            <p className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-1">Audit Trail</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/vendor/orders')}
                            className="shrink-0 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80"
                        >
                            All orders
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {recentRequests.map((req, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-50 hover:border-slate-200 transition-all cursor-pointer" onClick={() => navigate(`/vendor/orders/${req.id}`)}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 border border-slate-100 font-black text-[10px]">
                                        {req.ref}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{req.status.replace('_', ' ')}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(req.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 tabular-nums">₹{req.amount.toLocaleString()}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gross Value</p>
                                </div>
                            </div>
                        ))}
                        {recentRequests.length === 0 && (
                            <div className="py-10 text-center">
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Recent Activity</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
