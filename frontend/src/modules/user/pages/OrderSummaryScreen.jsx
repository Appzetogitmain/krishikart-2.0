import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft, MapPin, Receipt, Star, RotateCcw,
    ChevronRight, CheckCircle2, CreditCard, Wallet,
    Smartphone, Banknote, ShieldCheck, Clock
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/modules/user/contexts/OrderContext'
import { cn } from '@/lib/utils'

export default function OrderSummaryScreen() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { orders } = useOrders()
    const order = orders.find(o => o._id === id)

    if (!order) return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <p className="text-slate-400 font-bold mb-4 italic">Order not found.</p>
                <Button onClick={() => navigate('/orders')} className="rounded-full px-8">Back to Orders</Button>
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

    const getPaymentStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'completed') return 'bg-emerald-500 text-white';
        if (s === 'pending') return 'bg-amber-500 text-white';
        if (s === 'failed') return 'bg-red-500 text-white';
        return 'bg-slate-500 text-white';
    }

    return (
        <PageTransition>
            <div className="bg-[#f2f6f9] min-h-screen pb-32 font-sans">
                {/* Header */}
                <div className="bg-white/95 backdrop-blur-xl px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-slate-100/80 shadow-[0_1px_10px_rgba(0,0,0,0.04)] flex items-center justify-between sticky top-0 z-50 md:px-6 md:py-5 md:pt-5">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-all md:bg-slate-50 md:border-0 md:shadow-none">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight">Order Details</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mt-1">ID: #{order._id.slice(-8)}</p>
                        </div>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm", getPaymentStatusColor(order.paymentStatus))}>
                        {order.paymentStatus}
                    </div>
                </div>

                <div className="p-4 space-y-4 max-w-2xl mx-auto">
                    {/* Status Overview Card */}
                    <div className="bg-white rounded-[32px] p-8 text-center border border-white shadow-xl shadow-slate-200/50 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[30px] flex items-center justify-center mx-auto mb-5 border-4 border-white shadow-lg rotate-3">
                                <CheckCircle2 size={40} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight italic">Order {order.orderStatus?.replace(/_/g, ' ')}!</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.15em] mt-2">
                                Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>

                            <div className="flex items-center justify-center gap-3 mt-8">
                                <Button variant="outline" className="flex-1 h-12 rounded-2xl border-slate-100 font-black text-[11px] uppercase tracking-widest gap-2 bg-slate-50/50">
                                    <RotateCcw size={14} /> Reorder
                                </Button>
                                <Button className="flex-1 h-12 rounded-2xl bg-slate-900 font-black text-[11px] uppercase tracking-widest gap-2 shadow-lg shadow-slate-200">
                                    <Star size={14} className="text-yellow-400 fill-yellow-400" /> Review
                                </Button>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50/50 rounded-full blur-3xl -mr-20 -mt-20" />
                    </div>

                    {/* Delivery & Payment Info Split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-[32px] p-6 border border-slate-50 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                    <MapPin size={18} />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Delivery Address</h3>
                            </div>
                            <p className="text-sm font-bold text-slate-800 leading-relaxed pl-11">
                                {order.shippingAddress}
                            </p>
                        </div>

                        <div className="bg-white rounded-[32px] p-6 border border-slate-50 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                                    <ShieldCheck size={18} />
                                </div>
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Payment Info</h3>
                            </div>
                            <div className="flex items-center gap-3 pl-11">
                                <div className="text-slate-800">
                                    {getPaymentIcon(order.paymentMethod)}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 leading-none">{order.paymentMethod}</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">Status: {order.paymentStatus}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="bg-white rounded-[32px] overflow-hidden border border-slate-50 shadow-sm">
                        <div className="px-6 py-5 border-b border-slate-50">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Items Detail</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {order.items?.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-5 hover:bg-slate-50/50 transition-colors">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                                        <img
                                            src={item.image || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=200&q=80'}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=200&q=80' }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">{item.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                            {item.quantity} {item.unit} <span className="mx-1.5 opacity-30 text-slate-300">|</span> ₹{item.price}/{item.unit}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-slate-900 tracking-tight">₹{(item.price * item.quantity).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="bg-white rounded-[32px] p-8 border border-slate-50 shadow-sm space-y-4">
                        <div className="space-y-3 pb-6 border-b border-slate-50 border-dashed">
                            <div className="flex justify-between text-xs font-bold text-slate-400">
                                <span className="uppercase tracking-widest">Item Total</span>
                                <span className="text-slate-800 font-black">₹{(order.subtotal || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span className="uppercase tracking-widest">Delivery Charge</span>
                                <span className={cn("font-black tracking-widest", order.deliveryFee === 0 ? "text-emerald-500 uppercase" : "text-slate-800")}>
                                    {order.deliveryFee === 0 ? "Free" : `₹${order.deliveryFee}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span className="uppercase tracking-widest">GST & Taxes</span>
                                <span className="text-slate-800 font-black">₹{(order.tax || 0).toLocaleString()}</span>
                            </div>
                            {(order.discountAmount > 0) && (
                                <div className="flex justify-between text-xs font-bold text-emerald-600">
                                    <span className="uppercase tracking-widest">Coupon Discount</span>
                                    <span className="font-black">- ₹{order.discountAmount}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1 text-left">Grand Total</h4>
                                <span className="text-2xl font-black text-emerald-600 tracking-tighter">₹{(order.totalAmount || 0).toLocaleString()}</span>
                            </div>
                            {order.discountAmount > 0 && (
                                <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Savings</p>
                                    <p className="text-[11px] font-black text-emerald-600 uppercase">₹{order.discountAmount} SAVED</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-slate-300 py-6">
                        <ShieldCheck size={14} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Payment</span>
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
