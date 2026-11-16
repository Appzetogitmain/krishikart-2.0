import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
    ArrowLeft,
    CreditCard,
    Info,
    ChevronRight,
    TrendingUp,
    ShieldCheck,
    Calendar,
    IndianRupee,
    AlertTriangle,
    CheckCircle2,
    Receipt,
    ArrowDownLeft,
    ArrowUpRight,
    RotateCcw,
    Loader2,
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { useWallet } from '../contexts/WalletContext'
import api from '@/lib/axios'
import { cn } from '@/lib/utils'

/*
 * KK Credit (client, Nov 2026): which orders were bought on credit, what is still to pay and by
 * when (7 days per order), paying all or part of it (oldest orders are cleared first), and every
 * credit purchase, refund and payment.
 */

const money = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')}`
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')
const daysText = (n) => (n <= 0 ? 'due today' : n === 1 ? '1 day left' : `${n} days left`)

const CreditCardGraphic = ({ limit, used, available, blocked }) => {
    const percentage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
    return (
        <div className="relative w-full aspect-[1.6/1] md:aspect-[2.2/1] bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[32px] p-7 md:p-8 text-white shadow-2xl overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-full bg-white/5 pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition-all duration-500" />
            <div className="relative h-full flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Kisaankart Credit</p>
                        <h2 className="text-2xl font-black tracking-tight">Business Credit</h2>
                    </div>
                    <CreditCard size={32} className="opacity-40" strokeWidth={1.5} />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-2">{blocked ? 'Credit on hold' : 'Available Credit'}</p>
                    <span className="text-4xl font-black tracking-tighter">{money(available)}</span>
                </div>
                <div className="space-y-3">
                    <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-white/70" />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="opacity-70">Limit {money(limit)}</span>
                        <span className={cn(percentage > 90 ? 'text-amber-300' : 'opacity-80')}>{money(used)} used</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

const STATUS = {
    due: { label: 'To pay', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    part_paid: { label: 'Part paid', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    overdue: { label: 'Overdue', cls: 'bg-red-50 text-red-700 border-red-200' },
    paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    refunded: { label: 'Credit returned', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
}

function DuesPanel({ st, onPay, paying }) {
    const [other, setOther] = useState(false)
    const [amount, setAmount] = useState('')

    if (!(st.used > 0)) {
        return (
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-6 flex items-center gap-4" data-credit-dues="clear">
                <CheckCircle2 size={28} className="text-emerald-600 shrink-0" />
                <div>
                    <p className="text-base font-bold text-slate-900">No dues - you&apos;re all clear</p>
                    <p className="text-sm text-slate-500">Orders you pay with KK Credit will show here with their due dates.</p>
                </div>
            </div>
        )
    }

    const payOther = () => {
        const v = Math.round(Number(amount) * 100) / 100
        if (!Number.isFinite(v) || v < 1) return toast.error('Please enter at least ₹1')
        if (v > st.used) return toast.error(`You only owe ${money(st.used)}`)
        onPay(v)
    }

    return (
        <div className={cn('rounded-[24px] border p-6 space-y-4 bg-white shadow-sm', st.isOverdue ? 'border-red-200' : 'border-amber-200')} data-credit-dues={st.isOverdue ? 'overdue' : 'due'}>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Amount to pay</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tight mt-1">{money(st.used)}</p>
                    {st.isOverdue ? (
                        <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-red-600">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            {money(st.overdueAmount)} is overdue. KK Credit orders are paused until you pay it.
                        </p>
                    ) : (
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                            <Calendar size={16} />
                            Pay by {fmtDate(st.dueDate)} · {daysText(st.daysLeft)}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <button type="button" disabled={paying} onClick={() => onPay()} data-pay-all
                        className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[15px] shadow-lg shadow-emerald-600/20 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                        {paying ? <Loader2 size={18} className="animate-spin" /> : <IndianRupee size={18} />} Pay all {money(st.used)}
                    </button>
                    {st.isOverdue && st.overdueAmount < st.used && (
                        <button type="button" disabled={paying} onClick={() => onPay(st.overdueAmount)} data-pay-overdue
                            className="h-11 px-6 rounded-2xl border-2 border-red-200 text-red-700 font-bold text-sm hover:bg-red-50 disabled:opacity-60">
                            Pay overdue {money(st.overdueAmount)}
                        </button>
                    )}
                    <button type="button" onClick={() => setOther((v) => !v)} className="text-sm font-semibold text-emerald-700 hover:underline">
                        Pay another amount
                    </button>
                </div>
            </div>
            {other && (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        <input type="number" inputMode="decimal" min="1" max={st.used} value={amount} onChange={(e) => setAmount(e.target.value)}
                            placeholder={`1 - ${st.used}`} data-pay-amount
                            className="w-full h-11 pl-7 pr-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                    </div>
                    <button type="button" disabled={paying} onClick={payOther} data-pay-other
                        className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-60">Pay</button>
                </div>
            )}
            <p className="text-xs text-slate-500">Payments clear your oldest orders first. Each order bought on credit must be paid within {st.creditDays} days.</p>
        </div>
    )
}

function CreditOrders({ rows, onOpen }) {
    if (!rows.length) {
        return (
            <div className="bg-white rounded-[24px] p-8 border border-dashed border-slate-200 text-center">
                <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-600">No orders on credit yet</p>
            </div>
        )
    }
    return (
        <div className="space-y-2.5" data-credit-orders>
            {rows.map((r, i) => {
                const s = STATUS[r.status] || STATUS.due
                return (
                    <button
                        key={r.orderId || `earlier-${i}`}
                        type="button"
                        onClick={() => r.orderId && onOpen(r.orderId)}
                        disabled={!r.orderId}
                        data-credit-row={r.status}
                        className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-emerald-200 transition-colors disabled:cursor-default"
                    >
                        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', r.status === 'overdue' ? 'bg-red-50 text-red-600' : r.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500')}>
                            <Receipt size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{r.orderId ? `Order #${r.shortId}` : 'Earlier credit'}</span>
                                <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-bold', s.cls)}>{s.label}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                {r.orderId ? `${fmtDate(r.placedAt)}${r.items ? ` · ${r.items}` : ''}` : 'Credit used before this list was kept'}
                            </p>
                            {r.due > 0 && (
                                <p className={cn('text-xs font-semibold mt-1', r.status === 'overdue' ? 'text-red-600' : 'text-amber-700')}>
                                    {r.paid > 0 ? `${money(r.paid)} paid · ` : ''}{money(r.due)} {r.status === 'overdue' ? `was due ${fmtShort(r.dueDate)}` : `due by ${fmtShort(r.dueDate)}`}
                                </p>
                            )}
                            {r.restored > 0 && r.status !== 'refunded' && (
                                <p className="text-xs text-slate-500 mt-0.5">{money(r.restored)} credit returned for items not taken</p>
                            )}
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-sm font-black text-slate-900">{money(r.net || r.charged)}</p>
                            <p className="text-[11px] text-slate-400">on credit</p>
                        </div>
                        {r.orderId && <ChevronRight size={16} className="text-slate-300 shrink-0" />}
                    </button>
                )
            })}
        </div>
    )
}

const KIND = {
    used: { label: 'Bought on credit', icon: ArrowUpRight, cls: 'bg-amber-50 text-amber-600', sign: '' },
    repaid: { label: 'Payment made', icon: ArrowDownLeft, cls: 'bg-emerald-50 text-emerald-600', sign: '−' },
    refunded: { label: 'Credit returned', icon: RotateCcw, cls: 'bg-slate-50 text-slate-500', sign: '−' },
}

function CreditHistory({ history }) {
    if (!history.length) {
        return (
            <div className="bg-white rounded-[24px] p-8 border border-dashed border-slate-200 text-center">
                <IndianRupee size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-600">No credit activity yet</p>
            </div>
        )
    }
    return (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm divide-y divide-slate-50" data-credit-history>
            {history.map((h, i) => {
                const k = KIND[h.kind]
                return (
                    <div key={`${h.txnId}-${i}`} className="flex items-center gap-3 p-4">
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', k.cls)}><k.icon size={16} /></div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{k.label}{h.shortId ? ` · Order #${h.shortId}` : ''}</p>
                            <p className="text-xs text-slate-400">{fmtDate(h.createdAt)}{h.kind === 'repaid' && h.txnId ? ` · Ref ${h.txnId}` : ''}</p>
                        </div>
                        <p className={cn('text-sm font-bold shrink-0', h.kind === 'repaid' ? 'text-emerald-600' : 'text-slate-900')}>{k.sign}{money(h.amount)}</p>
                    </div>
                )
            })}
        </div>
    )
}

export default function CreditInfoScreen() {
    const navigate = useNavigate()
    const { repayCredit } = useWallet()
    const [st, setSt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [paying, setPaying] = useState(false)
    const [tab, setTab] = useState('orders')

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/user/credit/statement')
            if (data?.success) setSt(data.result)
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not load your credit details')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const pay = async (amount) => {
        setPaying(true)
        try {
            const r = await repayCredit(amount)
            if (r.success) toast.success(r.message || 'Payment received')
            else if (r.message !== 'Payment cancelled') toast.error(r.message || 'Payment failed')
        } finally {
            setPaying(false)
            load()
        }
    }

    if (loading || !st) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                {loading ? <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <p className="text-sm text-slate-500">Could not load your credit details.</p>}
            </div>
        )
    }

    const openOrders = st.rows.filter((r) => r.due > 0).length
    const stats = [
        { icon: TrendingUp, label: 'Credit used', value: money(st.used), desc: openOrders ? `${openOrders} order${openOrders > 1 ? 's' : ''} to pay` : 'Nothing to pay', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { icon: Calendar, label: 'Next due date', value: st.dueDate ? fmtShort(st.dueDate) : '—', desc: st.dueDate ? (st.isOverdue ? 'Overdue' : daysText(st.daysLeft)) : `${st.creditDays} days per order`, color: st.isOverdue ? 'text-red-600' : 'text-blue-600', bg: st.isOverdue ? 'bg-red-50' : 'bg-blue-50' },
        { icon: AlertTriangle, label: 'Overdue', value: money(st.overdueAmount), desc: st.isOverdue ? 'Pay to keep using credit' : 'Nothing overdue', color: st.isOverdue ? 'text-red-600' : 'text-slate-500', bg: st.isOverdue ? 'bg-red-50' : 'bg-slate-50' },
    ]

    return (
        <PageTransition>
            <div className="bg-[#fcfdff] min-h-screen">
                <div className="lg:hidden bg-white px-6 py-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-40">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-95 transition-all" aria-label="Back">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kisaankart Credit</h1>
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 pb-32">
                    <div className="hidden lg:flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 font-sans">Kisaankart Credit</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Business Credit</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-100">
                            Available: {money(st.available)}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                        <div className="lg:col-span-2 space-y-8">
                            <CreditCardGraphic limit={st.limit} used={st.used} available={st.available} blocked={st.blocked} />

                            {st.blocked && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    Your KK Credit is on hold{st.blockedReason ? `: ${st.blockedReason}` : ''}. You can still pay your dues.
                                </div>
                            )}

                            <DuesPanel st={st} onPay={pay} paying={paying} />

                            <div className="grid grid-cols-3 gap-3">
                                {stats.map((item) => (
                                    <div key={item.label} className="bg-white p-4 rounded-[20px] border border-slate-100 flex flex-col items-center text-center gap-2 shadow-sm">
                                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', item.bg, item.color)}><item.icon size={18} /></div>
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</h3>
                                            <p className={cn('text-base font-black tracking-tight', item.color)}>{item.value}</p>
                                            <p className="text-[11px] font-medium text-slate-400 leading-tight mt-0.5">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit" role="tablist">
                                    {[['orders', 'Orders on credit'], ['history', 'Payments & activity']].map(([k, label]) => (
                                        <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                                            className={cn('px-4 py-2 rounded-lg text-sm font-bold transition-colors', tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {tab === 'orders'
                                    ? <CreditOrders rows={st.rows} onOpen={(id) => navigate(`/order-detail/${id}`)} />
                                    : <CreditHistory history={st.history} />}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-emerald-600 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-100/50 lg:sticky lg:top-28">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><Info size={140} strokeWidth={1} /></div>
                                <div className="relative">
                                    <h4 className="text-lg font-black tracking-tight mb-4">How it works?</h4>
                                    <p className="text-sm font-medium opacity-90 leading-relaxed mb-6">
                                        Kisaankart Credit lets you buy now and pay later. Your limit depends on your order and payment history.
                                    </p>
                                    <ul className="space-y-4">
                                        {[
                                            `Pay each credit order within ${st.creditDays} days, interest-free`,
                                            'Reminders start 3 days after an order and come daily until it is paid',
                                            'Overdue dues pause KK Credit orders until they are paid',
                                            'Pay all at once or part - oldest orders are cleared first',
                                        ].map((step, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-[13px] font-bold">
                                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] shrink-0 mt-0.5">{idx + 1}</div>
                                                <span className="leading-snug">{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500"><ShieldCheck size={24} /></div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Secure payments</p>
                                    <p className="text-sm font-bold text-slate-700">UPI, cards &amp; net banking via Razorpay</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
