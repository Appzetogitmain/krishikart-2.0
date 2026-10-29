import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Plus, Send, CheckCircle2, XCircle, Search, PackageX, Camera, X, Clock, Truck, Store, CalendarDays, FileText, Package, Eye } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { FranchisePageHeader, PillTabs, HindiOnly } from '../components/layout/FranchisePageHeader';

// What is wrong with an item (the vendor sees this in Rejected Stock)
const ISSUES = [
    { value: 'rotten', label: 'Rotten' },
    { value: 'overripe', label: 'Overripe / mushy' },
    { value: 'small_size', label: 'Small size' },
    { value: 'dried', label: 'Dried / wilted' },
    { value: 'damaged', label: 'Damaged / crushed' },
    { value: 'other', label: 'Other' },
];
const issueLabel = (v) => ISSUES.find((x) => x.value === v)?.label;

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
    const [issues, setIssues] = useState({}); // productId -> what is wrong with it
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
        setIssues({});
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
                items: chosen.map(([productId, quantity]) => ({ productId, quantity: Number(quantity), photos: photos[productId] || [], issue: issues[productId] || undefined })),
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


    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState(null);

    const STATE = {
        requested: { icon: Clock, title: 'Pending Approval', sub: 'एडमिन से मंज़ूरी बाकी है', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
        approved: { icon: Send, title: 'Approved - send it', sub: 'मंज़ूर, भेजना बाकी है', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-600' },
        sent: { icon: Truck, title: 'On the way', sub: 'माल भेज दिया', cls: 'bg-violet-50 text-violet-700', dot: 'bg-violet-600' },
        received: { icon: CheckCircle2, title: 'Received', sub: 'माल प्राप्त हुआ', cls: 'bg-green-50 text-green-800', dot: 'bg-green-600' },
        rejected: { icon: XCircle, title: 'Not approved', sub: 'मंज़ूर नहीं हुआ', cls: 'bg-rose-50 text-rose-700', dot: 'bg-rose-600' },
        cancelled: { icon: XCircle, title: 'Cancelled', sub: 'रद्द किया', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' },
    };

    const list = tab === 'incoming' ? incoming : mine;
    const countOf = (s) => mine.filter((r) => r.status === s).length;
    const q = search.trim().toLowerCase();
    const shown = list.filter((r) => {
        if (tab === 'mine' && filter !== 'all' && r.status !== filter) return false;
        if (!q) return true;
        return (r.items || []).some((i) => String(i.name || '').toLowerCase().includes(q))
            || destName(r).toLowerCase().includes(q)
            || String(r.fromFranchiseId?.franchiseName || '').toLowerCase().includes(q)
            || String(r._id).toLowerCase().includes(q);
    });

    const filterTabs = [
        { id: 'all', label: 'सभी', icon: PackageX, count: mine.length },
        { id: 'requested', label: 'मंज़ूरी बाकी', icon: Clock, count: countOf('requested') },
        { id: 'approved', label: 'भेजने बाकी', icon: Send, count: countOf('approved') },
        { id: 'sent', label: 'भेज दिए', icon: Truck, count: countOf('sent') },
        { id: 'received', label: 'प्राप्त हुआ', icon: CheckCircle2, count: countOf('received') },
    ];

    const lineCredit = (r, i) => {
        if (r.status !== 'received' || !(Number(i.price) > 0)) return null;
        if (i.vendorDecision === 'rejected') return 0;
        const q2 = i.acceptedQuantity != null ? Number(i.acceptedQuantity) : Number(i.quantity);
        return Math.round(Number(i.price) * q2 * 100) / 100;
    };

    const returnCard = (r, side) => {
        const st = STATE[r.status] || STATE.requested;
        const open = openId === r._id;
        const who = side === 'in' ? (r.fromFranchiseId?.franchiseName || 'Franchise') : (destName(r) || 'Admin will decide');
        return (
            <div key={r._id} className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5">
                <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px] gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="w-14 h-14 rounded-full bg-green-50 text-green-700 flex items-center justify-center shrink-0"><Store size={24} /></span>
                        <div className="min-w-0 space-y-1">
                            <p translate="no" className="text-[16px] font-bold text-slate-900 truncate">{who}</p>
                            <p className="text-[13px] text-slate-500 truncate">{side === 'in' ? 'Returned to you' : `To: ${destName(r) || 'admin will decide'}`}</p>
                            <p className="text-[13px] text-slate-500 flex items-center gap-1.5"><CalendarDays size={14} /> {when(r.createdAt)}</p>
                            <p className="text-[13px] text-slate-500 flex items-center gap-1.5"><FileText size={14} /> Return #{String(r._id).slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 lg:border-l lg:border-slate-100 lg:pl-4 min-w-0">
                        {r.items.map((i) => {
                            const credit = lineCredit(r, i);
                            return (
                                <div key={i._id || i.productId} className="py-2 first:pt-0 last:pb-0 grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[56px_minmax(0,1fr)_80px_80px_100px] gap-x-3 gap-y-1 items-center">
                                    {i.image
                                        ? <img src={i.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-50 row-span-2 sm:row-span-1" loading="lazy" />
                                        : <span className="w-14 h-14 rounded-xl bg-green-50 text-green-700 flex items-center justify-center row-span-2 sm:row-span-1"><Package size={22} /></span>}
                                    <div className="min-w-0">
                                        <p className="text-[15px] font-bold text-slate-900 truncate">{i.name}</p>
                                        <p className="text-[13px] text-slate-500">Reason: {issueLabel(i.issue) || (i.condition === 'good' ? 'Good' : 'Damaged')} (खराब)</p>
                                        {i.vendorDecision && (
                                            <p className={cn('text-[12px] font-semibold', i.vendorDecision === 'rejected' ? 'text-rose-600' : 'text-green-700')}>
                                                {i.vendorDecision === 'rejected' ? 'Vendor rejected' : Number(i.acceptedQuantity) < Number(i.quantity) ? `Vendor accepted ${i.acceptedQuantity} ${i.unit}` : 'Vendor accepted'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="col-start-2 sm:col-start-auto flex sm:block gap-4 text-[13px]">
                                        <span><span className="text-slate-500 sm:block">Quantity </span><b className="text-slate-900">{i.quantity} {i.unit}</b></span>
                                    </div>
                                    <div className="hidden sm:block text-[13px]"><span className="block text-slate-500">Rate</span><b className="text-slate-900">{Number(i.price) > 0 ? `₹${i.price}/${i.unit}` : '-'}</b></div>
                                    <div className="hidden sm:block text-[13px]"><span className="block text-slate-500">Credit Amount</span><b className="text-slate-900">{credit == null ? '-' : money(credit)}</b></div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="space-y-2 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-slate-100 xl:pl-4">
                        <div className={cn('flex items-center gap-3 rounded-2xl p-3', st.cls)}>
                            <span className={cn('w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0', st.dot)}><st.icon size={18} /></span>
                            <span><span className="block text-[15px] font-bold">{st.title}</span><HindiOnly className="block text-[13px]">{st.sub}</HindiOnly></span>
                        </div>
                        {side === 'mine' && r.status === 'approved' && (
                            <button disabled={busyId === r._id} onClick={() => act(r._id, 'sent', 'Marked as sent')} className="w-full h-11 rounded-xl bg-green-700 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 hover:bg-green-800 disabled:opacity-40">
                                {busyId === r._id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Handed over to {destName(r)}
                            </button>
                        )}
                        {side === 'in' && r.status === 'sent' && (
                            <button disabled={busyId === r._id} onClick={() => act(r._id, 'received', 'Return received')} className="w-full h-11 rounded-xl bg-green-700 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 hover:bg-green-800 disabled:opacity-40">
                                {busyId === r._id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Goods received
                            </button>
                        )}
                        <button onClick={() => setOpenId(open ? null : r._id)} className="w-full h-11 rounded-xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 flex items-center justify-center gap-2 hover:bg-slate-50">
                            <Eye size={18} /> {open ? 'विवरण छुपाएं' : 'विवरण देखें'}
                        </button>
                    </div>
                </div>
                {open && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-[14px] text-slate-700">
                        <p><b>Reason:</b> {REASON_LABEL[r.reason] || r.reason}{r.note ? ` - ${r.note}` : ''}</p>
                        {r.approvedAt && <p><b>Approved:</b> {when(r.approvedAt)}{r.adminNote ? ` - ${r.adminNote}` : ''}</p>}
                        {r.status === 'rejected' && r.adminNote && <p className="text-rose-600"><b>Admin:</b> {r.adminNote}</p>}
                        {r.sentAt && <p><b>Sent:</b> {when(r.sentAt)}</p>}
                        {r.receivedAt && <p><b>Received:</b> {when(r.receivedAt)}</p>}
                        {r.creditNote?.number && (
                            <p className="text-green-700 font-semibold flex items-center gap-1.5"><CheckCircle2 size={16} /> Credit note {r.creditNote.number}: {money(r.creditNote.amount)}</p>
                        )}
                        {r.items.some((i) => i.photos?.length) && (
                            <div className="flex flex-wrap gap-2">
                                {r.items.flatMap((i) => (i.photos || []).map((u) => (
                                    <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={i.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200" /></a>
                                )))}
                            </div>
                        )}
                        {side === 'mine' && r.status === 'requested' && (
                            <button disabled={busyId === r._id} onClick={() => act(r._id, 'cancel', 'Return cancelled')} className="h-10 px-4 rounded-xl border border-rose-200 text-rose-600 text-[14px] font-semibold disabled:opacity-40">
                                Cancel return
                            </button>
                        )}
                        {side === 'in' && r.status === 'approved' && <p className="text-slate-500">Approved by admin. Waiting for the franchise to send it.</p>}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-24 lg:pb-8">
            <FranchisePageHeader
                icon={Truck}
                title="Return to Supplier / सप्लायर को वापस करें"
                subtitle="खराब माल वापस भेजें और उसका हिसाब देखें"
                right={
                    <button onClick={load} className="h-14 w-14 rounded-2xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50" aria-label="Refresh">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                }
            />

            {tab !== 'new' && (
                <div className="px-4 lg:px-6 flex flex-wrap items-center gap-3">
                    {tab === 'mine'
                        ? <PillTabs tabs={filterTabs} active={filter} onChange={setFilter} />
                        : <button onClick={() => setTab('mine')} className="h-11 px-4 rounded-xl bg-slate-100 text-[15px] font-semibold text-slate-700">← My returns</button>}
                    {isMother && tab === 'mine' && (
                        <button onClick={() => setTab('incoming')} className="h-11 px-4 rounded-xl border border-green-600 text-green-800 bg-green-50 text-[15px] font-semibold">
                            Returned to me{incoming.filter((x) => x.status === 'sent').length ? ` (${incoming.filter((x) => x.status === 'sent').length})` : ''}
                        </button>
                    )}
                    <div className="flex-1" />
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="उत्पाद का नाम या सप्लायर खोजें..."
                            className="w-full sm:w-80 h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-4 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-green-600" />
                    </div>
                    <button onClick={openNew} className="h-11 px-5 rounded-xl bg-green-700 text-white text-[15px] font-bold flex items-center gap-2 hover:bg-green-800">
                        <Plus size={20} /> नया रिटर्न
                    </button>
                </div>
            )}

            {tab !== 'new' && (
                <div className="px-4 lg:px-6 mt-4 space-y-3">
                    {loading && <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>}
                    {!loading && shown.length === 0 && (
                        <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-500">
                            <PackageX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-[15px]">{tab === 'mine' ? 'यहाँ कोई रिटर्न नहीं है।' : 'Nothing has been returned to you.'}</p>
                        </div>
                    )}
                    {!loading && shown.map((r) => returnCard(r, tab === 'mine' ? 'mine' : 'in'))}
                </div>
            )}

            {tab === 'new' && (
                <div className="px-4 lg:px-6 space-y-5 max-w-3xl">
                    {!options ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <p className="text-[13px] font-bold text-slate-500">1. What are you returning?</p>
                                {SOURCES.filter((s) => !s.motherOnly || isMother).map((s) => {
                                    const count = s.key === 'from_delivery' ? options.deliveries.length : s.key === 'from_return' ? options.received.length : options.stock.length;
                                    return (
                                        <button
                                            key={s.key}
                                            disabled={count === 0}
                                            onClick={() => { setKind(s.key); setSourceId(''); setQty({}); setReason(s.key === 'from_stock' ? '' : 'damaged_from_supplier'); }}
                                            className={cn('w-full text-left p-3 rounded-xl border-2 bg-white disabled:opacity-40', kind === s.key ? 'border-green-600' : 'border-slate-200')}
                                        >
                                            <p className="text-sm font-black text-slate-900">{s.title}</p>
                                            <p className="text-[13px] text-slate-500">{count === 0 ? 'Nothing to return here.' : s.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            {kind === 'from_delivery' && (
                                <div className="space-y-2">
                                    <p className="text-[13px] font-bold text-slate-500">2. Which delivery?</p>
                                    {options.deliveries.map((d) => (
                                        <button key={d.requestId} onClick={() => { setSourceId(String(d.requestId)); setQty({}); }} className={cn('w-full text-left p-3 rounded-xl border-2 bg-white', sourceId === String(d.requestId) ? 'border-green-600' : 'border-slate-200')}>
                                            <p className="text-sm font-black text-slate-900">{d.ref} from {d.supplierName}</p>
                                            <p className="text-[13px] text-slate-500">Received {when(d.receivedAt)} • {d.items.map((i) => `${i.name} ${i.returnable} ${i.unit}`).join(', ')}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {kind === 'from_return' && (
                                <div className="space-y-2">
                                    <p className="text-[13px] font-bold text-slate-500">2. Which returned goods?</p>
                                    {options.received.map((d) => (
                                        <button key={d.returnId} onClick={() => { setSourceId(String(d.returnId)); setQty({}); }} className={cn('w-full text-left p-3 rounded-xl border-2 bg-white', sourceId === String(d.returnId) ? 'border-green-600' : 'border-slate-200')}>
                                            <p className="text-sm font-black text-slate-900">{d.ref} from {d.fromName}</p>
                                            <p className="text-[13px] text-slate-500">{d.items.map((i) => `${i.name} ${i.returnable} ${i.unit}`).join(', ')}</p>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {kind && (kind === 'from_stock' || sourceId) && (
                                <div className="space-y-2">
                                    <p className="text-[13px] font-bold text-slate-500">{kind === 'from_stock' ? '2' : '3'}. How much?</p>
                                    {kind === 'from_stock' && (
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Search your stock..." className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold" />
                                        </div>
                                    )}
                                    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-80 overflow-y-auto">
                                        {lines.map((l) => (
                                            <div key={l.productId} className="px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{l.name}</p>
                                                    <p className="text-[12px] text-slate-400">{l.hint} • rate {money(l.price)}/{l.unit}</p>
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
                                                        className="w-20 h-8 border border-slate-200 rounded px-2 text-right text-sm font-bold"
                                                    />
                                                    <span className="text-[12px] text-slate-500 w-16">/ {l.max} {l.unit}</span>
                                                </div>
                                                {Number(qty[l.productId]) > 0 && (
                                                    <div className="basis-full flex items-center gap-2 flex-wrap">
                                                        <select value={issues[l.productId] || ''} onChange={(e) => setIssues((x) => ({ ...x, [l.productId]: e.target.value }))}
                                                            className="h-12 px-2 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700">
                                                            <option value="">What's wrong?</option>
                                                            {ISSUES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                                                        </select>
                                                        {(photos[l.productId] || []).map((u) => (
                                                            <span key={u} className="relative">
                                                                <img src={u} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                                                                <button type="button" onClick={() => setPhotos((p) => ({ ...p, [l.productId]: p[l.productId].filter((x) => x !== u) }))}
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-700 text-white flex items-center justify-center" aria-label="Remove photo"><X size={12} /></button>
                                                            </span>
                                                        ))}
                                                        {(photos[l.productId] || []).length < 3 && (
                                                            <label className={cn('h-12 px-3 rounded-xl border border-dashed border-slate-300 text-[13px] font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer', uploading === l.productId && 'opacity-50 pointer-events-none')}>
                                                                {uploading === l.productId ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Add photo
                                                                <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                                                                    onChange={(e) => { addPhotos(l.productId, e.target.files); e.target.value = ''; }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {lines.length === 0 && <p className="p-4 text-sm text-slate-400 text-center">No items</p>}
                                    </div>
                                </div>
                            )}

                            {kind && chosen.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[13px] font-bold text-slate-500">Reason</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {reasonsFor.map((k) => (
                                            <button key={k} onClick={() => setReason(k)} className={cn('p-2.5 rounded-xl border-2 text-left text-sm font-bold bg-white', reason === k ? 'border-green-600 text-slate-900' : 'border-slate-200 text-slate-600')}>
                                                {REASON_LABEL[k]}
                                            </button>
                                        ))}
                                    </div>
                                    {reason === 'franchise_closing' && (
                                        <p className="text-[13px] text-indigo-700 font-semibold">The admin can send good stock to a mother franchise.</p>
                                    )}
                                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={reason === 'other' ? 'Write what happened (required)' : 'Note (optional)'} className="w-full min-h-[64px] bg-white border border-slate-200 rounded-xl p-3 text-sm font-semibold" />
                                    <div className="flex items-center justify-between text-sm font-bold text-slate-700 px-1">
                                        <span>{chosen.length} item(s)</span>
                                        <span>Value about {money(total)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setTab('mine')} className="flex-1 h-12 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-500">Cancel</button>
                                        <button disabled={!canSubmit || submitting} onClick={submit} className="flex-1 h-12 rounded-xl bg-green-700 text-white text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to admin for approval
                                        </button>
                                    </div>
                                </div>
                            )}
                            {!kind && (
                                <button onClick={() => setTab('mine')} className="text-sm font-bold text-slate-500 flex items-center gap-1"><XCircle size={12} /> Back</button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

