import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, XCircle, RefreshCw, Loader2, Clock, Wallet, Phone, CalendarDays, FileText, Info, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { FranchisePageHeader, StatTile, PillTabs } from '../components/layout/FranchisePageHeader';

/*
 * COD cash the delivery partners hand over to this store: the franchise counts it and verifies or rejects
 * each entry. Built to the client's mockup (Hinglish labels).
 */

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const valid = (d) => d && !isNaN(new Date(d).getTime());
const dateOf = (d) => (valid(d) ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const timeOf = (d) => (valid(d) ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
const dayKey = (d) => { if (!valid(d)) return ''; const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const entries = (n) => `${n || 0} ${n === 1 ? 'entry' : 'entries'}`;

const AVATAR = ['bg-blue-50 text-blue-600', 'bg-green-50 text-green-700', 'bg-violet-50 text-violet-600', 'bg-amber-50 text-amber-600'];

export default function CashManagementScreen() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('submitted');
    const [rows, setRows] = useState([]);
    const [totals, setTotals] = useState({ awaitingAmount: 0, awaitingCount: 0, verifiedAmount: 0, rejectedAmount: 0 });
    const [busyId, setBusyId] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');
    const [query, setQuery] = useState('');
    const [day, setDay] = useState('');

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

    const q = query.trim().toLowerCase();
    const shown = rows.filter((r) => {
        if (day && dayKey(r.createdAt) !== day) return false;
        if (!q) return true;
        const ids = (r.orderIds || []).map((id) => String(id).toLowerCase());
        return (r.deliveryPartnerId?.fullName || '').toLowerCase().includes(q)
            || (r.deliveryPartnerId?.mobile || '').includes(q)
            || ids.some((id) => id.includes(q));
    });

    const tabs = [
        { id: 'submitted', label: 'Check karna hai', count: totals.awaitingCount },
        { id: 'verified', label: 'Verified', count: totals.verifiedCount },
        { id: 'rejected', label: 'Rejected', count: totals.rejectedCount },
        { id: 'all', label: 'All', count: totals.allCount },
    ];

    const renderStatus = (r) => {
        if (r.status === 'verified') {
            return (
                <div className="space-y-1">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-800 text-[15px] font-bold"><CheckCircle2 size={20} className="text-green-600" /> Verified</span>
                    {r.verifiedAt && <p className="text-[13px] text-slate-500">Verified on {dateOf(r.verifiedAt)}, {timeOf(r.verifiedAt)}</p>}
                </div>
            );
        }
        if (r.status === 'rejected') {
            return (
                <div className="space-y-1">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[15px] font-bold"><XCircle size={20} /> Rejected</span>
                    {r.rejectionReason && <p className="text-[13px] text-rose-600">Reason: {r.rejectionReason}</p>}
                </div>
            );
        }
        if (rejecting === r._id) {
            return (
                <div className="space-y-2">
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Cash kyun nahi liya? (jaise amount kam hai)"
                        className="w-full min-h-[72px] bg-white border border-slate-200 rounded-xl p-3 text-[14px] outline-none focus:border-rose-400"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setRejecting(null); setReason(''); }}
                            className="flex-1 h-11 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-600"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={!reason.trim() || busyId === r._id}
                            onClick={() => review(r._id, 'reject', reason)}
                            className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-[14px] font-bold disabled:opacity-40"
                        >
                            Confirm reject
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="space-y-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-[14px] font-bold"><Clock size={18} /> Check karna hai</span>
                <p className="text-[13px] text-slate-500">Partner ne cash handover kiya hai</p>
                <div className="flex flex-wrap gap-2">
                    <button
                        disabled={busyId === r._id}
                        onClick={() => review(r._id, 'verify')}
                        className="h-11 px-4 rounded-xl bg-green-700 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 hover:bg-green-800 disabled:opacity-40"
                    >
                        {busyId === r._id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Cash mil gaya / Verify
                    </button>
                    <button
                        disabled={busyId === r._id}
                        onClick={() => { setRejecting(r._id); setReason(''); }}
                        className="h-11 px-4 rounded-xl border border-rose-300 bg-white text-rose-600 text-[14px] font-bold flex items-center gap-1.5 hover:bg-rose-50 disabled:opacity-40"
                    >
                        <XCircle size={16} /> Amount galat / Reject
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-24 lg:pb-8">
            <FranchisePageHeader
                icon={Wallet}
                title="COD Cash / डिलीवरी से मिला कैश"
                subtitle="Delivery partners se mila cash check karein aur confirm karein."
                right={
                    <button onClick={load} className="h-14 w-14 rounded-2xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50" aria-label="Refresh">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 px-4 lg:px-6">
                <StatTile tone="orange" icon={Clock} label="Check karna hai (आपके पास चेक करने के लिए)" value={money(totals.awaitingAmount)} note={entries(totals.awaitingCount)} onClick={() => setStatus('submitted')} active={status === 'submitted'} />
                <StatTile tone="green" icon={CheckCircle2} label="Verified (सही पाया गया)" value={money(totals.verifiedAmount)} note={entries(totals.verifiedCount)} onClick={() => setStatus('verified')} active={status === 'verified'} />
                <StatTile tone="red" icon={XCircle} label="Rejected (गलत / समस्या)" value={money(totals.rejectedAmount)} note={entries(totals.rejectedCount)} onClick={() => setStatus('rejected')} active={status === 'rejected'} />
            </div>

            <div className="px-4 lg:px-6 mt-5 flex flex-wrap items-center gap-3">
                <PillTabs tabs={tabs} active={status} onChange={setStatus} />
                <div className="flex-1" />
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by delivery partner name or order ID"
                        className="w-full sm:w-80 h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-4 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-green-600"
                    />
                </div>
                <label className="flex items-center gap-2 h-11 px-3 rounded-xl border border-slate-200 bg-white">
                    <CalendarDays size={18} className="text-slate-600" />
                    <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="text-[14px] font-semibold text-slate-900 bg-transparent outline-none" aria-label="Select date" />
                    {day && <button type="button" onClick={() => setDay('')} aria-label="Clear date" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>}
                </label>
            </div>

            <div className="px-4 lg:px-6 mt-4">
                <div className="flex items-start gap-3 rounded-2xl bg-green-50 border border-green-100 p-4">
                    <Info size={22} className="text-green-700 shrink-0 mt-0.5" />
                    <div className="text-[14px] text-slate-700">
                        <p><b className="text-slate-900">Important:</b> Sirf wahi entry verify karein jab aapne delivery partner se physically cash le kar count kar liya ho.</p>
                        <p className="text-slate-500">Agar amount kam ya zyada ho to "Reject" karein aur note daalein.</p>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6 mt-4 space-y-3">
                {loading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
                    </div>
                )}
                {!loading && shown.length === 0 && (
                    <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-500">
                        <Banknote className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-[15px]">{status === 'submitted' ? 'Abhi koi cash check ke liye nahi hai.' : 'Yahan abhi kuch nahi hai.'}</p>
                    </div>
                )}
                {!loading && shown.map((r, idx) => {
                    const name = r.deliveryPartnerId?.fullName || 'Delivery partner';
                    const ids = (r.orderIds || []).map((id) => `#${String(id).slice(-4).toUpperCase()}`);
                    return (
                        <div key={r._id} className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px_minmax(0,1.1fr)] gap-4 items-center">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={cn('w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0', AVATAR[idx % AVATAR.length])}>{name.charAt(0).toUpperCase()}</span>
                                <div className="min-w-0">
                                    <p className="text-[16px] font-bold text-slate-900 truncate">{name}</p>
                                    {r.deliveryPartnerId?.mobile && <p className="text-[14px] text-slate-500 flex items-center gap-1.5"><Phone size={14} /> {r.deliveryPartnerId.mobile}</p>}
                                </div>
                            </div>
                            <div className="space-y-2 text-[14px] text-slate-700 xl:border-l xl:border-slate-100 xl:pl-4 min-w-0">
                                <p className="flex items-start gap-2"><CalendarDays size={18} className="text-slate-500 shrink-0" /><span>{dateOf(r.createdAt)}<br /><span className="text-slate-500">{timeOf(r.createdAt)}</span></span></p>
                                <p className="flex items-start gap-2"><FileText size={18} className="text-slate-500 shrink-0" />
                                    <span className="min-w-0">{r.orderCount} {r.orderCount === 1 ? 'order' : 'orders'}{ids.length > 0 && <><br /><span className="text-[13px] text-slate-500 break-words">Order IDs: {ids.join(', ')}</span></>}</span>
                                </p>
                                {(r.referenceNo || r.note) && <p className="text-[13px] text-slate-500">{r.referenceNo ? `Ref: ${r.referenceNo}` : ''}{r.referenceNo && r.note ? ' · ' : ''}{r.note ? `Note: ${r.note}` : ''}</p>}
                            </div>
                            <div className={cn('flex items-center gap-3 rounded-2xl p-4', r.status === 'submitted' ? 'bg-amber-50/70' : r.status === 'rejected' ? 'bg-rose-50/70' : 'bg-green-50/70')}>
                                <Banknote size={30} className={r.status === 'submitted' ? 'text-amber-500' : r.status === 'rejected' ? 'text-rose-500' : 'text-green-600'} />
                                <div>
                                    <p className="text-[13px] text-slate-600">{String(r.paymentMethod || 'cash') === 'cash' ? 'Cash Amount' : `${String(r.paymentMethod).replace('_', ' ').toUpperCase()} Amount`}</p>
                                    <p className="text-[22px] font-bold text-slate-900 tabular-nums">{money(r.amount)}</p>
                                </div>
                            </div>
                            <div className="xl:border-l xl:border-slate-100 xl:pl-4">{renderStatus(r)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
