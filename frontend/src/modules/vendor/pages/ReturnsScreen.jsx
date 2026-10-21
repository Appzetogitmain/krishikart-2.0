import { useCallback, useEffect, useState } from 'react';
import { Undo2, Loader2, RefreshCw, CheckCircle2, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { keepPage, peekPage } from '../lib/pageCache';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';

const STATUS = {
    approved: { label: 'Coming to you', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    sent: { label: 'Handed over - confirm', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    received: { label: 'Received', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};
const REASON_LABEL = {
    damaged_from_supplier: 'Damaged goods',
    rejected_at_receiving: 'Rejected at delivery',
    spoiled_in_stock: 'Spoiled / expired',
    franchise_closing: 'Franchise closing',
    other: 'Other',
};
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString() : '');

/** Vendor: goods franchises are returning (approved by the admin). */
export default function ReturnsScreen() {
    const [rows, setRows] = useState(() => peekPage('returns') || []);
    const [loading, setLoading] = useState(!peekPage('returns'));
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/stock-returns/vendor');
            setRows(keepPage('returns', res.data?.results || []));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load returns');
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
        socket.on('stock_return_update', onUpdate);
        return () => socket.off('stock_return_update', onUpdate);
    }, [load]);

    const confirm = async (id) => {
        if (busyId) return;
        setBusyId(id);
        try {
            await api.put(`/stock-returns/vendor/${id}/received`, {});
            toast.success('Return received');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not confirm');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 pb-28">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-lg font-black text-slate-900 flex items-center gap-2"><Undo2 size={18} /> Returns</h1>
                    <p className="text-xs text-slate-500">Goods franchises are sending back to you. Confirm when you receive them; a credit note is made for the amount.</p>
                </div>
                <button onClick={load} className="p-2 border border-slate-200 rounded-lg bg-white"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
            </div>
            {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
            {!loading && rows.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <PackageX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500">No returns.</p>
                </div>
            )}
            {!loading && rows.map((r) => {
                const st = STATUS[r.status] || STATUS.approved;
                return (
                    <div key={r._id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-slate-900">From: {r.fromFranchiseId?.franchiseName || 'Franchise'}</p>
                                <p className="text-[11px] text-slate-500">{[r.fromFranchiseId?.area, r.fromFranchiseId?.city].filter(Boolean).join(', ')}{r.fromFranchiseId?.mobile ? ` • ${r.fromFranchiseId.mobile}` : ''}</p>
                                <p className="text-[11px] text-slate-500">Return #{String(r._id).slice(-6).toUpperCase()} • {REASON_LABEL[r.reason] || r.reason}{r.note ? ` • ${r.note}` : ''}</p>
                            </div>
                            <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0', st.cls)}>{st.label}</span>
                        </div>
                        <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                            {r.items.map((i) => (
                                <div key={i._id} className="px-3 py-2 flex justify-between text-xs">
                                    <span className="font-bold text-slate-800">{i.name} <span className="text-slate-400 font-semibold">({i.condition})</span></span>
                                    <span className="font-black tabular-nums">{i.quantity} {i.unit}</span>
                                </div>
                            ))}
                        </div>
                        {r.status === 'sent' && (
                            <button disabled={busyId === r._id} onClick={() => confirm(r._id)} className="w-full h-10 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-40">
                                {busyId === r._id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Goods received
                            </button>
                        )}
                        {r.status === 'approved' && <p className="text-[11px] text-slate-500">Approved by admin. The franchise will hand it over.</p>}
                        {r.creditNote?.number && <p className="text-[11px] font-bold text-emerald-600">Credit note {r.creditNote.number}: {money(r.creditNote.amount)} • {when(r.receivedAt)}</p>}
                    </div>
                );
            })}
        </div>
    );
}
