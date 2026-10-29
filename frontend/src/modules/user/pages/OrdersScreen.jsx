import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Package, CheckCircle2, Clock, Truck, ChevronRight, Zap, Receipt } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useOrders } from '@/modules/user/contexts/OrderContext'
import DesktopOrders from '../components/orders/DesktopOrders'

export default function OrdersScreen() {
    const navigate = useNavigate()
    const { orders, fetchMyOrders } = useOrders()

    useEffect(() => {
        fetchMyOrders()
    }, [fetchMyOrders])

    const getDisplayStatus = (order) => {
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

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase();
        if (s.startsWith('return_')) {
            if (['return_approved', 'return_picked_up', 'return_completed'].includes(s)) return 'bg-green-50 text-green-600 border-green-100';
            if (['return_requested', 'return_pickup_assigned'].includes(s)) return 'bg-amber-50 text-amber-600 border-amber-100';
            if (s === 'return_rejected') return 'bg-rose-50 text-rose-600 border-rose-100';
        }
        switch (s) {
            case 'received':
            case 'delivered': return 'bg-green-50 text-green-600 border-green-100'
            case 'dispatched':
            case 'out for delivery':
            case 'out_for_delivery':
            case 'in_progress': return 'bg-blue-50 text-blue-600 border-blue-100'
            case 'placed':
            case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100'
            case 'procuring':
            case 'accepted': return 'bg-indigo-50 text-indigo-600 border-indigo-100'
            case 'packed':
            case 'ready': return 'bg-purple-50 text-purple-600 border-purple-100'
            case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100'
            default: return 'bg-slate-50 text-slate-600 border-slate-100'
        }
    }

    const handleOrderClick = (order) => {
        navigate(`/order-detail/${order._id}`)
    }

    return (
        <PageTransition>
            {/* Desktop layout (client mockup, Oct 2026); phones keep the list below */}
            <div className="hidden md:block"><DesktopOrders orders={orders} /></div>
            <div className="md:hidden bg-white min-h-screen pb-24">
                {/* Header */}
                <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-slate-50 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-90 transition-transform"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">My Orders</h1>
                </div>

                <div className="p-4 space-y-4">
                    {orders.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                                <Package size={32} />
                            </div>
                            <h3 className="text-base font-black text-slate-900">No Orders Yet</h3>
                            <button onClick={() => navigate('/home')} className="mt-3 text-primary font-black uppercase text-[10px] tracking-widest">Start Shopping</button>
                        </div>
                    ) : (
                        orders.map((order, idx) => {
                            // Handle both split orders and standalone orders
                            const isSplitOrder = order.isSplitOrder === true;
                            const orderId = isSplitOrder ? order.orderGroupId : order._id;
                            const displayStatus = isSplitOrder ? 
                                (order.allDelivered ? 'delivered' : order.anyInProgress ? 'in_progress' : 'placed') :
                                getDisplayStatus(order);
                            
                            // For split orders, get items from first order in the group
                            const firstOrder = isSplitOrder ? order.orders?.[0] : order;
                            const totalItems = isSplitOrder ? 
                                order.orders?.reduce((sum, o) => sum + (o.items?.length || 0), 0) : 
                                order.items?.length || 0;
                            const totalAmount = isSplitOrder ? order.grandTotal : order.totalAmount;
                            const createdAt = isSplitOrder ? order.createdAt : order.createdAt;

                            return (
                                <motion.div
                                    key={orderId || idx}
                                    onClick={() => {
                                        if (isSplitOrder) {
                                            // Navigate to split order tracking page
                                            navigate(`/split-order/${order.orderGroupId}`);
                                        } else {
                                            handleOrderClick(order);
                                        }
                                    }}
                                    className="p-4 rounded-[28px] bg-white border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:shadow-md mb-2"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-50 overflow-hidden border border-slate-50 shrink-0">
                                                <img
                                                    src={firstOrder?.items?.[0]?.image || firstOrder?.items?.[0]?.productId?.image || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=100&q=80'}
                                                    alt="order"
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col min-w-0 overflow-hidden">
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5 leading-none">
                                                    #{(orderId || '').toString().slice(-8).toUpperCase()}
                                                </span>
                                                <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight uppercase truncate">
                                                    {isSplitOrder && (
                                                        <span className="text-primary mr-1">🛒</span>
                                                    )}
                                                    {totalItems} {totalItems === 1 ? 'Product' : 'Products'}
                                                    {isSplitOrder && (
                                                        <span className="text-[10px] text-slate-400 ml-1">• {order.totalOrders} deliveries</span>
                                                    )}
                                                </h3>
                                                <div className="text-[10px] font-bold text-slate-400 capitalize mt-1.5 flex items-center gap-1.5 leading-none">
                                                    <Clock size={10} className="text-slate-300" />
                                                    Ordered {new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </div>
                                                {order.scheduledDate && (
                                                    <div className="text-[10px] font-black text-emerald-600 uppercase mt-1.5 flex items-center gap-1.5 leading-none">
                                                        <Zap size={10} className="fill-emerald-600 text-emerald-600" />
                                                        Delivering {new Date(order.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={cn("rounded-lg border-[0.5px] font-black text-[10px] py-1 px-2.5 flex items-center gap-1.5 shrink-0 bg-opacity-40 mt-0.5", getStatusColor(displayStatus))}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                            <span className="uppercase tracking-[0.15em]">{displayStatus?.replace(/_/g, ' ')}</span>
                                        </Badge>
                                    </div>

                                    <div className="flex items-center bg-slate-50/70 p-3 rounded-2xl border border-slate-50 gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 opacity-80">Final Payable</p>
                                            <div className="text-base font-black text-slate-900 tracking-tighter italic">₹{(totalAmount || 0).toLocaleString()}</div>
                                        </div>
                                        <div className="h-8 w-[1px] bg-slate-200/50" />
                                        <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-[0.2em] shrink-0 pl-1">
                                            {isSplitOrder ? 'Track All' : 'Details'} <ChevronRight size={14} strokeWidth={4} />
                                        </div>
                                    </div>

                                    {/* Split Order Status Indicators */}
                                    {isSplitOrder && order.orders && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                                            {order.orders.slice(0, 3).map((subOrder, subIdx) => (
                                                <div key={subOrder._id || subIdx} className="flex items-center gap-2 text-[10px]">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", 
                                                        ['Delivered', 'Received'].includes(subOrder.orderStatus) ? 'bg-green-500' :
                                                        ['Out for Delivery', 'Dispatched'].includes(subOrder.orderStatus) ? 'bg-blue-500' :
                                                        ['Packed', 'Ready'].includes(subOrder.orderStatus) ? 'bg-purple-500' :
                                                        'bg-amber-500'
                                                    )} />
                                                    <span className="font-bold text-slate-600">Order {subIdx + 1}:</span>
                                                    <span className="font-black text-slate-900">{subOrder.orderStatus}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </div>
        </PageTransition>
    )
}
