import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    MapPin,
    Phone,
    Clock,
    Package,
    UserCircle,
    CheckCircle2,
    Truck,
    ShieldCheck,
    Store,
    ShoppingBag,
    CreditCard,
    Banknote,
    Wallet,
    Download,
    Share2,
    AlertCircle,
    Building2,
    FileText
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import StatusBadge from '../common/StatusBadge';
import html2pdf from 'html2pdf.js';

const OrderDetailModal = ({ isOpen, onClose, orderId, onProcure, onAllowPartial }) => {
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const printableRef = useRef(null);

    useEffect(() => {
        if (isOpen && orderId) {
            fetchOrderDetail();
        }
    }, [isOpen, orderId]);

    const fetchOrderDetail = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/orders/admin/${orderId}`);
            if (response.data.success) {
                setOrder(response.data.result);
            }
        } catch (error) {
            console.error('Fetch order detail error:', error);
            toast.error('Failed to load order details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        try {
            const response = await api.put(`/orders/admin/${orderId}/status`, {
                status: newStatus
            });
            if (response.data.success) {
                toast.success(`Order status updated to ${newStatus}`);
                fetchOrderDetail();
            }
        } catch (error) {
            console.error('Update status error:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;

        const element = printableRef.current || document.getElementById('printable-order-content');
        if (!element) {
            toast.error('Invoice content not ready. Please try again.');
            return;
        }

        const opt = {
            margin: [10, 10],
            filename: `Invoice_${order._id.slice(-8)}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfPromise = (async () => {
            try {
                const worker = html2pdf().set(opt).from(element);
                await worker.save();
            } catch (err) {
                console.error('Invoice PDF error:', err);
                try {
                    const fallback = document.createElement('div');
                    fallback.style.padding = '20px';
                    fallback.style.fontFamily = 'sans-serif';
                    fallback.style.fontSize = '12px';
                    fallback.innerHTML = `
                        <h2>Order #${order._id?.slice(-8) || 'N/A'}</h2>
                        <p><strong>Customer:</strong> ${order.userId?.fullName || (order.franchiseId?.mobile === order.userId?.mobile ? order.franchiseId?.ownerName : 'Guest')}</p>
                        <p><strong>Contact:</strong> ${order.userId?.mobile || 'N/A'}</p>
                        <p><strong>Address:</strong> ${order.shippingAddress || 'N/A'}</p>
                        <p><strong>Subtotal:</strong> ₹${(order.subtotal ?? 0).toLocaleString()}</p>
                        <p><strong>Delivery:</strong> ₹${(order.deliveryFee ?? 0).toLocaleString()}</p>
                        <p><strong>Tax:</strong> ₹${(order.tax ?? 0).toLocaleString()}</p>
                        ${order.discountAmount > 0 ? `<p><strong>Discount (${order.couponCode}):</strong> -₹${(order.discountAmount ?? 0).toLocaleString()}</p>` : ''}
                        <p><strong>Total:</strong> ₹${(order.totalAmount ?? 0).toLocaleString()}</p>
                        <p><em>Generated on ${new Date().toLocaleString()}</em></p>
                    `;
                    document.body.appendChild(fallback);
                    await html2pdf().set({ ...opt, filename: `Invoice_${order._id?.slice(-8)}.pdf` }).from(fallback).save();
                    document.body.removeChild(fallback);
                } catch (fallbackErr) {
                    console.error('Fallback PDF error:', fallbackErr);
                    throw new Error('Could not generate invoice. Try again or check the console.');
                }
            }
        })();

        toast.promise(pdfPromise, {
            loading: 'Generating PDF invoice...',
            success: 'Invoice downloaded successfully',
            error: (err) => err?.message || 'Failed to generate invoice'
        });
    };

    const handleShareOrder = async () => {
        if (!order) return;

        const customerName = order.userId?.fullName || (order.franchiseId?.mobile === order.userId?.mobile ? order.franchiseId?.ownerName : 'Guest');

        const shareData = {
            title: `Kisaankart Order #${order._id.slice(-8)}`,
            text: `Order Details for ${customerName}. Amount: ₹${order.totalAmount}`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(`Order ID: ${order._id}\nAmount: ₹${order.totalAmount}\nCustomer: ${customerName}`);
                toast.success('Order details copied to clipboard');
            }
        } catch (err) {
            console.error('Sharing failed:', err);
        }
    };

    const statusSteps = [
        { label: 'Placed', icon: ShoppingBag },
        { label: 'Confirmed', icon: CheckCircle2 },
        { label: 'Processing', icon: Clock },
        { label: 'Assigned', icon: Truck },
        { label: 'Out for Delivery', icon: Truck },
        { label: 'Delivered', icon: ShieldCheck }
    ];

    const PaymentBadge = ({ method }) => {
        const config = {
            'Prepaid': { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            'COD': { icon: Banknote, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
            'Credit': { icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' }
        };
        const { icon: Icon, color, bg, border } = config[method] || config['COD'];
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border", bg, color, border)}>
                <Icon size={12} strokeWidth={2.5} />
                {method}
            </span>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-slate-50 w-full max-w-5xl max-h-[90vh] rounded-sm shadow-2xl overflow-hidden flex flex-col relative z-10"
                    >
                        {/* Header */}
                        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                                    <ShoppingBag size={12} />
                                    <span>Orders</span>
                                </div>
                                <h1 className="text-sm font-black text-slate-900 tracking-tighter uppercase tabular-nums">
                                    {isLoading ? 'Loading Order...' : `Order #${order?._id?.slice(-8)}`}
                                </h1>
                                {!isLoading && order && (
                                    <StatusBadge status={
                                        order.orderStatus === 'Cancelled'
                                            ? 'Cancelled'
                                            : Array.isArray(order.assignmentAttempts) &&
                                              order.assignmentAttempts.some(a => a.reason === 'rejected')
                                                ? 'franchise_rejected'
                                                : order.orderStatus
                                    } />
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {!isLoading && order && (
                                    <>
                                        <button
                                            onClick={handleShareOrder}
                                            className="p-2 text-slate-400 hover:text-slate-900 transition-colors border border-slate-200 rounded-sm bg-white"
                                            title="Share Order"
                                        >
                                            <Share2 size={15} />
                                        </button>
                                        <button
                                            onClick={handleDownloadInvoice}
                                            className="bg-slate-900 text-white px-4 py-2 rounded-sm text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm uppercase tracking-[0.1em]"
                                        >
                                            <Download size={14} />
                                            Invoice
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all rounded-sm"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {isLoading ? (
                                <div className="space-y-6 animate-pulse">
                                    <div className="h-24 bg-white border border-slate-200 rounded-sm" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2 h-96 bg-white border border-slate-200 rounded-sm" />
                                        <div className="h-96 bg-white border border-slate-200 rounded-sm" />
                                    </div>
                                </div>
                            ) : order ? (
                                <div ref={printableRef} className="space-y-6" id="printable-order-content">

                                    {order.items?.some(i => i.isShortage) && !order.allowPartialFulfillment && (
                                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-sm flex items-start gap-4">
                                            <div className="w-10 h-10 bg-rose-500 rounded-sm flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-200">
                                                <AlertCircle size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-[12px] font-black text-rose-900 uppercase tracking-widest">Stock Kam Hai</h3>
                                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] animate-pulse">Action Required</span>
                                                </div>
                                                <p className="text-[10px] text-rose-600 font-bold mt-1 leading-relaxed uppercase tracking-tight">
                                                    Required quantity available nahi hai. Aap <b>Stock Mangwayein</b> (supplier se stock arrange karne ka request bhejein) ya <b>Partial Delivery Allow Karein</b> (jitna stock hai, utna deliver karne ki permission dein).
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Left Column - Order Items */}
                                        <div className="md:col-span-2 space-y-6">
                                            <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Package size={16} className="text-slate-900" />
                                                        <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Order Items</h2>
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-2.5 py-1 rounded-sm">
                                                        {order.items?.length || 0} Products
                                                    </span>
                                                </div>
                                                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                                    {order.items?.map((item, idx) => (
                                                        <div key={idx} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-all group">
                                                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-sm overflow-hidden flex items-center justify-center p-2">
                                                                <img
                                                                    src={item.productId?.primaryImage || item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.productId?.name || item.name)}&background=f1f5f9&color=94a3b8&size=128`}
                                                                    alt={item.productId?.name || item.name}
                                                                    className="w-full h-full object-contain mix-blend-multiply"
                                                                    onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=Product&background=f1f5f9&color=94a3b8&size=128' }}
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight line-clamp-1">{item.productId?.name || item.name}</h4>
                                                                <div className="flex items-center gap-2 mt-1 font-bold text-[10px] text-slate-400 uppercase tracking-widest">
                                                                    <span>Qty: {item.quantity}</span>
                                                                    <div className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                                                    <span>₹{item.price?.toLocaleString()} / unit</span>
                                                                </div>
                                                                {item.isShortage && (
                                                                    <div className="mt-1.5 flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase tracking-[0.1em] bg-rose-50 px-2 py-0.5 rounded-sm border border-rose-100 w-fit animate-pulse">
                                                                        <AlertCircle size={10} />
                                                                        Stock Kam Hai: {item.shortageQty} {item.unit}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[11px] font-black text-slate-900 tabular-nums">
                                                                    ₹{((Number(item.price) || 0) * (Number(item.quantity) || 0)).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="bg-slate-900 p-6 flex flex-col gap-3">
                                                    {order.items?.some(i => i.isShortage) && (order.orderStatus || '').toLowerCase() !== 'procuring' && (
                                                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => onAllowPartial?.(order)}
                                                                disabled={order.allowPartialFulfillment}
                                                                className={cn(
                                                                    "w-full py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border",
                                                                    order.allowPartialFulfillment
                                                                        ? "bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed"
                                                                        : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400"
                                                                )}
                                                            >
                                                                <Truck size={15} />
                                                                {order.allowPartialFulfillment ? 'Partial Delivery Allowed' : 'Partial Delivery Allow Karein'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    onClose();
                                                                    onProcure?.(order);
                                                                }}
                                                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 py-3 rounded-sm text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                                                            >
                                                                <Package size={16} />
                                                                Stock Mangwayein
                                                            </button>
                                                        </div>
                                                    )}

                                                    {(order.orderStatus || '').toLowerCase() === 'procuring' && (
                                                        <div className="mb-4 p-4 bg-slate-800 border border-slate-700 rounded-sm flex items-center justify-center gap-3">
                                                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Stock Arranging · Samaan arrange ho raha hai</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                        <span>Subtotal</span>
                                                        <span className="tabular-nums">₹{(Number(order.subtotal) || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                        <span>Delivery Fee</span>
                                                        <span className="tabular-nums">₹{(Number(order.deliveryFee) || 0).toLocaleString()}</span>
                                                    </div>
                                                    {(Number(order.tax) || 0) > 0 && (
                                                        <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                            <span>Tax</span>
                                                            <span className="tabular-nums">₹{(Number(order.tax) || 0).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {(Number(order.discountAmount) || 0) > 0 && (
                                                        <div className="flex items-center justify-between text-rose-400 text-[10px] font-black uppercase tracking-widest">
                                                            <span>Discount ({order.couponCode})</span>
                                                            <span className="tabular-nums">-₹{(Number(order.discountAmount) || 0).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    <div className="h-px bg-slate-800 my-1" />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Total</span>
                                                        <span className="text-xl font-black text-white tracking-tighter tabular-nums">₹{(Number(order.totalAmount) || 0).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>


                                        </div>

                                        {/* Right Column - Customer & Info */}
                                        <div className="space-y-6">
                                            {/* Customer Insight */}
                                            <div className="bg-white border border-slate-200 rounded-sm p-5 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 border-l-4 border-slate-900 pl-3">
                                                    <UserCircle size={16} />
                                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Customer</h3>
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Name</span>
                                                        <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                                            {order.userId?.fullName || 
                                                             (order.franchiseId?.mobile === order.userId?.mobile ? order.franchiseId?.ownerName : 'Unnamed User')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Contact</span>
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 tabular-nums">
                                                                <Phone size={10} className="text-slate-400" />
                                                                {order.userId?.mobile || 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Payment</span>
                                                            <PaymentBadge method={order.paymentMethod || 'COD'} />
                                                        </div>
                                                    </div>
                                                    <div className="pt-3 border-t border-slate-50">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Shipping to</span>
                                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm flex gap-2">
                                                            <MapPin size={14} className="text-slate-400 shrink-0" />
                                                            <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase">
                                                                {order.shippingAddress || 'No Address Provided'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fulfillment Insight */}
                                            <div className="bg-white border border-slate-200 rounded-sm p-5 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                                                    <Store size={16} className="text-emerald-500" />
                                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Franchise</h3>
                                                </div>
                                                {order.franchiseId ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-emerald-50 rounded-sm flex items-center justify-center text-emerald-600 border border-emerald-100">
                                                            <Building2 size={16} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{order.franchiseId?.franchiseName || order.franchiseId?.storeName || 'Franchise'}</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Franchise</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    ['Confirmed', 'Processing', 'Out for Delivery', 'Delivered', 'Completed'].includes(order.orderStatus) ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-emerald-50 rounded-sm flex items-center justify-center text-emerald-600 border border-emerald-100">
                                                                <Building2 size={16} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Kisaankart</h4>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Warehouse</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 border border-dashed border-slate-200 rounded-sm flex flex-col items-center text-center gap-2">
                                                            <AlertCircle size={16} className="text-slate-300" />
                                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Unassigned</p>
                                                        </div>
                                                    )
                                                )}
                                            </div>

                                            {/* Audit Log */}
                                            <div className="bg-white border border-slate-200 rounded-sm p-5 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
                                                    <FileText size={16} className="text-amber-500" />
                                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">History</h3>
                                                </div>
                                                <div className="space-y-3">
                                                    {(order.scheduledDateFormatted || order.scheduledDate) && (
                                                        <div className="flex gap-3 mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-sm">
                                                            <Clock size={16} className="text-indigo-600 shrink-0" />
                                                            <div>
                                                                <p className="text-[10px] font-black text-indigo-900 uppercase tracking-tight">Advance Booking / Target Date</p>
                                                                <p className="text-[11px] font-black text-indigo-600 mt-1 uppercase tabular-nums">
                                                                    {order.scheduledDateFormatted || new Date(order.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-3">
                                                        <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Created</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(order.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-center">
                                    <AlertCircle size={40} className="text-slate-200 mb-4" />
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Order Not Found</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">We couldn't find this order</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default OrderDetailModal;
