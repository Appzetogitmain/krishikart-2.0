import { useCallback, useEffect, useState } from 'react';
import { Home, ChevronRight, RefreshCw, Loader2, CheckCircle2, XCircle, Warehouse, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

const STATUS = {
    requested: { label: 'Needs approval', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'Approved - store to send', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    sent: { label: 'On the way', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    received: { label: 'Received', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};
const REASON_LABEL = {
    damaged_from_supplier: 'Damaged goods from the supplier',
    rejected_at_receiving: 'Rejected when the delivery arrived',
    spoiled_in_stock: 'Spoiled / expired in stock',
    franchise_closing: 'Franchise closing down',
    other: 'Other',
};
const KIND_LABEL = { from_delivery: 'From a delivery', from_stock: 'From store stock', from_return: 'Passing on returned goods' };
const FILTERS = ['requested', 'approved', 'sent', 'received', 'rejected', 'all'];
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString() : '');
const valueOf = (items) => (items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);

/** Admin: approve every stock return and choose where it goes (vendor or mother franchise). */
export default function StockReturnsScreen() {
    const [status, setStatus] = useState('requested');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dest, setDest] = useState({ vendors: [], mothers: [] });
    const [deciding, setDeciding] = useState(null); // the return being approved/rejected
    const [destType, setDestType] = useState('vendor');
    const [destId, setDestId] = useState('');
    const [adminNote, setAdminNote] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/stock-returns/admin', { params: { status } });
            setRows(res.data?.results || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load returns');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { load(); }, [load]);

    const openDecide = async (r) => {
        setDeciding(r);
        setAdminNote('');
        setRejectReason('');
        // Start on the supplier the goods came from; franchise closing usually goes to a mother franchise
        const s = r.suggested || {};
        if (s.type === 'mother_franchise' && s.franchiseId) { setDestType('mother_franchise'); setDestId(String(s.franchiseId._id || s.franchiseId)); }
        else if (s.type === 'vendor' && s.vendorId && r.reason !== 'franchise_closing') { setDestType('vendor'); setDestId(String(s.vendorId._id || s.vendorId)); }
        else { setDestType(r.reason === 'franchise_closing' ? 'mother_franchise' : 'vendor'); setDestId(''); }
        try {
            const res = await api.get('/stock-returns/admin/destinations');
            setDest(res.data?.result || { vendors: [], mothers: [] });
        } catch {
            setDest({ vendors: [], mothers: [] });
        }
    };

    const approve = async () => {
        if (busy || !destId) return;
        setBusy(true);
        try {
            const body = destType === 'vendor' ? { type: 'vendor', vendorId: destId } : { type: 'mother_franchise', franchiseId: destId };
            const res = await api.put(`/stock-returns/admin/${deciding._id}/approve`, { ...body, note: adminNote });
            toast.success(res.data?.message || 'Approved');
            setDeciding(null);
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not approve');
        } finally {
            setBusy(false);
        }
    };

    const reject = async () => {
        if (busy || !rejectReason.trim()) return;
        setBusy(true);
        try {
            await api.put(`/stock-returns/admin/${deciding._id}/reject`, { reason: rejectReason });
            toast.success('Return rejected');
            setDeciding(null);
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not reject');
        } finally {
            setBusy(false);
        }
    };

    const suggestedName = (r) => r.suggested?.vendorId?.fullName || r.suggested?.franchiseId?.franchiseName || '';
    const destName = (r) => r.destination?.vendorId?.fullName || r.destination?.franchiseId?.franchiseName || '';
    const list = destType === 'vendor'
        ? dest.vendors.map((v) => ({ id: v._id, name: v.fullName, sub: v.farmLocation || v.mobile }))
        : dest.mothers.filter((m) => String(m._id) !== String(deciding?.fromFranchiseId?._id)).map((m) => ({ id: m._id, name: m.franchiseName, sub: [m.area, m.city].filter(Boolean).join(', ') }));

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} /><ChevronRight size={10} /><span>Operations</span><ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Stock Returns</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Approve returns and choose where they go</h1>
                    </div>
                    <button onClick={load} className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 flex gap-2 flex-wrap">
                {FILTERS.map((f) => (
                    <button key={f} onClick={() => setStatus(f)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize', status === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}>
                        {f === 'requested' ? 'Needs approval' : f}
                    </button>
                ))}
            </div>

            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                {loading && <div className="col-span-full flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
                {!loading && rows.length === 0 && <div className="col-span-full bg-white border border-slate-200 rounded-sm p-8 text-center text-xs font-bold text-slate-400">Nothing here.</div>}
                {!loading && rows.map((r) => {
                    const st = STATUS[r.status] || STATUS.requested;
                    return (
                        <div key={r._id} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">{r.fromFranchiseId?.franchiseName || 'Franchise'}{destName(r) ? ` → ${destName(r)}` : ''}</p>
                                    <p className="text-[11px] text-slate-500">#{String(r._id).slice(-6).toUpperCase()} • {when(r.createdAt)} • {KIND_LABEL[r.kind]}</p>
                                    <p className="text-[11px] font-semibold text-slate-600">{REASON_LABEL[r.reason]}{r.note ? ` • ${r.note}` : ''}</p>
                                </div>
                                <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0', st.cls)}>{st.label}</span>
                            </div>
                            <div className="border border-slate-100 rounded-sm divide-y divide-slate-100">
                                {r.items.map((i) => (
                                    <div key={i._id} className="px-3 py-1.5 text-[11px] space-y-1">
                                        <div className="flex justify-between gap-2">
                                            <span className="font-bold text-slate-700">{i.name} <span className="text-slate-400 font-semibold">({i.condition}{i.fromStock ? ', from stock' : ''})</span></span>
                                            <span className="font-black tabular-nums">{i.quantity} {i.unit} × {money(i.price)}</span>
                                        </div>
                                        {i.vendorDecision && (
                                            <p className={i.vendorDecision === 'rejected' ? 'font-bold text-rose-600' : 'font-bold text-emerald-600'}>
                                                {i.vendorDecision === 'rejected' ? 'Vendor rejected' : Number(i.acceptedQuantity) < Number(i.quantity) ? `Vendor accepted ${i.acceptedQuantity} of ${i.quantity} ${i.unit}` : 'Vendor accepted'}
                                            </p>
                                        )}
                                        {i.photos?.length > 0 && (
                                            <div className="flex gap-1.5">{i.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-10 h-10 rounded-sm object-cover border border-slate-200" /></a>)}</div>
                                        )}
                                    </div>
                                ))}
                                <div className="px-3 py-1.5 flex justify-between text-[11px] font-black bg-slate-50"><span>Value</span><span>{money(valueOf(r.items))}</span></div>
                            </div>
                            {r.status === 'requested' && suggestedName(r) && <p className="text-[11px] text-slate-500">Came from: <b>{suggestedName(r)}</b></p>}
                            {r.adminNote && <p className="text-[11px] text-slate-500">Admin note: {r.adminNote}</p>}
                            {r.vendorOutcome && r.vendorOutcome !== 'accepted' && (
                                <p className="text-[11px] font-bold text-rose-600">
                                    {r.vendorOutcome === 'rejected' ? 'Vendor rejected this return' : 'Vendor accepted only part of this return'}{r.receivedNote ? ` — "${r.receivedNote}"` : ''}
                                </p>
                            )}
                            {r.creditNote?.number && <p className="text-[11px] font-bold text-emerald-600">Credit note {r.creditNote.number}: {money(r.creditNote.amount)} • received {when(r.receivedAt)}</p>}
                            {r.status === 'requested' && (
                                <button onClick={() => openDecide(r)} className="w-full h-9 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm">Review & decide</button>
                            )}
                        </div>
                    );
                })}
            </div>

            {deciding && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/50" onClick={() => !busy && setDeciding(null)} />
                    <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
                        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-900">Return from {deciding.fromFranchiseId?.franchiseName}</h3>
                                <p className="text-[11px] text-slate-500">{REASON_LABEL[deciding.reason]} • {money(valueOf(deciding.items))}</p>
                            </div>
                            <button onClick={() => setDeciding(null)} className="text-slate-400"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Send the goods to</p>
                                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-sm">
                                    {[{ k: 'vendor', l: 'Vendor', I: Users }, { k: 'mother_franchise', l: 'Mother franchise', I: Warehouse }].map(({ k, l, I }) => (
                                        <button key={k} onClick={() => { setDestType(k); setDestId(''); }} className={cn('h-9 text-[10px] font-black uppercase rounded-sm flex items-center justify-center gap-1.5', destType === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}>
                                            <I size={12} /> {l}
                                        </button>
                                    ))}
                                </div>
                                {suggestedName(deciding) && <p className="text-[11px] text-slate-500 mt-2">The goods came from <b>{suggestedName(deciding)}</b>.</p>}
                            </div>
                            <div className="space-y-1.5 max-h-72 overflow-y-auto">
                                {list.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">{destType === 'vendor' ? 'No vendors' : 'No mother franchise. Mark one on the Franchises page.'}</p>}
                                {list.map((o) => (
                                    <button key={o.id} onClick={() => setDestId(String(o.id))} className={cn('w-full text-left p-2.5 rounded-sm border-2', destId === String(o.id) ? 'border-slate-900 bg-slate-50' : 'border-slate-200')}>
                                        <p className="text-xs font-black text-slate-900">{o.name}</p>
                                        {o.sub && <p className="text-[10px] text-slate-400">{o.sub}</p>}
                                    </button>
                                ))}
                            </div>
                            <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} maxLength={300} placeholder="Note for the store (optional)" className="w-full h-9 border border-slate-200 rounded-sm px-3 text-xs" />
                            <button disabled={busy || !destId} onClick={approve} className="w-full h-11 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-sm disabled:opacity-40 flex items-center justify-center gap-2">
                                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                            </button>
                            <div className="pt-4 border-t border-slate-100 space-y-2">
                                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} placeholder="Reason to reject (required to reject)" className="w-full min-h-[60px] border border-slate-200 rounded-sm p-2.5 text-xs" />
                                <button disabled={busy || !rejectReason.trim()} onClick={reject} className="w-full h-10 border border-rose-300 text-rose-600 text-[11px] font-black uppercase tracking-widest rounded-sm disabled:opacity-40 flex items-center justify-center gap-2">
                                    <XCircle size={14} /> Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
