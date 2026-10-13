import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ArrowLeft, Package, RotateCcw, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeliveryOrders } from '../contexts/DeliveryOrderContext';

export default function NotificationSettingsScreen() {
    const navigate = useNavigate();
    const { dispatchedOrders, returnPickups } = useDeliveryOrders();

    // Combine and sort notifications newest first
    const notifications = [
        ...(dispatchedOrders || []).filter(Boolean).map(order => ({
            id: order._id || order.id,
            type: 'delivery',
            title: 'New Delivery Task',
            subtitle: `Order for ${order.customerName || order.customer || 'Customer'}`,
            meta: order.franchiseName || order.franchiseId?.shopName || 'Franchise',
            time: order.assignedAt || order.createdAt || order.date,
            raw: order,
        })),
    ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

    const formatTime = (ts) => {
        if (!ts) return '';
        const date = new Date(ts);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-20">
            {/* Header */}
            <div className="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-border/50 shadow-sm">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-foreground">Notifications</h1>
                    {notifications.length > 0 && (
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                            {notifications.length} pending task{notifications.length > 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                {notifications.length > 0 && (
                    <span className="bg-rose-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full">
                        {notifications.length}
                    </span>
                )}
            </div>

            <div className="p-6 space-y-3">
                <AnimatePresence>
                    {notifications.length > 0 ? (
                        notifications.map((notif, i) => (
                            <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: i * 0.04 }}
                                onClick={() =>
                                    notif.type === 'delivery'
                                        ? navigate('/delivery/requests')
                                        : navigate('/delivery/return-pickups')
                                }
                                className="bg-white rounded-3xl border border-border shadow-sm p-5 flex items-start gap-4 cursor-pointer active:scale-[0.98] transition-all hover:border-primary/30 hover:shadow-md"
                            >
                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                    notif.type === 'delivery'
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'bg-amber-50 text-amber-600'
                                }`}>
                                    {notif.type === 'delivery'
                                        ? <Package className="w-6 h-6" />
                                        : <RotateCcw className="w-6 h-6" />
                                    }
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-sm font-black text-foreground">{notif.title}</h3>
                                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 shrink-0">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(notif.time)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.subtitle}</p>
                                    {notif.meta && (
                                        <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full inline-block mt-1.5">
                                            {notif.meta}
                                        </span>
                                    )}
                                </div>

                                {/* Unread dot */}
                                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-24 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-base font-black text-foreground">All Caught Up!</h3>
                            <p className="text-sm text-muted-foreground mt-1 px-8">No pending tasks right now. New assignments will appear here.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
