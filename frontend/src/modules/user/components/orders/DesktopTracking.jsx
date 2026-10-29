import { toast } from 'sonner'
import { Check, CheckCircle2, Copy, FileText, Home, Leaf, Package, ShieldCheck, ShoppingBasket, Store, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import DeliveryCodeCard from '../common/DeliveryCodeCard'
import { TRACK_STEPS, progressOf, shortId, statusText } from './orderProgress'

/*
 * Desktop track order (client mockup, Oct 2026): status banner and the full timeline. Phones keep the
 * layout in OrderTrackingScreen, which also does the loading, polling and "confirm received".
 */

const STEP_ICONS = { placed: FileText, accepted: Store, packed: ShoppingBasket, dispatched: Truck, delivered: Home, received: CheckCircle2 }
const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).replace(' am', ' AM').replace(' pm', ' PM') : '')

export default function DesktopTracking({ order, isTerminal, isUpdating, onConfirmReceived }) {
    const steps = progressOf(order, TRACK_STEPS)
    const [title, sub] = statusText(order)
    const reached = steps.filter((s) => s.done || s.current).length
    const copy = () => navigator.clipboard?.writeText(shortId(order._id)).then(() => toast.success('Order ID copied')).catch(() => {})

    return (
        <div className="bg-slate-50 min-h-screen pb-16">
            <div className="max-w-[1440px] mx-auto px-8 pt-1 space-y-5">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-[36px] font-bold text-slate-900 leading-tight">Track Order</h1>
                        <p className="flex items-center gap-2 text-[20px] font-semibold text-slate-800">
                            Order #{shortId(order._id)}
                            <button type="button" aria-label="Copy order ID" onClick={copy} className="text-slate-400 hover:text-green-700"><Copy size={18} /></button>
                        </p>
                    </div>
                    {!isTerminal && (
                        <span className="inline-flex items-center gap-2.5 h-11 px-5 rounded-full bg-green-100 text-green-800 text-[17px] font-bold">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600" />
                            </span>
                            Live
                        </span>
                    )}
                </div>

                <section className="relative overflow-hidden rounded-2xl bg-[#0f2a1d] text-white min-h-[150px] flex items-center">
                    <img src="/home-hero.jpg" alt="" className="absolute left-0 top-0 h-full w-[34%] object-cover opacity-90" />
                    <div className="absolute left-[20%] top-0 h-full w-[18%] bg-gradient-to-r from-transparent to-[#0f2a1d]" />
                    <div className="relative z-10 ml-[38%] flex items-center gap-5 py-6">
                        <span className="w-20 h-20 rounded-2xl bg-green-600 flex items-center justify-center shrink-0"><Truck size={40} /></span>
                        <div>
                            <h2 className="text-[34px] font-bold leading-tight">{title}</h2>
                            {sub && <p className="text-[18px] text-green-50/90">{sub}</p>}
                            <div className="mt-3 flex gap-2">
                                {[0, 1, 2].map((i) => <span key={i} className={cn('h-1.5 rounded-full', i < Math.ceil((reached / steps.length) * 3) ? 'w-8 bg-green-400' : 'w-6 bg-white/25')} />)}
                            </div>
                        </div>
                    </div>
                    <div className="relative z-10 ml-auto mr-8 hidden xl:flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 px-6 py-5">
                        <ShoppingBasket size={36} className="text-green-400" />
                        <p className="text-[17px] leading-snug">We are carefully picking<br />fresh items for you <Leaf size={16} className="inline text-green-400" /></p>
                    </div>
                </section>

                <DeliveryCodeCard order={order} />

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-3">
                    {steps.map((s, i) => {
                        const Icon = STEP_ICONS[s.key] || Package
                        return (
                            <div key={s.key} className={cn('relative flex items-center gap-5 py-4 px-3 -mx-3', s.current && 'bg-green-50/70 rounded-2xl', i < steps.length - 1 && !s.current && 'border-b border-slate-100')}>
                                <span className="relative w-8 flex justify-center self-stretch">
                                    {i < steps.length - 1 && <span className={cn('absolute top-1/2 h-[calc(100%+2rem)] w-0', s.done ? 'border-l-2 border-green-600' : 'border-l-2 border-dashed border-slate-300')} />}
                                    <span className={cn('relative z-10 self-center w-8 h-8 rounded-full flex items-center justify-center', s.done || s.current ? 'bg-green-600 text-white' : 'bg-white border-2 border-slate-300')}>
                                        {(s.done || s.current) && <Check size={18} strokeWidth={3} />}
                                    </span>
                                </span>
                                <span className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', s.current ? 'bg-green-700 text-white' : s.done ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500')}>
                                    <Icon size={26} />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-3">
                                        <span className="text-[20px] font-bold text-slate-900">{s.label}</span>
                                        {s.current && <span className="h-7 px-3 rounded-full bg-amber-400 text-white text-[14px] font-bold flex items-center">Current</span>}
                                    </span>
                                    <span className="block text-[17px] text-slate-600">{s.done && s.doneNote ? s.doneNote : s.note}</span>
                                </span>
                                <span className="text-[17px] text-slate-600 tabular-nums">{s.done || s.current ? when(s.time) : 'Waiting'}</span>
                            </div>
                        )
                    })}
                </section>

                {order.orderStatus === 'Delivered' && (
                    <section className="rounded-2xl bg-green-50 border border-green-100 p-6 flex items-center gap-5">
                        <span className="w-14 h-14 rounded-2xl bg-green-600 text-white flex items-center justify-center"><ShieldCheck size={28} /></span>
                        <div className="flex-1">
                            <p className="text-[20px] font-bold text-green-900">Confirm Delivery</p>
                            <p className="text-[16px] text-green-800">Your order has arrived. Please confirm after checking the quantity and quality of all items.</p>
                        </div>
                        <button type="button" onClick={onConfirmReceived} disabled={isUpdating}
                            className="h-14 px-8 rounded-2xl bg-green-700 hover:bg-green-800 text-white text-[18px] font-bold disabled:opacity-60">
                            {isUpdating ? 'Confirming...' : 'Confirm Received'}
                        </button>
                    </section>
                )}
            </div>
        </div>
    )
}
