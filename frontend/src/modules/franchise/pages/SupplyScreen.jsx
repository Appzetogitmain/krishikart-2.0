import { useCallback, useEffect, useState } from 'react';
import { Send, Loader2, RefreshCw, XCircle, Package, CheckCircle2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';

const FILTERS = [
    { key: 'approved', label: 'To send' },
    { key: 'picked_up', label: 'On the way' },
    { key: 'completed', label: 'Received' },
    { key: 'all', label: 'All' },
];
const STATUS = {
    approved: { label: 'To send', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    preparing: { label: 'Sending', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    picked_up: { label: 'On the way', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed: { label: 'Received by franchise', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};
const when = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString() : '');

/** Mother franchise: stock the admin asked it to send to other franchises. */
export default function SupplyScreen() {
    const { franchise } = useFranchiseAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('approved');
    const [sending, setSending] = useState(null); // request being sent: { _id, qty: { itemId: n } }
    const [declining, setDeclining] = useState(null); // request id
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/procurement/franchise/supply-requests');
            setRows(res.data?.results || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load supply requests');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const socket = getSocket();
        const onUpdate = (data) => {
            if (data?.message) toast.info(data.message);
            load();
        };
        socket.on('supply_request_update', onUpdate);
        return () => socket.off('supply_request_update', onUpdate);
    }, [load]);

    if (franchise && !franchise.isMotherFranchise) {
        return (
            <div className="p-8 text-center text-sm font-bold text-slate-500">
                This page is only for mother franchises. Ask the admin if your store should supply other franchises.
            </div>
        );
    }

    const visible = rows.filter((r) => filter === 'all' || r.status === filter || (filter === 'approved' && r.status === 'preparing'));
    const toSendCount = rows.filter((r) => r.status === 'approved').length;

    const openSend = (r) => {
        const qty = {};
        r.items.forEach((i) => { qty[i._id] = Math.min(Number(i.quantity) || 0, Number(i.myStock) || 0); });
        setSending({ _id: r._id, qty });
        setNote('');
        setDeclining(null);
    };

    const send = async (r) => {
        if (busy) return;
        setBusy(true);
        try {
            const items = r.items.map((i) => ({ itemId: i._id, dispatchedQuantity: Number(sending.qty[i._id]) || 0 }));
            const res = await api.put(`/procurement/franchise/supply-requests/${r._id}/dispatch`, { items, note });
            toast.success(res.data?.message || 'Stock sent');
            setSending(null);
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not send the stock');
        } finally {
            setBusy(false);
        }
    };

    const decline = async (id) => {
        if (busy || !reason.trim()) return;
        setBusy(true);
        try {
            await api.put(`/procurement/franchise/supply-requests/${id}/decline`, { reason });
            toast.success('Sent back to the admin');
            setDeclining(null);
            setReason('');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not send it back');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-24">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Send size={14} /> Supply to Franchises</h1>
                        <p className="text-[11px] text-slate-500">Stock the admin asked you to send to other franchises from your own stock.</p>
                    </div>
                    <button onClick={load} className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shrink-0">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="px-4 pt-4 flex gap-2 overflow-x-auto">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap',
                            filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}
                    >
                        {f.label}{f.key === 'approved' && toSendCount > 0 ? ` (${toSendCount})` : ''}
                    </button>
                ))}
            </div>

            <div className="p-4 space-y-3">
                {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
                {!loading && visible.length === 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-500">{filter === 'approved' ? 'Nothing to send right now.' : 'Nothing here yet.'}</p>
                    </div>
                )}
                {!loading && visible.map((r) => {
                    const st = STATUS[r.status] || { label: r.status, cls: 'bg-slate-50 text-slate-500 border-slate-200' };
                    const isSending = sending?._id === r._id;
                    return (
                        <div key={r._id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">To: {r.franchiseId?.franchiseName || 'Franchise'}</p>
                                    <p className="text-[11px] text-slate-500">{[r.franchiseId?.area, r.franchiseId?.city].filter(Boolean).join(', ')}{r.franchiseId?.mobile ? ` • ${r.franchiseId.mobile}` : ''}</p>
                                    <p className="text-[11px] text-slate-400">Request #{String(r._id).slice(-6).toUpperCase()} • {when(r.createdAt)}</p>
                                </div>
                                <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0', st.cls)}>{st.label}</span>
                            </div>

                            <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                                {r.items.map((i) => {
                                    const short = r.status === 'approved' && Number(i.myStock) < Number(i.quantity);
                                    return (
                                        <div key={i._id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-800 truncate">{i.name}</p>
                                                {r.status === 'approved' && (
                                                    <p className={cn('text-[10px] font-semibold', short ? 'text-rose-600' : 'text-slate-400')}>
                                                        Your stock: {i.myStock} {i.unit}{short ? ' (not enough)' : ''}
                                                    </p>
                                                )}
                                                {r.status === 'completed' && (
                                                    <p className="text-[10px] font-semibold text-slate-400">
                                                        Received {i.receivedQuantity} {i.unit}{i.rejected ? ' • rejected' : Number(i.damagedQuantity) > 0 ? ` • ${i.damagedQuantity} damaged` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            {isSending ? (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={i.quantity}
                                                        step="any"
                                                        value={sending.qty[i._id]}
                                                        onChange={(e) => {
                                                            const v = e.target.value === '' ? '' : Math.max(0, Math.min(Number(i.quantity), Number(e.target.value)));
                                                            setSending((s) => ({ ...s, qty: { ...s.qty, [i._id]: v } }));
                                                        }}
                                                        className="w-20 h-8 border border-slate-200 rounded px-2 text-right font-bold"
                                                    />
                                                    <span className="text-[10px] text-slate-500 w-14">/ {i.quantity} {i.unit}</span>
                                                </div>
                                            ) : (
                                                <span className="font-black text-slate-900 tabular-nums shrink-0">{i.dispatchedQuantity || i.quantity} {i.unit}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {r.status === 'picked_up' && (
                                <p className="text-[11px] font-semibold text-blue-600 flex items-center gap-1"><Truck size={12} /> Sent {when(r.supplierDispatchedAt)}{r.invoice?.invoiceNumber ? ` • ${r.invoice.invoiceNumber}` : ''}. Waiting for the franchise to check it in.</p>
                            )}
                            {r.status === 'completed' && (
                                <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Checked in by the franchise</p>
                            )}

                            {r.status === 'approved' && !isSending && declining !== r._id && (
                                <div className="flex gap-2">
                                    <button onClick={() => openSend(r)} className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1.5">
                                        <Send size={14} /> Send stock
                                    </button>
                                    <button onClick={() => { setDeclining(r._id); setReason(''); setSending(null); }} className="h-10 px-4 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-black uppercase flex items-center gap-1.5">
                                        <XCircle size={14} /> Cannot supply
                                    </button>
                                </div>
                            )}

                            {isSending && (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-slate-500">Enter what you are sending. It leaves your stock now. Anything you do not send goes back to the admin to get from someone else.</p>
                                    <input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        maxLength={300}
                                        placeholder="Note (optional, e.g. vehicle number)"
                                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-semibold"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setSending(null)} className="flex-1 h-10 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500">Cancel</button>
                                        <button disabled={busy} onClick={() => send(r)} className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase disabled:opacity-40 flex items-center justify-center">
                                            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Confirm & send'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {declining === r._id && (
                                <div className="space-y-2">
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        maxLength={300}
                                        placeholder="Why can't you send it? (e.g. out of stock)"
                                        className="w-full min-h-[64px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-semibold"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setDeclining(null)} className="flex-1 h-10 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500">Cancel</button>
                                        <button disabled={busy || !reason.trim()} onClick={() => decline(r._id)} className="flex-1 h-10 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase disabled:opacity-40">Send back to admin</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
