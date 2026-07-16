import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    Power,
    Package,
    CheckCircle2,
    X,
    Store,
    ShoppingBag,
    Clock
} from 'lucide-react';
import MetricCard from '../components/cards/MetricCard';
import { useDeliveryAuth } from '../contexts/DeliveryAuthContext';
import { useDeliveryOrders } from '../contexts/DeliveryOrderContext';
import api from '@/lib/axios';
import { toast } from 'sonner';

const Dashboard = () => {
    const navigate = useNavigate();
    const { delivery, setDelivery, loading: authLoading, isAuthenticated, logout } = useDeliveryAuth();
    const { dispatchedOrders, taskCount } = useDeliveryOrders();
    const [isOnline, setIsOnline] = useState(delivery?.isOnline ?? true);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [sendingPush, setSendingPush] = useState(false);



    useEffect(() => {
        if (delivery) {
            setIsOnline(delivery.isOnline);
        }
    }, [delivery]);

    const fetchHistory = async () => {
        try {
            const response = await api.get('/orders/delivery/history');
            if (response.data.success) {
                setHistory(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch history error:', error);
            if (error.response?.status === 401) {
                logout?.();
                return;
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        fetchHistory();
    }, [authLoading, isAuthenticated, logout]);

    // Re-fetch history whenever dispatched orders count changes (a delivery was completed)
    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            fetchHistory();
        }
    }, [dispatchedOrders.length]);

    const toggleOnline = async () => {
        if (isUpdating) return;
        const nextState = !isOnline;
        setIsUpdating(true);
        try {
            const response = await api.put('/delivery/availability', { isOnline: nextState });
            const ok = response.data && (response.data.success === true || response.status === 200);
            const updatedDelivery = response.data?.result || response.data?.delivery;
            if (ok) {
                setIsOnline(nextState);
                const base = delivery || {};
                const toSave = updatedDelivery ? { ...base, ...updatedDelivery, isOnline: nextState } : { ...base, isOnline: nextState };
                if (setDelivery) setDelivery(toSave);
                try {
                    localStorage.setItem('deliveryData', JSON.stringify(toSave));
                } catch (_) {}
                toast.success(nextState ? 'You are now online' : 'You are now offline');
            } else {
                toast.error('Could not update status');
            }
        } catch (error) {
            console.error('Toggle availability error:', error);
            toast.error(error.response?.data?.message || 'Failed to update availability');
        } finally {
            setIsUpdating(false);
        }
    };

    // Use local YYYY-MM-DD for reliable date comparison (same approach as DeliveryHistory page)
    const safeGetLocalDateStr = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
        } catch (_) {
            return '';
        }
    };
    const todayStr = new Date().toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD
    const completedCount = history.filter(item => {
        const itemDate = item.rawDate
            ? safeGetLocalDateStr(item.rawDate)
            : item.date
                ? safeGetLocalDateStr(item.date)
                : null;
        return itemDate === todayStr;
    }).length;

    if (loading) {
        return (
            <div className="p-6 space-y-6 animate-pulse">
                <div className="h-20 bg-muted rounded-2xl w-full" />
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-24 bg-muted rounded-2xl" />
                    <div className="h-24 bg-muted rounded-2xl" />
                </div>
                <div className="h-40 bg-muted rounded-2xl w-full" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-24">
            {/* Header */}
            <div className="px-6 pt-8 pb-4 flex justify-between items-center bg-white sticky top-0 z-10 border-b border-border/5">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Hello, {delivery?.fullName?.split(' ')[0] || 'Partner'}!</h1>
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
                        {isOnline ? 'Online & Available' : 'Currently Offline'}
                    </p>
                </div>
                <div className="flex items-center gap-3">

                    <button
                        onClick={() => navigate('/delivery/notifications')}
                        className="relative p-3 rounded-2xl bg-muted/30 text-foreground active:scale-95 transition-all hover:bg-muted/50"
                    >
                        <Bell className="w-5 h-5" />
                        {taskCount > 0 && (
                            <span className="absolute top-2 right-2 min-w-[16px] h-4 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white px-0.5">
                                {taskCount > 9 ? '9+' : taskCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={toggleOnline}
                        disabled={isUpdating}
                        className={`p-3 rounded-2xl active:scale-95 transition-all shadow-sm ${isOnline ? 'bg-primary text-white shadow-primary/20' : 'bg-white text-muted-foreground border border-border'} ${isUpdating ? 'opacity-50' : ''}`}
                    >
                        <Power className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="px-6 space-y-6 pt-6">
                {!delivery?.isApproved && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-amber-50 border border-amber-200 rounded-3xl space-y-3"
                    >
                        <div className="flex items-center gap-3 text-amber-800">
                            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Clock size={16} className="text-amber-600" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest">Account Pending Approval</h3>
                        </div>
                        <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed tracking-wider">
                            Admin is currently verifying your documents. You will be able to accept delivery tasks and go online once your account is authorized.
                        </p>
                    </motion.div>
                )}

                {/* Availability Toggle UI Block */}
                <motion.div
                    onClick={() => delivery?.isApproved ? toggleOnline() : toast.error('Account pending admin approval')}
                    className={`cursor-pointer px-5 py-4 rounded-3xl flex items-center justify-between border-2 transition-all ${isUpdating || !delivery?.isApproved ? 'opacity-70 pointer-events-none' : ''} ${isOnline ? 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5' : 'bg-white border-border shadow-sm grayscale opacity-70'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isOnline ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Power className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-black uppercase tracking-widest block leading-none mb-1">{isOnline ? 'Active' : 'Resting'}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">{isOnline ? 'Ready for new requests' : 'Status set to offline'}</span>
                        </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 relative transition-colors ${isOnline ? 'bg-primary' : 'bg-muted'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all ${isOnline ? 'left-7' : 'left-1'}`} />
                    </div>
                </motion.div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                        title="New Tasks"
                        value={taskCount}
                        icon={Package}
                        color="bg-blue-600 shadow-blue-200"
                    />
                    <MetricCard
                        title="Today Done"
                        value={completedCount}
                        icon={CheckCircle2}
                        color="bg-primary shadow-emerald-200"
                    />
                </div>

                {/* Task Feed Link */}
                <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl shadow-slate-200 overflow-hidden relative"
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Live Status</p>
                        <h3 className="text-xl font-black mb-1">Task Feed Ready</h3>
                        <p className="text-white/60 text-xs mb-6">Check and accept incoming delivery requests near you.</p>
                        <button
                            onClick={() => navigate('/delivery/requests')}
                            className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl"
                        >
                            Open Task Feed
                        </button>
                    </div>
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Package size={120} />
                    </div>
                </motion.div>

                {/* Today's Deliveries Detail */}
                <div className="mt-8 mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            Today's Deliveries <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">{completedCount}</span>
                        </h3>
                    </div>

                    {(() => {
                        const todayItems = history.filter(item => {
                            const itemDate = item.rawDate
                                ? safeGetLocalDateStr(item.rawDate)
                                : item.date
                                    ? safeGetLocalDateStr(item.date)
                                    : null;
                            return itemDate === todayStr;
                        });
                        return todayItems.length > 0 ? (
                        <div className="space-y-3">
                            {todayItems.map((task) => (
                                <motion.div
                                    key={task.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedOrder(task)}
                                    className="bg-white p-4 rounded-[24px] border border-slate-100 flex items-center justify-between shadow-sm cursor-pointer hover:border-primary/30 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                                            <CheckCircle2 size={18} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{task.customer}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{task.time}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-sm uppercase tracking-tighter">Done</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        ) : null;
                    })()}
                    {completedCount === 0 && (
                        <div className="py-6 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No deliveries yet today</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Order Detail Modal */}
            <AnimatePresence>
                {selectedOrder && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedOrder(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 400 }}
                            className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
                        >
                            <div className="px-8 pt-10 pb-12">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Order Summary</p>
                                        <h2 className="text-2xl font-black text-slate-900">{selectedOrder.customer}</h2>
                                        <p className="text-xs font-bold text-slate-400 mt-0.5">{selectedOrder.date} • {selectedOrder.time}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Franchise Info */}
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-100 text-slate-900">
                                            <Store size={22} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Picked Up From</p>
                                            <h4 className="text-sm font-bold text-slate-900 uppercase">{selectedOrder.franchiseName}</h4>
                                            <p className="text-[10px] font-medium text-slate-500 line-clamp-1">{selectedOrder.franchiseAddress}</p>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <ShoppingBag size={14} className="text-slate-400" />
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Delivered Items</h4>
                                        </div>
                                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
                                            {selectedOrder.items?.map((item, idx) => (
                                                <div key={idx} className="p-4 flex justify-between items-center border-b border-slate-100 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        <span className="text-sm font-bold text-slate-900 uppercase">{item.name}</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                                        x{item.quantity}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="w-full mt-10 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
