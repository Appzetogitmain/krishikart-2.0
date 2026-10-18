import { useCallback, useEffect, useState } from 'react';
import { Undo2, Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';

/**
 * Orders the customer did not take: the partner brings the goods back to the franchise and enters
 * the franchise's return code to confirm the hand-over.
 */
export default function ReturnToFranchiseCard() {
    const [rows, setRows] = useState([]);
    const [codes, setCodes] = useState({});
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/orders/delivery/returns-to-franchise');
            setRows(res.data?.results || []);
        } catch {
            // not approved yet, offline, ... the card simply stays hidden
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handBack = async (id) => {
        if (busyId) return;
        setBusyId(id);
        try {
            await api.put(`/orders/delivery/${id}/handed-back`, { otp: codes[id] });
            toast.success('Goods handed back to the franchise');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not confirm the hand-over');
        } finally {
            setBusyId(null);
        }
    };

    if (!rows.length) return null;

    return (
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-700">
                <Undo2 size={16} />
                <h3 className="text-sm font-black">Return goods to the franchise ({rows.length})</h3>
            </div>
            <p className="text-[11px] text-slate-500">The customer did not take these orders. Take the goods back to the franchise and enter the code the franchise tells you.</p>
            {rows.map((r) => (
                <div key={r._id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900">#{String(r._id).slice(-6).toUpperCase()} • {r.franchiseName}</p>
                            {r.franchiseAddress && <p className="text-[11px] text-slate-500 truncate">{r.franchiseAddress}</p>}
                            <p className="text-[11px] text-slate-500">{r.items.map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(', ')}</p>
                            {r.reason && <p className="text-[11px] font-semibold text-rose-600">{r.reason}</p>}
                        </div>
                        {r.franchiseMobile && (
                            <a href={`tel:${r.franchiseMobile}`} className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0" aria-label="Call franchise"><Phone size={14} /></a>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            inputMode="numeric"
                            maxLength={4}
                            value={codes[r._id] || ''}
                            onChange={(e) => setCodes((c) => ({ ...c, [r._id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            placeholder="Code"
                            className="flex-1 min-w-0 w-0 h-11 border-2 border-slate-200 rounded-xl px-3 text-center text-lg font-black tracking-[0.3em] outline-none focus:border-slate-900"
                        />
                        <button
                            disabled={busyId === r._id || (codes[r._id] || '').length !== 4}
                            onClick={() => handBack(r._id)}
                            className="h-11 px-4 shrink-0 whitespace-nowrap rounded-xl bg-slate-900 text-white text-xs font-black uppercase disabled:opacity-40 flex items-center gap-1.5"
                        >
                            {busyId === r._id ? <Loader2 size={14} className="animate-spin" /> : 'Handed back'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
