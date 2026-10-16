import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Bell, ArrowRight, Package, MapPin, CreditCard, Clock } from 'lucide-react';
import { useFranchiseOrders } from '../../contexts/FranchiseOrdersContext';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import sellerAlertSound from '@/assets/sounds/seller_alert.mp3';

const NewOrderAlert = () => {
    const {
        isAlertOpen,
        setIsAlertOpen,
        newOrderData,
        acceptOrder,
        rejectFranchiseOrder,
        updateOrderStatus,
        refreshOrders,
        ringingOrderIds,
        reopenOrderAlert,
    } = useFranchiseOrders();
    const navigate = useNavigate();

    const orderId = newOrderData?.orderId || newOrderData?._id || newOrderData?.id || null;

    const [orderDetail, setOrderDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    // Sound is now handled exclusively by FranchiseOrdersContext via useNotificationSound

    useEffect(() => {
        if (!isAlertOpen || !orderId) return;
        let cancelled = false;
        setDetailLoading(true);
        api
            .get(`/orders/franchise/${orderId}`)
            .then((res) => {
                if (cancelled) return;
                if (res.data?.success) setOrderDetail(res.data.result);
                else setOrderDetail(null);
            })
            .catch(() => { if (!cancelled) setOrderDetail(null); })
            .finally(() => { if (!cancelled) setDetailLoading(false); });
        return () => { cancelled = true; };
    }, [isAlertOpen, orderId]);

    const statusNormalized = (orderDetail?.orderStatus || newOrderData?.orderStatus || '').toString().toLowerCase();
    const autoAccepted =
        newOrderData?.autoAccepted === true ||
        newOrderData?.showRejectOnly === true ||
        newOrderData?.franchiseAutoAccepted === true ||
        orderDetail?.franchiseAutoAccepted === true;
    const canAccept = !autoAccepted && ['assigned', 'placed', 'pending', 'new'].includes(statusNormalized);
    const canReject = statusNormalized !== 'cancelled' && statusNormalized !== 'delivered';

    const hotelName =
        orderDetail?.userId?.legalEntityName ||
        orderDetail?.userId?.fullName ||
        orderDetail?.user?.legalEntityName ||
        orderDetail?.user?.fullName ||
        newOrderData?.hotelName ||
        'Guest User';

    const totalAmount = orderDetail?.totalAmount ?? orderDetail?.total ?? newOrderData?.totalAmount ?? 0;
    const items = orderDetail?.items || newOrderData?.items || [];
    const paymentMethod = orderDetail?.paymentMethod || newOrderData?.paymentMethod || '';
    const shippingAddress = orderDetail?.shippingAddress || '';

    // The pop-up was closed with "Not Now" but an order is still ringing: keep a way back to it
    if (!isAlertOpen && ringingOrderIds?.length > 0) {
        const waitingId = ringingOrderIds[0];
        return (
            <button
                type="button"
                onClick={() => reopenOrderAlert(waitingId)}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-2.5 rounded-full bg-rose-600 px-5 py-3 text-white shadow-2xl animate-pulse"
            >
                <Bell size={16} />
                <span className="text-[11px] font-black uppercase tracking-widest">
                    Order #{String(waitingId).slice(-6).toUpperCase()} waiting
                    {ringingOrderIds.length > 1 ? ` (+${ringingOrderIds.length - 1} more)` : ''} - tap to respond
                </span>
            </button>
        );
    }

    if (!isAlertOpen || !newOrderData) return null;

    const onAccept = async () => {
        if (!orderId) return;
        const ok = await acceptOrder(orderId);
        if (!ok) return;
        setIsAlertOpen(false);
        refreshOrders?.();
    };

    const onReject = async () => {
        if (!orderId) return;
        if (autoAccepted) {
            const ok = await rejectFranchiseOrder(orderId);
            if (!ok) return;
        } else {
            const ok = await updateOrderStatus(orderId, 'Cancelled');
            if (!ok) return;
        }
        setIsAlertOpen(false);
        refreshOrders?.();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { setIsAlertOpen(false); }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ y: 80, opacity: 0, scale: 0.97 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 80, opacity: 0, scale: 0.97 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
                >
                    {/* Top green pulse bar */}
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />

                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30 scale-110" />
                                <div className="relative bg-emerald-50 p-2.5 rounded-xl">
                                    <Bell className="text-emerald-600 w-5 h-5" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">
                                    {autoAccepted ? 'Auto-Accepted' : 'New Assignment'}
                                </p>
                                <h2 className="text-lg font-black text-slate-900 leading-tight">
                                    {autoAccepted ? 'New Order Incoming' : 'Order Assigned to You'}
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={() => { setIsAlertOpen(false); }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700 mt-0.5"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Info banner */}
                    <div className="mx-5 mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <p className="text-[11px] font-semibold text-amber-700 leading-relaxed">
                            {autoAccepted
                                ? 'This order is auto-assigned to your store. Reject only if you cannot fulfil it.'
                                : 'Accept this order to start processing, or reject to pass it on.'}
                        </p>
                    </div>

                    {/* Order Card */}
                    <div className="mx-5 mb-4 border border-slate-100 rounded-xl overflow-hidden">
                        {/* Order ID row */}
                        <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <ShoppingBag className="text-slate-500 w-4 h-4" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Ref</p>
                                    <p className="text-sm font-black text-slate-900">
                                        #{orderId ? orderId.toString().slice(-6).toUpperCase() : '------'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                                    {statusNormalized || 'accepted'}
                                </span>
                            </div>
                        </div>
                        {/* Scheduled Date Row */}
                        {(orderDetail?.isPreOrder || newOrderData?.isPreOrder) && (orderDetail?.scheduledDateFormatted || newOrderData?.scheduledDateFormatted || orderDetail?.scheduledDate || newOrderData?.scheduledDate) && (
                            <div className="bg-indigo-50 px-4 py-2 flex items-center gap-2 border-b border-indigo-100">
                                <Clock size={12} className="text-indigo-600" />
                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                    Scheduled for: {orderDetail?.scheduledDateFormatted || newOrderData?.scheduledDateFormatted || (!isNaN(new Date(orderDetail?.scheduledDate || newOrderData?.scheduledDate).getTime()) ? new Date(orderDetail?.scheduledDate || newOrderData?.scheduledDate).toLocaleDateString() : 'Pending')}
                                </span>
                            </div>
                        )}

                        {/* Stats row */}
                        <div className="grid grid-cols-3 divide-x divide-slate-100">
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                                <p className="text-xs font-bold text-slate-800 truncate">{hotelName}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                                <p className="text-xs font-bold text-slate-800">₹{Number(totalAmount || 0).toLocaleString()}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items</p>
                                <p className="text-xs font-bold text-slate-800">{Array.isArray(items) ? items.length : 0}</p>
                            </div>
                        </div>

                        {/* Items list */}
                        {Array.isArray(items) && items.length > 0 && (
                            <div className="border-t border-slate-100 px-4 py-3 space-y-1.5">
                                {items.slice(0, 3).map((it, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[75%]">
                                            {it.name || it.productName || 'Item'}
                                        </span>
                                        <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                            ×{it.quantity ?? it.qty ?? 0}
                                        </span>
                                    </div>
                                ))}
                                {items.length > 3 && (
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-0.5">
                                        +{items.length - 3} more items
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Payment + Address row */}
                        {(paymentMethod || shippingAddress) && (
                            <div className="border-t border-slate-100 px-4 py-3 flex flex-col gap-1.5">
                                {paymentMethod && (
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={11} className="text-slate-400 shrink-0" />
                                        <span className="text-[11px] font-semibold text-slate-500">{paymentMethod}</span>
                                    </div>
                                )}
                                {shippingAddress && (
                                    <div className="flex items-start gap-2">
                                        <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
                                        <span className="text-[11px] font-semibold text-slate-500 line-clamp-2 leading-relaxed">{shippingAddress}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="px-5 pb-5">
                        {autoAccepted ? (
                            <div className="flex flex-col gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => { setIsAlertOpen(false); navigate(`/franchise/orders`); }}
                                    className="h-12 w-full rounded-xl bg-emerald-600 text-white font-black uppercase text-xs tracking-[0.15em] hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    View Order <ArrowRight size={15} />
                                </button>
                                <button
                                    type="button"
                                    onClick={onReject}
                                    disabled={!canReject || detailLoading}
                                    className="h-11 w-full rounded-xl border-2 border-rose-200 text-rose-600 font-black uppercase text-xs tracking-[0.15em] hover:bg-rose-50 active:scale-[0.98] transition-all disabled:opacity-40"
                                >
                                    {detailLoading ? 'Loading...' : 'Reject Order'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={onAccept}
                                        disabled={!canAccept || detailLoading}
                                        className="h-12 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs tracking-[0.15em] hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40"
                                    >
                                        {detailLoading ? '...' : canAccept ? 'Accept' : 'Accepted'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onReject}
                                        disabled={!canReject || detailLoading}
                                        className="h-12 rounded-xl border-2 border-rose-200 text-rose-600 font-black uppercase text-xs tracking-[0.15em] hover:bg-rose-50 active:scale-[0.98] transition-all disabled:opacity-40"
                                    >
                                        {detailLoading ? '...' : 'Reject'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => { setIsAlertOpen(false); }}
                                        className="h-11 rounded-xl border border-slate-200 text-slate-500 font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                    >
                                        Not Now
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsAlertOpen(false); navigate(`/franchise/orders`); }}
                                        className="h-11 rounded-xl border border-slate-200 text-slate-700 font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        View <ArrowRight size={13} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-900 py-3 px-5 flex items-center justify-center gap-2">
                        <Package size={12} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Kisaankart</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default NewOrderAlert;
