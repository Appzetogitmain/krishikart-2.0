import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    MapPinned, Search, Loader2, Save, RotateCcw, Plus, Trash2, Pencil, X, Store, ChevronDown, Info, KeyRound, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

/**
 * City Rates: enter a city code (e.g. JPR for Jaipur) to open that city's rate sheet. Rates saved
 * here apply to every franchise in that city. City admins only see the codes given to them.
 */

const fmt = (n) => (n === null || n === undefined || n === '' ? '' : `₹${Number(n).toLocaleString('en-IN')}`);
const toInput = (v) => (v === null || v === undefined ? '' : String(v));
const sameBulk = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function BulkEditor({ value, unit, onChange, onClose, mainBulk }) {
    const [rows, setRows] = useState(() => (Array.isArray(value) ? value : mainBulk || []).map((t) => ({ minQty: String(t.minQty), price: String(t.price) })));
    const save = () => {
        const clean = rows
            .filter((r) => r.minQty !== '' || r.price !== '')
            .map((r) => ({ minQty: Number(r.minQty), price: Number(r.price) }));
        onChange(clean);
        onClose();
    };
    return (
        <div className="mt-2 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <p className="text-[11px] text-slate-500">Bulk rates for this city. Each must be cheaper than the city rate.</p>
            {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input value={r.minQty} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, minQty: e.target.value } : y)))} inputMode="decimal" placeholder="Qty" className="w-20 h-8 rounded-lg border border-slate-200 px-2 text-sm" />
                    <span className="text-xs text-slate-500">{unit}+ at ₹</span>
                    <input value={r.price} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} inputMode="decimal" placeholder="Rate" className="w-24 h-8 rounded-lg border border-slate-200 px-2 text-sm" />
                    <span className="text-xs text-slate-500">/{unit}</span>
                    <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="ml-auto w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500" aria-label="Remove tier"><X size={14} /></button>
                </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
                {rows.length < 6 && <button type="button" onClick={() => setRows((x) => [...x, { minQty: '', price: '' }])} className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold">+ Add tier</button>}
                <button type="button" onClick={save} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold">Done</button>
                <button type="button" onClick={() => { onChange(null); onClose(); }} className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200">Use main bulk rates</button>
                <button type="button" onClick={() => { onChange([]); onClose(); }} className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200">No bulk rates here</button>
            </div>
        </div>
    );
}

function ZoneManager({ zones, uncoveredCities, onChanged }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(null); // { code, name, cities, editing }
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const body = { code: form.code, name: form.name, cities: form.cities.split(',').map((c) => c.trim()).filter(Boolean) };
            if (form.editing) await api.put(`/masteradmin/city-rates/zones/${form.code}`, body);
            else await api.post('/masteradmin/city-rates/zones', body);
            toast.success(form.editing ? `City code ${form.code.toUpperCase()} updated` : `City code ${form.code.toUpperCase()} created`);
            setForm(null);
            onChanged();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save the city code');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (z) => {
        if (!window.confirm(`Delete city code ${z.code}? Its ${z.cityRateCount} city rates will be removed and its franchises will use the main rates.`)) return;
        try {
            await api.delete(`/masteradmin/city-rates/zones/${z.code}`);
            toast.success(`City code ${z.code} deleted`);
            onChanged();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not delete the city code');
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200">
            <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 sm:px-5 py-4">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><KeyRound size={16} /> Manage city codes <span className="text-slate-400 font-semibold">({zones.length})</span></span>
                <ChevronDown size={18} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="px-4 sm:px-5 pb-5 space-y-4">
                    <p className="text-[12px] text-slate-500">
                        Each code covers one or more cities. Every franchise in those cities uses that code's rates.
                        Give a city admin access to a code from <b>Team Management</b>.
                    </p>
                    <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-sm min-w-[560px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                                    <th className="px-1 py-2">Code</th><th className="px-1 py-2">Name</th><th className="px-1 py-2">Cities</th><th className="px-1 py-2 text-right">Franchises</th><th className="px-1 py-2 text-right">City rates</th><th />
                                </tr>
                            </thead>
                            <tbody>
                                {zones.map((z) => (
                                    <tr key={z.code} className="border-t border-slate-100">
                                        <td className="px-1 py-2 font-black text-slate-900">{z.code}</td>
                                        <td className="px-1 py-2">{z.name}</td>
                                        <td className="px-1 py-2 text-slate-600 capitalize">{(z.cities || []).join(', ')}</td>
                                        <td className="px-1 py-2 text-right tabular-nums">{z.franchiseCount}</td>
                                        <td className="px-1 py-2 text-right tabular-nums">{z.cityRateCount}</td>
                                        <td className="px-1 py-2 text-right whitespace-nowrap">
                                            <button type="button" onClick={() => setForm({ code: z.code, name: z.name, cities: (z.cities || []).join(', '), editing: true })} className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Edit"><Pencil size={14} /></button>
                                            <button type="button" onClick={() => remove(z)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500" aria-label="Delete"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {zones.length === 0 && <tr><td colSpan={6} className="px-1 py-4 text-slate-500">No city codes yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {uncoveredCities.length > 0 && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                            <p className="text-[12px] font-semibold text-amber-800">Franchise cities without a code (they use the main rates):</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {uncoveredCities.map((c) => (
                                    <button key={c.city} type="button"
                                        onClick={() => setForm({ code: c.city.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase(), name: c.city.replace(/\b\w/g, (x) => x.toUpperCase()), cities: c.city, editing: false })}
                                        className="h-7 px-2.5 rounded-lg bg-white border border-amber-200 text-[12px] font-semibold text-amber-900 capitalize hover:border-amber-400">
                                        {c.city} · {c.count} <span className="text-amber-600">+ code</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {form ? (
                        <div className="rounded-xl border border-slate-200 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">Code (e.g. JPR)</span>
                                <input value={form.code} disabled={form.editing} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={12} className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold uppercase disabled:bg-slate-50" />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">City / area name</span>
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">Cities covered (comma separated)</span>
                                <input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} placeholder="Jaipur" className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                            </label>
                            <div className="sm:col-span-3 flex gap-2">
                                <button type="button" onClick={submit} disabled={saving} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {form.editing ? 'Save changes' : 'Create code'}
                                </button>
                                <button type="button" onClick={() => setForm(null)} className="h-9 px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setForm({ code: '', name: '', cities: '', editing: false })} className="h-9 px-4 rounded-xl border border-slate-300 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50">
                            <Plus size={15} /> New city code
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function CityRatesScreen() {
    const [zonesInfo, setZonesInfo] = useState({ zones: [], uncoveredCities: [], canManageCodes: false });
    const [codeInput, setCodeInput] = useState('');
    const [code, setCode] = useState('');
    const [sheet, setSheet] = useState(null); // { zone, franchises, items }
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [edits, setEdits] = useState({}); // productId -> { price, comparePrice, bulkPricing }
    const [bulkOpen, setBulkOpen] = useState(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [onlyCityRates, setOnlyCityRates] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadZones = useCallback(async () => {
        try {
            const res = await api.get('/masteradmin/city-rates/zones');
            setZonesInfo(res.data.result || { zones: [], uncoveredCities: [], canManageCodes: false });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not load city codes');
        }
    }, []);
    useEffect(() => { loadZones(); }, [loadZones]);

    const openCode = async (raw) => {
        const c = String(raw || '').trim().toUpperCase();
        if (!c) return;
        if (Object.keys(edits).length && !window.confirm('You have unsaved changes. Open another city anyway?')) return;
        setLoadingSheet(true);
        try {
            const res = await api.get(`/masteradmin/city-rates/zones/${encodeURIComponent(c)}/rates`);
            setSheet(res.data.result);
            setCode(c);
            setCodeInput(c);
            setEdits({});
            setBulkOpen(null);
        } catch (err) {
            toast.error(err.response?.data?.message || `Could not open city code ${c}`);
        } finally {
            setLoadingSheet(false);
        }
    };

    const items = sheet?.items || [];
    const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);

    // Current value of a field (edited or saved)
    const cur = (item, field) => {
        const e = edits[item.productId];
        if (e && field in e) return e[field];
        if (field === 'bulkPricing') return item.city ? item.city.bulkPricing : null;
        return item.city ? item.city[field] : null;
    };
    const setField = (item, field, value) => {
        setEdits((prev) => {
            const next = { ...prev, [item.productId]: { ...(prev[item.productId] || {}), [field]: value } };
            const e = next[item.productId];
            const savedPrice = item.city?.price ?? null, savedMrp = item.city?.comparePrice ?? null, savedBulk = item.city ? item.city.bulkPricing : null;
            const norm = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
            const unchanged = (!('price' in e) || norm(e.price) === savedPrice)
                && (!('comparePrice' in e) || norm(e.comparePrice) === savedMrp)
                && (!('bulkPricing' in e) || sameBulk(e.bulkPricing, savedBulk));
            if (unchanged) delete next[item.productId];
            return next;
        });
    };
    const resetToMain = (item) => setEdits((prev) => ({ ...prev, [item.productId]: { price: '', comparePrice: '', bulkPricing: null } }));

    const visible = items.filter((i) => {
        if (category !== 'all' && i.category !== category) return false;
        if (search && !i.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
        if (onlyCityRates && !(i.city || edits[i.productId])) return false;
        return true;
    });
    const editCount = Object.keys(edits).length;

    const save = async () => {
        setSaving(true);
        try {
            const payload = Object.entries(edits).map(([productId, e]) => {
                const item = items.find((i) => String(i.productId) === String(productId));
                const v = (field) => {
                    const val = field in e ? e[field] : (field === 'bulkPricing' ? (item.city ? item.city.bulkPricing : null) : item.city?.[field] ?? null);
                    if (field === 'bulkPricing') return val;
                    return val === '' || val === null || val === undefined ? null : Number(val);
                };
                return { productId, price: v('price'), comparePrice: v('comparePrice'), bulkPricing: v('bulkPricing') };
            });
            await api.put(`/masteradmin/city-rates/zones/${code}/rates`, { items: payload });
            toast.success(`${payload.length} ${payload.length === 1 ? 'rate' : 'rates'} saved for ${code}. All ${sheet?.franchises?.length || 0} franchises updated.`);
            const res = await api.get(`/masteradmin/city-rates/zones/${code}/rates`);
            setSheet(res.data.result);
            setEdits({});
            loadZones();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save the rates');
        } finally {
            setSaving(false);
        }
    };

    const myZones = zonesInfo.zones || [];

    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6 pb-28">
            <div className="max-w-6xl mx-auto space-y-5">
                <div className="flex items-start gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0"><MapPinned size={20} /></span>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">City Rates</h1>
                        <p className="text-[13px] text-slate-500 mt-0.5 max-w-2xl">
                            Enter a city code to set that city's rates. Every franchise in the city uses them. Products left on
                            the main rate keep the price set in Products.
                        </p>
                    </div>
                </div>

                {/* Code entry */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <form onSubmit={(e) => { e.preventDefault(); openCode(codeInput); }} className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Enter city code, e.g. JPR" onFocus={(e) => e.target.select()}
                                className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-base font-bold tracking-wider uppercase outline-none focus:border-slate-900" maxLength={12} autoFocus />
                        </div>
                        <button type="submit" disabled={!codeInput.trim() || loadingSheet} className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                            {loadingSheet ? <Loader2 size={16} className="animate-spin" /> : null} Open rates
                        </button>
                    </form>
                    {myZones.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] text-slate-500 mr-1">{zonesInfo.canManageCodes ? 'All codes:' : 'Your codes:'}</span>
                            {myZones.map((z) => (
                                <button key={z.code} type="button" onClick={() => openCode(z.code)}
                                    className={cn('h-8 px-3 rounded-lg border text-[12px] font-bold', code === z.code ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400')}>
                                    {z.code} <span className="font-semibold text-slate-500">· {z.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {!zonesInfo.canManageCodes && myZones.length === 0 && (
                        <p className="mt-3 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">No city code is assigned to you yet. Ask the main admin to give you your city's code.</p>
                    )}
                </div>

                {zonesInfo.canManageCodes && <ZoneManager zones={myZones} uncoveredCities={zonesInfo.uncoveredCities || []} onChanged={loadZones} />}

                {/* Rate sheet */}
                {sheet && (
                    <div className="bg-white rounded-2xl border border-slate-200">
                        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h2 className="text-lg font-black text-slate-900">{sheet.zone.code} · {sheet.zone.name}</h2>
                                <span className="text-[12px] text-slate-500 capitalize">Cities: {(sheet.zone.cities || []).join(', ')}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[12px] font-semibold text-slate-600 flex items-center gap-1 mr-1"><Store size={13} /> Applies to {sheet.franchises.length} {sheet.franchises.length === 1 ? 'franchise' : 'franchises'}:</span>
                                {sheet.franchises.map((f) => (
                                    <span key={f._id} className="h-6 px-2 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-700 inline-flex items-center">{f.franchiseName}</span>
                                ))}
                                {sheet.franchises.length === 0 && <span className="text-[12px] text-amber-700">No franchise is in these cities yet.</span>}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative flex-1">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product…" className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400" />
                                </div>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                                    <option value="all">All categories</option>
                                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <label className="h-10 px-3 rounded-xl border border-slate-200 flex items-center gap-2 text-sm cursor-pointer select-none">
                                    <input type="checkbox" checked={onlyCityRates} onChange={(e) => setOnlyCityRates(e.target.checked)} /> Only city rates
                                </label>
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-px" /> Leave the city rate empty to use the main rate. A franchise's own store price (Stock Levels) still overrides the city rate for that one store.</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[760px]">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
                                        <th className="px-4 py-2.5">Product</th>
                                        <th className="px-3 py-2.5 text-right">Main rate</th>
                                        <th className="px-3 py-2.5">City rate</th>
                                        <th className="px-3 py-2.5">City MRP</th>
                                        <th className="px-3 py-2.5">Bulk rates</th>
                                        <th className="px-3 py-2.5" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((item) => {
                                        const price = cur(item, 'price');
                                        const mrp = cur(item, 'comparePrice');
                                        const bulk = cur(item, 'bulkPricing');
                                        const dirty = !!edits[item.productId];
                                        const effectivePrice = price === '' || price === null ? item.main.price : Number(price);
                                        const bulkText = Array.isArray(bulk)
                                            ? (bulk.length ? bulk.map((t) => `${t.minQty}+ ${fmt(t.price)}`).join(', ') : 'None in this city')
                                            : (item.main.bulkPricing.length ? `Main: ${item.main.bulkPricing.map((t) => `${t.minQty}+ ${fmt(t.price)}`).join(', ')}` : 'None');
                                        return (
                                            <tr key={item.productId} className={cn('border-t border-slate-100 align-top', dirty && 'bg-amber-50/60')}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {item.image ? <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" /> : <span className="w-9 h-9 rounded-lg bg-slate-100 shrink-0" />}
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                                                            <div className="text-[11px] text-slate-500">{item.category} · per {item.unit}{item.status !== 'active' ? ' · hidden' : ''}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right tabular-nums text-slate-600 whitespace-nowrap">{fmt(item.main.price)}<div className="text-[11px] text-slate-400">{item.main.comparePrice ? `MRP ${fmt(item.main.comparePrice)}` : ''}</div></td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-400">₹</span>
                                                        <input value={toInput(price)} onChange={(e) => setField(item, 'price', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={`main ₹${item.main.price}`}
                                                            className={cn('w-28 h-9 rounded-lg border px-2 placeholder:text-slate-300 placeholder:font-normal text-sm font-semibold tabular-nums outline-none focus:border-slate-900', price !== '' && price !== null ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200')} />
                                                    </div>
                                                    {item.city?.updatedBy && !dirty && <div className="mt-1 text-[10px] text-slate-400">by {item.city.updatedBy}</div>}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-400">₹</span>
                                                        <input value={toInput(mrp)} onChange={(e) => setField(item, 'comparePrice', e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={item.main.comparePrice ? String(item.main.comparePrice) : '—'}
                                                            className="w-20 h-9 rounded-lg border border-slate-200 px-2 text-sm tabular-nums outline-none focus:border-slate-900" />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 max-w-[260px]">
                                                    <button type="button" onClick={() => setBulkOpen(bulkOpen === item.productId ? null : item.productId)} className="text-left text-[12px] text-slate-700 hover:text-emerald-700">
                                                        <span className={cn(!Array.isArray(bulk) && 'text-slate-500')}>{bulkText}</span> <Pencil size={11} className="inline ml-0.5" />
                                                    </button>
                                                    {bulkOpen === item.productId && (
                                                        <BulkEditor value={bulk} mainBulk={item.main.bulkPricing} unit={item.unit} onChange={(v) => setField(item, 'bulkPricing', v)} onClose={() => setBulkOpen(null)} />
                                                    )}
                                                    {Array.isArray(bulk) && bulk.some((t) => Number(t.price) >= effectivePrice) && (
                                                        <div className="mt-1 text-[11px] text-red-600">A bulk rate is not lower than the rate</div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    {(item.city || dirty) && (
                                                        <button type="button" onClick={() => resetToMain(item)} className="h-8 px-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap" title="Use the main rate, MRP and bulk rates in this city">
                                                            <RotateCcw size={12} /> Main rate
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {visible.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No products match.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Save bar */}
            {editCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 md:left-auto md:right-6 md:bottom-6 md:w-auto">
                    <div className="m-3 md:m-0 rounded-2xl bg-slate-900 text-white shadow-2xl px-4 py-3 flex items-center gap-3">
                        <span className="text-sm font-semibold">{editCount} unsaved {editCount === 1 ? 'change' : 'changes'} in {code}</span>
                        <button type="button" onClick={() => setEdits({})} className="ml-auto h-9 px-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white">Discard</button>
                        <button type="button" onClick={save} disabled={saving} className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-bold flex items-center gap-2 disabled:opacity-60">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save for all {sheet?.franchises?.length || 0} franchises
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
