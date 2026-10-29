import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Box, CalendarDays, Check, CheckCircle2, Copy, Headphones, List, Package, RotateCcw, Truck, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '../../contexts/CartContext'
import { fmtDate, fmtTime, isToday, listSteps, money, progressOf, shortId, statusLabel, statusTone } from './orderProgress'

/*
 * Desktop "My Orders" (client mockup, Oct 2026): filter tabs, sort, and one wide card per order with
 * its progress. Phones keep the list in OrdersScreen.
 */

const lower = (s) => String(s || '').toLowerCase()
const groupOf = (status) => {
    const s = lower(status)
    if (['delivered', 'received'].includes(s)) return 'delivered'
    if (s === 'cancelled') return 'cancelled'
    return 'progress'
}

// A split checkout is shown as one card, using its first delivery for progress
const view = (order) => {
    if (!order.isSplitOrder) return { ...order, key: order._id, ref: order._id, link: `/order-detail/${order._id}`, total: order.totalAmount, items: order.items || [] }
    const first = order.orders?.[0] || {}
    const status = order.allDelivered ? 'Delivered' : first.orderStatus
    return {
        ...first, orderStatus: status, key: order.orderGroupId, ref: order.orderGroupId, link: `/split-order/${order.orderGroupId}`,
        total: order.grandTotal, createdAt: order.createdAt, items: (order.orders || []).flatMap((o) => o.items || []),
    }
}

const BADGE_ICON = { 'Out for delivery': Truck, 'Being prepared': Box, Packed: Package, Delivered: CheckCircle2, Cancelled: XCircle, Placed: Clock }

function Step({ step, last }) {
    return (
        <div className="relative flex-1 flex flex-col items-center text-center min-w-0">
            {!last && <span className={cn('absolute top-[17px] left-1/2 w-full h-[3px]', step.done ? 'bg-green-600' : 'bg-slate-200')} />}
            <span className={cn('relative z-10 w-9 h-9 rounded-full flex items-center justify-center',
                step.done ? 'bg-green-600 text-white' : step.current ? 'bg-white border-[3px] border-green-600' : 'bg-white border-2 border-slate-300 text-slate-400')}>
                {step.done ? <Check size={20} strokeWidth={3} /> : step.current ? <span className="w-3.5 h-3.5 rounded-full bg-green-600" /> : <Truck size={16} />}
            </span>
            <span className={cn('mt-2 text-[15px] font-semibold leading-tight', step.done || step.current ? 'text-slate-900' : 'text-slate-500')}>{step.label}</span>
            <span className="text-[13px] text-slate-500 mt-0.5">
                {step.done && step.time ? fmtTime(step.time) : step.current ? (step.key === 'out' ? 'On the way' : 'In progress') : ''}
            </span>
        </div>
    )
}

export default function DesktopOrders({ orders }) {
    const navigate = useNavigate()
    const [tab, setTab] = useState('all')
    const [sort, setSort] = useState('latest')

    const all = useMemo(() => orders.map(view), [orders])
    const counts = useMemo(() => {
        const c = { all: all.length, progress: 0, delivered: 0, cancelled: 0 }
        all.forEach((o) => { c[groupOf(o.orderStatus)] += 1 })
        return c
    }, [all])

    const shown = all
        .filter((o) => tab === 'all' || groupOf(o.orderStatus) === tab)
        .sort((a, b) => {
            if (sort === 'amount') return (b.total || 0) - (a.total || 0)
            const d = new Date(b.createdAt) - new Date(a.createdAt)
            return sort === 'oldest' ? -d : d
        })

    const TABS = [
        { id: 'all', label: 'All Orders', Icon: List },
        { id: 'progress', label: 'In Progress', Icon: Clock },
        { id: 'delivered', label: 'Delivered', Icon: CheckCircle2 },
        { id: 'cancelled', label: 'Cancelled', Icon: XCircle },
    ]

    // Same as "Order Again" on the order page: put the items back in the cart
    const { addToCart } = useCart()
    const reorder = (o) => toast.promise(
        Promise.all(o.items.map((item) => addToCart({ _id: item.productId?._id || item.productId, ...item }, item.quantity))),
        { loading: 'Adding items to cart...', success: () => { navigate('/cart'); return 'Items added to your cart' }, error: 'Could not add the items' },
    )

    const copy = (text) => { navigator.clipboard?.writeText(text).then(() => toast.success('Order ID copied')).catch(() => {}) }

    return (
        <div className="bg-slate-50 min-h-screen pb-16">
            <div className="max-w-[1440px] mx-auto px-8 pt-1">
                <h1 className="text-[40px] font-bold text-slate-900 tracking-tight">My Orders</h1>
                <p className="text-[18px] text-slate-600">Track, view or reorder your past and current orders</p>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-3">
                        {TABS.map(({ id, label, Icon }) => (
                            <button key={id} type="button" onClick={() => setTab(id)}
                                className={cn('inline-flex items-center gap-2.5 h-[52px] px-6 rounded-2xl text-[17px] font-semibold border transition-colors',
                                    tab === id ? 'bg-green-700 border-green-700 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50')}>
                                <Icon size={20} /> {label} ({counts[id]})
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-3 text-[16px] text-slate-600">
                        Sort by
                        <select value={sort} onChange={(e) => setSort(e.target.value)}
                            className="h-[52px] pl-4 pr-10 rounded-2xl border border-slate-200 bg-white text-[16px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-200">
                            <option value="latest">Latest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="amount">Highest Amount</option>
                        </select>
                    </label>
                </div>

                <div className="mt-6 space-y-4">
                    {shown.length === 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center">
                            <Package size={44} className="mx-auto text-slate-300" />
                            <p className="mt-4 text-[22px] font-bold text-slate-900">{all.length ? 'No orders here' : 'No orders yet'}</p>
                            <button type="button" onClick={() => navigate('/home')} className="mt-4 h-12 px-6 rounded-xl bg-green-700 text-white text-[17px] font-bold">Start Shopping</button>
                        </div>
                    )}
                    {shown.map((o) => {
                        const steps = progressOf(o, listSteps(o))
                        const label = statusLabel(o.orderStatus)
                        const BadgeIcon = BADGE_ICON[label] || Clock
                        const delivered = groupOf(o.orderStatus) === 'delivered'
                        // Delivered orders show when they were actually delivered
                        const deliveredAt = delivered && [...(o.statusHistory || [])].reverse().find((h) => ['delivered', 'received'].includes(String(h.status).toLowerCase()))?.updatedAt
                        const deliveryDay = deliveredAt || o.scheduledDate || o.createdAt
                        const names = [...new Set(o.items.map((i) => i.name).filter(Boolean))]
                        return (
                            <div key={o.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 grid grid-cols-[140px_minmax(0,1.3fr)_minmax(0,1.3fr)_175px_250px] gap-5 items-center">
                                <button type="button" onClick={() => navigate(o.link)} className="w-[140px] h-[120px] rounded-xl overflow-hidden bg-slate-100">
                                    <img src={o.items[0]?.image || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=300&q=70'} alt="" className="w-full h-full object-cover" />
                                </button>
                                <div className="min-w-0 space-y-2">
                                    <p className="flex items-center gap-2 text-[18px]">
                                        <span className="font-bold text-slate-900">Order ID</span>
                                        <span className="text-slate-600">#{shortId(o.ref)}</span>
                                        <button type="button" aria-label="Copy order ID" onClick={() => copy(shortId(o.ref))} className="text-slate-400 hover:text-green-700"><Copy size={17} /></button>
                                    </p>
                                    <p className="flex items-center gap-2 text-[15px] text-slate-600 whitespace-nowrap">
                                        <CalendarDays size={17} /> Ordered on <span className="font-medium text-slate-800">{fmtDate(o.createdAt)} • {fmtTime(o.createdAt)}</span>
                                    </p>
                                    <p className="flex items-center gap-2 text-[15px] text-slate-600 whitespace-nowrap">
                                        <Truck size={17} /> {delivered ? 'Delivered on' : 'Delivery'}
                                        <span className="font-semibold text-green-700">
                                            {isToday(deliveryDay) ? `Today, ${fmtDate(deliveryDay, { month: 'short', day: 'numeric' })}` : fmtDate(deliveryDay, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            {o.deliveryShift ? ` • ${o.deliveryShift}` : ''}
                                        </span>
                                    </p>
                                    <span className="inline-flex max-w-full items-center h-8 px-3 rounded-lg bg-green-50 text-green-800 text-[14px] font-medium">
                                        <span className="truncate">{o.items.length} {o.items.length === 1 ? 'item' : 'items'}{names.length ? ` • ${names.slice(0, 3).join(', ')}` : ''}</span>
                                    </span>
                                </div>
                                <div className="flex items-start">
                                    {o.orderStatus === 'Cancelled'
                                        ? <p className="text-[16px] text-red-600 font-semibold">This order was cancelled.</p>
                                        : steps.map((s, i) => <Step key={s.key} step={s} last={i === steps.length - 1} />)}
                                </div>
                                <div className="border-l border-slate-200 pl-6">
                                    <p className="text-[16px] text-slate-600">Total Payable</p>
                                    <p className="text-[28px] font-bold text-slate-900 tabular-nums">{money(o.total)}</p>
                                </div>
                                <div className="flex flex-col items-stretch gap-2.5">
                                    <span className={cn('self-end inline-flex items-center gap-2 h-10 px-4 rounded-xl border text-[15px] font-semibold', statusTone(o.orderStatus))}>
                                        <BadgeIcon size={18} /> {label}
                                    </span>
                                    <div className="flex gap-2">
                                        {delivered && (
                                            <button type="button" onClick={() => reorder(o)} className="whitespace-nowrap h-12 px-3 rounded-xl border border-green-700 text-green-700 text-[15px] font-semibold inline-flex items-center gap-1.5 hover:bg-green-50">
                                                <RotateCcw size={17} /> Reorder
                                            </button>
                                        )}
                                        <button type="button" onClick={() => navigate(o.link)} className="flex-1 whitespace-nowrap h-12 px-3 rounded-xl bg-green-700 hover:bg-green-800 text-white text-[16px] font-bold inline-flex items-center justify-center gap-2">
                                            View details <ArrowRight size={18} />
                                        </button>
                                    </div>
                                    <button type="button" onClick={() => navigate('/help-support')} className="self-center inline-flex items-center gap-2 text-[15px] font-medium text-slate-700 hover:text-green-700">
                                        <Headphones size={17} /> Need help?
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
