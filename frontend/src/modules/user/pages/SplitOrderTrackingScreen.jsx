import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Package, MapPin, Phone, Truck, CheckCircle2, Clock, Store } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/axios'
import { toast } from 'sonner'

export default function SplitOrderTrackingScreen() {
    const navigate = useNavigate()
    const { orderGroupId } = useParams()
    const [loading, setLoading] = useState(true)
    const [groupDetails, setGroupDetails] = useState(null)

    const fetchSplitOrderDetails = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/orders/group/${orderGroupId}`)
            setGroupDetails(response.data.result)
        } catch (error) {
            console.error('Error fetching split order details:', error)
            toast.error('Failed to load order details')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (orderGroupId) {
            fetchSplitOrderDetails()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderGroupId])

    const getStatusColor = (status) => {
        const s = (status || '').toLowerCase()
        switch (s) {
            case 'received':
            case 'delivered': return 'bg-green-50 text-green-600 border-green-100'
            case 'dispatched':
            case 'out for delivery': return 'bg-blue-50 text-blue-600 border-blue-100'
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

    const getStatusIcon = (status) => {
        const s = (status || '').toLowerCase()
        if (['delivered', 'received'].includes(s)) return <CheckCircle2 size={16} className="text-green-600" />
        if (['out for delivery', 'dispatched'].includes(s)) return <Truck size={16} className="text-blue-600" />
        if (['packed', 'ready'].includes(s)) return <Package size={16} className="text-purple-600" />
        return <Clock size={16} className="text-amber-600" />
    }

    if (loading) {
        return (
            <PageTransition>
                <div className="bg-white min-h-screen">
                    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-slate-50 flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-600">
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-lg font-black text-slate-900">Split Order</h1>
                    </div>
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-64 bg-slate-50 rounded-[28px] animate-pulse" />
                        ))}
                    </div>
                </div>
            </PageTransition>
        )
    }

    if (!groupDetails) {
        return (
            <PageTransition>
                <div className="bg-white min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <Package size={48} className="text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-slate-900">Order Not Found</h3>
                        <button onClick={() => navigate('/orders')} className="mt-4 text-primary font-black text-sm">
                            View All Orders
                        </button>
                    </div>
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
            <div className="bg-white min-h-screen pb-24">
                {/* Header */}
                <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-slate-50">
                    <div className="flex items-center gap-3 mb-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-90 transition-transform"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight">Split Order Tracking</h1>
                    </div>
                    
                    {/* Order Summary */}
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/10">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Group</span>
                            <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                                #{groupDetails.orderGroupId.slice(-8).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-black text-slate-900 tracking-tighter">
                                    ₹{groupDetails.grandTotal.toLocaleString()}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                    {groupDetails.totalOrders} separate deliveries
                                </div>
                            </div>
                            <Badge variant="outline" className={cn("rounded-lg font-black text-[8px] py-1.5 px-3", 
                                groupDetails.allDelivered ? 'bg-green-50 text-green-600 border-green-100' :
                                groupDetails.anyInProgress ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                            )}>
                                {groupDetails.allDelivered ? '✅ ALL DELIVERED' : 
                                 groupDetails.anyInProgress ? '🚚 IN PROGRESS' : '📦 PLACED'}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Individual Orders */}
                <div className="p-4 space-y-4">
                    {groupDetails.orders.map((order, index) => (
                        <motion.div
                            key={order._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-white border border-slate-100 rounded-[28px] p-4 shadow-sm"
                        >
                            {/* Order Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-sm font-black text-primary">{index + 1}</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Order {index + 1} of {groupDetails.totalOrders}
                                        </div>
                                        <div className="text-xs font-black text-slate-900">
                                            #{order._id.slice(-6).toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className={cn("rounded-lg font-black text-[8px] py-1 px-2.5 flex items-center gap-1.5", getStatusColor(order.orderStatus))}>
                                    {getStatusIcon(order.orderStatus)}
                                    <span className="uppercase tracking-wider">{order.orderStatus}</span>
                                </Badge>
                            </div>

                            {/* Amount */}
                            <div className="bg-slate-50/70 rounded-2xl p-3 mb-4">
                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</div>
                                <div className="text-xl font-black text-slate-900 tracking-tighter">₹{order.totalAmount.toLocaleString()}</div>
                            </div>

                            {/* Franchise Details */}
                            {order.franchiseId && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Store size={14} className="text-primary" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fulfilled By</span>
                                    </div>
                                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                                        <div className="font-black text-sm text-slate-900 mb-1">
                                            {order.franchiseId.franchiseName || order.franchiseId.storeName}
                                        </div>
                                        {order.franchiseId.storeName && order.franchiseId.franchiseName && (
                                            <div className="text-[10px] font-bold text-slate-500 mb-2">
                                                {order.franchiseId.storeName}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 text-[10px]">
                                            {order.franchiseId.mobile && (
                                                <a href={`tel:${order.franchiseId.mobile}`} className="flex items-center gap-1.5 text-primary font-black">
                                                    <Phone size={10} />
                                                    {order.franchiseId.mobile}
                                                </a>
                                            )}
                                            {order.franchiseId.address && (
                                                <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                                                    <MapPin size={10} />
                                                    <span className="truncate max-w-[150px]">{order.franchiseId.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Delivery Partner */}
                            {order.deliveryPartnerId && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Truck size={14} className="text-blue-600" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Delivery Partner</span>
                                    </div>
                                    <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100">
                                        <div className="font-black text-sm text-slate-900 mb-1">
                                            {order.deliveryPartnerId.fullName}
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px]">
                                            <a href={`tel:${order.deliveryPartnerId.mobile}`} className="flex items-center gap-1.5 text-blue-600 font-black">
                                                <Phone size={10} />
                                                {order.deliveryPartnerId.mobile}
                                            </a>
                                            {order.deliveryPartnerId.vehicleNumber && (
                                                <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                                                    🚗 {order.deliveryPartnerId.vehicleNumber}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Package size={14} className="text-purple-600" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Items</span>
                                </div>
                                <div className="space-y-2">
                                    {order.items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="flex items-center gap-3 bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                                            <div className="w-10 h-10 rounded-lg bg-white overflow-hidden border border-slate-100 shrink-0">
                                                <img
                                                    src={item.image || item.productId?.image || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=100&q=80'}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-black text-slate-900 truncate">{item.name}</div>
                                                <div className="text-[10px] font-bold text-slate-500">
                                                    {item.quantity} {item.unit}
                                                </div>
                                            </div>
                                            <div className="text-xs font-black text-slate-900">
                                                ₹{item.subtotal}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tracking Timeline */}
                            {order.statusHistory && order.statusHistory.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock size={14} className="text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tracking</span>
                                    </div>
                                    <div className="space-y-2">
                                        {order.statusHistory.map((history, histIdx) => (
                                            <div key={histIdx} className="flex items-start gap-3">
                                                <div className="relative">
                                                    <div className={cn("w-2 h-2 rounded-full mt-1.5", 
                                                        histIdx === order.statusHistory.length - 1 ? 'bg-primary' : 'bg-slate-300'
                                                    )} />
                                                    {histIdx < order.statusHistory.length - 1 && (
                                                        <div className="absolute top-3 left-1 w-[1px] h-6 bg-slate-200" />
                                                    )}
                                                </div>
                                                <div className="flex-1 pb-4">
                                                    <div className="text-xs font-black text-slate-900 capitalize">
                                                        {history.status}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                        {new Date(history.updatedAt).toLocaleString('en-IN', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <button
                                onClick={() => navigate(`/order-detail/${order._id}`)}
                                className="w-full mt-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-sm font-black text-slate-900 uppercase tracking-wider transition-colors"
                            >
                                View Full Details
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </PageTransition>
    )
}
