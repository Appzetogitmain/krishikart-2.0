import { useCallback, useEffect, useMemo, useState } from 'react';
import { Undo2, Loader2, RefreshCw, Plus, Send, CheckCircle2, XCircle, Search, PackageX, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';

const STATUS = {
    requested: { label: 'Waiting for admin', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: 'Approved - send it', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    sent: { label: 'On the way', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    received: { label: 'Received', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Not approved', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};
const REASON_LABEL = {
    damaged_from_supplier: 'Damaged goods from the supplier',
    rejected_at_receiving: 'Rejected when the delivery arrived',
    spoiled_in_stock: 'Spoiled / expired in stock',
    franchise_closing: 'Franchise closing down',
    other: 'Other',
};
const SOURCES = [
    { key: 'from_delivery', title: 'Damaged / rejected goods from a delivery', desc: 'Goods you marked damaged or rejected when checking a delivery in.' },
    { key: 'from_stock', title: 'From my stock', desc: 'Goods in your stock: spoiled later, franchise closing, or anything else.' },
    { key: 'from_return', title: 'Pass on returned goods', desc: 'Damaged goods other franchises returned to you.', motherOnly: true },
];
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString() : '');
const destName = (r) => r.destination?.vendorId?.fullName || r.destination?.franchiseId?.franchiseName || '';

/** Returns going back up the supply chain: franchise -> vendor / mother franchise (admin approves). */
export default function StockReturnsScreen() {
    const { franchise } = useFranchiseAuth();
    const isMother = !!franchise?.isMotherFranchise;
    const [tab, setTab] = useState('mine');
    const [mine, setMine] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    // New return form
    const [options, setOptions] = useState(null);
    const [kind, setKind] = useState(null);
    const [sourceId, setSourceId] = useState('');
    const [qty, setQty] = useState({});
    const [photos, setPhotos] = useState({}); // productId -> [photo urls] (proof of damage, up to 3)
    const [uploading, setUploading] = useState(null);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [stockSearch, setStockSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/stock-returns/franchise');
            setMine(res.data?.result?.mine || []);
            setIncoming(res.data?.result?.incoming || []);
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

    const openNew = async () => {
        setTab('new');
        setKind(null);
        setSourceId('');
        setQty({});
        setPhotos({});
        setReason('');
        setNote('');
        try {
            const res = await api.get('/stock-returns/franchise/options');
            setOptions(res.data?.result || { deliveries: [], stock: [], received: [] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load what you can return');
        }
    };

    // Lines the user can enter quantities for, given the chosen source
    const lines = useMemo(() => {
        if (!options || !kind) return [];
        if (kind === 'from_delivery') {
            const d = options.deliveries.find((x) => String(x.requestId) === sourceId);
            return (d?.items || []).map((i) => ({ ...i, max: i.returnable, hint: i.rejected ? 'Rejected' : `${i.damaged} ${i.unit} damaged` }));
        }
        if (kind === 'from_return') {
            const d = options.received.find((x) => String(x.returnId) === sourceId);
            return (d?.items || []).map((i) => ({ ...i, max: i.returnable, hint: 'Damaged' }));
        }
        const q = stockSearch.trim().toLowerCase();
        return options.stock
            .filter((i) => !q || String(i.name).toLowerCase().includes(q) || Number(qty[i.productId]) > 0)
            .map((i) => ({ ...i, max: i.inStock, hint: `In stock: ${i.inStock} ${i.unit}` }));
    }, [options, kind, sourceId, stockSearch, qty]);

    const reasonsFor = kind === 'from_stock'
        ? ['spoiled_in_stock', 'franchise_closing', 'damaged_from_supplier', 'other']
        : ['damaged_from_supplier', 'rejected_at_receiving', 'other'];

    const chosen = Object.entries(qty).filter(([, v]) => Number(v) > 0);
    const total = (options && kind)
        ? chosen.reduce((s, [pid, v]) => {
            const all = kind === 'from_stock' ? options.stock : lines;
            const l = all.find((x) => String(x.productId) === pid);
            return s + (Number(l?.price) || 0) * Number(v);
        }, 0)
        : 0;

    const submit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await api.post('/stock-returns/franchise', {
                kind,
                procurementRequestId: kind === 'from_delivery' ? sourceId : undefined,
                sourceReturnId: kind === 'from_return' ? sourceId : undefined,
                reason,
                note,
                items: chosen.map(([productId, quantity]) => ({ productId, quantity: Number(quantity), photos: photos[productId] || [] })),
            });
            toast.success('Return sent to the admin for approval');
            setTab('mine');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not create the return');
        } finally {
            setSubmitting(false);
        }
    };

    // Photos of the damaged goods, so the vendor can see what is coming back
    const addPhotos = async (productId, fileList) => {
        const have = photos[productId] || [];
        const files = [...(fileList || [])].slice(0, 3 - have.length);
        if (!files.length) { toast.error('Up to 3 photos per item'); return; }
        const form = new FormData();
        files.forEach((f) => form.append('photos', f));
        setUploading(productId);
        try {
            const res = await api.post('/stock-returns/franchise/photos', form, { headers: { 'Content-Type': null } });
            const urls = res.data?.result?.urls || [];
            setPhotos((p) => ({ ...p, [productId]: [...(p[productId] || []), ...urls].slice(0, 3) }));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not upload the photo');
        } finally {
            setUploading(null);
        }
    };

    const act = async (id, path, okMsg) => {
        if (busyId) return;
        setBusyId(id);
        try {
            await api.put(`/stock-returns/franchise/${id}/${path}`, {});
            toast.success(okMsg);
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update the return');
        } finally {
            setBusyId(null);
        }
    };

    const canSubmit = kind && reason && chosen.length > 0 && (kind === 'from_stock' || sourceId) && (reason !== 'other' || note.trim());

    const ReturnCard = ({ r, side }) => {
        const st = STATUS[r.status] || STATUS.requested;
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-slate-900">
                            {side === 'in' ? `From: ${r.fromFranchiseId?.franchiseName || 'Franchise'}` : (destName(r) ? `To: ${destName(r)}` : 'Destination: admin will decide')}
                        </p>
                        <p className="text-[11px] text-slate-500">Return #{String(r._id).slice(-6).toUpperCase()} • {when(r.createdAt)}</p>
                        <p className="text-[11px] text-slate-500">{REASON_LABEL[r.reason] || r.reason}{r.note ? ` • ${r.note}` : ''}</p>
                    </div>
                    <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded border shrink-0', st.cls)}>{st.label}</span>
                </div>
                <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                    {r.items.map((i) => (
                        <div key={i._id || i.productId} className="px-3 py-2 text-xs space-y-1.5">
                            <div className="flex justify-between gap-2">
                                <span className="font-bold text-slate-800">{i.name} <span className="font-semibold text-slate-400">({i.condition})</span></span>
                                <span className="font-black text-slate-900 tabular-nums">{i.quantity} {i.unit}</span>
                            </div>
                            {i.vendorDecision && (
                                <p className={cn('font-bold', i.vendorDecision === 'rejected' ? 'text-rose-600' : 'text-emerald-600')}>
                                    {i.vendorDecision === 'rejected' ? 'Vendor rejected' : Number(i.acceptedQuantity) < Number(i.quantity) ? `Vendor accepted ${i.acceptedQuantity} ${i.unit}` : 'Vendor accepted'}
                                </p>
                            )}
                            {i.photos?.length > 0 && (
                                <div className="flex gap-1.5">{i.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-10 h-10 rounded object-cover border border-slate-200" /></a>)}</div>
                            )}
                        </div>
                    ))}
                </div>
                {r.status === 'rejected' && r.adminNote && <p className="text-[11px] font-semibold text-rose-600">Admin: {r.adminNote}</p>}
                {r.status === 'approved' && r.adminNote && <p className="text-[11px] font-semibold text-slate-500">Admin note: {r.adminNote}</p>}
                {r.creditNote?.number && (
                    <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Credit note {r.creditNote.number}: {money(r.creditNote.amount)}
                    </p>
                )}
                {side === 'mine' && r.status === 'requested' && (
                    <button disabled={busyId === r._id} onClick={() => act(r._id, 'cancel', 'Return cancelled')} className="h-9 px-4 rounded-lg border border-slate-200 text-[11px] font-black uppercase text-slate-500 disabled:opacity-40">
                        Cancel return
                    </button>
                )}
                {side === 'mine' && r.status === 'approved' && (
                    <button disabled={busyId === r._id} onClick={() => act(r._id, 'sent', 'Marked as sent')} className="w-full h-10 rounded-lg bg-slate-900 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-40">
                        {busyId === r._id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} I have handed it over to {destName(r)}
                    </button>
                )}
                {side === 'in' && r.status === 'sent' && (
                    <button disabled={busyId === r._id} onClick={() => act(r._id, 'received', 'Return received')} className="w-full h-10 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase flex items-center justify-center gap-1.5 disabled:opacity-40">
                        {busyId === r._id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Goods received
                    </button>
                )}
                {side === 'in' && r.status === 'approved' && <p className="text-[11px] text-slate-500">Approved by admin. Waiting for the franchise to send it.</p>}
            </div>
        );
    };

    const tabs = [
        { key: 'mine', label: 'My returns' },
        ...(isMother ? [{ key: 'incoming', label: `Returned to me${incoming.filter((x) => x.status === 'sent').length ? ` (${incoming.filter((x) => x.status === 'sent').length})` : ''}` }] : []),
    ];

    return (
        <div className="bg-slate-50 min-h-screen pb-24">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Undo2 size={14} /> Return to Supplier</h1>
                        <p className="text-[11px] text-slate-500">Send goods back to the vendor or mother franchise. Every return is approved by the admin.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={load} className="px-3 py-1.5 border border-slate-200 bg-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={openNew} className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <Plus size={12} /> New return
                        </button>
                    </div>
                </div>
            </div>

            {tab !== 'new' && (
                <div className="px-4 pt-4 flex gap-2">
                    {tabs.map((t) => (
                        <button key={t.key} onClick={() => setTab(t.key)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border', tab === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {tab !== 'new' && (
                <div className="p-4 space-y-3">
                    {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
                    {!loading && (tab === 'mine' ? mine : incoming).length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                            <PackageX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-500">{tab === 'mine' ? 'No returns yet.' : 'Nothing has been returned to you.'}</p>
                        </div>
                    )}
                    {!loading && (tab === 'mine' ? mine : incoming).map((r) => <ReturnCard key={r._id} r={r} side={tab === 'mine' ? 'mine' : 'in'} />)}
                </div>
            )}

            {tab === 'new' && (
                <div className="p-4 space-y-4 max-w-3xl">
                    {!options ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <p className="text-[11px] font-black uppercase text-slate-500">1. What are you returning?</p>
                                {SOURCES.filter((s) => !s.motherOnly || isMother).map((s) => {
                                    const count = s.key === 'from_delivery' ? options.deliveries.length : s.key === 'from_return' ? options.received.length : options.stock.length;
                                    return (
                                        <button
                                            key={s.key}
                                            disabled={count === 0}
                                            onClick={() => { setKind(s.key); setSourceId(''); setQty({}); setReason(s.key === 'from_stock' ? '' : 'damaged_from_supplier'); }}
                                            className={cn('w-full text-left p-3 rounded-xl border-2 bg-white disabled:opacity-40', kind === s.key ? 'border-slate-900' : 'border-slate-200')}
                                        >
                                            <p className="text-sm font-black text-slate-900">{s.title}</p>
                                            <p className="text-[11px] text-slate-500">{count === 0 ? 'Nothing to return here.' : s.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            {kind === 'from_delivery' && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black uppercase text-slate-500">2. Which delivery?</p>
                                    {options.deliveries.map((d) => (
                                        <button key={d.requestId} onClick={() => { setSourceId(String(d.requestId)); setQty({}); }} className={cn('w-full text-left p-3 rounded-xl border-2 bg-white', sourceId === String(d.requestId) ? 'border-slate-900' : 'border-slate-200')}>
                                            <p className="text-xs font-black text-slate-900">{d.ref} from {d.supplierName}</p>
                                            <p className="text-[11px] text-slate-500">Received {when(d.receivedAt)} • {d.items.map((i) => `${i.name} ${i.returnable} ${i.unit}`).join(', ')}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {kind === 'from_return' && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black uppercase text-slate-500">2. Which returned goods?</p>
                                    {options.received.map((d) => (
                                        <button key={d.returnId} onClick={() => { setSourceId(String(d.returnId)); setQty({}); }} className={cn('w-full text-left p-3 rounded-xl border-2 bg-white', sourceId === String(d.returnId) ? 'border-slate-900' : 'border-slate-200')}>
                                            <p className="text-xs font-black text-slate-900">{d.ref} from {d.fromName}</p>
                                            <p className="text-[11px] text-slate-500">{d.items.map((i) => `${i.name} ${i.returnable} ${i.unit}`).join(', ')}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {kind && (kind === 'from_stock' || sourceId) && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black uppercase text-slate-500">{kind === 'from_stock' ? '2' : '3'}. How much?</p>
                                    {kind === 'from_stock' && (
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Search your stock..." className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold" />
                                        </div>
                                    )}
                                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                                        {lines.map((l) => (
                                            <div key={l.productId} className="px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{l.name}</p>
                                                    <p className="text-[10px] text-slate-400">{l.hint} • rate {money(l.price)}/{l.unit}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={l.max}
                                                        step="any"
                                                        value={qty[l.productId] ?? ''}
                                                        placeholder="0"
                                                        onChange={(e) => {
                                                            const v = e.target.value === '' ? '' : Math.max(0, Math.min(Number(l.max), Number(e.target.value)));
                                                            setQty((q) => ({ ...q, [l.productId]: v }));
                                                        }}
                                                        className="w-20 h-8 border border-slate-200 rounded px-2 text-right text-xs font-bold"
                                                    />
                                                    <span className="text-[10px] text-slate-500 w-16">/ {l.max} {l.unit}</span>
                                                </div>
                                                {Number(qty[l.productId]) > 0 && (
                                                    <div className="basis-full flex items-center gap-2 flex-wrap">
                                                        {(photos[l.productId] || []).map((u) => (
                                                            <span key={u} className="relative">
                                                                <img src={u} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                                                                <button type="button" onClick={() => setPhotos((p) => ({ ...p, [l.productId]: p[l.productId].filter((x) => x !== u) }))}
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center" aria-label="Remove photo"><X size={12} /></button>
                                                            </span>
                                                        ))}
                                                        {(photos[l.productId] || []).length < 3 && (
                                                            <label className={cn('h-12 px-3 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer', uploading === l.productId && 'opacity-50 pointer-events-none')}>
                                                                {uploading === l.productId ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Add photo
                                                                <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                                                                    onChange={(e) => { addPhotos(l.productId, e.target.files); e.target.value = ''; }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {lines.length === 0 && <p className="p-4 text-xs text-slate-400 text-center">No items</p>}
                                    </div>
                                </div>
                            )}

                            {kind && chosen.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black uppercase text-slate-500">Reason</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {reasonsFor.map((k) => (
                                            <button key={k} onClick={() => setReason(k)} className={cn('p-2.5 rounded-lg border-2 text-left text-xs font-bold bg-white', reason === k ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-600')}>
                                                {REASON_LABEL[k]}
                                            </button>
                                        ))}
                                    </div>
                                    {reason === 'franchise_closing' && (
                                        <p className="text-[11px] text-indigo-700 font-semibold">The admin can send good stock to a mother franchise.</p>
                                    )}
                                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={reason === 'other' ? 'Write what happened (required)' : 'Note (optional)'} className="w-full min-h-[64px] bg-white border border-slate-200 rounded-lg p-3 text-xs font-semibold" />
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                                        <span>{chosen.length} item(s)</span>
                                        <span>Value about {money(total)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setTab('mine')} className="flex-1 h-11 rounded-lg border border-slate-200 bg-white text-[11px] font-black uppercase text-slate-500">Cancel</button>
                                        <button disabled={!canSubmit || submitting} onClick={submit} className="flex-1 h-11 rounded-lg bg-slate-900 text-white text-[11px] font-black uppercase disabled:opacity-40 flex items-center justify-center gap-2">
                                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to admin for approval
                                        </button>
                                    </div>
                                </div>
                            )}
                            {!kind && (
                                <button onClick={() => setTab('mine')} className="text-xs font-bold text-slate-500 flex items-center gap-1"><XCircle size={12} /> Back</button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
