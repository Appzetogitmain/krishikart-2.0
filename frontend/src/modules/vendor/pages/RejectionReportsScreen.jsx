import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Archive,
    ChevronLeft,
    ChevronRight,
    IndianRupee,
    Loader2,
    Package,
    Search,
    ShoppingBag,
    Store,
    Weight,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { keepPage, peekPage } from '../lib/pageCache';
import { franchiseNameOf, loadOf, loadText, unitLabel } from '../lib/packing';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import DatePicker, { DATE_PRESETS, dateRange } from '../components/DateRangePicker';

/*
 * Rejected Stock: goods franchises sent back that the vendor accepted in Returns.
 * Their value is credited to the franchise (credit note), i.e. deducted from the vendor's settlement.
 */

const ISSUE = {
    rotten: { label: 'Rotten', cls: 'bg-red-50 text-red-600' },
    overripe: { label: 'Overripe / mushy', cls: 'bg-red-50 text-red-600' },
    small_size: { label: 'Small size', cls: 'bg-amber-50 text-amber-700' },
    dried: { label: 'Dried / wilted', cls: 'bg-pink-50 text-pink-600' },
    damaged: { label: 'Damaged / crushed', cls: 'bg-red-50 text-red-600' },
    other: { label: 'Other', cls: 'bg-slate-100 text-slate-600' },
};
const REASON_LABEL = {
    damaged_from_supplier: 'Damaged goods',
    rejected_at_receiving: 'Rejected at delivery',
    spoiled_in_stock: 'Spoiled / expired',
    franchise_closing: 'Franchise closing',
    other: 'Other',
};
const TILES = ['bg-red-50 text-red-600', 'bg-blue-50 text-blue-700', 'bg-green-50 text-green-700', 'bg-amber-50 text-amber-600'];

const money = (v) => `₹ ${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const keptQty = (i) => (i.vendorDecision ? Number(i.acceptedQuantity) || 0 : Number(i.quantity) || 0);

/** One row per accepted item of every received return. */
function rowsOf(returns) {
    const rows = [];
    for (const r of returns || []) {
        if (r.status !== 'received') continue;
        for (const i of r.items || []) {
            const qty = keptQty(i);
            if (qty <= 0) continue;
            rows.push({
                key: `${r._id}:${i._id}`,
                franchiseId: String(r.fromFranchiseId?._id || r.fromFranchiseId),
                franchise: r.fromFranchiseId,
                name: i.name,
                unit: i.unit,
                quantity: qty,
                rate: Number(i.price) || 0,
                value: qty * (Number(i.price) || 0),
                issue: i.issue,
                reason: r.reason,
                when: new Date(r.receivedAt || r.updatedAt || r.createdAt),
                photos: i.photos || [],
                image: i.image,
                creditNote: r.creditNote?.number || '',
            });
        }
    }
    return rows.sort((a, b) => b.when - a.when);
}

function Thumb({ src, className }) {
    return src
        ? <img src={src} alt="" className={cn('object-cover rounded-lg', className)} loading="lazy" />
        : <span className={cn('rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center', className)}><Package size={18} /></span>;
}

function IssueBadge({ row, className }) {
    const { t } = useVendorLanguage();
    const known = ISSUE[row.issue];
    return (
        <span className={cn('inline-flex px-2.5 py-1 rounded-lg text-sm font-semibold whitespace-nowrap', known ? known.cls : 'bg-red-50 text-red-600', className)}>
            {t(known ? known.label : REASON_LABEL[row.reason] || 'Damaged goods')}
        </span>
    );
}

function Kpis({ items, compact }) {
    const { t } = useVendorLanguage();
    return (
        <div className={cn('grid gap-3', compact ? 'grid-cols-3' : 'grid-cols-2')}>
            {items.map((k) => (
                <div key={k.label} className={cn('rounded-2xl p-3 flex items-start gap-2.5', k.tone)}>
                    <k.icon size={compact ? 22 : 26} className={cn('shrink-0 mt-0.5', k.iconTone)} />
                    <span className="min-w-0">
                        <span className="block text-sm text-slate-600 leading-tight">{t(k.label)}</span>
                        <span className={cn('block font-bold text-slate-900 mt-1 break-words', compact ? 'text-lg' : 'text-2xl')}>{k.value}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Photos + every detail of one rejected item (sheet on phones, dialog on desktop). */
function ItemDetail({ row, onClose }) {
    const { t, locale } = useVendorLanguage();
    const photos = row.photos.length ? row.photos : row.image ? [row.image] : [];
    const [idx, setIdx] = useState(0);
    const lines = [
        ['Franchise', <span key="f" translate="no">{franchiseNameOf(row.franchise)}</span>],
        ['Rejected quantity', `${row.quantity} ${t(unitLabel(row.unit))}`],
        [`Rate (₹/${unitLabel(row.unit)})`, money(row.rate)],
        ['Total deduction', money(row.value)],
        ['Rejection reason', <IssueBadge key="r" row={row} />],
        ['Rejection date', formatDay(row.when, locale)],
        ['Rejection time', formatTime(row.when, locale)],
    ];
    if (row.creditNote) lines.push(['Credit note', <span key="c" translate="no">{row.creditNote}</span>]);

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-end lg:items-center justify-center" onClick={onClose}>
            <div className="w-full lg:max-w-lg max-h-[94vh] overflow-y-auto bg-white rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex items-center justify-center mb-4">
                    <button type="button" onClick={onClose} className="absolute left-0 w-11 h-11 -ml-2 flex items-center justify-center lg:hidden" aria-label="Back"><ArrowLeft size={28} /></button>
                    <h3 className="text-2xl font-bold text-slate-900">{t('Item details')}</h3>
                    <button type="button" onClick={onClose} className="absolute right-0 w-11 h-11 hidden lg:flex items-center justify-center" aria-label="Close"><X size={26} /></button>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-[4/3]">
                    {photos.length ? <img src={photos[idx]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Package size={56} /></div>}
                    {photos.length > 1 && (
                        <>
                            <button type="button" onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center" aria-label="Previous photo"><ChevronLeft size={24} /></button>
                            <button type="button" onClick={() => setIdx((i) => (i + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center" aria-label="Next photo"><ChevronRight size={24} /></button>
                            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/60 text-white text-sm font-semibold">{idx + 1} / {photos.length}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 mt-3">
                    <Thumb src={row.image} className="w-12 h-12" />
                    <p className="flex-1 text-xl font-bold text-slate-900">{t(row.name)}</p>
                    <IssueBadge row={row} />
                </div>
                <div className="divide-y divide-slate-100 mt-3">
                    {lines.map(([k, v]) => (
                        <div key={k} className={cn('flex items-center justify-between gap-3 px-3 py-3 text-base', k === 'Rejection reason' && 'bg-rose-50 rounded-xl')}>
                            <span className="text-slate-500">{t(k)}</span>
                            <span className="font-semibold text-slate-900 text-right">{v}</span>
                        </div>
                    ))}
                </div>
                {row.photos.length > 0 && (
                    <>
                        <h4 className="text-xl font-bold text-slate-900 mt-5 mb-2">{t('Photos')} ({row.photos.length})</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {row.photos.map((u, k) => (
                                <button key={u} type="button" onClick={() => setIdx(k)}>
                                    <img src={u} alt="" className={cn('w-full aspect-square object-cover rounded-xl', k === idx && 'ring-2 ring-green-600')} />
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function RejectionReportsScreen() {
    const { t, locale } = useVendorLanguage();
    const [returns, setReturns] = useState(() => peekPage('returns') || []);
    const [loading, setLoading] = useState(!peekPage('returns'));
    const [date, setDate] = useState({ mode: 'today', day: '' });
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [openRow, setOpenRow] = useState(null);

    // Same data as Returns (accepted returns), shared through the page cache
    const load = useCallback(async () => {
        try {
            const res = await api.get('/stock-returns/vendor');
            setReturns(keepPage('returns', res.data?.results || []));
        } catch (error) {
            if (error.response?.status !== 401) toast.error(error.response?.data?.message || 'Could not load rejected stock');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const allRows = useMemo(() => rowsOf(returns), [returns]);
    const rows = useMemo(() => {
        const range = dateRange(date);
        return allRows.filter((r) => !range || (r.when >= range[0] && r.when < range[1]));
    }, [allRows, date]);

    const franchises = useMemo(() => {
        const m = new Map();
        rows.forEach((r) => {
            if (!m.has(r.franchiseId)) m.set(r.franchiseId, { id: r.franchiseId, franchise: r.franchise, rows: [] });
            m.get(r.franchiseId).rows.push(r);
        });
        return [...m.values()]
            .map((f) => ({ ...f, value: f.rows.reduce((s, r) => s + r.value, 0), load: loadOf(f.rows, (r) => r.quantity) }))
            .sort((a, b) => b.value - a.value);
    }, [rows]);
    const q = search.trim().toLowerCase();
    const shownFranchises = franchises.filter((f) => !q || franchiseNameOf(f.franchise).toLowerCase().includes(q));
    const tileOf = (id) => TILES[Math.max(0, franchises.findIndex((f) => f.id === id)) % TILES.length];

    // Desktop shows the first franchise until one is picked; phones show the list first
    const active = franchises.find((f) => f.id === selectedId) || null;
    const desktopActive = active || shownFranchises[0] || null;

    const periodLabel = date.mode === 'day' ? '' : t(DATE_PRESETS.find((p) => p.value === date.mode)?.label || 'All dates');

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const empty = (
        <div className="text-center py-14 px-4 rounded-2xl bg-white border border-slate-100">
            <Archive size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">{t('No rejected stock')}</p>
            <p className="text-base text-slate-500 mt-1">{t('Items show here after you accept a return.')}</p>
            {date.mode !== 'all' && (
                <button type="button" onClick={() => setDate({ mode: 'all', day: '' })} className="mt-4 h-12 px-6 rounded-xl bg-green-700 text-white text-base font-semibold">
                    {t('Show all dates')}
                </button>
            )}
        </div>
    );

    const searchBox = (
        <div className="flex items-center gap-2.5 h-12 px-4 rounded-xl border border-slate-200 bg-white">
            <Search size={20} className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search franchise name...')} className="flex-1 min-w-0 bg-transparent outline-none text-base" />
        </div>
    );

    const franchiseCard = (f, desktop) => {
        const on = desktop && desktopActive?.id === f.id;
        return (
            <button key={f.id} type="button" onClick={() => setSelectedId(f.id)}
                className={cn('w-full flex items-center gap-3 rounded-2xl border bg-white p-4 text-left', on ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100' : 'border-slate-100')}>
                <span className={cn('w-14 h-14 rounded-xl flex items-center justify-center shrink-0', tileOf(f.id))}><Store size={26} /></span>
                <span className="flex-1 min-w-0">
                    <span className="block text-lg font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(f.franchise)}</span>
                    <span className="block text-sm text-slate-500">{f.rows.length} {t('items')} • {loadText(f.load, t)}</span>
                    <span className="block text-lg font-bold text-slate-900 mt-0.5">{money(f.value)}</span>
                </span>
                <ChevronRight size={22} className="text-slate-500 shrink-0" />
            </button>
        );
    };

    const itemCard = (r) => (
        <button key={r.key} type="button" onClick={() => setOpenRow(r)} className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left">
            <Thumb src={r.image} className="w-14 h-14" />
            <span className="flex-1 min-w-0">
                <span className="block text-lg font-bold text-slate-900">{t(r.name)}</span>
                <span className="block text-base text-slate-500">{r.quantity} {t(unitLabel(r.unit))}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
                <IssueBadge row={r} />
                <span className="text-sm text-slate-500">₹{r.rate}/{unitLabel(r.unit).toLowerCase()}</span>
                <span className="text-lg font-bold text-slate-900">{money(r.value)}</span>
            </span>
            <ChevronRight size={22} className="text-slate-500 shrink-0" />
        </button>
    );

    const sumKpis = (list, withFranchises) => {
        const value = list.reduce((s, r) => s + r.value, 0);
        const k = [];
        if (withFranchises) k.push({ label: 'Total franchises', value: new Set(list.map((r) => r.franchiseId)).size, icon: Store, tone: 'bg-red-50', iconTone: 'text-red-600' });
        k.push({ label: 'Total items', value: list.length, icon: Package, tone: withFranchises ? 'bg-violet-50' : 'bg-red-50', iconTone: withFranchises ? 'text-violet-600' : 'text-red-600' });
        k.push({ label: 'Total quantity', value: loadText(loadOf(list, (r) => r.quantity), t), icon: ShoppingBag, tone: withFranchises ? 'bg-amber-50' : 'bg-violet-50', iconTone: withFranchises ? 'text-amber-600' : 'text-violet-600' });
        k.push({ label: 'Total deduction', value: money(value), icon: withFranchises ? IndianRupee : Weight, tone: withFranchises ? 'bg-green-50' : 'bg-amber-50', iconTone: withFranchises ? 'text-green-700' : 'text-amber-600' });
        return k;
    };

    return (
        <div className="pb-24 lg:pb-6">
            {/* ---------- Mobile ---------- */}
            <div className="lg:hidden">
                {active ? (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <button type="button" onClick={() => setSelectedId(null)} className="w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Back"><ArrowLeft size={28} /></button>
                            <h1 className="text-2xl font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(active.franchise)}</h1>
                        </div>
                        <DatePicker value={date} onChange={setDate} />
                        <div className="my-4"><Kpis compact items={sumKpis(active.rows, false)} /></div>
                        <div className="space-y-3">{active.rows.map(itemCard)}</div>
                    </>
                ) : (
                    <>
                        <VendorMobileTopBar />
                        <h1 className="text-3xl font-bold text-slate-900">{t('Rejected Stock')}</h1>
                        <p className="text-lg text-slate-600 mt-1 mb-4">{t('Franchises that rejected goods')}</p>
                        <DatePicker value={date} onChange={setDate} />
                        <div className="my-3">{searchBox}</div>
                        {rows.length > 0 && <div className="mb-4"><Kpis items={sumKpis(rows, true)} /></div>}
                        {shownFranchises.length ? <div className="space-y-3">{shownFranchises.map((f) => franchiseCard(f, false))}</div> : empty}
                    </>
                )}
            </div>

            {/* ---------- Desktop ---------- */}
            <div className="hidden lg:block">
                <VendorDesktopHeader
                    icon={Archive}
                    title={t('Rejected Stock')}
                    subtitle={t('Select a franchise to view the items they have rejected. These are deducted from your final settlement.')}
                    dateSlot={<DatePicker desktop value={date} onChange={setDate} />}
                />
                <div className="rounded-3xl bg-white border border-slate-100 p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <h2 className="text-xl font-bold text-slate-900">{t('Franchises with rejected stock')}{periodLabel ? ` (${periodLabel})` : ''}</h2>
                        <div className="w-[340px]">{searchBox}</div>
                    </div>
                    {shownFranchises.length
                        ? <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{shownFranchises.map((f) => franchiseCard(f, true))}</div>
                        : empty}
                </div>

                {desktopActive && (
                    <div className="rounded-3xl bg-white border border-slate-100 p-5 mt-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{t('Rejected Stock')} - <span translate="no">{franchiseNameOf(desktopActive.franchise)}</span></h2>
                                <p className="text-base text-slate-500 mt-1">{t('Items rejected by this franchise and returned to you.')}</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="rounded-xl bg-slate-50 px-4 py-2.5 min-w-[130px]">
                                    <p className="text-sm text-slate-500">{t('Total rejected')}</p>
                                    <p className="text-xl font-bold text-slate-900">{loadText(desktopActive.load, t)}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 px-4 py-2.5 min-w-[130px]">
                                    <p className="text-sm text-slate-500">{t('Total deducted value')}</p>
                                    <p className="text-xl font-bold text-slate-900">{money(desktopActive.value)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                            <table className="w-full min-w-[900px]">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
                                        {['#', 'Item', 'Rejected qty', 'Rate', 'Value', 'Reason', 'Date & Time', 'Images'].map((h) => <th key={h} className="px-3 py-3 first:pl-5">{h === '#' ? h : t(h)}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {desktopActive.rows.map((r, k) => (
                                        <tr key={r.key} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setOpenRow(r)}>
                                            <td className="pl-5 pr-3 py-3 text-base text-slate-600">{k + 1}</td>
                                            <td className="px-3 py-3"><span className="flex items-center gap-3"><Thumb src={r.image} className="w-11 h-11" /><span className="text-base font-semibold text-slate-900">{t(r.name)}</span></span></td>
                                            <td className="px-3 py-3 text-base text-slate-900 whitespace-nowrap">{r.quantity} {t(unitLabel(r.unit))}</td>
                                            <td className="px-3 py-3 text-base text-slate-900 whitespace-nowrap">₹{r.rate}/{unitLabel(r.unit).toLowerCase()}</td>
                                            <td className="px-3 py-3 text-base font-semibold text-slate-900 whitespace-nowrap">{money(r.value)}</td>
                                            <td className="px-3 py-3"><IssueBadge row={r} /></td>
                                            <td className="px-3 py-3 text-base text-slate-700 whitespace-nowrap">{formatDay(r.when, locale)}, {formatTime(r.when, locale)}</td>
                                            <td className="px-3 py-3">
                                                <span className="flex gap-1.5">
                                                    {(r.photos.length ? r.photos.slice(0, 2) : [r.image]).map((u, n) => <Thumb key={n} src={u} className="w-11 h-11" />)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {openRow && <ItemDetail row={openRow} onClose={() => setOpenRow(null)} />}
        </div>
    );
}
