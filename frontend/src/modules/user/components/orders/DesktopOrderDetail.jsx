import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Box, CalendarDays, Check, Clock, Copy, CreditCard, Headphones, Home, MapPin, Package, RotateCcw, ShoppingCart, Truck, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import DeliveryCodeCard from '../common/DeliveryCodeCard'
import { DETAIL_STEPS, fmtTime, money, progressOf, shortId, statusTone, statusText } from './orderProgress'

/*
 * Desktop order details (client mockup, Oct 2026): progress across the top, track button, delivery
 * facts, items and price details. Phones keep the layout in OrderDetailScreen.
 */

const STEP_ICONS = { placed: ShoppingCart, accepted: Check, procuring: Box, packed: Package, out: Truck, delivered: Home }

const dayMonth = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

export default function DesktopOrderDetail({ order, isOrderActive, onReorder }) {
    const navigate = useNavigate()
    const steps = progressOf(order, DETAIL_STEPS)
    const [title] = statusText(order)
    const subtotal = Number(order.subtotal) || 0
    const fee = Number(order.deliveryFee) || 0
    const tax = Number(order.tax) || 0
    const discount = Number(order.discount || order.discountAmount) || 0
    const taxRate = subtotal + fee > 0 ? Math.round((tax / (subtotal + fee)) * 100) : 0
    const deliveryDay = order.scheduledDate || order.createdAt
    const copy = () => navigator.clipboard?.writeText(shortId(order._id)).then(() => toast.success('Order ID copied')).catch(() => {})

    const facts = [
        { Icon: MapPin, tone: 'bg-green-50 text-green-700', label: 'Delivery Address', value: order.shippingAddress || 'Saved location' },
        { Icon: Clock, tone: 'bg-green-50 text-green-700', label: 'Delivery Slot', value: order.deliveryShift || 'Standard' },
        { Icon: CalendarDays, tone: 'bg-green-50 text-green-700', label: 'Delivery Date', value: new Date(deliveryDay).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) },
        { Icon: CreditCard, tone: 'bg-orange-50 text-orange-500', label: 'Payment Method', value: order.paymentMethod || '—' },
    ]

    return (
        <div className="bg-slate-50 min-h-screen pb-16">
            <div className="max-w-[1440px] mx-auto px-8 pt-1 space-y-4">
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <span className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center"><Package size={28} /></span>
                            <div>
                                <h1 className="text-[32px] font-bold text-slate-900 leading-tight">Order Details</h1>
                                <p className="flex items-center gap-2 text-[17px] text-slate-600">
                                    Reference: #{shortId(order._id)}
                                    <button type="button" aria-label="Copy order ID" onClick={copy} className="text-slate-400 hover:text-green-700"><Copy size={17} /></button>
                                </p>
                            </div>
                        </div>
                        <span className={cn('inline-flex items-center gap-3 px-5 py-3 rounded-2xl border', statusTone(order.orderStatus))}>
                            <Box size={28} />
                            <span className="leading-tight">
                                <span className="block text-[20px] font-bold">{order.orderStatus === 'Cancelled' ? 'Cancelled' : title}</span>
                                <span className="block text-[14px] text-slate-600">Order placed on {dayMonth(order.createdAt)}</span>
                            </span>
                        </span>
                    </div>

                    {order.orderStatus !== 'Cancelled' && (
                        <div className="mt-6 rounded-2xl bg-green-50/60 px-4 py-5 flex">
                            {steps.map((s, i) => {
                                const Icon = STEP_ICONS[s.key]
                                return (
                                    <div key={s.key} className="relative flex-1 flex flex-col items-center text-center">
                                        {i < steps.length - 1 && (
                                            <span className={cn('absolute top-[22px] left-1/2 w-full', s.done ? 'h-[3px] bg-green-600' : 'border-t-2 border-dashed border-slate-300')} />
                                        )}
                                        <span className={cn('relative z-10 w-11 h-11 rounded-full flex items-center justify-center',
                                            s.done ? 'bg-green-600 text-white' : s.current ? 'bg-violet-600 text-white ring-4 ring-violet-100' : 'bg-slate-200 text-slate-500')}>
                                            {s.done ? <Check size={22} strokeWidth={3} /> : <Icon size={20} />}
                                        </span>
                                        <span className={cn('mt-2.5 text-[17px] font-semibold', s.done || s.current ? 'text-slate-900' : 'text-slate-500')}>{s.label}</span>
                                        <span className="text-[14px] text-slate-500">
                                            {s.done && s.time ? `${dayMonth(s.time)}, ${fmtTime(s.time)}` : s.current ? s.note : ''}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {isOrderActive && (
                        <button type="button" onClick={() => navigate(`/track-order/${order._id}`)}
                            className="mt-4 w-full h-[72px] px-6 rounded-2xl bg-green-700 hover:bg-green-800 text-white flex items-center gap-4 text-left transition-colors">
                            <Truck size={30} />
                            <span className="flex-1 leading-tight">
                                <span className="block text-[20px] font-bold">Track Order</span>
                                <span className="block text-[15px] text-green-100">Live tracking and updates</span>
                            </span>
                            <ArrowRight size={24} />
                        </button>
                    )}
                </section>

                <DeliveryCodeCard order={order} />

                <div className="grid grid-cols-4 gap-4">
                    {facts.map(({ Icon, tone, label, value }) => (
                        <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 min-w-0">
                            <span className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', tone)}><Icon size={26} /></span>
                            <span className="min-w-0">
                                <span className="block text-[17px] font-bold text-slate-900">{label}</span>
                                <span className="block text-[16px] text-slate-700 line-clamp-2" title={value}>{value}</span>
                            </span>
                        </div>
                    ))}
                </div>

                <section>
                    <h2 className="text-[20px] font-bold text-slate-900 mb-2">Items ({order.items?.length || 0})</h2>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                        {(order.items || []).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-5 px-6 py-4">
                                <img src={item.image || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=200&q=70'} alt={item.name} className="w-20 h-20 rounded-xl object-cover bg-slate-50 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[20px] font-bold text-slate-900">{item.name}</p>
                                    <p className="text-[16px] text-slate-600">{item.quantity} {item.unit} × {money(item.price, 0)}</p>
                                </div>
                                <p className="text-[20px] font-bold text-slate-900 tabular-nums">{money((Number(item.price) || 0) * (Number(item.quantity) || 0), 0)}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-[20px] font-bold text-slate-900">Price Details</h2>
                    <div className="mt-3 space-y-2.5 text-[17px] text-slate-700">
                        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(subtotal, 0)}</span></div>
                        <div className="flex justify-between"><span>Taxes &amp; Charges{taxRate ? ` (${taxRate}%)` : ''}</span><span className="tabular-nums">{money(tax, 0)}</span></div>
                        <div className="flex justify-between"><span>Delivery Fee</span>{fee === 0 ? <span className="font-bold text-green-700">FREE</span> : <span className="tabular-nums">{money(fee, 0)}</span>}</div>
                        {discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="text-green-700 tabular-nums">−{money(discount, 0)}</span></div>}
                    </div>
                    <div className="mt-4 rounded-xl bg-green-50 px-5 py-4 flex justify-between items-center">
                        <span className="text-[22px] font-bold text-slate-900">Grand Total</span>
                        <span className="text-[28px] font-bold text-green-700 tabular-nums">{money(order.totalAmount, 0)}</span>
                    </div>
                </section>

                <div className="flex gap-4">
                    <button type="button" onClick={onReorder}
                        className="flex-1 h-14 rounded-2xl border border-slate-300 bg-white text-[18px] font-semibold text-slate-900 inline-flex items-center justify-center gap-3 hover:bg-slate-50">
                        <RotateCcw size={20} /> Order Again
                    </button>
                    <button type="button" onClick={() => navigate('/help-support')}
                        className="h-14 px-8 rounded-2xl border border-slate-300 bg-white text-[18px] font-semibold text-slate-900 inline-flex items-center gap-3 hover:bg-slate-50">
                        <Headphones size={20} /> Need help?
                    </button>
                </div>
            </div>
        </div>
    )
}
