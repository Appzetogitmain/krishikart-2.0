import { useCallback, useEffect, useState } from 'react';
import {
    IndianRupee,
    RefreshCw,
    Wallet,
    CheckCircle2,
    Clock,
    AlertTriangle,
    XCircle,
    Loader2,
    CalendarRange,
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formatInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESETS = [
    { id: 'month', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
];
const presetRange = (id) => {
    const t = new Date();
    if (id === 'month') return { from: dayKey(new Date(t.getFullYear(), t.getMonth(), 1)), to: dayKey(t) };
    if (id === 'lastMonth') return { from: dayKey(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: dayKey(new Date(t.getFullYear(), t.getMonth(), 0)) };
    if (id === 'year') return { from: dayKey(new Date(t.getFullYear(), 0, 1)), to: dayKey(t) };
    return { from: '', to: '' };
};

const STATUS = {
    awaiting_confirmation: { label: 'Waiting for your confirmation', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
    confirmed: { label: 'Received - confirmed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
    disputed: { label: 'Reported as not received', cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle },
};

/** Franchise "Earnings & Payments": what you earned, what the admin paid, what is still due. */
export default function ReportsScreen() {
    const [preset, setPreset] = useState('month');
    const [range, setRange] = useState(() => presetRange('month'));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [disputing, setDisputing] = useState(null);
    const [note, setNote] = useState('');
    const today = dayKey(new Date());

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (range.from) params.from = range.from;
            if (range.to) params.to = range.to;
            const res = await api.get('/franchise/reports/earnings', { params });
            setData(res.data?.result || null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not load your earnings');
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { load(); }, [load]);

    const choose = (id) => {
        setPreset(id);
        if (id !== 'custom') setRange(presetRange(id));
    };

    const respond = async (id, action) => {
        if (busyId) return;
        setBusyId(id);
        try {
            const res = await api.put(`/franchise/reports/admin-payouts/${id}/${action}`, action === 'dispute' ? { note } : {});
            toast.success(res.data?.message || 'Updated');
            setDisputing(null);
            setNote('');
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Could not update this payment');
        } finally {
            setBusyId(null);
        }
    };

    const b = data?.balance || {};
    const p = data?.period || {};

    return (
        <div className="space-y-4">
            {/* Header + period */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Earnings &amp; Payments</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Your commission on delivered orders, what the admin has paid you, and what is still due.
                        </p>
                    </div>
                    <button onClick={load} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((x) => (
                        <button
                            key={x.id}
                            onClick={() => choose(x.id)}
                            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border', preset === x.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}
                        >
                            {x.label}
                        </button>
                    ))}
                </div>
                {preset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <CalendarRange size={14} className="text-slate-400" />
                        <input type="date" max={today} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 border border-slate-200 rounded-lg px-2" />
                        <span className="text-slate-400">to</span>
                        <input type="date" max={today} min={range.from || undefined} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 border border-slate-200 rounded-lg px-2" />
                    </div>
                )}
            </div>

            {loading && !data ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : (
                <>
                    {data?.missingRates?.length > 0 && (
                        <div className="flex gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-900">
                                <p className="font-bold">Your commission rate is not set for: {data.missingRates.join(', ')}</p>
                                <p className="mt-0.5">Orders in these categories earn you ₹0 until the admin sets your commission %. Please contact the admin.</p>
                            </div>
                        </div>
                    )}

                    {/* Overall balance */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 md:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your balance (all time)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            <div>
                                <p className="text-[11px] text-slate-400">Total earned</p>
                                <p className="text-xl font-bold tabular-nums">{formatInr(b.earned)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400">Paid &amp; confirmed by you</p>
                                <p className="text-xl font-bold tabular-nums text-emerald-400">{formatInr(b.confirmed)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400">Paid, waiting for your confirmation</p>
                                <p className="text-xl font-bold tabular-nums text-amber-300">{formatInr(b.awaiting)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-slate-400">Still due from admin</p>
                                <p className={cn('text-xl font-bold tabular-nums', b.balanceDue < 0 ? 'text-sky-300' : 'text-white')}>{formatInr(b.balanceDue)}</p>
                                {b.balanceDue < 0 && <p className="text-[10px] text-sky-300">Paid in advance</p>}
                            </div>
                        </div>
                        {b.disputed > 0 && (
                            <p className="mt-3 text-[11px] text-rose-300">{formatInr(b.disputed)} reported as not received is not counted as paid.</p>
                        )}
                    </div>

                    {/* This period */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Delivered orders', value: p.orders, money: false },
                            { label: 'Sales', value: p.sales, money: true },
                            { label: 'You earned', value: p.earned, money: true },
                            { label: 'Paid to you', value: p.paidInPeriod, money: true },
                        ].map((k) => (
                            <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-3.5">
                                <p className="text-xs text-slate-500">{k.label}</p>
                                <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{k.money ? formatInr(k.value) : Number(k.value || 0)}</p>
                            </div>
                        ))}
                    </div>

                    {/* By category */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900">Earnings by category</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Commission is worked out when each order is delivered, at the rate in force then.</p>
                        </div>
                        {!p.byCategory?.length ? (
                            <p className="px-4 py-8 text-center text-sm text-slate-400">No delivered orders in this period.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-xs text-slate-500">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold">Category</th>
                                            <th className="px-4 py-2 text-right font-semibold">Sales</th>
                                            <th className="px-4 py-2 text-right font-semibold">Commission %</th>
                                            <th className="px-4 py-2 text-right font-semibold">You earned</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {p.byCategory.map((c) => (
                                            <tr key={c.category}>
                                                <td className="px-4 py-2 text-slate-800">{c.category}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{formatInr(c.sales)}</td>
                                                <td className={cn('px-4 py-2 text-right tabular-nums', Number(c.rateAtDelivery) === 0 && 'text-amber-600 font-semibold')}>
                                                    {c.rateAtDelivery}%{Number(c.rateAtDelivery) === 0 ? ' (not set)' : ''}
                                                </td>
                                                <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">{formatInr(c.earned)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-50 font-bold">
                                            <td className="px-4 py-2">Total</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{formatInr(p.sales)}</td>
                                            <td />
                                            <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatInr(p.earned)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Payments from admin */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                            <Wallet size={16} className="text-slate-500" />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Payments from admin</h3>
                                <p className="text-xs text-slate-500">Confirm each payment once the money reaches your account.</p>
                            </div>
                        </div>
                        {!data?.payments?.length ? (
                            <p className="px-4 py-8 text-center text-sm text-slate-400">The admin has not recorded any payment to you yet.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {data.payments.map((pay) => {
                                    const st = STATUS[pay.status] || STATUS.awaiting_confirmation;
                                    return (
                                        <li key={pay._id} className="px-4 py-3 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-base font-bold text-slate-900 tabular-nums flex items-center gap-1"><IndianRupee size={14} />{Number(pay.amount).toLocaleString('en-IN')}</p>
                                                    <p className="text-xs text-slate-500">Paid on {formatDate(pay.paidAt)}{pay.reference ? ` • Ref: ${pay.reference}` : ''}</p>
                                                    {pay.note && <p className="text-xs text-slate-500">{pay.note}</p>}
                                                    {pay.status === 'disputed' && pay.disputeNote && <p className="text-xs text-rose-600 font-semibold">Your note: {pay.disputeNote}</p>}
                                                </div>
                                                <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold', st.cls)}>
                                                    <st.Icon size={12} /> {st.label}
                                                </span>
                                            </div>
                                            {pay.status !== 'confirmed' && disputing !== pay._id && (
                                                <div className="flex gap-2">
                                                    <button disabled={busyId === pay._id} onClick={() => respond(pay._id, 'confirm')} className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5">
                                                        {busyId === pay._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Confirm received
                                                    </button>
                                                    {pay.status !== 'disputed' && (
                                                        <button disabled={busyId === pay._id} onClick={() => { setDisputing(pay._id); setNote(''); }} className="h-9 px-4 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold disabled:opacity-40">
                                                            Not received
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {disputing === pay._id && (
                                                <div className="space-y-2">
                                                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What is wrong? (e.g. money not in bank, amount is less)" className="w-full min-h-[64px] border border-slate-200 rounded-lg p-2.5 text-xs" />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setDisputing(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-bold text-slate-500">Cancel</button>
                                                        <button disabled={!note.trim() || busyId === pay._id} onClick={() => respond(pay._id, 'dispute')} className="h-9 px-4 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-40">Tell the admin</button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
