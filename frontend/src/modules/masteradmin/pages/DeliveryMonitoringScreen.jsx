import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Truck,
    Navigation,
    Map as MapIcon,
    Clock,
    CheckSquare,
    AlertTriangle,
    Search,
    ChevronRight,
    Activity,
    IndianRupee,
    Timer,
    Home,
    Download,
    RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { initSocket, joinAdminDeliveryTracking } from '@/lib/socket.js';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import ChartPanel from '../components/cards/ChartPanel';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';
import ProfessionalTooltip from '../components/common/ProfessionalTooltip';

import { exportToCSV } from '@/lib/exportToCSV';

export default function DeliveryMonitoringScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState([]);

    const fetchOrders = async () => {
        try {
            const response = await api.get('/orders/admin/delivery-tracking');
            if (response.data.success) {
                setOrders(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch orders error:', error);
            toast.error('Failed to load live deliveries');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();

        // Initializing Real-time tracking
        const socket = initSocket();
        joinAdminDeliveryTracking();

        socket.on('order_status_updated', (updatedOrder) => {
            fetchOrders(); // Refresh to get the fully populated structure
            const friendly = { Accepted: 'Order Accepted', Procuring: 'Stock Arranging' }[updatedOrder.orderStatus] || updatedOrder.orderStatus;
            toast.info(`Order status updated to ${friendly}`);
        });

        return () => {
            socket.off('order_status_updated');
        };
    }, []);

    const handleStatusUpdate = async (orderId, newStatus) => {
        try {
            const response = await api.put(`/orders/admin/${orderId}/status`, { status: newStatus });
            if (response.data.success) {
                toast.success('Status updated successfully');
                fetchOrders();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    const matchesSearch = (o) => {
        const query = searchTerm.toLowerCase();
        return o._id.toLowerCase().includes(query) ||
            (o.customer?.name || '').toLowerCase().includes(query) ||
            (o.franchise?.name || '').toLowerCase().includes(query) ||
            (o.rider?.name || '').toLowerCase().includes(query);
    };

    const inTransitOrders = orders.filter(o =>
        ['Packed', 'Dispatched'].includes(o.status) && matchesSearch(o)
    );
    const deliveredOrders = orders.filter(o =>
        ['Delivered', 'Received'].includes(o.status) && matchesSearch(o)
    );

    // Real figures for the summary cards (previously hard-coded sample numbers)
    const todayKey = new Date().toDateString();
    const allDelivered = orders.filter(o => ['Delivered', 'Received'].includes(o.status));
    const deliveredToday = allDelivered.filter(o => o.timestamp?.delivered && new Date(o.timestamp.delivered).toDateString() === todayKey).length;
    const deliveryDurations = allDelivered
        .map(o => (o.timestamp?.delivered && o.timestamp?.created) ? new Date(o.timestamp.delivered) - new Date(o.timestamp.created) : null)
        .filter(ms => ms !== null && ms > 0);
    const avgDeliveryMs = deliveryDurations.length ? deliveryDurations.reduce((a, b) => a + b, 0) / deliveryDurations.length : 0;
    const formatDuration = (ms) => {
        if (!ms) return '—';
        const mins = Math.round(ms / 60000);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 48) return `${hrs}h ${mins % 60}m`;
        return `${Math.round(hrs / 24)} days`;
    };

    const handleExport = () => {
        const columns = [
            { header: 'Order ID', key: '_id' },
            { header: 'Customer', key: 'customerName' },
            { header: 'Shop', key: 'franchiseName' },
            { header: 'Rider', key: 'riderName' },
            { header: 'Status', key: 'status' },
            { header: 'Amount', key: 'amount' }
        ];

        const data = (activeTab === 'active' ? inTransitOrders : deliveredOrders).map(o => ({
            ...o,
            customerName: o.customer?.name,
            franchiseName: o.franchise?.name,
            riderName: o.rider?.name
        }));

        exportToCSV(`Delivery_Report_${activeTab}`, columns, data);
    };

    const unitColumns = [
        {
            header: 'DELIVERY PARTNER',
            key: 'rider',
            render: (rider) => (
                <div className="flex items-center gap-3 py-1">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                        rider?.id ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-slate-50 border-slate-200 text-slate-400"
                    )}>
                        <Truck size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                            {rider?.name || 'NOT ASSIGNED'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{rider?.vehicle || 'NA-00-0000'}</span>
                            {rider?.mobile && (
                                <span className="text-[10px] font-bold text-blue-500">{rider.mobile}</span>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'ORDER & DESTINATION',
            key: '_id',
            render: (val, row) => (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-[10px] tracking-tighter">LID-{val?.slice(-6).toUpperCase()}</span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 border border-emerald-100 rounded-sm">₹{row.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Home size={10} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600">{row.customer?.name}</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 truncate max-w-[150px]">{row.customer?.address}</span>
                </div>
            )
        },
        {
            header: 'PICKUP FROM',
            key: 'franchise',
            render: (franchise) => (
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{franchise?.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Navigation size={10} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{franchise?.location || 'Franchise'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'STATUS',
            key: 'status',
            render: (val, row) => (
                <div className="flex flex-col gap-2">
                    <select
                        value={val}
                        onChange={(e) => handleStatusUpdate(row._id, e.target.value)}
                        className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-sm border outline-none bg-white",
                            val === 'Placed' && "text-slate-500 border-slate-200",
                            (val === 'Packed' || val === 'Preparing') && "text-amber-600 border-amber-200 bg-amber-50",
                            val === 'Dispatched' && "text-blue-600 border-blue-200 bg-blue-50",
                            val === 'Delivered' && "text-emerald-600 border-emerald-200 bg-emerald-50",
                            val === 'Cancelled' && "text-red-600 border-red-200 bg-red-50"
                        )}
                    >
                        {['Placed', 'Packed', 'Dispatched', 'Delivered', 'Received', 'Cancelled'].map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: val === 'Delivered' || val === 'Received' ? '100%' : val === 'Dispatched' ? '66%' : '33%' }}
                                className={cn(
                                    "h-full transition-all",
                                    val === 'Delivered' ? "bg-emerald-500" : "bg-blue-500"
                                )}
                            />
                        </div>
                    </div>
                </div>
            )
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
            {/* Simple Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Delivery Tracking</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Track and manage customer deliveries</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-slate-100 p-1 rounded-sm">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all",
                                    activeTab === 'active' ? "bg-white text-slate-900 shadow-sm rounded-sm" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                Active Orders
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all",
                                    activeTab === 'history' ? "bg-white text-slate-900 shadow-sm rounded-sm" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                Past Orders
                            </button>
                        </div>
                        <button
                            onClick={handleExport}
                            className="bg-slate-900 text-white px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors"
                        >
                            <Download size={13} />
                            Download Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Orders on the Way"
                    value={inTransitOrders.length.toString()}
                    icon={Navigation}
                />
                <MetricRow
                    label="Delivered Today"
                    value={deliveredToday.toString()}
                    icon={CheckSquare}
                />
                <MetricRow
                    label="Delivered (All Time)"
                    value={allDelivered.length.toString()}
                    icon={Activity}
                />
                <MetricRow
                    label="Avg. Order-to-Delivery Time"
                    value={formatDuration(avgDeliveryMs)}
                    icon={Timer}
                />
            </div>

            {/* Main Operational Ledger */}
            <div className="flex flex-col gap-px">
                <FilterBar
                    onSearch={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                    filters={[]}
                    actions={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full animate-pulse">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Tracking Active</span>
                            </div>
                        </div>
                    }
                />

                <div className="bg-white">
                    <DataGrid
                        title={activeTab === 'active' ? "Active Orders" : "Order History"}
                        columns={unitColumns}
                        data={activeTab === 'active' ? inTransitOrders : deliveredOrders}
                        density="compact"
                    />

                </div>
            </div>
        </div>
    );
}
