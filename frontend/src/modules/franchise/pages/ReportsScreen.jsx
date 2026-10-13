import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Home,
    ChevronRight,
    IndianRupee,
    RefreshCw,
    ShoppingCart,
    Info,
    Layers,
    CalendarRange,
    ArrowUpRight,
    Wallet,
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formatInr = (n) =>
    `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function formatPaidAt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatPeriodLabel(from, to) {
    if (!from && !to) return 'All time';
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    return `Until ${to}`;
}

/** YYYY-MM-DD in local timezone (for `<input type="date">`). */
function localDateInputValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default function ReportsScreen() {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState({
        franchiseName: '',
        orderCount: 0,
        orderValue: 0,
        amountDueFromAdmin: 0,
        categories: [],
        from: null,
        to: null,
    });
    const [adminLedger, setAdminLedger] = useState({ items: [], totalReceived: 0 });

    const periodLabel = useMemo(
        () => formatPeriodLabel(fromDate || report.from, toDate || report.to),
        [fromDate, toDate, report.from, report.to],
    );

    const fetchReport = useCallback(async () => {
        const today = localDateInputValue();
        if (fromDate && fromDate > today) {
            toast.error('From date cannot be in the future');
            setLoading(false);
            return;
        }
        if (toDate && toDate > today) {
            toast.error('To date cannot be in the future');
            setLoading(false);
            return;
        }
        if (fromDate && toDate && toDate < fromDate) {
            toast.error('To date must be on or after the From date');
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const params = {};
            if (fromDate) params.from = fromDate;
            if (toDate) params.to = toDate;
            const [summaryRes, ledgerRes] = await Promise.allSettled([
                api.get('/franchise/reports/payout-summary', { params }),
                api.get('/franchise/reports/admin-payouts', { params }),
            ]);

            if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.success && summaryRes.value.data?.result) {
                setReport(summaryRes.value.data.result);
            } else if (summaryRes.status === 'rejected') {
                console.error(summaryRes.reason);
                toast.error(summaryRes.reason.response?.data?.message || 'Failed to load report');
            }

            if (ledgerRes.status === 'fulfilled' && ledgerRes.value.data?.success && ledgerRes.value.data?.result) {
                setAdminLedger({
                    items: ledgerRes.value.data.result.items || [],
                    totalReceived: ledgerRes.value.data.result.totalReceived ?? 0,
                });
            } else {
                setAdminLedger({ items: [], totalReceived: 0 });
                if (ledgerRes.status === 'rejected') {
                    console.error(ledgerRes.reason);
                }
            }
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const clearDates = () => {
        setFromDate('');
        setToDate('');
    };

    const todayStr = localDateInputValue();

    const onFromDateChange = (e) => {
        const v = e.target.value;
        if (!v) {
            setFromDate('');
            return;
        }
        if (v > todayStr) {
            toast.error('From date cannot be in the future');
            return;
        }
        setFromDate(v);
        if (toDate && toDate < v) {
            setToDate(v);
            toast.info('To date was adjusted to match the From date');
        }
    };

    const onToDateChange = (e) => {
        const v = e.target.value;
        if (!v) {
            setToDate('');
            return;
        }
        if (v > todayStr) {
            toast.error('To date cannot be in the future');
            return;
        }
        if (fromDate && v < fromDate) {
            toast.error('To date must be on or after the From date');
            return;
        }
        setToDate(v);
    };

    return (
        <div className="bg-[#f4f6f9] min-h-screen font-sans pb-28 lg:pb-10">
            {/* Top bar */}
            <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm shadow-slate-200/40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">
                        <Home size={13} className="shrink-0 text-slate-300" strokeWidth={2} />
                        <ChevronRight size={12} className="shrink-0 text-slate-200" />
                        <span className="truncate">Franchise</span>
                        <ChevronRight size={12} className="shrink-0 text-slate-200" />
                        <span className="text-slate-900 font-black tracking-[0.14em] truncate">Reports</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchReport()}
                        disabled={loading}
                        className={cn(
                            'shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg',
                            'bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.15em]',
                            'hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none',
                        )}
                    >
                        <RefreshCw size={14} className={cn(loading && 'animate-spin')} strokeWidth={2.5} />
                        Refresh
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Title block */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100">
                            <BarChart3 size={14} className="text-emerald-700" strokeWidth={2.5} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">
                                Earnings
                            </span>
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight text-balance">
                                Settlement report
                            </h1>
                            <p className="mt-2 text-sm text-slate-500 font-medium max-w-xl leading-relaxed">
                                Estimated commission Kisaankart owes you, based on{' '}
                                <span className="text-slate-700 font-semibold">Delivered</span> and{' '}
                                <span className="text-slate-700 font-semibold">Received</span> orders and your
                                category commission rates.
                            </p>
                            {report.franchiseName ? (
                                <p className="mt-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    {report.franchiseName}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {/* Date filters */}
                    <div className="w-full lg:w-auto lg:min-w-[320px]">
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30">
                            <div className="flex items-center gap-2 mb-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                <CalendarRange size={14} />
                                Date range
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="space-y-1.5 block">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        From
                                    </span>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        max={todayStr}
                                        onChange={onFromDateChange}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                                    />
                                </label>
                                <label className="space-y-1.5 block">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        To
                                    </span>
                                    <input
                                        type="date"
                                        value={toDate}
                                        min={fromDate || undefined}
                                        max={todayStr}
                                        onChange={onToDateChange}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                                    />
                                </label>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold text-slate-400 truncate">{periodLabel}</span>
                                {(fromDate || toDate) && (
                                    <button
                                        type="button"
                                        onClick={clearDates}
                                        className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div
                    role="note"
                    className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-orange-50/40 px-5 py-4 flex gap-4"
                >
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-amber-700 shadow-sm">
                        <Info size={20} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-950/90 mb-1">
                            Important
                        </p>
                        <p className="text-sm text-amber-950/80 leading-relaxed font-medium">
                            Amounts are <strong className="font-semibold text-amber-950">estimates</strong> from your category commission rates. Always confirm the final amount with the admin and your signed agreement.{' '}
                            <strong className="font-semibold text-amber-950">Payments actually sent</strong> by admin
                            appear in <strong className="font-semibold text-amber-950">Payments received from admin</strong>{' '}
                            below when they are recorded in Finance → Franchise Payouts.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-40 rounded-2xl bg-slate-200/70" />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="h-28 rounded-2xl bg-slate-200/60" />
                            <div className="h-28 rounded-2xl bg-slate-200/60" />
                        </div>
                        <div className="h-64 rounded-2xl bg-slate-200/50" />
                    </div>
                ) : (
                    <>
                        {/* Hero KPI */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-300/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/[0.07] via-transparent to-slate-900/[0.03] pointer-events-none" />
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                            <div className="relative px-6 sm:px-8 py-8 sm:py-10">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                                    <div className="space-y-2">
                                        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800/90">
                                            <IndianRupee size={14} strokeWidth={2.5} />
                                            Estimated amount due from admin
                                        </p>
                                        <p className="text-4xl sm:text-5xl font-black text-slate-900 tabular-nums tracking-tight">
                                            {formatInr(report.amountDueFromAdmin)}
                                        </p>
                                        <p className="text-sm text-slate-500 font-medium max-w-md leading-snug">
                                            Commission accrual for the selected period. This is what you may request from
                                            admin, subject to approval and payment terms.
                                        </p>
                                    </div>
                                    <div className="sm:pt-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                                            <ArrowUpRight size={14} />
                                            Payout estimate
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Secondary metrics */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="grid sm:grid-cols-2 gap-4"
                        >
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                        Qualifying orders
                                    </span>
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                        <ShoppingCart size={18} strokeWidth={2} />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-slate-900 tabular-nums">{report.orderCount}</p>
                                <p className="mt-2 text-xs text-slate-500 font-medium">
                                    Delivered or received in range
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                        Tracked sales value
                                    </span>
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                        <Layers size={18} strokeWidth={2} />
                                    </div>
                                </div>
                                <p className="text-3xl font-black text-slate-900 tabular-nums">
                                    {formatInr(report.orderValue)}
                                </p>
                                <p className="mt-2 text-xs text-slate-500 font-medium">
                                    Line items used for commission (subtotals)
                                </p>
                            </div>
                        </motion.div>

                        {/* Category table */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                        <Layers size={18} strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.12em]">
                                            By category
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                                            Only categories selected at registration; sales and payout outside those are
                                            excluded from this report.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {report.categories?.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[520px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Category
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-right">
                                                    Rate
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-right">
                                                    Sales
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-right">
                                                    Payout
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {report.categories.map((c) => (
                                                <tr
                                                    key={c.categoryId}
                                                    className="hover:bg-slate-50/60 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-slate-900">
                                                            {c.categoryName || 'Category'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-black text-slate-600 tabular-nums">
                                                            {Number(c.commissionPercentage || 0)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-bold text-slate-700 tabular-nums">
                                                            {formatInr(c.orderValue)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-black text-emerald-700 tabular-nums">
                                                            {formatInr(c.payoutAmount)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-6 py-16 text-center max-w-md mx-auto">
                                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                                        <BarChart3 size={26} strokeWidth={1.5} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-800">No commission data for this range</p>
                                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                        Try a different date range, or ask the admin to set commission rates for your categories.
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        {/* Admin-recorded settlement payments */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.14, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                        <Wallet size={18} strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.12em]">
                                            Payments received from admin
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            Payments recorded by the admin in this date range (by payment date).
                                        </p>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right shrink-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        Total in range
                                    </p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">
                                        {formatInr(adminLedger.totalReceived)}
                                    </p>
                                </div>
                            </div>

                            {adminLedger.items?.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[480px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Paid on
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-right">
                                                    Amount
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Reference
                                                </th>
                                                <th className="px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Note
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {adminLedger.items.map((row) => (
                                                <tr
                                                    key={row._id || `${row.paidAt}-${row.amount}`}
                                                    className="hover:bg-slate-50/60 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-slate-800">
                                                            {formatPaidAt(row.paidAt)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-black text-emerald-700 tabular-nums">
                                                            {formatInr(row.amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-slate-600">
                                                            {row.reference?.trim() ? row.reference : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 max-w-[220px]">
                                                        <span className="text-sm text-slate-500 line-clamp-2">
                                                            {row.note?.trim() ? row.note : '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="px-6 py-14 text-center max-w-md mx-auto">
                                    <p className="text-sm font-bold text-slate-800">No recorded payments in this range</p>
                                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                        When the admin records a settlement for your outlet, it will appear here. The
                                        estimate above is separate from these logged transfers.
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
}
