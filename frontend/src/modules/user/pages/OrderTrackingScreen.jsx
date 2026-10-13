import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Package, Truck, CheckCircle2, ShoppingBag, Zap, ClipboardList, ShieldCheck, Radio } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { useOrders } from '@/modules/user/contexts/OrderContext'
import { joinOrderRoom } from '@/lib/socket'

const stepMappings = [
    { label: 'Placed', matchStatuses: ['placed', 'pending'], icon: ShoppingBag, desc: 'We have received your order.' },
    { label: 'Accepted', matchStatuses: ['assigned', 'accepted', 'procuring'], icon: ClipboardList, desc: 'The store has accepted your order.' },
    { label: 'Packed', matchStatuses: ['packed', 'ready'], icon: Zap, desc: 'Your order has been packed.' },
    { label: 'Dispatched', matchStatuses: ['dispatched', 'out for delivery'], icon: Truck, desc: 'Your order is on the way.' },
    { label: 'Delivered', matchStatuses: ['delivered'], icon: Package, desc: 'Delivered at your address.' },
    { label: 'Received', matchStatuses: ['received'], icon: CheckCircle2, desc: 'Order complete. Thank you!' }
]

export default function OrderTrackingScreen() {
    const navigate = useNavigate()
    const { id } = useParams()
    const location = useLocation()
    const { orders, updateOrderStatus, getOrderById, syncOrderById, fetchMyOrders } = useOrders()
    const [isUpdating, setIsUpdating] = useState(false)
    const [orderDetails, setOrderDetails] = useState(null)
    const [isLive, setIsLive] = useState(true)
    const pollingRef = useRef(null)

    const handleBack = () => {
        navigate('/home', { replace: true })
    }

    const orderFromContext = useMemo(() => orders.find((item) => item._id === id), [orders, id])
    const order = orderFromContext || orderDetails

    // Explicitly join the socket room for this order on page mount
    useEffect(() => {
        if (!id) return
        joinOrderRoom(id)
    }, [id])

    // Load order data on mount
    useEffect(() => {
        let isMounted = true

        const loadOrder = async () => {
            if (!id) return
            
            // If context is empty (e.g. after login), fetch orders first
            if (orders.length === 0) {
                await fetchMyOrders();
            }

            if (orderFromContext) {
                setOrderDetails(orderFromContext)
                return
            }
            const freshOrder = await getOrderById(id)
            if (isMounted && freshOrder) {
                setOrderDetails(freshOrder)
            }
        }

        loadOrder()
        return () => { isMounted = false }
    }, [getOrderById, id, orderFromContext])

    // 30-second polling while user is actively on this page
    useEffect(() => {
        if (!id) return

        pollingRef.current = setInterval(async () => {
            await syncOrderById(id)
            setIsLive(true)
        }, 30000)

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
        }
    }, [id, syncOrderById])

    const handleMarkDelivered = () => {
        setIsUpdating(true)
        setTimeout(() => {
            updateOrderStatus(id, 'Delivered')
            setIsUpdating(false)
        }, 1500)
    }

    const handleConfirmReceived = async () => {
        setIsUpdating(true)
        try {
            await updateOrderStatus(id, 'Received')
            navigate(`/order-summary/${id}`)
        } finally {
            setIsUpdating(false)
        }
    }

    if (!order) {
        return (
            <PageTransition>
                <div className="bg-[#f8fafc] min-h-screen flex items-center justify-center p-6">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <h2 className="text-lg font-black text-slate-900">Loading Order</h2>
                        <p className="text-sm text-slate-400 mt-2">Fetching the latest order status...</p>
                    </div>
                </div>
            </PageTransition>
        )
    }

    const isTerminal = ['delivered', 'received', 'cancelled'].includes((order.orderStatus || '').toLowerCase())

    return (
        <PageTransition>
            <div className="bg-[#f8fafc] min-h-screen pb-32">
                {/* Header */}
                <div className="bg-white/90 backdrop-blur-xl px-4 py-2 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-slate-100/80 sticky top-0 z-40 flex items-center justify-between">
                    <div className="flex items-center gap-3 py-1">
                        <button onClick={handleBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 active:scale-95 transition-transform">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none mb-1">Track Order</h1>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] leading-none">Order #{order._id.slice(-8).toUpperCase()}</p>
                        </div>
                    </div>

                    {/* Live Indicator */}
                    {!isTerminal && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Live</span>
                        </div>
                    )}
                </div>

                <div className="p-4 space-y-4">
                    {/* Status Overview */}
                    <div className="bg-slate-900 rounded-[24px] p-6 text-center relative overflow-hidden shadow-xl shadow-slate-200">
                        <div className="relative z-10">
                            <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                                className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4 border border-primary/20 shadow-inner shadow-primary/10"
                            >
                                <Truck size={28} strokeWidth={2.5} />
                            </motion.div>
                            <h2 className="text-xl font-black text-white leading-tight uppercase tracking-tight italic">
                                {order.orderStatus?.replace(/_/g, ' ') || 'Updating...'}
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.25em] mt-2">
                                {isTerminal ? 'Order Completed' : 'Live tracking · updates every 30 seconds'}
                            </p>
                        </div>
                        {/* Background blur elements */}
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                            <div className="absolute top-[-40%] right-[-10%] w-48 h-48 bg-primary rounded-full blur-[80px]" />
                            <div className="absolute bottom-[-40%] left-[-10%] w-48 h-48 bg-emerald-700 rounded-full blur-[80px]" />
                        </div>
                    </div>

                    {/* Timeline Log */}
                    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
                        <div className="space-y-6 relative">
                            <div className="absolute left-[17.5px] top-4 bottom-4 w-[1px] bg-slate-100" />
                            {stepMappings.map((step, i) => {
                                const currentStatus = (order.orderStatus || '').toLowerCase()
                                const currentIndex = stepMappings.findIndex(s => s.matchStatuses.includes(currentStatus))
                                
                                const orderStatusHistory = order.statusHistory || []
                                // Find the latest history entry that matches this step's statuses
                                const historyEntry = orderStatusHistory.slice().reverse().find(h => 
                                    step.matchStatuses.includes((h.status || '').toLowerCase())
                                )
                                
                                // A step is completed if it has a history entry OR if the current overarching order state index is past this step
                                const isCompleted = !!historyEntry || (currentIndex > -1 && i < currentIndex)
                                const isCurrent = currentIndex === i
                                
                                const time = historyEntry
                                    ? new Date(historyEntry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : '--:--'

                                return (
                                    <div key={i} className="flex items-start gap-4 p-0.5 relative z-10">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-4 border-white shadow-sm ring-1 ring-slate-100 shrink-0 ${
                                            isCompleted ? 'bg-primary text-white shadow-primary/20' :
                                            isCurrent ? 'bg-orange-500 text-white shadow-orange-200 animate-pulse' :
                                            'bg-slate-50 text-slate-300'
                                        }`}>
                                            <step.icon size={16} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex justify-between items-center gap-2 mb-1">
                                                <h3 className={`text-[11px] font-black uppercase tracking-tight ${!isCompleted && !isCurrent ? 'text-slate-300' : 'text-slate-900'}`}>
                                                    {step.label}
                                                    {isCurrent && <span className="ml-1.5 text-[10px] font-black text-orange-500 uppercase tracking-wider">Current</span>}
                                                </h3>
                                                <span className="text-[10px] font-black text-slate-400 tabular-nums">{time}</span>
                                            </div>
                                            <p className={`text-[10px] leading-relaxed ${!isCompleted && !isCurrent ? 'text-slate-200' : 'text-slate-500'} font-medium`}>
                                                {step.desc}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Confirm Received CTA */}
                    {order.orderStatus === 'Delivered' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2 pb-6">
                            <div className="p-5 rounded-[28px] bg-emerald-50 border border-emerald-100 shadow-sm relative overflow-hidden">
                                <div className="flex items-center gap-3.5 mb-4 relative z-10">
                                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
                                        <ShieldCheck size={20} strokeWidth={3} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-[14px] font-black text-emerald-900 tracking-tight leading-none mb-1.5 uppercase">Confirm Delivery</h4>
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Confirm receipt of your order</p>
                                    </div>
                                </div>

                                <p className="text-[11px] font-bold text-emerald-800/70 leading-relaxed mb-6 relative z-10">
                                    Your order has arrived. Please confirm receipt after verifying quantity and quality of all items.
                                </p>

                                <Button
                                    onClick={handleConfirmReceived}
                                    disabled={isUpdating}
                                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-100 relative z-10"
                                >
                                    {isUpdating ? 'Confirming...' : 'Confirm Received'}
                                </Button>

                                <CheckCircle2 className="absolute -bottom-6 -right-6 w-32 h-32 text-emerald-500/5 rotate-12" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    )
}
