import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft, MapPin, Receipt, Star, RotateCcw,
    ChevronRight, CheckCircle2, CreditCard, Wallet,
    Smartphone, Banknote, ShieldCheck, Clock, Truck,
    Package, ArrowRight, Activity, HelpCircle
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/modules/user/contexts/OrderContext'
import { useCart } from '@/modules/user/contexts/CartContext'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRequireAuth } from '../hooks/useRequireAuth'
import { joinOrderRoom } from '@/lib/socket'

export default function OrderDetailScreen() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { orders, requestReturn, fetchMyOrders } = useOrders()
    const { requireAuth } = useRequireAuth()
    const { addToCart } = useCart()
    const [returnQuantities, setReturnQuantities] = useState({})
    const [returnReason, setReturnReason] = useState('')
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)
    const order = orders.find(o => o._id === id)

    // Ensure orders are loaded if user lands here directly
    useEffect(() => {
        if (orders.length === 0) {
            fetchMyOrders()
        }
    }, [orders.length, fetchMyOrders])

    // Explicitly join the socket room so this page gets live updates
    useEffect(() => {
        if (id) joinOrderRoom(id)
    }, [id])

    if (!order) return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <p className="text-slate-400 font-bold mb-4 italic text-sm">Order history not found.</p>
                <Button onClick={() => navigate('/orders')} className="rounded-2xl px-8 h-12 bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200">
                    Back to Orders
                </Button>
            </div>
        </div>
    );

    const getPaymentIcon = (method) => {
        const m = (method || '').toLowerCase();
        if (m.includes('wallet')) return <Wallet size={18} />;
        if (m.includes('upi')) return <Smartphone size={18} />;
        if (m.includes('card')) return <CreditCard size={18} />;
        return <Banknote size={18} />;
    }

    const getStatusStyles = (status) => {
        const s = (status || '').toLowerCase();
        if (s.startsWith('return_')) {
            if (['return_approved', 'return_picked_up', 'return_completed'].includes(s)) 
                return { bg: 'bg-emerald-50/50', text: 'text-emerald-600', border: 'border-emerald-100', dot: 'bg-emerald-500' };
            if (['return_requested', 'return_pickup_assigned'].includes(s)) 
                return { bg: 'bg-amber-50/50', text: 'text-amber-600', border: 'border-amber-100', dot: 'bg-amber-500' };
            if (s === 'return_rejected') 
                return { bg: 'bg-rose-50/50', text: 'text-rose-600', border: 'border-rose-100', dot: 'bg-rose-500' };
        }
        switch (s) {
            case 'received':
            case 'delivered': 
                return { bg: 'bg-emerald-50/50', text: 'text-emerald-600', border: 'border-emerald-100', dot: 'bg-emerald-500' };
            case 'dispatched':
            case 'out for delivery':
            case 'out_for_delivery': 
                return { bg: 'bg-sky-50/50', text: 'text-sky-600', border: 'border-sky-100', dot: 'bg-sky-500' };
            case 'placed':
            case 'pending': 
                return { bg: 'bg-amber-50/50', text: 'text-amber-600', border: 'border-amber-100', dot: 'bg-amber-500' };
            case 'procuring':
            case 'accepted': 
                return { bg: 'bg-indigo-50/50', text: 'text-indigo-600', border: 'border-indigo-100', dot: 'bg-indigo-500' };
            case 'packed':
            case 'ready': 
                return { bg: 'bg-purple-50/50', text: 'text-purple-600', border: 'border-purple-100', dot: 'bg-purple-500' };
            case 'cancelled': 
                return { bg: 'bg-rose-50/50', text: 'text-rose-600', border: 'border-rose-100', dot: 'bg-rose-500' };
            default: 
                return { bg: 'bg-slate-50/50', text: 'text-slate-500', border: 'border-slate-100', dot: 'bg-slate-400' };
        }
    }

    const getDisplayStatus = () => {
        const latestReturn = [...(order.returnRequests || [])]
            .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0))[0];

        if (!latestReturn?.status) return order.orderStatus;

        const map = {
            pending: 'return_requested',
            approved: 'return_approved',
            rejected: 'return_rejected',
            pickup_assigned: 'return_pickup_assigned',
            picked_up: 'return_picked_up',
            completed: 'return_completed',
        };

        return map[latestReturn.status] || order.orderStatus;
    };

    const displayStatus = getDisplayStatus();
    const status = getStatusStyles(displayStatus);

    const isOrderActive = !['delivered', 'received', 'cancelled'].includes(order.orderStatus?.toLowerCase());

    const handleReorder = requireAuth(async () => {
        toast.promise(
            Promise.all(order.items.map(item =>
                addToCart({ _id: item.productId, ...item }, item.quantity)
            )),
            {
                loading: 'Adding items to cart...',
                success: () => {
                    navigate('/cart');
                    return 'Reordered successfully!';
                },
                error: 'Failed to reorder items'
            }
        );
    });

    return (
        <PageTransition>
            <div className="bg-[#f8fafc] min-h-screen pb-32">
                {/* Header */}
                <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/orders')}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-800 active:scale-95 transition-all border border-slate-100"
                        >
                            <ArrowLeft size={18} strokeWidth={3} />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">Order Details</h1>
                            <p className="text-[10px] font-bold text-slate-400 capitalize mt-1 leading-none">Reference: #{order._id.slice(-8).toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                {/* Content Manifest */}
                <div className="px-4 pt-4 space-y-6 pb-36">
                    {/* Integrated Status Header */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] mb-1">Status</h2>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full", status.dot, "animate-pulse shadow-sm")} />
                                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">
                                    {displayStatus?.replace(/_/g, ' ')}
                                </h3>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Date</p>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                    </div>

                    {/* Tracking & Logistics Context */}
                    <div className="space-y-3">
                        {isOrderActive && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => navigate(`/track-order/${order._id}`)}
                                className="bg-slate-900 rounded-[20px] p-3.5 text-white active:scale-[0.98] transition-all flex items-center justify-between border border-slate-800"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shrink-0">
                                        <Activity size={16} strokeWidth={2.5} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Live Tracking</p>
                                        <h4 className="text-[11px] font-black uppercase tracking-tight">Track Order</h4>
                                    </div>
                                </div>
                                <ArrowRight size={14} strokeWidth={3} className="text-slate-500 mr-1" />
                            </motion.div>
                        )}

                        <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm space-y-4">
                            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-50">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 text-orange-500">
                                        <MapPin size={10} strokeWidth={3} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Deliver To</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-700 truncate leading-none">{order.shippingAddress?.split(',')[0] || 'Saved Location'}</p>
                                </div>
                                <div className="flex flex-col gap-1.5 pl-4">
                                    <div className="flex items-center gap-1.5 text-blue-500">
                                        <CreditCard size={10} strokeWidth={3} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Payment</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase leading-none truncate">{order.paymentMethod}</span>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-slate-50 grid grid-cols-2 gap-4 divide-x divide-slate-50">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 text-emerald-500">
                                        <Clock size={10} strokeWidth={3} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Delivery Slot</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-700 leading-none">{order.deliveryShift}</p>
                                </div>
                                <div className="flex flex-col gap-1.5 pl-4">
                                    <div className="flex items-center gap-1.5 text-purple-500">
                                        <Activity size={10} strokeWidth={3} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Delivery Date</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-700 leading-none">
                                        {order.scheduledDate 
                                            ? new Date(order.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
                                            : new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order Manifest (Items) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Items ({order.items?.length})</h3>
                        </div>
                        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
                            {order.items?.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3.5 p-3.5">
                                    <div className="w-11 h-11 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                                        <img
                                            src={item.image || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=200&q=80'}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{item.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                            {item.quantity} {item.unit} <span className="mx-1 opacity-20">×</span> ₹{item.price}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] font-black text-slate-900 tracking-tight">₹{(item.price * item.quantity).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Monetary Breakdown */}
                    <div className="bg-slate-900 rounded-[28px] p-5 text-white relative overflow-hidden">
                        <div className="space-y-3 relative z-10">
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2.5">
                                <span>Subtotal</span>
                                <span className="text-white">₹{(order.subtotal || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <span>Taxes & Charges</span>
                                <span className="text-white">₹{(order.tax || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <span>Delivery Fee</span>
                                <span className={cn(order.deliveryFee === 0 ? "text-emerald-400" : "text-white")}>
                                    {order.deliveryFee === 0 ? "FREE" : `₹${order.deliveryFee}`}
                                </span>
                            </div>

                            <div className="pt-5 mt-2 border-t border-dashed border-white/10 flex items-end justify-between">
                                <div className="flex flex-col">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Grand Total</p>
                                    <p className="text-2xl font-black text-white tracking-tighter italic">₹{(order.totalAmount || 0).toLocaleString()}</p>
                                </div>
                                <ShieldCheck size={24} className="text-white/10" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky Action Navigation */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-[100] flex gap-2">
                    <Button
                        onClick={handleReorder}
                        className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.25em] active:scale-95 transition-all group"
                    >
                        <RotateCcw size={14} className="mr-2" /> Order Again
                    </Button>
                    <button
                        onClick={() => navigate('/help-support')}
                        className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 active:scale-95"
                    >
                        <HelpCircle size={18} />
                    </button>
                </div>
            </div>
        </PageTransition>
    )
}

