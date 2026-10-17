import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, XCircle, RefreshCw, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString() : 'N/A');

const FILTERS = [
    { key: 'submitted', label: 'Waiting for you' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
];

const STATUS_STYLE = {
    submitted: 'bg-amber-50 text-amber-700 border-amber-200',
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};
const STATUS_LABEL = { submitted: 'Waiting for your check', verified: 'Verified', rejected: 'Rejected' };

export default function CashManagementScreen() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('submitted');
    const [rows, setRows] = useState([]);
    const [totals, setTotals] = useState({ awaitingAmount: 0, awaitingCount: 0, verifiedAmount: 0, rejectedAmount: 0 });
    const [busyId, setBusyId] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/franchise/cod/remittances', { params: { status } });
            const data = res.data?.result;
            setRows(data?.remittances || []);
            if (data?.totals) setTotals(data.totals);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load the COD cash list');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        load();
    }, [load]);

    const review = async (id, action, why = '') => {
        try {
            setBusyId(id);
            const res = await api.put(`/franchise/cod/remittances/${id}/review`, { action, reason: why });
            if (res.data?.success) {
                toast.success(action === 'verify' ? 'Cash marked as received' : 'Cash rejected');
                setRejecting(null);
                setReason('');
                await load();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update this cash entry');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-24">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-sm font-bold text-slate-900">COD Cash from Delivery Partners</h1>
                        <p className="text-[11px] text-slate-500">Check the cash your delivery partners hand over for orders that went out from your store.</p>
                    </div>
                    <button
                        onClick={load}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shrink-0"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-200 border-b border-slate-200">
                <div className="bg-slate-900 text-white px-5 py-4">
                    <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1.5">Waiting for your check</p>
                    <p className="text-xl font-black tabular-nums">{money(totals.awaitingAmount)}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{totals.awaitingCount} {totals.awaitingCount === 1 ? 'submission' : 'submissions'}</p>
                </div>
                <div className="bg-white px-5 py-4">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Verified</p>
                    <p className="text-xl font-black text-slate-900 tabular-nums">{money(totals.verifiedAmount)}</p>
                </div>
                <div className="bg-white px-5 py-4">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1.5">Rejected</p>
                    <p className="text-xl font-black text-slate-900 tabular-nums">{money(totals.rejectedAmount)}</p>
                </div>
            </div>

            <div className="px-4 pt-4 flex gap-2 overflow-x-auto">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setStatus(f.key)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap transition-colors',
                            status === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200',
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="p-4 space-y-3">
                {loading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                )}
                {!loading && rows.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                        <Banknote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-500">
                            {status === 'submitted' ? 'No cash is waiting for your check.' : 'Nothing here yet.'}
                        </p>
                    </div>
                )}
                {!loading && rows.map((r) => (
                    <div key={r._id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-slate-900">{r.deliveryPartnerId?.fullName || 'Delivery partner'}</p>
                                <p className="text-[11px] text-slate-500">
                                    {r.deliveryPartnerId?.mobile || ''}{r.deliveryPartnerId?.vehicleNumber ? ` • ${r.deliveryPartnerId.vehicleNumber}` : ''}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{when(r.createdAt)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-slate-900 tabular-nums">{money(r.amount)}</p>
                                <span className={cn('inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded border', STATUS_STYLE[r.status])}>
                                    {STATUS_LABEL[r.status] || r.status}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            <span>{r.orderCount} {r.orderCount === 1 ? 'order' : 'orders'}</span>
                            <span className="uppercase">{String(r.paymentMethod || 'cash').replace('_', ' ')}</span>
                            {r.referenceNo && <span>Ref: {r.referenceNo}</span>}
                            {r.note && <span>Note: {r.note}</span>}
                        </div>

                        {r.status === 'rejected' && r.rejectionReason && (
                            <p className="text-[11px] font-semibold text-rose-600">Reason: {r.rejectionReason}</p>
                        )}
                        {r.status === 'verified' && r.verifiedAt && (
                            <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Verified on {when(r.verifiedAt)}
                            </p>
                        )}

                        {r.status === 'submitted' && (
                            rejecting === r._id ? (
                                <div className="space-y-2">
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Why is the cash not accepted? (e.g. amount is short)"
                                        className="w-full min-h-[72px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-bold outline-none focus:border-slate-400"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setRejecting(null); setReason(''); }}
                                            className="flex-1 h-10 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            disabled={!reason.trim() || busyId === r._id}
                                            onClick={() => review(r._id, 'reject', reason)}
                                            className="flex-1 h-10 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase disabled:opacity-40"
                                        >
                                            Confirm reject
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        disabled={busyId === r._id}
                                        onClick={() => review(r._id, 'verify')}
                                        className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-40"
                                    >
                                        {busyId === r._id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Verify - cash received
                                    </button>
                                    <button
                                        disabled={busyId === r._id}
                                        onClick={() => { setRejecting(r._id); setReason(''); }}
                                        className="h-10 px-4 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-black uppercase flex items-center gap-1.5 disabled:opacity-40"
                                    >
                                        <XCircle size={14} /> Not received
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                ))}
                {!loading && status === 'submitted' && rows.length > 0 && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
                        <Clock size={12} /> Verify only after you have counted the cash in hand.
                    </p>
                )}
            </div>
        </div>
    );
}
