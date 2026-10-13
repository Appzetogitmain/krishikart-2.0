import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Truck,
    User,
    CheckCircle2,
    Search,
    MapPin,
    Package,
    Ghost,
    Home,
    ChevronRight,
    RefreshCw,
    Settings2,
    ArrowRight
} from 'lucide-react';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import FilterBar from '../components/tables/FilterBar';

export default function DeliveryScreen() {
    const {
        orders,
        updateOrderStatus,
        deliveryPartners,
        assignDeliveryPartner,
        refreshOrders,
        refreshPartners
    } = useFranchiseOrders();
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 600);
        return () => clearTimeout(timer);
    }, []);

    const handleRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            await Promise.all([
                refreshOrders?.(),
                refreshPartners?.()
            ]);
            toast.success('Dispatch data refreshed');
        } catch (error) {
            console.error('Refresh dispatch data error:', error);
            toast.error('Failed to refresh dispatch data');
        } finally {
            setIsRefreshing(false);
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesSearch = (o.hotelName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (o.id?.toLowerCase() || '').includes(searchQuery.toLowerCase());

        if (activeTab === 'active') {
            return matchesSearch && ['packed', 'dispatched'].includes(o.status);
        } else {
            return matchesSearch && ['delivered', 'received'].includes(o.status);
        }
    });

    const readyCount = orders.filter(o => o.status === 'packed').length;
    const outCount = orders.filter(o => o.status === 'dispatched').length;
    const completedCount = orders.filter(o => ['delivered', 'received'].includes(o.status)).length;

    if (isLoading) {
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
                            <span>Deliveries</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Delivery Center</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Send orders out for delivery</h1>
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                </div>
            </div>

            {/* Performance Strip */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-3">
                <MetricRow
                    label="Active Dispatch"
                    value={outCount}
                    trend="up"
                    icon={Truck}
                    sub="Couriers on Road"
                />
                <MetricRow
                    label="Ready"
                    value={readyCount}
                    trend="Stable"
                    icon={Package}
                    sub="Ready to Assign"
                />
                <MetricRow
                    label="Completed"
                    value={completedCount}
                    trend="up"
                    icon={CheckCircle2}
                    sub="Total Delivered"
                />
            </div>

            <div className="p-px bg-slate-200">
                <FilterBar
                    actions={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-sm mr-4">
                                <button
                                    onClick={() => setActiveTab('active')}
                                    className={cn(
                                        "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                        activeTab === 'active' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                    )}
                                >
                                    Active Deliveries
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                        activeTab === 'history' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                    )}
                                >
                                    History
                                </button>
                            </div>
                            <div className="relative group w-full max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search by Order ID or Hotel..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.trim())}
                                    className="bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:border-slate-400 transition-all font-sans min-w-[240px]"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                title="Refresh dispatch data"
                                aria-label="Refresh dispatch data"
                                className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-100 transition-colors text-slate-400 bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} />
                            </button>
                        </div>
                    }
                />

                <div className="p-4 space-y-4">
                    <AnimatePresence mode="popLayout">
                        {filteredOrders.length > 0 ? (
                            filteredOrders.map((order) => (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-white border border-slate-200 p-6 rounded-sm grid grid-cols-12 gap-8 items-start group relative transition-all hover:border-slate-900"
                                >
                                    <div className="col-span-12 lg:col-span-4 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-sm bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shrink-0">
                                                <Package size={22} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{order.hotelName}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.id}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight border-b border-slate-900 pb-px">{order.deliverySlot}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-slate-50/50 rounded-sm border border-slate-100 space-y-2">
                                            <div className="flex items-start gap-2 text-[11px] font-bold text-slate-500">
                                                <MapPin size={12} className="shrink-0 mt-0.5" />
                                                <p className="leading-snug">{order.address}</p>
                                            </div>
                                        </div>
                                        {/* Items Section */}
                                        <div className="pt-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Package Contents</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {order.items?.map((item, idx) => (
                                                    <span key={idx} className="bg-slate-50 px-2 py-0.5 rounded-sm border border-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                                                        {item.qty} {item.unit} {item.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 lg:col-span-5">
                                        {activeTab === 'active' ? (
                                            order.status === 'packed' ? (
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Choose a delivery partner</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {deliveryPartners.length > 0 ? deliveryPartners.map((dp) => (
                                                            <button
                                                                key={dp._id}
                                                                onClick={() => assignDeliveryPartner(order.id, dp._id)}
                                                                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-sm hover:border-slate-900 hover:bg-slate-50 transition-all group/dp text-left"
                                                            >
                                                                <div className="w-10 h-10 rounded-sm bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-400 group-hover/dp:bg-slate-900 group-hover/dp:text-white transition-all uppercase shrink-0">
                                                                    {dp.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate">{dp.fullName}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 tabular-nums uppercase tracking-wider">{dp.mobile || dp.phone || 'No Contact'}</p>
                                                                </div>
                                                            </button>
                                                        )) : (
                                                            <p className="col-span-2 text-[10px] font-bold text-slate-400 uppercase p-4 text-center border border-dashed border-slate-200 rounded-sm">No delivery partners are available in your area right now</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-6 p-4 bg-emerald-50/50 border border-emerald-100 rounded-sm">
                                                    <div className="w-12 h-12 rounded-sm bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
                                                        <User size={20} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-2">Out for delivery</p>
                                                        <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight">
                                                            {order.deliveryPartner?.fullName || 'Assigned Partner'}
                                                        </h4>
                                                        <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                                                            {order.deliveryPartner?.mobile || 'Contact pending'}
                                                        </p>
                                                    </div>
                                                    <div className="w-px h-10 bg-emerald-200" />
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Est. Completion</span>
                                                        <span className="text-[11px] font-black text-slate-900 tabular-nums">30 MINS</span>
                                                    </div>
                                                </div>
                                            )
                                        ) : (() => {
                                            const deliveryLog = order.statusHistory?.find(h => h.status?.toLowerCase() === 'delivered');
                                            const isFranchiseDelivered = deliveryLog?.updatedBy === 'franchise';
                                            const delivererName = isFranchiseDelivered ? 'Franchise Self-Delivery' : (order.deliveryPartner?.fullName || 'Hub Management');

                                            return (
                                                <div className="flex items-center gap-6 p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-sm flex items-center justify-center border",
                                                        isFranchiseDelivered ? "bg-amber-500 text-white border-amber-600" : "bg-slate-900 text-white border-slate-800"
                                                    )}>
                                                        {isFranchiseDelivered ? <Settings2 size={20} /> : <User size={20} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-2">Delivery Completed</p>
                                                        <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight">
                                                            {delivererName}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.1em]">Verification:</span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                {isFranchiseDelivered ? 'Confirmed by franchise' : 'Partner verified'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-10 bg-slate-200" />
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Order completed</p>
                                                        <div className="flex items-center gap-1 text-emerald-600">
                                                            <CheckCircle2 size={12} />
                                                            <span className="text-[11px] font-black uppercase tracking-tight">Delivered</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div className="col-span-12 lg:col-span-3 flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 h-full">
                                        <div className={cn(
                                            "px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border",
                                            order.status === 'packed' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                order.status === 'dispatched' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                                                    "bg-emerald-50 text-emerald-600 border-emerald-100"
                                        )}>
                                            {order.status === 'packed' ? 'Ready' : order.status === 'dispatched' ? 'In-Transit' : 'Delivered'}
                                        </div>

                                        <div className="flex-1 lg:flex-none" />

                                        {order.status === 'dispatched' && activeTab === 'active' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'Delivered')}
                                                className="w-full h-11 bg-slate-900 text-white rounded-sm font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                            >
                                                Confirm Delivery <ArrowRight size={14} />
                                            </button>
                                        )}
                                        {(order.status === 'packed' || activeTab === 'history') && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Value</p>
                                                <p className="text-[14px] font-black text-slate-900 tabular-nums">₹{order.total.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-32 flex flex-col items-center justify-center text-center opacity-40">
                                <Ghost size={64} strokeWidth={1} className="mb-4 text-slate-200" />
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">No active delivery</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Orders appear here once they are packed</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
