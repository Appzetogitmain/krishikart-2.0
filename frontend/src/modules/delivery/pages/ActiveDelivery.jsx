import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Phone,
    MessageSquare,
    MapPin,
    Clock,
    Loader2,
    Package,
    Navigation
} from 'lucide-react';
import StatusProgress from '../components/ui/StatusProgress';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { useDeliveryOrders } from '../contexts/DeliveryOrderContext';
import DocumentViewer from '../../vendor/components/documents/DocumentViewer';
import { useConfirm } from '../hooks/useConfirm';

const ActiveDelivery = () => {
    const navigate = useNavigate();
    const { dispatchedOrders, loading, updateStatus, activeDeliveryId, setActiveDeliveryId } = useDeliveryOrders();
    const [isUpdating, setIsUpdating] = useState(false);
    const submittingRef = useRef(false);
    const [confirm, confirmDialog] = useConfirm();
    const [isDocOpen, setIsDocOpen] = useState(false);

    const order = useMemo(() => {
        if (!activeDeliveryId) return null;
        return (dispatchedOrders || []).find(o => o && (o.id === activeDeliveryId || o._id === activeDeliveryId)) || null;
    }, [dispatchedOrders, activeDeliveryId]);

    // Current order status from backend: 'Dispatched' or 'Delivered'
    const currentStatus = order?.orderStatus || 'Dispatched';
    const isCodOrder = String(order?.paymentMethod || '').toUpperCase() === 'COD';

    // Open turn-by-turn directions to the customer's exact pin; fall back to a search on the
    // typed address when the order has no saved coordinates.
    const handleNavigate = () => {
        const loc = order?.customerLocation;
        const destination = loc
            ? `${loc.lat},${loc.lng}`
            : encodeURIComponent(order?.shippingAddress || '');
        if (!destination) return;
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`, '_blank', 'noopener');
    };

    const handleMarkDelivered = async () => {
        // A ref, not state: a quick second tap runs before the re-render that disables the button
        if (!order || submittingRef.current) return;
        const confirmed = await confirm({
            title: 'Mark this order as delivered?',
            message: isCodOrder
                ? `Only continue if you have handed over the order and collected Rs ${Number(order?.totalAmount || 0).toFixed(2)} cash.`
                : 'Only continue if you have handed over the order to the customer.',
            confirmLabel: 'Yes, delivered',
        });
        if (!confirmed || submittingRef.current) return;
        submittingRef.current = true;
        setIsUpdating(true);
        const ok = await updateStatus(order.id, 'Delivered');
        setIsUpdating(false);
        submittingRef.current = false;
        if (!ok) return; // stay on the page so the partner can see what went wrong
        setActiveDeliveryId(null);
        navigate(ROUTES.DASHBOARD);
    };

    if (loading && !order) {
        return (
            <div className="h-full flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="h-full flex flex-col items-center justify-center min-h-screen p-6 text-center gap-4">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-bold">No Active Delivery</h2>
                <p className="text-sm text-muted-foreground">Accept an order from the Requests tab to get started.</p>
                <button
                    onClick={() => navigate(ROUTES.REQUESTS)}
                    className="mt-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm"
                >
                    View Requests
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full pb-24">
            {/* Header */}
            <div className="px-6 pt-8 pb-2 bg-white sticky top-0 z-10 border-b border-border/30">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Active Delivery</h1>
                </div>
                <StatusProgress currentStatus={currentStatus} />
            </div>

            <div className="p-6 space-y-6">
                {/* Status Alert */}
                <motion.div
                    animate={{ x: [0, -2, 2, -2, 2, 0] }}
                    transition={{ repeat: Infinity, duration: 4, repeatDelay: 3 }}
                    className="bg-primary/10 border border-primary/20 p-4 rounded-2xl flex items-center gap-4"
                >
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="text-white w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-primary">On Your Way</p>
                            {order.isPreOrder && (
                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tight">
                                    Scheduled
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isCodOrder
                                ? `Collect COD Rs ${Number(order?.totalAmount || 0).toFixed(2)} and then mark delivered.`
                                : 'Deliver to customer and tap the button below when done.'}
                        </p>
                        {(order.scheduledDate || order.scheduledDateFormatted) && (
                            <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/50 px-1 rounded">
                                    Target: {order.scheduledDateFormatted || (order.scheduledDate && !isNaN(new Date(order.scheduledDate).getTime()) ? new Date(order.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A')}
                                </span>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/50 px-1 rounded">
                                    Slot: {order.deliveryShift || 'Standard'}
                                </span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Location Cards */}
                <div className="space-y-4">
                    {/* Pickup */}
                    <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center border border-green-200 shrink-0">
                                <MapPin className="text-primary w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Pickup — Franchise</p>
                                <h3 className="text-sm font-bold">{order?.franchiseId?.franchiseName || 'Franchise'}</h3>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {[order?.franchiseId?.area, order?.franchiseId?.city].filter(Boolean).join(', ') || '—'}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => {
                                    if (order?.franchiseId?.mobile) {
                                        window.location.href = `tel:${order.franchiseId.mobile}`;
                                    }
                                }}
                                className="flex-1 bg-muted/50 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:bg-slate-100"
                            >
                                <Phone className="w-3.5 h-3.5" /> Call Franchise
                            </button>
                        </div>
                    </div>

                    {/* Dropoff */}
                    <div className="bg-white rounded-2xl border border-border p-4 shadow-sm border-l-4 border-l-amber-500">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200 shrink-0">
                                <MapPin className="text-amber-500 w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Deliver To — Customer</p>
                                <h3 className="text-sm font-bold">{order?.userId?.fullName || 'Customer'}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{order?.shippingAddress || '—'}</p>
                                {order?.customerLocation ? (
                                    <p className="text-[10px] font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Exact location pinned by customer
                                    </p>
                                ) : (
                                    <p className="text-[10px] font-bold text-amber-600 mt-1.5">
                                        No pin saved - navigation uses the written address
                                    </p>
                                )}
                            </div>
                        </div>
                        {/* Map preview of the drop point (the customer's pin, else the written address) */}
                        {(order?.customerLocation || order?.shippingAddress) && (
                            <button
                                type="button"
                                onClick={handleNavigate}
                                className="mt-4 block w-full h-40 rounded-xl overflow-hidden border border-border relative"
                                aria-label="Open directions in Google Maps"
                            >
                                <iframe
                                    title="Customer location"
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    className="w-full h-full pointer-events-none"
                                    src={`https://maps.google.com/maps?q=${order?.customerLocation
                                        ? `${order.customerLocation.lat},${order.customerLocation.lng}`
                                        : encodeURIComponent(order.shippingAddress)}&z=16&output=embed`}
                                />
                                <span className="absolute bottom-2 right-2 bg-white/95 text-[10px] font-bold text-primary px-2 py-1 rounded-lg shadow">
                                    Tap for directions
                                </span>
                            </button>
                        )}
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={handleNavigate}
                                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <Navigation className="w-3.5 h-3.5" /> Navigate
                            </button>
                            <button
                                onClick={() => {
                                    if (order?.userId?.mobile) {
                                        window.location.href = `tel:${order.userId.mobile}`;
                                    }
                                }}
                                className="flex-1 bg-muted/50 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:bg-slate-100"
                            >
                                <Phone className="w-3.5 h-3.5" /> Call Customer
                            </button>
                        </div>
                    </div>
                </div>

                {/* Order Items & Bilty */}
                <div className="bg-white rounded-2xl border border-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Package Details</h4>
                        {Number(order?.numberOfPackages) > 0 ? (
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {order.numberOfPackages} {Number(order.numberOfPackages) === 1 ? 'Package' : 'Packages'}
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">Package count not entered</span>
                        )}
                    </div>

                    {order.bilty && (
                        <div className="p-4 bg-amber-50/50 border-t border-amber-100 flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center text-white">
                                    <Package size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Delivery Slip (Bilty)</p>
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">{order.bilty.numberOfPackages} Packages • {order.bilty.biltyNumber}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDocOpen(true)}
                                className="w-full py-3 bg-white border border-amber-200 rounded-xl text-xs font-black text-amber-600 uppercase tracking-widest shadow-sm active:scale-95 transition-all text-center"
                            >
                                View Delivery Slip
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {confirmDialog}

            {/* Document Viewer Modal */}
            <DocumentViewer
                isOpen={isDocOpen}
                onClose={() => setIsDocOpen(false)}
                type="BILTY"
                data={order.bilty || {}}
            />

            {/* Bottom Action */}
            <div className="fixed bottom-16 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
                <div className="max-w-md mx-auto pointer-events-auto">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        disabled={isUpdating}
                        onClick={handleMarkDelivered}
                        className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/30 flex items-center justify-center text-center text-lg disabled:opacity-60"
                    >
                        {isUpdating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            isCodOrder ? 'Collect COD & Mark Delivered' : 'Mark as Delivered'
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default ActiveDelivery;
