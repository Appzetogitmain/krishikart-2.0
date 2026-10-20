import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Home,
    ChevronRight,
    IndianRupee,
    Store,
    ShoppingCart,
    RefreshCw,
    PlusCircle,
    History,
    X,
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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

export default function FranchisePayoutsScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [summary, setSummary] = useState({
        totalFranchises: 0,
        totalOrders: 0,
        totalOrderValue: 0,
        totalPayable: 0
    });
    const [rows, setRows] = useState([]);
    const [recordModal, setRecordModal] = useState(null);
    const [historyModal, setHistoryModal] = useState(null);
    const [recordSubmitting, setRecordSubmitting] = useState(false);
    const [recordForm, setRecordForm] = useState({
        amount: '',
        paidAt: '',
        reference: '',
        note: '',
    });
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyItems, setHistoryItems] = useState([]);
    const [historyTotal, setHistoryTotal] = useState(0);

    useEffect(() => {
        if (!recordModal) return;
        const t = new Date().toISOString().slice(0, 10);
        setRecordForm({ amount: '', paidAt: t, reference: '', note: '' });
    }, [recordModal]);

    useEffect(() => {
        if (!historyModal?.franchiseId) {
            setHistoryItems([]);
            setHistoryTotal(0);
            return;
        }
        let cancelled = false;
        (async () => {
            setHistoryLoading(true);
            try {
                const { data } = await api.get(
                    `/masteradmin/franchises/${historyModal.franchiseId}/admin-payouts`,
                );
                if (cancelled) return;
                if (data?.success && data?.result) {
                    setHistoryItems(data.result.items || []);
                    setHistoryTotal(data.result.totalPaid ?? 0);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error(error);
                    toast.error(error.response?.data?.message || 'Failed to load payment history');
                }
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [historyModal]);

    const fetchPayouts = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = {};
            if (fromDate) params.from = fromDate;
            if (toDate) params.to = toDate;
            const response = await api.get('/masteradmin/franchise-payouts', { params });
            if (response.data.success) {
                setSummary(response.data.result?.summary || {});
                setRows(response.data.result?.franchises || []);
            }
        } catch (error) {
            console.error('Fetch franchise payouts error:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch franchise payouts');
        } finally {
            setIsLoading(false);
        }
    }, [fromDate, toDate]);

    const submitRecordPayment = async () => {
        if (!recordModal?.franchiseId) return;
        const num = Number(recordForm.amount);
        if (!Number.isFinite(num) || num <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        try {
            setRecordSubmitting(true);
            const { data } = await api.post(
                `/masteradmin/franchises/${recordModal.franchiseId}/admin-payouts`,
                {
                    amount: num,
                    paidAt: recordForm.paidAt || undefined,
                    reference: recordForm.reference?.trim() || undefined,
                    note: recordForm.note?.trim() || undefined,
                },
            );
            if (data?.success) {
                toast.success(data.message || 'Payment recorded');
                setRecordModal(null);
                fetchPayouts();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to record payment');
        } finally {
            setRecordSubmitting(false);
        }
    };

    useEffect(() => {
        fetchPayouts();
    }, [fetchPayouts]);

    const filteredRows = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) =>
            row.franchiseName?.toLowerCase().includes(q) ||
            row.ownerName?.toLowerCase().includes(q) ||
            row.city?.toLowerCase().includes(q) ||
            row.mobile?.toLowerCase().includes(q)
        );
    }, [rows, searchTerm]);

    const payoutColumns = [
        {
            header: 'Franchise',
            key: 'franchiseName',
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-slate-100 flex items-center justify-center text-slate-500">
                        <Store size={14} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-[11px] leading-none mb-1">{val}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{row.ownerName}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'City',
            key: 'city',
            render: (val) => <span className="text-[11px] font-bold text-slate-700">{val || 'N/A'}</span>
        },
        {
            header: 'Orders',
            key: 'orderCount',
            align: 'right',
            render: (val) => <span className="text-[11px] font-bold text-slate-900 tabular-nums">{val}</span>
        },
        {
            header: 'Order Value',
            key: 'orderValue',
            align: 'right',
            render: (val) => <span className="text-[11px] font-bold text-slate-900 tabular-nums">{formatCurrency(val)}</span>
        },
        {
            header: 'Payable',
            key: 'payableAmount',
            align: 'right',
            render: (val) => <span className="text-[11px] font-black text-emerald-600 tabular-nums">{formatCurrency(val)}</span>
        },
        {
            // All-time: earned on delivered orders minus what was paid (franchise-disputed payments don't count)
            header: 'Balance (all time)',
            key: 'balance',
            align: 'right',
            render: (bal) => bal ? (
                <div className="flex flex-col items-end leading-tight">
                    <span className="text-[11px] font-black text-slate-900 tabular-nums">{formatCurrency(bal.balanceDue)} due</span>
                    <span className="text-[10px] text-slate-500 tabular-nums">Earned {formatCurrency(bal.earned)} • Paid {formatCurrency(bal.paid)}</span>
                    {bal.awaitingCount > 0 && <span className="text-[10px] font-bold text-amber-600">{bal.awaitingCount} awaiting franchise confirmation</span>}
                    {bal.disputedCount > 0 && <span className="text-[10px] font-bold text-rose-600">{bal.disputedCount} reported not received</span>}
                </div>
            ) : <span className="text-[10px] text-slate-400">—</span>
        },
        {
            header: 'Category Commission',
            key: 'categories',
            render: (categories) => (
                <div className="flex flex-wrap gap-1">
                    {(categories || []).slice(0, 3).map((c) => (
                        <span
                            key={c.categoryId}
                            className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider"
                        >
                            {c.categoryName}: {c.commissionPercentage}%
                        </span>
                    ))}
                    {(categories || []).length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider">
                            +{categories.length - 3}
                        </span>
                    )}
                </div>
            )
        },
        {
            header: 'Settlement',
            key: 'franchiseId',
            align: 'right',
            render: (_, row) => (
                <div
                    className="flex flex-wrap items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() =>
                            setHistoryModal({
                                franchiseId: row.franchiseId,
                                franchiseName: row.franchiseName,
                            })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                    >
                        <History size={12} />
                        History
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            setRecordModal({
                                franchiseId: row.franchiseId,
                                franchiseName: row.franchiseName,
                            })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700"
                    >
                        <PlusCircle size={12} />
                        Record
                    </button>
                </div>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-50 border border-slate-200" />
                <div className="h-[500px] bg-slate-50 border border-slate-200" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Finance</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Franchise Payouts</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Franchise payments</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                        />
                        <button
                            onClick={fetchPayouts}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 flex items-center gap-2"
                        >
                            <RefreshCw size={12} />
                            Apply
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Franchises"
                    value={summary.totalFranchises || 0}
                    change={0}
                    trend="up"
                    icon={Store}
                    sparklineData={[...Array(7)].map(() => ({ value: summary.totalFranchises || 0 }))}
                />
                <MetricRow
                    label="Orders"
                    value={summary.totalOrders || 0}
                    change={0}
                    trend="up"
                    icon={ShoppingCart}
                    sparklineData={[...Array(7)].map(() => ({ value: summary.totalOrders || 0 }))}
                />
                <MetricRow
                    label="Order Value"
                    value={formatCurrency(summary.totalOrderValue || 0)}
                    change={0}
                    trend="up"
                    icon={IndianRupee}
                    sparklineData={[...Array(7)].map(() => ({ value: summary.totalOrderValue || 0 }))}
                />
                <MetricRow
                    label="Total Payable"
                    value={formatCurrency(summary.totalPayable || 0)}
                    change={0}
                    trend="up"
                    icon={IndianRupee}
                    sparklineData={[...Array(7)].map(() => ({ value: summary.totalPayable || 0 }))}
                />
            </div>

            <div className="flex flex-col gap-0 p-px">
                <div className="bg-white">

                    <DataGrid
                        title="What each franchise is owed (commission)"
                        columns={payoutColumns}
                        data={filteredRows}
                        density="compact"
                    />
                </div>
            </div>

            {recordModal ? (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="record-payout-title"
                >
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-slate-200">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h2 id="record-payout-title" className="text-sm font-bold text-slate-900">
                                Record payment to franchise
                            </h2>
                            <button
                                type="button"
                                onClick={() => setRecordModal(null)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-4 py-3 space-y-3 text-xs">
                            <p className="text-slate-500 font-medium">
                                <span className="text-slate-900 font-bold">{recordModal.franchiseName}</span>
                                <span className="block mt-1">
                                    Shown on the franchise Reports screen under &quot;Payments received from admin&quot;.
                                </span>
                            </p>
                            <label className="block space-y-1">
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                                    Amount (Rs)
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={recordForm.amount}
                                    onChange={(e) => setRecordForm((f) => ({ ...f, amount: e.target.value }))}
                                    className="w-full border border-slate-300 rounded px-2 py-2 font-bold text-slate-900"
                                    placeholder="0.00"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                                    Paid on
                                </span>
                                <input
                                    type="date"
                                    value={recordForm.paidAt}
                                    onChange={(e) => setRecordForm((f) => ({ ...f, paidAt: e.target.value }))}
                                    className="w-full border border-slate-300 rounded px-2 py-2 font-medium text-slate-900"
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                                    Reference (optional)
                                </span>
                                <input
                                    type="text"
                                    value={recordForm.reference}
                                    onChange={(e) => setRecordForm((f) => ({ ...f, reference: e.target.value }))}
                                    className="w-full border border-slate-300 rounded px-2 py-2 text-slate-800"
                                    placeholder="UTR / invoice no."
                                />
                            </label>
                            <label className="block space-y-1">
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                                    Note (optional)
                                </span>
                                <textarea
                                    value={recordForm.note}
                                    onChange={(e) => setRecordForm((f) => ({ ...f, note: e.target.value }))}
                                    rows={2}
                                    className="w-full border border-slate-300 rounded px-2 py-2 text-slate-800 resize-none"
                                />
                            </label>
                        </div>
                        <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRecordModal(null)}
                                className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 rounded-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={recordSubmitting}
                                onClick={submitRecordPayment}
                                className="px-4 py-2 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
                            >
                                {recordSubmitting ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {historyModal ? (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="payout-history-title"
                >
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full border border-slate-200 max-h-[85vh] flex flex-col">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 id="payout-history-title" className="text-sm font-bold text-slate-900">
                                    Recorded payments
                                </h2>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    {historyModal.franchiseName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHistoryModal(null)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-4 py-2 border-b border-slate-50 flex justify-between text-xs">
                            <span className="font-bold text-slate-500 uppercase tracking-wider">Total recorded</span>
                            <span className="font-black text-emerald-600 tabular-nums">
                                {formatCurrency(historyTotal)}
                            </span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2">
                            {historyLoading ? (
                                <p className="text-center text-xs text-slate-400 py-8">Loading…</p>
                            ) : historyItems.length === 0 ? (
                                <p className="text-center text-xs text-slate-500 py-8">No payments recorded yet.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {historyItems.map((item) => (
                                        <li key={item._id} className="px-2 py-2.5 text-[11px]">
                                            <div className="flex justify-between gap-2">
                                                <span className="font-bold text-slate-800">
                                                    {formatPaidAt(item.paidAt)}
                                                </span>
                                                <span className="font-black text-emerald-600 tabular-nums shrink-0">
                                                    {formatCurrency(item.amount)}
                                                </span>
                                            </div>
                                            <p className={
                                                (item.status === 'confirmed' ? 'text-emerald-600' : item.status === 'disputed' ? 'text-rose-600' : 'text-amber-600') + ' mt-1 text-[10px] font-black uppercase tracking-wider'
                                            }>
                                                {item.status === 'confirmed' ? 'Franchise confirmed received' : item.status === 'disputed' ? 'Franchise says not received' : 'Waiting for franchise confirmation'}
                                            </p>
                                            {item.status === 'disputed' && item.disputeNote ? (
                                                <p className="text-rose-600 mt-0.5">"{item.disputeNote}"</p>
                                            ) : null}
                                            {item.reference ? (
                                                <p className="text-slate-600 mt-1">Ref: {item.reference}</p>
                                            ) : null}
                                            {item.note ? (
                                                <p className="text-slate-500 mt-0.5">{item.note}</p>
                                            ) : null}
                                            {item.recordedBy?.fullName ? (
                                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                                                    By {item.recordedBy.fullName}
                                                </p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
