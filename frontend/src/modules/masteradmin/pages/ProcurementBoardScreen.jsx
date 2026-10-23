import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Home, Loader2, Package, RefreshCw, Store, Truck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

/*
 * Consolidated vendor assignment. Franchise orders (from any time of day) are added up product-wise;
 * the admin compares the vendors' own rates and gives a product — for all franchises or one — to a
 * vendor. That vendor packs it at their rate; no quotation round. Products not packed yet can be moved
 * to another vendor. Every hotel order behind a total stays visible.
 */

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const qtyText = (q, unit) => `${Number(q || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${String(unit || '').toUpperCase()}`;
const when = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const STATUS = {
    assigned: 'Old quote: waiting for rate', quoted: 'Old quote: rate sent', negotiating: 'Old quote: offer sent',
    approved: 'To pack', preparing: 'Packing', ready_for_pickup: 'Ready for pickup', picked_up: 'On the way',
};

function Img({ src }) {
    return src
        ? <img src={src} alt="" className="w-10 h-10 object-contain shrink-0 rounded bg-white" loading="lazy" />
        : <span className="w-10 h-10 rounded bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><Package size={16} /></span>;
}

/** The hotel / customer orders behind a total. */
function Lines({ lines }) {
    return (
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-sm bg-slate-50/60">
            {lines.map((l) => (
                <div key={`${l.requestId}-${l.itemId}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[11px]">
                    <span className="min-w-0">
                        <span className="font-bold text-slate-800">{l.customerName || 'Franchise stock'}</span>
                        <span className="text-slate-400"> • #{l.requestId.slice(-6).toUpperCase()} • {when(l.createdAt)}</span>
                    </span>
                    <span className="font-black text-slate-900 tabular-nums whitespace-nowrap">{qtyText(l.quantity, l.unit)}</span>
                </div>
            ))}
        </div>
    );
}

/**
 * Pick a vendor (with its own rate) and give the product to it.
 * franchises: [{ franchiseId, name, qty }]; fixedFranchiseId: only that franchise; fromVendorId: a move.
 */
function AssignPanel({ product, franchises, vendors, fixedFranchiseId, fromVendorId, onDone }) {
    const options = vendors.filter((v) => v.vendorId !== fromVendorId);
    const [franchiseId, setFranchiseId] = useState(fixedFranchiseId || '');
    const [vendorId, setVendorId] = useState(() => (options.find((v) => v.rate > 0 && v.available) || options[0])?.vendorId || '');
    const chosen = options.find((v) => v.vendorId === vendorId);
    const [rate, setRate] = useState(chosen?.rate ? String(chosen.rate) : '');
    const [busy, setBusy] = useState(false);

    const qty = franchiseId ? franchises.find((f) => f.franchiseId === franchiseId)?.qty || 0 : franchises.reduce((s, f) => s + f.qty, 0);

    const pick = (v) => { setVendorId(v.vendorId); setRate(v.rate ? String(v.rate) : ''); };

    const submit = async () => {
        if (!vendorId) return toast.error('Choose a vendor');
        if (!(Number(rate) > 0)) return toast.error('Enter the rate');
        setBusy(true);
        try {
            const body = { productId: product.productId, unit: product.unit, vendorId, rate: Number(rate) };
            if (franchiseId) body.franchiseId = franchiseId;
            if (fromVendorId) body.fromVendorId = fromVendorId;
            const res = await api.post('/procurement/admin/board/assign', body);
            toast.success(res.data?.message || 'Assigned');
            onDone?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not assign');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="border border-slate-200 rounded-sm bg-white">
            {!fixedFranchiseId && franchises.length > 1 && (
                <div className="px-3 pt-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign for</label>
                    <select value={franchiseId} onChange={(e) => setFranchiseId(e.target.value)} className="mt-1 w-full h-9 px-2 border border-slate-200 rounded-sm text-xs font-bold bg-white">
                        <option value="">All franchises — {qtyText(franchises.reduce((s, f) => s + f.qty, 0), product.unit)}</option>
                        {franchises.map((f) => <option key={f.franchiseId} value={f.franchiseId}>{f.name} — {qtyText(f.qty, product.unit)}</option>)}
                    </select>
                </div>
            )}
            <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Vendors and their own rates</p>
                {!options.length && (
                    <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-sm px-2 py-2">
                        No {fromVendorId ? 'other ' : ''}vendor supplies this product. Add it to a vendor's products in Vendor Management.
                    </p>
                )}
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-sm">
                    {options.map((v) => (
                        <label key={v.vendorId} className={cn('flex items-center gap-3 px-3 py-2 cursor-pointer text-xs', v.vendorId === vendorId ? 'bg-emerald-50' : 'hover:bg-slate-50')}>
                            <input type="radio" name={`v-${product.key || product.productId}-${fixedFranchiseId || ''}-${fromVendorId || ''}`} checked={v.vendorId === vendorId} onChange={() => pick(v)} />
                            <span className="flex-1 min-w-0">
                                <span className="font-bold text-slate-900">{v.name}</span>
                                <span className="text-slate-400"> {v.city ? `• ${v.city}` : ''}{v.status !== 'active' ? ` • ${v.status}` : ''}{!v.available ? ' • marked not available' : ''}</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className={cn('block font-black tabular-nums', v.rate > 0 ? 'text-slate-900' : 'text-amber-600')}>{v.rate > 0 ? `${money(v.rate)}/${product.unit || 'unit'}` : 'No rate'}</span>
                                {v.rate > 0 && <span className="block text-[10px] text-slate-500 tabular-nums">{money(v.rate * qty)} total</span>}
                            </span>
                        </label>
                    ))}
                </div>
                {options.length > 0 && (
                    <div className="flex flex-wrap items-end gap-2 mt-3">
                        <label className="flex-1 min-w-[140px]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rate ({product.unit || 'unit'})</span>
                            <input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)}
                                className="mt-1 w-full h-9 px-2 border border-slate-200 rounded-sm text-sm font-black tabular-nums" />
                        </label>
                        <div className="text-right text-[11px] text-slate-500 pb-2">
                            {qtyText(qty, product.unit)} × {money(rate)} = <span className="font-black text-slate-900">{money(qty * (Number(rate) || 0))}</span>
                        </div>
                        <button type="button" onClick={submit} disabled={busy || !vendorId}
                            className="w-full h-9 bg-slate-900 text-white rounded-sm text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                            {fromVendorId ? 'Move' : 'Assign'} {qtyText(qty, product.unit)} to {chosen?.name || 'vendor'}
                        </button>
                        {chosen && Number(rate) > 0 && chosen.rate > 0 && Number(rate) !== chosen.rate && (
                            <p className="w-full text-[10px] text-amber-700">Vendor's own rate is {money(chosen.rate)}; you are assigning at {money(rate)}.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ProductCard({ product, rank, onDone }) {
    const [open, setOpen] = useState(false);
    const cheapest = product.vendors.find((v) => v.rate > 0);
    return (
        <div className="bg-white border border-slate-200 rounded-sm">
            <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3 text-left">
                <span className="w-6 text-[11px] font-black text-slate-400">{rank}</span>
                <Img src={product.image} />
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-black text-slate-900">{product.name}</span>
                    <span className="block text-[11px] text-slate-500">{product.franchises.length} franchise{product.franchises.length > 1 ? 's' : ''} • {product.lineCount} order{product.lineCount > 1 ? 's' : ''}{cheapest ? ` • best rate ${money(cheapest.rate)} (${cheapest.name})` : ' • no vendor rate yet'}</span>
                </span>
                <span className="text-right">
                    <span className="block text-base font-black text-slate-900 tabular-nums">{qtyText(product.totalQty, product.unit)}</span>
                    <span className="block text-[10px] font-bold uppercase text-emerald-700">{open ? 'Close' : 'Assign'}</span>
                </span>
                <ChevronDown size={16} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="border-t border-slate-100 p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Franchise-wise ({product.franchises.length})</p>
                        {product.franchises.map((f) => (
                            <div key={f.franchiseId}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-black text-slate-900 flex items-center gap-1.5"><Store size={13} /> {f.name}{f.city ? <span className="font-semibold text-slate-400">, {f.city}</span> : null}</span>
                                    <span className="font-black tabular-nums">{qtyText(f.qty, product.unit)}</span>
                                </div>
                                <Lines lines={f.lines} />
                            </div>
                        ))}
                        <div className="flex items-center justify-between text-xs font-black border-t border-slate-200 pt-2">
                            <span>Total for vendor</span><span className="tabular-nums">{qtyText(product.totalQty, product.unit)}</span>
                        </div>
                    </div>
                    <AssignPanel product={product} franchises={product.franchises} vendors={product.vendors} onDone={onDone} />
                </div>
            )}
        </div>
    );
}

function VendorProductRow({ vendor, franchise, p, onDone }) {
    const [open, setOpen] = useState(null); // 'orders' | 'move'
    return (
        <div className="py-2">
            <div className="flex items-center gap-3">
                <Img src={p.image} />
                <span className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-slate-900">{p.name}</span>
                    <span className="block text-[10px] text-slate-500">{p.statuses.map((s) => STATUS[s] || s).join(', ')} • {p.lines.length} order{p.lines.length > 1 ? 's' : ''}</span>
                </span>
                <span className="text-right text-xs tabular-nums whitespace-nowrap">
                    <span className="block font-black text-slate-900">{qtyText(p.qty, p.unit)}</span>
                    <span className="block text-[10px] text-slate-500">@ {money(p.rate)} = {money(p.amount)}</span>
                </span>
                <button type="button" onClick={() => setOpen(open === 'orders' ? null : 'orders')} className="px-2 h-7 border border-slate-200 rounded-sm text-[10px] font-bold uppercase">Orders</button>
                {p.reassignable && (
                    <button type="button" onClick={() => setOpen(open === 'move' ? null : 'move')} className="px-2 h-7 border border-slate-900 rounded-sm text-[10px] font-bold uppercase">Change vendor</button>
                )}
            </div>
            {open === 'orders' && <div className="mt-2"><Lines lines={p.lines} /></div>}
            {open === 'move' && (
                <div className="mt-2">
                    <AssignPanel product={p} franchises={[{ franchiseId: franchise.franchiseId, name: franchise.name, qty: p.lines.filter((l) => ['assigned', 'quoted', 'negotiating', 'approved'].includes(l.status)).reduce((s, l) => s + l.quantity, 0) }]}
                        vendors={p.vendors} fixedFranchiseId={franchise.franchiseId} fromVendorId={vendor.vendorId} onDone={onDone} />
                </div>
            )}
        </div>
    );
}

export default function ProcurementBoardScreen() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('assign');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/procurement/admin/board');
            setData(res.data?.result || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load orders');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const q = search.trim().toLowerCase();
    const products = useMemo(() => (data?.products || []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.franchises.some((f) => f.name.toLowerCase().includes(q))), [data, q]);
    const vendors = useMemo(() => (data?.vendors || []).filter((v) => !q || v.name.toLowerCase().includes(q) || v.franchises.some((f) => f.name.toLowerCase().includes(q) || f.products.some((p) => p.name.toLowerCase().includes(q)))), [data, q]);
    const s = data?.summary || {};

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} /><ChevronRight size={10} /><span>Operations</span><ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Assign Vendors</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Franchise orders added up product-wise — give each product to a vendor at their rate</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/masteradmin/assignment/requests" className="px-3 py-1.5 border border-slate-300 rounded-sm text-[10px] font-bold uppercase tracking-widest text-slate-700">
                            Single requests / mother franchise
                        </Link>
                        <button onClick={load} className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    ['Products to assign', s.pendingProducts],
                    ['Franchises waiting', s.pendingFranchises],
                    ['Open franchise requests', s.pendingRequests],
                    ['Vendors working', s.activeVendors],
                ].map(([label, value]) => (
                    <div key={label} className="bg-white border border-slate-200 rounded-sm p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                        <p className="text-2xl font-black text-slate-900 tabular-nums">{value ?? '—'}</p>
                    </div>
                ))}
            </div>

            {(data?.products || []).length > 0 && (
                <div className="px-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Top items to assign</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {data.products.slice(0, 8).map((p) => (
                            <span key={p.key} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-1 pr-3 py-1 whitespace-nowrap">
                                <Img src={p.image} />
                                <span className="text-xs font-black text-slate-900">{p.name}</span>
                                <span className="text-xs font-bold text-emerald-700 tabular-nums">{qtyText(p.totalQty, p.unit)}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="px-4 pt-4 flex items-center gap-2 flex-wrap">
                {[['assign', `To assign (${data?.products?.length || 0})`], ['vendors', `With vendors (${data?.vendors?.length || 0})`]].map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border', tab === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}>{label}</button>
                ))}
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, franchise or vendor..."
                    className="ml-auto h-8 w-full sm:w-72 px-3 border border-slate-200 rounded-sm text-xs bg-white" />
            </div>

            <div className="p-4 space-y-2">
                {loading && !data && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div>}

                {tab === 'assign' && data && (
                    products.length ? products.map((p, k) => <ProductCard key={p.key} product={p} rank={k + 1} onDone={load} />) : (
                        <div className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-wider">No franchise orders waiting for a vendor</div>
                    )
                )}

                {tab === 'vendors' && data && (
                    vendors.length ? vendors.map((v) => (
                        <div key={v.vendorId} className="bg-white border border-slate-200 rounded-sm">
                            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100 bg-slate-50">
                                <span className="flex items-center gap-2 text-sm font-black text-slate-900"><Truck size={15} /> {v.name}<span className="text-[11px] font-semibold text-slate-400">{v.city ? ` • ${v.city}` : ''}{v.mobile ? ` • ${v.mobile}` : ''}</span></span>
                                <span className="text-xs text-slate-600">{v.franchiseCount} franchise{v.franchiseCount > 1 ? 's' : ''} • {v.productCount} products • <span className="font-black text-slate-900">{money(v.amount)}</span></span>
                            </div>
                            <div className="p-3 space-y-3">
                                {v.franchises.map((f) => (
                                    <div key={f.franchiseId}>
                                        <p className="flex items-center justify-between text-xs font-black text-slate-800 mb-1">
                                            <span className="flex items-center gap-1.5"><Store size={13} /> {f.name}{f.city ? <span className="font-semibold text-slate-400">, {f.city}</span> : null}</span>
                                            <span className="tabular-nums">{money(f.amount)}</span>
                                        </p>
                                        <div className="divide-y divide-slate-100 border-t border-slate-100">
                                            {f.products.map((p) => <VendorProductRow key={`${p.productId}-${p.unit}`} vendor={v} franchise={f} p={p} onDone={load} />)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-wider">No orders with vendors right now</div>
                    )
                )}
            </div>
        </div>
    );
}
