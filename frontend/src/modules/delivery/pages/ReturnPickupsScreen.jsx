import { useEffect, useState } from 'react';
import { RefreshCw, Undo2, MapPin, Phone, CheckCircle2, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useConfirm } from '../hooks/useConfirm';

export default function ReturnPickupsScreen() {
    const [pickups, setPickups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingKey, setProcessingKey] = useState('');
    const [confirm, confirmDialog] = useConfirm();

    const fetchPickups = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const response = await api.get('/orders/delivery/return-pickups');
            if (response.data.success) {
                setPickups(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error('Fetch return pickups error:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch return pickups');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPickups();
    }, []);

    const updatePickupStatus = async (pickup, status) => {
        const ref = `#${String(pickup.orderId).slice(-6).toUpperCase()}`;
        const confirmed = await confirm(
            status === 'picked_up'
                ? {
                    title: `Picked up return ${ref}?`,
                    message: `Only continue if you have collected the items from ${pickup.customerName || 'the customer'}.`,
                    confirmLabel: 'Yes, picked up',
                }
                : {
                    title: `Complete return ${ref}?`,
                    message: `Only continue if you have handed the items to ${pickup.franchiseName || 'the franchise'}.`,
                    confirmLabel: 'Yes, complete',
                }
        );
        if (!confirmed) return;

        const key = `${pickup.orderId}-${pickup.requestIndex}`;
        setProcessingKey(key);
        try {
            const response = await api.put(
                `/orders/delivery/return-pickups/${pickup.orderId}/${pickup.requestIndex}/status`,
                { status },
            );
            if (response.data.success) {
                toast.success(status === 'picked_up' ? 'Marked as picked up' : 'Return completed successfully');
                await fetchPickups(true);
            }
        } catch (error) {
            console.error('Update return pickup status error:', error);
            toast.error(error.response?.data?.message || 'Failed to update pickup status');
        } finally {
            setProcessingKey('');
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-20">
            <div className="px-6 pt-8 pb-4 bg-white sticky top-0 z-10 border-b border-border/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                            <Undo2 className="w-6 h-6 text-primary" />
                            Return Pickups
                        </h1>
                        <p className="text-muted-foreground text-sm">{pickups.length} assigned tasks</p>
                    </div>
                    <button
                        onClick={() => fetchPickups(true)}
                        className="p-2 rounded-xl border border-border bg-white text-foreground active:scale-95"
                    >
                        <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-36 bg-white border border-border rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : pickups.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No return pickups</h3>
                        <p className="text-sm text-muted-foreground">Assigned return collection requests will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pickups.map((pickup, idx) => {
                            const key = `${pickup.orderId}-${pickup.requestIndex}`;
                            const isBusy = processingKey === key;
                            const isAssigned = pickup.status === 'pickup_assigned';
                            const isPicked = pickup.status === 'picked_up';
                            return (
                                <motion.div
                                    key={key}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                    className="bg-white border border-border rounded-3xl p-5 space-y-4 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-foreground">Order #{pickup.orderId?.slice(-6)} | Request #{(pickup.requestIndex || 0) + 1}</p>
                                            <p className="text-xs text-muted-foreground font-semibold mt-1">{pickup.requestedAt && !isNaN(new Date(pickup.requestedAt).getTime()) ? new Date(pickup.requestedAt).toLocaleString() : 'N/A'}</p>
                                        </div>
                                        <span className={cn(
                                            'text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-sm border',
                                            isAssigned ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                        )}>
                                            {pickup.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <p className="font-bold text-slate-800">{pickup.customerName}</p>
                                        <p className="text-slate-600 flex items-start gap-2">
                                            <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                                            {pickup.pickupAddress}
                                        </p>
                                        {!!pickup.customerMobile && (
                                            <p className="text-slate-600 flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-slate-400" />
                                                {pickup.customerMobile}
                                            </p>
                                        )}
                                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">
                                            Return To: {pickup.franchiseName}
                                        </p>
                                    </div>

                                    <div className="space-y-1">
                                        {pickup.items?.map((item, i) => (
                                            <div key={i} className="text-[12px] font-semibold text-slate-700 flex justify-between">
                                                <span>{item.name}</span>
                                                <span>{item.quantity} {item.unit}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <button
                                            disabled={!isAssigned || isBusy}
                                            onClick={() => updatePickupStatus(pickup, 'picked_up')}
                                            className="h-10 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Mark Picked Up
                                        </button>
                                        <button
                                            disabled={!isPicked || isBusy}
                                            onClick={() => updatePickupStatus(pickup, 'completed')}
                                            className="h-10 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Complete
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
            {confirmDialog}
        </div>
    );
}
