import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Home, Loader2, Package, RefreshCw, Send, Truck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

/*
 * Admin side of the vendor's quotation page: per vendor, everything given to them added up product-wise.
 * For each item the admin accepts the vendor's rate or sends another rate; both sides chat here.
 * Agreed items go to the vendor's packing list.
 */

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const qtyText = (q, unit) => `${Number(q || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${String(unit || '').toUpperCase()}`;
const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const STATUS = {
    open: { label: 'Vendor rate awaited', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    sent: { label: 'Waiting for you', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    countered: { label: 'Your offer sent', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    final: { label: 'Final', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function Img({ src }) {
    return src
        ? <img src={src} alt="" className="w-10 h-10 object-contain shrink-0 rounded bg-white" loading="lazy" />
        : <span className="w-10 h-10 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><Package size={16} /></span>;
}

function ItemRow({ row, vendorId, onDone }) {
    const [offer, setOffer] = useState('');
    const [busy, setBusy] = useState(null);
    const respond = async (action) => {
        if (action === 'counter' && !(Number(offer) > 0)) return toast.error('Enter your rate');
        setBusy(action);
        try {
            const res = await api.post(`/procurement/admin/rate-sheets/${vendorId}/respond`, {
                productId: row.productId, unit: row.unit, action, rate: action === 'counter' ? Number(offer) : undefined,
            });
            toast.success(res.data?.message || 'Done');
            setOffer('');
            onDone(res.data?.result);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update');
        } finally {
            setBusy(null);
        }
    };
    const st = STATUS[row.status];
    return (
        <div className={cn('grid grid-cols-2 lg:grid-cols-[minmax(150px,1fr)_80px_120px_110px_140px] gap-x-3 gap-y-2 items-center px-3 py-2.5 text-xs', row.status === 'sent' && 'bg-amber-50/40')}>
            <span className="flex items-center gap-3 min-w-0">
                <Img src={row.image} />
                <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-900">{row.name}</span>
                    <span className="block text-[10px] text-slate-500">{row.franchises} franchise{row.franchises > 1 ? 's' : ''} • {row.lines} order{row.lines > 1 ? 's' : ''}{row.listRate ? ` • rate list ${money(row.listRate)}` : ''}</span>
                </span>
            </span>
            <span className="font-black text-slate-900 tabular-nums">{qtyText(row.qty, row.unit)}</span>
            <span className="tabular-nums">
                {row.vendorRate > 0 ? (<>
                    <span className="block font-black text-slate-900">{money(row.vendorRate * row.qty)}</span>
                    <span className="block text-[10px] text-slate-500">{money(row.vendorRate)}/{row.unit || 'unit'} (vendor)</span>
                </>) : <span className="text-slate-400">—</span>}
            </span>
            <span className="tabular-nums">
                {row.adminRate > 0 ? (<>
                    <span className="block font-black text-blue-700">{money(row.adminRate * row.qty)}</span>
                    <span className="block text-[10px] text-slate-500">{money(row.adminRate)}/{row.unit || 'unit'} (you)</span>
                </>) : <span className="text-slate-400">—</span>}
            </span>
            <span><span className={cn('px-2 py-1 text-[10px] font-bold uppercase rounded border whitespace-nowrap', st.cls)}>{st.label}</span></span>
            <span className="col-span-full flex items-center justify-end gap-1.5 flex-wrap">
                {row.status === 'sent' && (
                    <button type="button" onClick={() => respond('accept')} disabled={!!busy}
                        className="h-8 px-2.5 bg-emerald-600 text-white rounded-sm text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50">
                        {busy === 'accept' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Accept {money(row.vendorRate)}
                    </button>
                )}
                <input type="number" min="0" step="any" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={`Your rate /${row.unit || 'unit'}`}
                    className="h-8 w-28 px-2 border border-slate-200 rounded-sm text-xs font-bold tabular-nums" />
                <button type="button" onClick={() => respond('counter')} disabled={!!busy || !(Number(offer) > 0)}
                    className="h-8 px-2.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50">
                    {busy === 'counter' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Offer
                </button>
                {Number(offer) > 0 && <span className="text-[10px] text-slate-500">= {money(Number(offer) * row.qty)} for {qtyText(row.qty, row.unit)}</span>}
            </span>
        </div>
    );
}

export default function RateNegotiationScreen() {
    const [params, setParams] = useSearchParams();
    const vendorId = params.get('vendor');
    const [vendors, setVendors] = useState(null);
    const [sheet, setSheet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('open');
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const loadVendors = useCallback(async () => {
        try {
            const res = await api.get('/procurement/admin/rate-sheets');
            setVendors(res.data?.results || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load vendors');
            setVendors([]);
        }
    }, []);
    const loadSheet = useCallback(async (id) => {
        if (!id) { setSheet(null); return; }
        try {
            const res = await api.get(`/procurement/admin/rate-sheets/${id}`);
            setSheet(res.data?.result || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load the quotation');
        }
    }, []);
    const refresh = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadVendors(), loadSheet(vendorId)]);
        setLoading(false);
    }, [loadVendors, loadSheet, vendorId]);

    useEffect(() => { refresh(); }, [refresh]);
    // Keep up with the vendor's replies
    useEffect(() => {
        const timer = setInterval(() => { loadVendors(); loadSheet(vendorId); }, 30000);
        return () => clearInterval(timer);
    }, [loadVendors, loadSheet, vendorId]);
    // Open the first vendor waiting for a reply
    useEffect(() => {
        if (!vendorId && vendors?.length) setParams({ vendor: vendors[0].vendorId }, { replace: true });
    }, [vendorId, vendors, setParams]);

    const onRowDone = (next) => { if (next) setSheet((s) => ({ ...s, ...next })); loadVendors(); };

    const sendMessage = async () => {
        if (!text.trim() || !vendorId) return;
        setSending(true);
        try {
            await api.post(`/procurement/admin/rate-sheets/${vendorId}/message`, { text });
            setText('');
            await loadSheet(vendorId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not send');
        } finally {
            setSending(false);
        }
    };

    const s = sheet?.summary || {};
    const items = sheet?.items || [];
    const final = sheet?.final || [];
    const total = items.length + final.length;

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} /><ChevronRight size={10} /><span>Operations</span><ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Vendor Quotations</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Each vendor's list for today — accept their rate or offer yours, item by item</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/masteradmin/assignment" className="px-3 py-1.5 border border-slate-300 rounded-sm text-[10px] font-bold uppercase tracking-widest text-slate-700">Assign vendors</Link>
                        <Link to="/masteradmin/quotations/requests" className="px-3 py-1.5 border border-slate-300 rounded-sm text-[10px] font-bold uppercase tracking-widest text-slate-700">Single requests</Link>
                        <button onClick={refresh} className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vendors ({vendors?.length || 0})</p>
                    {vendors === null && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>}
                    {vendors?.length === 0 && <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-sm p-4">No vendor has items to quote. Give products to vendors on Assign Vendors.</p>}
                    {(vendors || []).map((v) => (
                        <button key={v.vendorId} type="button" onClick={() => setParams({ vendor: v.vendorId })}
                            className={cn('w-full text-left bg-white border rounded-sm p-3', v.vendorId === vendorId ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200')}>
                            <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-sm font-black text-slate-900"><Truck size={14} /> {v.name}</span>
                                {v.summary.waitingAdmin > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">{v.summary.waitingAdmin} for you</span>}
                            </span>
                            <span className="block text-[11px] text-slate-500 mt-1">
                                {v.summary.itemCount} items • {v.summary.finalCount} final • {money(v.summary.quotationValue)}
                            </span>
                            {v.lastMessage && <span className="block text-[11px] text-slate-600 truncate mt-1">"{v.lastMessage.text}"</span>}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    {!sheet ? (
                        vendors?.length ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div> : null
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                    ['Vendor', sheet.vendor?.name, sheet.vendor?.mobile],
                                    ["Today's requirement", `${s.itemCount || 0} items`, `${(s.totalKg || 0).toLocaleString('en-IN')} KG`],
                                    ['Finalized', `${final.length}/${total}`, `${s.waitingAdmin || 0} waiting for you`],
                                    ['Quotation value', money(s.quotationValue), 'vendor rates + agreed'],
                                ].map(([label, value, sub]) => (
                                    <div key={label} className="bg-white border border-slate-200 rounded-sm p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                                        <p className="text-lg font-black text-slate-900 truncate">{value}</p>
                                        <p className="text-[11px] text-slate-500">{sub}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
                                <div className="bg-white border border-slate-200 rounded-sm">
                                    <div className="flex gap-2 p-3 border-b border-slate-100">
                                        {[['open', `Negotiation (${items.length})`], ['final', `Final (${final.length})`]].map(([k, label]) => (
                                            <button key={k} onClick={() => setTab(k)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border', tab === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}>{label}</button>
                                        ))}
                                    </div>
                                    {tab === 'open' ? (
                                        <>
                                            <div className="hidden lg:grid grid-cols-[minmax(150px,1fr)_80px_120px_110px_140px] gap-x-3 px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                <span>Item</span><span>Required</span><span>Vendor quote</span><span>Your offer</span><span>Status</span>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {items.length ? items.map((row) => <ItemRow key={row.key} row={row} vendorId={vendorId} onDone={onRowDone} />)
                                                    : <p className="text-center py-12 text-xs font-bold text-slate-400 uppercase tracking-wider">Nothing left to negotiate</p>}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {final.length ? final.map((row) => (
                                                <div key={row.key} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                                                    <Img src={row.image} />
                                                    <span className="flex-1 text-sm font-black text-slate-900">{row.name}</span>
                                                    <span className="font-black tabular-nums">{qtyText(row.finalQty, row.unit)}</span>
                                                    <span className="w-40 text-right tabular-nums"><span className="block font-black">{money(row.finalRate * row.finalQty)}</span><span className="text-[10px] text-slate-500">{money(row.finalRate)}/{row.unit || 'unit'}</span></span>
                                                    <span className={cn('px-2 py-1 text-[10px] font-bold uppercase rounded border', STATUS.final.cls)}>Final</span>
                                                </div>
                                            )) : <p className="text-center py-12 text-xs font-bold text-slate-400 uppercase tracking-wider">No item agreed today</p>}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white border border-slate-200 rounded-sm p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Messages</p>
                                    <div className="space-y-3 max-h-[420px] overflow-y-auto">
                                        {!(sheet.messages || []).length && <p className="text-xs text-slate-500">No messages yet</p>}
                                        {(sheet.messages || []).map((m) => (
                                            <div key={m._id} className="flex gap-2">
                                                <span className={cn('w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0', m.by === 'admin' ? 'bg-blue-600' : 'bg-emerald-600')}>{m.by === 'admin' ? 'A' : 'V'}</span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="flex justify-between text-[11px]"><b>{m.by === 'admin' ? (m.byName || 'Admin') : (sheet.vendor?.name || 'Vendor')}</b><span className="text-slate-400">{time(m.createdAt)}</span></span>
                                                    <span className="block text-xs text-slate-700 break-words">{m.text}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Write to the vendor..."
                                            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                                            className="flex-1 min-w-0 h-9 px-2 border border-slate-200 rounded-sm text-xs" />
                                        <button type="button" onClick={sendMessage} disabled={sending || !text.trim()} className="h-9 px-3 bg-slate-900 text-white rounded-sm disabled:opacity-50" aria-label="Send">
                                            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
