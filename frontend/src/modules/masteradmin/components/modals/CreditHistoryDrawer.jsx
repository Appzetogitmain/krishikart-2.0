import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, ArrowUpRight, ArrowDownLeft, RotateCcw, ShieldAlert, UserCog } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const monthLabel = (key) => new Date(`${key}-15T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });

const KIND = {
    used: { label: 'Credit used', icon: ArrowUpRight, tone: 'text-rose-600 bg-rose-50', sign: '+' },
    repaid: { label: 'Repaid', icon: ArrowDownLeft, tone: 'text-emerald-600 bg-emerald-50', sign: '−' },
    refunded: { label: 'Refunded to credit', icon: RotateCcw, tone: 'text-blue-600 bg-blue-50', sign: '−' },
};

/** Side panel with one customer's KK Credit usage, repayments and admin changes. */
export default function CreditHistoryDrawer({ customer, onClose }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('transactions');

    useEffect(() => {
        if (!customer?._id) return;
        let cancelled = false;
        setData(null);
        setError('');
        setTab('transactions');
        api.get(`/masteradmin/customers/${customer._id}/credit-history`)
            .then((res) => { if (!cancelled) setData(res.data?.result || res.data?.results || null); })
            .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load credit history'); });
        return () => { cancelled = true; };
    }, [customer?._id]);

    const maxMonth = data ? Math.max(1, ...data.months.map((m) => Math.max(m.used, m.repaid))) : 1;

    return (
        <AnimatePresence>
            {customer && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.2 }}
                        className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl"
                    >
                        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <History size={18} className="text-slate-500" />
                                <div>
                                    <h2 className="text-sm font-black text-slate-900">Credit history</h2>
                                    <p className="text-[11px] font-bold text-slate-400">
                                        {customer.fullName || 'Unnamed Customer'} · {customer.mobile}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900">
                                <X size={18} />
                            </button>
                        </div>

                        {error && <p className="m-5 text-sm font-bold text-rose-600">{error}</p>}
                        {!data && !error && (
                            <div className="p-5 space-y-3">
                                {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-slate-50 animate-pulse rounded-sm" />)}
                            </div>
                        )}

                        {data && (
                            <div className="p-5 space-y-6">
                                {data.customer.creditBlocked && (
                                    <div className="flex gap-3 p-3 bg-rose-50 border border-rose-200 rounded-sm">
                                        <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                                        <div className="text-[12px]">
                                            <p className="font-black text-rose-700">Credit blocked since {when(data.customer.creditBlockedAt)}</p>
                                            {data.customer.creditBlockedReason && (
                                                <p className="font-bold text-rose-600 mt-0.5">Reason: {data.customer.creditBlockedReason}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Current position */}
                                <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden">
                                    {[
                                        ['Limit', money(data.customer.creditLimit)],
                                        ['Outstanding', money(data.customer.usedCredit)],
                                        ['Available', money(data.customer.creditBlocked ? 0 : Math.max(0, data.customer.creditLimit - data.customer.usedCredit))],
                                    ].map(([label, value]) => (
                                        <div key={label} className="bg-white p-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                            <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Lifetime usage */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        ['Total credit used', money(data.summary.totalUsed)],
                                        ['Total repaid', money(data.summary.totalRepaid)],
                                        ['Refunded to credit', money(data.summary.totalRefunded)],
                                        ['Credit orders', data.summary.purchaseCount],
                                        ['Average order', money(data.summary.averagePurchase)],
                                        ['Largest order', money(data.summary.largestPurchase)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="border border-slate-100 rounded-sm p-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                            <p className="text-sm font-black text-slate-900 tabular-nums mt-0.5">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] font-bold text-slate-400 -mt-3">
                                    Last used: {when(data.summary.lastUsedAt)} · Last repaid: {when(data.summary.lastRepaidAt)}
                                    {data.customer.isOverdue && <span className="text-rose-600"> · Payment overdue</span>}
                                </p>

                                {/* Last 6 months */}
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Last 6 months</p>
                                    <div className="flex items-end gap-3 h-28 border-b border-slate-200 pb-1">
                                        {data.months.map((m) => (
                                            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${monthLabel(m.month)}: used ${money(m.used)}, repaid ${money(m.repaid)}`}>
                                                <div className="flex items-end gap-0.5 w-full justify-center h-full">
                                                    <div className="w-2.5 bg-rose-400 rounded-t-sm" style={{ height: `${(m.used / maxMonth) * 100}%` }} />
                                                    <div className="w-2.5 bg-emerald-400 rounded-t-sm" style={{ height: `${(m.repaid / maxMonth) * 100}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        {data.months.map((m) => (
                                            <span key={m.month} className="flex-1 text-center text-[10px] font-bold text-slate-400 mt-1">{monthLabel(m.month)}</span>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-500">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-400 rounded-sm" /> Used</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm" /> Repaid</span>
                                    </div>
                                </div>

                                {/* Lists */}
                                <div>
                                    <div className="flex border-b border-slate-200 mb-3">
                                        {[
                                            ['transactions', `Transactions (${data.transactions.length})`],
                                            ['admin', `Admin changes (${data.adminChanges.length})`],
                                        ].map(([key, label]) => (
                                            <button
                                                key={key}
                                                onClick={() => setTab(key)}
                                                className={cn(
                                                    'px-3 py-2 text-[11px] font-black uppercase tracking-widest border-b-2 -mb-px',
                                                    tab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {tab === 'transactions' && (
                                        data.transactions.length === 0 ? (
                                            <p className="text-[12px] font-bold text-slate-400 py-4">This customer hasn't used KK Credit yet.</p>
                                        ) : (
                                            <ul className="divide-y divide-slate-100">
                                                {data.transactions.map((t, i) => {
                                                    const k = KIND[t.kind];
                                                    return (
                                                        <li key={t.txnId || i} className="flex items-center gap-3 py-2.5">
                                                            <div className={cn('w-8 h-8 rounded-sm flex items-center justify-center shrink-0', k.tone)}>
                                                                <k.icon size={14} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[12px] font-black text-slate-900">{k.label}</p>
                                                                <p className="text-[11px] font-bold text-slate-400 truncate">
                                                                    {when(t.createdAt)}{t.note ? ` · ${t.note}` : ''}
                                                                </p>
                                                            </div>
                                                            <span className={cn('text-[13px] font-black tabular-nums', t.kind === 'used' ? 'text-rose-600' : 'text-emerald-600')}>
                                                                {k.sign}{money(t.amount)}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )
                                    )}

                                    {tab === 'admin' && (
                                        data.adminChanges.length === 0 ? (
                                            <p className="text-[12px] font-bold text-slate-400 py-4">No admin changes recorded.</p>
                                        ) : (
                                            <ul className="divide-y divide-slate-100">
                                                {data.adminChanges.map((a) => (
                                                    <li key={a._id} className="flex gap-3 py-2.5">
                                                        <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 bg-slate-100 text-slate-500">
                                                            <UserCog size={14} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[12px] font-black text-slate-900">{a.title}</p>
                                                            <p className="text-[11px] font-bold text-slate-400">
                                                                {when(a.createdAt)} · by {a.actorName || 'Admin'}{a.actorRole ? ` (${a.actorRole})` : ''}
                                                            </p>
                                                            {(a.changes || []).map((c) => (
                                                                <p key={c.field} className="text-[11px] font-bold text-slate-600 mt-0.5">
                                                                    {c.field}: <span className="line-through text-slate-400">{c.from || '—'}</span> → {c.to || '—'}
                                                                </p>
                                                            ))}
                                                            {(a.details || []).filter((d) => d.label === 'Reason').map((d) => (
                                                                <p key="reason" className="text-[11px] font-bold text-amber-700 mt-0.5">Reason: {d.value}</p>
                                                            ))}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
