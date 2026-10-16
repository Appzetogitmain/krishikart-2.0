import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Clock,
    CheckCircle2,
    Package,
    Truck,
    AlertCircle,
    MapPin,
    IndianRupee,
    ChevronRight,
    Loader2,
    Calendar,
    Phone,
    Shield,
    ClipboardList,
    XCircle,
    ThumbsUp,
    ThumbsDown,
    FileText,
    ExternalLink
} from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useOrders } from '@/modules/user/contexts/OrderContext';
// import { useProcurement } from '@/modules/franchise/contexts/ProcurementContext';
import DocumentViewer from '../components/documents/DocumentViewer';
import VendorBackBar from '../components/navigation/VendorBackBar';
import OfferHistory from '@/components/procurement/OfferHistory';

const inr = (n) => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN')}`;

export default function OrderDetailScreen() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [status, setStatus] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isDocOpen, setIsDocOpen] = useState(false);
    const [docType, setDocType] = useState('DC');
    const [bidPrice, setBidPrice] = useState('');
    const { orders: contextOrders, updateOrderStatus } = useOrders();
    // const { procurementRequests, submitQuotation, updateRequestStatus } = useProcurement(); 
    const procurementRequests = [];
    const submitQuotation = async () => { };
    const updateRequestStatus = async () => { };
    const [quotedItems, setQuotedItems] = useState([]);
    // Replying to an admin's rate offer: counter mode lets the vendor type their own rates
    const [counterMode, setCounterMode] = useState(false);
    const [replyNote, setReplyNote] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const response = await api.get(`/procurement/vendor/${id}`);
                if (response.data.success) {
                    const foundOrder = response.data.result || response.data.results;
                    let currentStatus = foundOrder.status?.toLowerCase();
                    if (currentStatus === 'assigned') {
                        currentStatus = 'requested';
                    }
                    setStatus(currentStatus);
                    setOrder(foundOrder);
                    const currentQuotedTotal = foundOrder.items?.reduce((sum, item) => sum + (item.quotedPrice || 0) * (item.quantity || 0), 0) || 0;
                    setBidPrice(currentQuotedTotal.toString());
                    if (foundOrder.items) {
                        setQuotedItems(foundOrder.items.map(item => ({
                            ...item,
                            quotedPrice: item.quotedPrice || 0,
                            image: item.image
                        })));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch order details", error);
                if (error.response?.status === 403) toast.error("This request is not assigned to your account");
            } finally {
                setIsLoading(false);
            }
        };

        if (location.state?.order) {
            const foundOrder = location.state.order;
            let currentStatus = foundOrder.status?.toLowerCase();
            if (currentStatus === 'assigned') {
                currentStatus = 'requested';
            }
            setStatus(currentStatus);
            setOrder(foundOrder);
            const currentQuotedTotal = foundOrder.items?.reduce((sum, item) => sum + (item.quotedPrice || 0) * (item.quantity || 0), 0) || 0;
            setBidPrice(currentQuotedTotal.toString());
            if (foundOrder.items) {
                setQuotedItems(foundOrder.items.map(item => ({
                    ...item,
                    quotedPrice: item.quotedPrice || 0,
                    image: item.image,
                    rejected: item.rejected || false,
                    receivedQuantity: item.receivedQuantity || 0,
                    damagedQuantity: item.damagedQuantity || 0
                })));
            }
            setIsLoading(false);
        }
        // Always load the latest copy too (rate offers and their history live on the server)
        fetchOrder();
    }, [id, location.state, reloadKey]);

    // Socket listener for rejections
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleRejection = (data) => {
            if (data.requestId?.toString() === id?.toString()) {
                console.log("[VendorOrderDetail] Items rejected:", data);
                // Refresh order details to show rejections
                const fetchOrder = async () => {
                    try {
                        const response = await api.get(`/procurement/vendor/${id}`);
                        if (response.data.success) {
                            const foundOrder = response.data.result || response.data.results;
                            setOrder(foundOrder);
                            if (foundOrder.items) {
                                setQuotedItems(foundOrder.items.map(item => ({
                                    ...item,
                                    quotedPrice: item.quotedPrice || 0,
                                    image: item.image,
                                    rejected: item.rejected || false,
                                    receivedQuantity: item.receivedQuantity || 0,
                                    damagedQuantity: item.damagedQuantity || 0
                                })));
                            }
                        }
                    } catch (err) {
                        console.error("Failed to refresh after rejection", err);
                    }
                };
                fetchOrder();
            }
        };

        socket.on('procurement_items_rejected', handleRejection);
        return () => socket.off('procurement_items_rejected', handleRejection);
    }, [id]);

    const handleAction = async (newStatus, callback) => {
        setIsActionLoading(true);
        try {
            const response = await api.put(`/procurement/vendor/${id}/status`, { status: newStatus });
            if (response.data.success) {
                setStatus(newStatus);
                if (callback) callback();
            }
        } catch (error) {
            console.error("Failed to update status", error);
            toast.error(error.response?.data?.message || "Could not update the order status");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleQuotationSubmit = async () => {
        setIsActionLoading(true);
        try {
            const isCounter = status === 'negotiating';
            const response = await api.post(`/procurement/vendor/${id}/quote`, { items: quotedItems, note: replyNote });
            if (response.data.success) {
                if (isCounter) {
                    toast.success('Your rate has been sent to the admin');
                    setCounterMode(false);
                    setReplyNote('');
                    setReloadKey((k) => k + 1);
                    return;
                }
                setStatus('quoted');
                navigate('/vendor/orders');
            }
        } catch (error) {
            console.error("Failed to submit quotation", error);
            toast.error(error.response?.data?.message || "Could not submit the quotation");
        } finally {
            setIsActionLoading(false);
        }
    };

    // Accept or decline the admin's rate offer
    const replyToOffer = async (decision) => {
        setIsActionLoading(true);
        try {
            const response = await api.post(`/procurement/vendor/${id}/offer/${decision}`, { note: replyNote });
            if (response.data.success) {
                toast.success(response.data.message || (decision === 'accept' ? 'Rate accepted' : 'Offer declined'));
                setReplyNote('');
                setCounterMode(false);
                setReloadKey((k) => k + 1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not send your reply');
        } finally {
            setIsActionLoading(false);
        }
    };

    const updateItemQuotation = (idx, price) => {
        const newItems = [...quotedItems];
        newItems[idx].quotedPrice = parseFloat(price) || 0;
        setQuotedItems(newItems);

        const total = newItems.reduce((sum, item) => sum + (item.quotedPrice * (item.quantity || item.qty || 0)), 0);
        setBidPrice(total.toString());
    };

    if (isLoading) return (
        <div className="space-y-8 animate-pulse">
            <div className="h-10 w-48 bg-slate-100 rounded-xl" />
            <div className="h-32 w-full bg-slate-100 rounded-[32px]" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-96 bg-slate-100 rounded-[40px]" />
                <div className="h-96 bg-slate-100 rounded-[40px]" />
            </div>
        </div>
    );

    if (!order) return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-dashed border-slate-200">
                <AlertCircle size={32} />
            </div>
            <h4 className="text-slate-900 font-black tracking-tight uppercase tracking-widest">Order Not Found</h4>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">We couldn't find this order</p>
            <button onClick={() => navigate('/vendor/orders')} className="mt-6 text-primary font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                <ArrowLeft size={14} /> Back to Orders
            </button>
        </div>
    );

    const steps = [
        { id: 'requested', label: 'New Request', icon: ClipboardList, description: 'Request received from a franchise' },
        { id: 'quoted', label: 'Quoted', icon: IndianRupee, description: 'Awaiting Approval' },
        { id: 'approved', label: 'Approved', icon: CheckCircle2, description: 'Admin approved your quote' },
        { id: 'preparing', label: 'Processing', icon: Package, description: 'Packing in progress' },
        { id: 'ready', label: 'Ready', icon: Shield, description: 'Packed and ready for pickup' },
        { id: 'completed', label: 'Dispatched', icon: Truck, description: 'On the way to the franchise' }
    ];

    const getActiveStepId = (s) => {
        const lowerS = s?.toLowerCase();
        if (lowerS === 'new') return 'approved';
        if (lowerS === 'bidding' || lowerS === 'negotiating') return 'quoted';
        return lowerS;
    };

    // Rate offer from the admin (when status is "negotiating")
    const offers = order.offers || [];
    const isNegotiating = status === 'negotiating';
    const adminOffer = [...offers].reverse().find((o) => o.by === 'admin' && o.action === 'counter');
    const myLastOffer = [...offers].reverse().find((o) => o.by === 'vendor' && (o.action === 'quote' || o.action === 'counter'));
    const canEditRates = status === 'requested' || status === 'assigned' || status === 'quoted' || (isNegotiating && counterMode);

    const currentStepIndex = steps.findIndex(s => s.id === getActiveStepId(order.status === 'completed' ? 'completed' : order.status));

    return (
        <div className="space-y-6 pb-32">
            <header className="space-y-3">
                <div className="flex items-start gap-3">
                    <VendorBackBar fallbackPath="/vendor/orders" className="mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                            <button onClick={() => navigate('/vendor/orders')} className="hover:text-slate-900 transition-colors">Orders</button>
                            <ChevronRight size={10} />
                            <span className="text-primary">{order.id}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Ref</h1>
                            <div className={cn(
                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                status === 'assigned' || status === 'new' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                    status === 'bidding' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                        status === 'accepted' || status === 'ready' || status === 'ready_for_pickup' || status === 'picked_up' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                            "bg-slate-50 text-slate-400 border-slate-100"
                            )}>
                                {isNegotiating ? 'New rate offered' : status?.replace(/_/g, ' ')}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Admin offered a different rate: accept, send own rate, or decline */}
            {isNegotiating && adminOffer && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-[28px] p-5 sm:p-6 space-y-4">
                    <div>
                        <h4 className="text-base font-black text-slate-900">Admin offered a different rate</h4>
                        <p className="text-[12px] text-slate-600 mt-0.5">
                            Work starts only after you agree. You can accept this rate, send your own rate, or decline and keep your rate.
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-orange-100 divide-y divide-slate-100">
                        {adminOffer.items.map((it) => {
                            const mine = myLastOffer?.items?.find((m) => m.productId === it.productId);
                            const priceDiff = mine ? Number(it.price) - Number(mine.price) : 0;
                            return (
                                <div key={it.productId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{it.name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {mine && Number(mine.quantity) !== Number(it.quantity)
                                                ? <>Quantity <s>{mine.quantity}</s> → <b className="text-slate-800">{it.quantity} {it.unit}</b></>
                                                : <>{it.quantity} {it.unit}</>}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[12px] text-slate-500 tabular-nums">Your rate {inr(mine?.price)}/{it.unit}</p>
                                        <p className={cn('text-sm font-black tabular-nums', priceDiff < 0 ? 'text-rose-600' : priceDiff > 0 ? 'text-emerald-700' : 'text-slate-900')}>
                                            Offer {inr(it.price)}/{it.unit}
                                            {priceDiff !== 0 && <span className="ml-1 text-[11px] font-bold">({priceDiff > 0 ? '+' : '−'}{inr(Math.abs(priceDiff))})</span>}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[12px] text-slate-600">Your total {inr(myLastOffer?.total)}</span>
                        <span className="text-lg font-black text-slate-900 tabular-nums">Offered total {inr(adminOffer.total)}</span>
                    </div>
                    {adminOffer.note && <p className="text-[12px] text-slate-700 bg-white rounded-xl px-3 py-2 border border-orange-100">Admin's note: “{adminOffer.note}”</p>}
                    <textarea
                        value={replyNote}
                        onChange={(e) => setReplyNote(e.target.value)}
                        rows={2}
                        maxLength={300}
                        placeholder="Add a note for the admin (optional)"
                        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
                    />
                    {counterMode && (
                        <p className="text-[12px] font-semibold text-orange-800">Type your rates in the item list below, then tap “Send my rate”.</p>
                    )}
                </div>
            )}



            {/* Price Bidding UI */}
            <AnimatePresence>
                {(status === 'requested' || status === 'quoted' || status === 'assigned' || (isNegotiating && counterMode)) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-primary/5 p-8 rounded-[40px] border border-primary/10 shadow-sm space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Your Quotation</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {status === 'requested' ? "Enter your price for each item below" : "Quotation Total"}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                                <IndianRupee size={20} />
                            </div>
                        </div>

                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">₹</span>
                            <div className="w-full bg-white border-2 border-slate-100 rounded-[28px] py-4 pl-12 pr-6 text-2xl font-black text-slate-900 tabular-nums">
                                {parseFloat(bidPrice || 0).toLocaleString()}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Document Log */}
            {(order.deliveryChallan || order.grn) && (
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Documents</p>
                        <Shield size={16} className="text-slate-200" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {order.deliveryChallan && (
                            <button
                                onClick={() => { setDocType('DC'); setIsDocOpen(true); }}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Delivery Challan</p>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-0.5">{order.deliveryChallan.id}</p>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                            </button>
                        )}
                        {order.grn && (
                            <button
                                onClick={() => { setDocType('GRN'); setIsDocOpen(true); }}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100/50 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                        <Shield size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Digital GRN</p>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-0.5">{order.grn.id}</p>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Items Manifest */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                <ClipboardList size={22} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Item List</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.items.length} Items</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {quotedItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-50 group hover:border-slate-200 hover:bg-slate-50 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm flex items-center justify-center">
                                            {item.image ? (
                                                <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                            ) : (
                                                <Package size={20} className="text-slate-300" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 text-sm tracking-tight">{item.name}</p>
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.qty || item.quantity} {item.unit} Requested</p>
                                                {(item.dispatchedQuantity > 0 || item.receivedQuantity > 0) && (
                                                    <div className="flex items-center gap-2">
                                                        {item.dispatchedQuantity > 0 && (
                                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Sent: {item.dispatchedQuantity}</p>
                                                        )}
                                                        {item.receivedQuantity !== undefined && (
                                                            <p className={cn(
                                                                "text-[10px] font-black uppercase tracking-widest",
                                                                item.receivedQuantity === item.dispatchedQuantity ? "text-emerald-500" : "text-rose-500"
                                                            )}>
                                                                Received: {item.receivedQuantity}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {canEditRates ? (
                                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-primary transition-all shadow-sm">
                                            <span className="text-[11px] font-black text-slate-400">₹</span>
                                            <input
                                                type="number"
                                                className="w-16 bg-transparent border-none outline-none font-black text-[11px] tabular-nums text-slate-900"
                                                placeholder="Rate"
                                                value={item.quotedPrice || ''}
                                                onChange={(e) => updateItemQuotation(idx, e.target.value)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <div className="flex flex-col items-end">
                                                <p className="text-[11px] font-black text-slate-900 tabular-nums">₹{item.quotedPrice || (item.price || 0)}</p>
                                                {item.originalQuotedPrice && item.originalQuotedPrice !== item.quotedPrice && (
                                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter line-through opacity-60">Was ₹{item.originalQuotedPrice}</p>
                                                )}
                                            </div>
                                            {item.rejected && (
                                                <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black uppercase rounded-sm animate-pulse">
                                                    Rejected
                                                </span>
                                            )}
                                            {item.damagedQuantity > 0 && (
                                                <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black uppercase rounded-sm">
                                                    Damaged: {item.damagedQuantity}
                                                </span>
                                            )}
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rate</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Operations Intel */}
                <div className="space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-[100px] -z-0" />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-10">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Deliver To</p>
                                    <h4 className="text-2xl font-black tracking-tight">{order.franchiseName}</h4>
                                </div>
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-primary backdrop-blur-xl border border-white/5">
                                    <MapPin size={24} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md group-hover:border-white/20 transition-colors">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-slate-300">
                                        <Phone size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Franchise Contact</p>
                                        <p className="text-sm font-black tabular-nums">{order.franchiseMobile}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md group-hover:border-white/20 transition-colors">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-slate-300">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Order Timeline</p>
                                        <p className="text-sm font-black tabular-nums">{new Date(order.createdAt || order.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Today</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Settle Info hidden as per request */}
                </div>
            </div>

            <OfferHistory offers={offers} viewer="vendor" />

            {(status === 'quoted') && offers.length > 0 && (
                <p className="text-[12px] text-slate-500 text-center">Waiting for the admin to reply to your rate.</p>
            )}

            {/* Sticky Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-2xl border-t border-slate-100 lg:left-64 flex gap-4 z-[100] shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.1)]">
                <AnimatePresence mode="wait">
                    {(status === 'requested' || status === 'quoted') && (
                        <motion.div
                            key="action-requested"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex gap-4"
                        >
                            <button
                                onClick={handleQuotationSubmit}
                                disabled={isActionLoading || quotedItems.some(item => !item.quotedPrice)}
                                className="flex-[2] bg-slate-900 text-white py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50 group"
                            >
                                {isActionLoading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        {status === 'quoted' ? 'Update Quotation' : 'Send Quotation'}
                                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {/* status === 'quoted' indicator removed because we now show the update button instead */}

                    {isNegotiating && !counterMode && (
                        <motion.div key="action-offer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 grid grid-cols-3 gap-2 sm:gap-3">
                            <button
                                onClick={() => replyToOffer('decline')}
                                disabled={isActionLoading}
                                className="py-4 rounded-[20px] border-2 border-slate-200 text-slate-600 font-black text-xs sm:text-sm active:scale-95 transition-all disabled:opacity-50"
                            >
                                Decline
                            </button>
                            <button
                                onClick={() => setCounterMode(true)}
                                disabled={isActionLoading}
                                className="py-4 rounded-[20px] border-2 border-orange-300 bg-orange-50 text-orange-800 font-black text-xs sm:text-sm active:scale-95 transition-all disabled:opacity-50"
                            >
                                Send my rate
                            </button>
                            <button
                                onClick={() => replyToOffer('accept')}
                                disabled={isActionLoading}
                                className="py-4 rounded-[20px] bg-emerald-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : <>Accept {inr(adminOffer?.total)}</>}
                            </button>
                        </motion.div>
                    )}

                    {isNegotiating && counterMode && (
                        <motion.div key="action-counter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex gap-3">
                            <button
                                onClick={() => { setCounterMode(false); setReloadKey((k) => k + 1); }}
                                disabled={isActionLoading}
                                className="flex-1 py-4 rounded-[20px] border-2 border-slate-200 text-slate-600 font-black text-sm active:scale-95 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleQuotationSubmit}
                                disabled={isActionLoading || quotedItems.some(item => !item.quotedPrice)}
                                className="flex-[2] bg-slate-900 text-white py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 shadow-2xl shadow-slate-200 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : <>Send my rate · {inr(bidPrice)}</>}
                            </button>
                        </motion.div>
                    )}

                    {status === 'approved' && (
                        <motion.div
                            key="action-approved"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex gap-4"
                        >
                            <button
                                onClick={() => handleAction('preparing', () => navigate(`/vendor/dispatch?order=${order.id}`))}
                                disabled={isActionLoading}
                                className="flex-1 bg-slate-900 text-white py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 active:scale-95 transition-all group"
                            >
                                {isActionLoading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Start Packing
                                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {(status === 'preparing' || status === 'ready') && (
                        <motion.button
                            key="action-fufillment"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => navigate(`/vendor/dispatch?order=${order.id}`)}
                            className="flex-1 bg-emerald-600 text-white py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 shadow-2xl shadow-emerald-100 active:scale-95 transition-all group"
                        >
                            Progress
                            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                    )}

                    {status === 'ready_for_pickup' && (
                        <motion.div
                            key="action-ready-for-pickup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex gap-4"
                        >
                            <button
                                onClick={() => handleAction('picked_up', () => toast.success("Marked as picked up"))}
                                disabled={isActionLoading}
                                className="flex-1 bg-emerald-600 text-white py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 shadow-2xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50 group"
                            >
                                {isActionLoading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        <Truck size={18} />
                                        Mark as Picked Up
                                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {status === 'picked_up' && (
                        <motion.div
                            key="action-picked-up"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 bg-slate-50 text-slate-400 py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-2 border border-dashed border-slate-200"
                        >
                            <Truck size={18} /> Picked up - waiting for the franchise to confirm receipt
                        </motion.div>
                    )}

                    {status === 'completed' && (
                        <motion.div
                            key="action-completed"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 bg-slate-50 text-slate-300 py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-2 border border-dashed border-slate-200"
                        >
                            <CheckCircle2 size={18} /> Order Completed
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <DocumentViewer
                isOpen={isDocOpen}
                onClose={() => setIsDocOpen(false)}
                type={docType}
                data={docType === 'DC' ? order.deliveryChallan : order.grn}
            />
        </div>
    );
}
