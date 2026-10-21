import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Ban,
    Box,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    Filter,
    IndianRupee,
    Loader2,
    Package,
    RotateCcw,
    Search,
    ShoppingBag,
    SlidersHorizontal,
    Truck,
    UserRound,
    Weight,
    X,
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import { franchiseNameOf, loadOf, loadText, rateOf, rupees, sentQty, shortId, unitLabel } from '../lib/packing';
import { keepPage, peekPage } from '../lib/pageCache';

const HISTORY_STATUSES = ['ready_for_pickup', 'picked_up', 'completed', 'rejected'];

const STATUS_META = {
    picked_up: { label: 'Dispatched', className: 'bg-green-50 text-green-700', icon: CheckCircle2 },
    completed: { label: 'Received', className: 'bg-green-50 text-green-700', icon: CheckCircle2 },
    ready_for_pickup: { label: 'Packed', className: 'bg-blue-50 text-blue-700', icon: Package },
    rejected: { label: 'Cancelled', className: 'bg-red-50 text-red-700', icon: Ban },
};

const STATUS_FILTERS = [
    { value: 'all', label: 'All', match: () => true },
    { value: 'dispatched', label: 'Dispatched', match: (s) => s === 'picked_up' || s === 'completed' },
    { value: 'packed', label: 'Packed', match: (s) => s === 'ready_for_pickup' },
    { value: 'cancelled', label: 'Cancelled', match: (s) => s === 'rejected' },
];

const DATE_PRESETS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All dates' },
];

const PAGE_SIZE = 10;
const DEFAULT_FILTERS = { date: { mode: 'today', day: '' }, franchise: 'all', status: 'all' };

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayInput = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

function dateRange({ mode, day }) {
    const today = startOfDay(new Date());
    const DAY = 86400000;
    if (mode === 'today') return [today, new Date(+today + DAY)];
    if (mode === 'yesterday') return [new Date(+today - DAY), today];
    if (mode === '7d') return [new Date(+today - 6 * DAY), new Date(+today + DAY)];
    if (mode === '30d') return [new Date(+today - 29 * DAY), new Date(+today + DAY)];
    if (mode === 'day' && day) { const s = startOfDay(new Date(`${day}T00:00:00`)); return [s, new Date(+s + DAY)]; }
    return null;
}

const whenOf = (r) => new Date(r.dispatchedAt || r.invoice?.invoiceDate || r.updatedAt || r.createdAt);

function ItemIcons({ items, max = 3 }) {
    const shown = items.slice(0, max);
    const extra = items.length - shown.length;
    return (
        <span className="flex items-center gap-1.5">
            {shown.map((it, i) => it.image
                ? <img key={i} src={it.image} alt="" className="w-9 h-9 object-contain" loading="lazy" />
                : <span key={i} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><Package size={16} /></span>)}
            {extra > 0 && <span className="h-8 min-w-8 px-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 flex items-center justify-center">+{extra}</span>}
        </span>
    );
}

function StatusBadge({ status, className }) {
    const { t } = useVendorLanguage();
    const m = STATUS_META[status] || STATUS_META.picked_up;
    const Icon = m.icon;
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', m.className, className)}>
            <Icon size={16} className="shrink-0" /> {t(m.label)}
        </span>
    );
}

function DatePicker({ value, onChange, desktop }) {
    const { t, locale } = useVendorLanguage();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const label = value.mode === 'day' && value.day
        ? formatDay(new Date(`${value.day}T00:00:00`), locale)
        : value.mode === 'today'
            ? `${formatDay(new Date(), locale)} (${t('Today')})`
            : t(DATE_PRESETS.find((p) => p.value === value.mode)?.label || 'All dates');

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)}
                className={cn('w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white text-left', desktop ? 'h-16 px-4 min-w-[230px]' : 'h-14 px-4')}>
                <CalendarDays size={22} className="text-slate-700 shrink-0" />
                <span className="flex-1 min-w-0">
                    {desktop && <span className="block text-xs text-slate-500">{t('Select Date')}</span>}
                    <span className="block text-base lg:text-lg font-semibold text-slate-900 truncate">{label}</span>
                </span>
                <ChevronDown size={20} className="text-slate-500 shrink-0" />
            </button>
            {open && (
                <div className="absolute z-30 mt-2 left-0 right-0 lg:right-auto lg:w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2">
                    {DATE_PRESETS.map((p) => (
                        <button key={p.value} type="button" onClick={() => { onChange({ mode: p.value, day: '' }); setOpen(false); }}
                            className={cn('w-full text-left px-4 py-3 rounded-xl text-base', value.mode === p.value ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-800 hover:bg-slate-50')}>
                            {t(p.label)}
                        </button>
                    ))}
                    <div className="border-t border-slate-100 mt-1 pt-2 px-2 pb-1">
                        <p className="text-sm text-slate-500 mb-1">{t('Pick a day')}</p>
                        <input type="date" max={dayInput(new Date())} value={value.mode === 'day' ? value.day : ''}
                            onChange={(e) => { if (e.target.value) { onChange({ mode: 'day', day: e.target.value }); setOpen(false); } }}
                            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-base" />
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiCards({ stats, periodLabel }) {
    const { t } = useVendorLanguage();
    const cards = [
        { icon: Box, tone: 'bg-green-50', iconTone: 'bg-green-100 text-green-700', label: 'Total Orders', value: stats.orders, sub: periodLabel },
        { icon: ShoppingBag, tone: 'bg-blue-50', iconTone: 'bg-blue-100 text-blue-700', label: 'Total Items', value: stats.items, sub: t('Different items') },
        { icon: Weight, tone: 'bg-violet-50', iconTone: 'bg-violet-100 text-violet-700', label: 'Total Quantity', value: stats.load, sub: periodLabel },
        { icon: IndianRupee, tone: 'bg-amber-50', iconTone: 'bg-amber-100 text-amber-600', label: 'Total Value', value: rupees(stats.value), sub: periodLabel },
    ];
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {cards.map((c) => (
                <div key={c.label} className={cn('rounded-2xl p-3.5 lg:p-5 flex items-start gap-3 lg:gap-4 lg:bg-white lg:border lg:border-slate-100', c.tone)}>
                    <span className={cn('w-11 h-11 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0', c.iconTone)}>
                        <c.icon size={24} className="lg:w-7 lg:h-7" />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm lg:text-base text-slate-600 leading-tight">{t(c.label)}</span>
                        <span className="block text-xl lg:text-2xl font-bold text-slate-900 mt-1 break-words">{c.value}</span>
                        <span className="block text-xs lg:text-sm text-slate-500 mt-0.5">{c.sub}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

function OrderDetail({ order, onBack, onPickedUp, busy, asModal }) {
    const { t, locale } = useVendorLanguage();
    const when = whenOf(order);
    const items = order.items || [];
    const total = items.reduce((s, it) => s + sentQty(it) * rateOf(it), 0);
    const meta = STATUS_META[order.status] || STATUS_META.picked_up;
    const f = order.franchiseId || {};

    const info = [
        ['Order ID', shortId(order._id)],
        ['Franchise', `${franchiseNameOf(f)}${f.city ? ` (${f.city})` : ''}`],
        ['Dispatch Time', `${formatDay(when, locale)}, ${formatTime(when, locale)}`],
        ['Total Items', items.length],
        ['Total Quantity', loadText(loadOf(items, sentQty), t)],
        ['Total Value', rupees(total)],
    ];
    if (order.invoice?.invoiceNumber) info.push(['Invoice', order.invoice.invoiceNumber]);

    const body = (
        <>
            <div className={cn('flex items-center gap-4 rounded-2xl px-5 py-4', order.status === 'rejected' ? 'bg-red-50' : order.status === 'ready_for_pickup' ? 'bg-blue-50' : 'bg-green-50')}>
                <span className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0',
                    order.status === 'rejected' ? 'bg-red-600' : order.status === 'ready_for_pickup' ? 'bg-blue-600' : 'bg-green-600')}>
                    <meta.icon size={28} />
                </span>
                <div>
                    <p className="text-lg font-bold text-slate-900">{t(meta.label)}</p>
                    <p className="text-base text-slate-700">{formatDay(when, locale)}, {formatTime(when, locale)}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 mt-4 space-y-2">
                {info.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[130px_1fr] gap-3 text-base">
                        <span className="text-slate-500">{t(k)}</span>
                        <span className="font-semibold text-slate-900 break-words" translate="no">{v}</span>
                    </div>
                ))}
            </div>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">{t('Item list')} ({items.length})</h3>
            <div className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] gap-3 items-center px-3 h-11 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
                <span>#</span><span>{t('Item')}</span><span className="text-right">{t('Quantity')}</span><span className="text-right min-w-[70px]">{t('Value')}</span>
            </div>
            <div className="divide-y divide-slate-100">
                {items.map((it, i) => (
                    <div key={it._id || i} className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] gap-3 items-center px-3 py-2.5">
                        <span className="text-base text-slate-600">{i + 1}</span>
                        <span className="flex items-center gap-3 min-w-0">
                            {it.image ? <img src={it.image} alt="" className="w-10 h-10 object-contain shrink-0" loading="lazy" />
                                : <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><Package size={18} /></span>}
                            <span className="min-w-0">
                                <span className="block text-base font-semibold text-slate-900 break-words">{t(it.name)}</span>
                                {order.status === 'completed' && Number(it.receivedQuantity) !== sentQty(it) && (
                                    <span className="block text-xs text-amber-700">{t('Received')}: {Number(it.receivedQuantity) || 0}</span>
                                )}
                            </span>
                        </span>
                        <span className="text-base text-slate-800 whitespace-nowrap text-right">{sentQty(it)} {t(unitLabel(it.unit))}</span>
                        <span className="text-base font-semibold text-slate-900 whitespace-nowrap text-right min-w-[70px]">{rupees(sentQty(it) * rateOf(it))}</span>
                    </div>
                ))}
            </div>

            {order.dispatchNote && (
                <div className="rounded-2xl bg-amber-50 px-5 py-3 mt-4">
                    <p className="text-sm text-amber-800">{t('Note')}</p>
                    <p className="text-base text-slate-900">{order.dispatchNote}</p>
                </div>
            )}

            {order.status !== 'rejected' && (
                <div className="flex items-center gap-4 rounded-2xl bg-slate-100 px-5 py-4 mt-4">
                    <Truck size={30} className="text-slate-700 shrink-0" />
                    <p className="text-base text-slate-800">
                        {t('This order was dispatched on')} {formatDay(when, locale)}, {formatTime(when, locale)}
                    </p>
                </div>
            )}

            {order.status === 'ready_for_pickup' && (
                <button type="button" onClick={() => onPickedUp(order)} disabled={busy}
                    className="w-full mt-5 flex items-center justify-center gap-3 h-16 rounded-2xl bg-green-700 text-white text-lg font-bold disabled:opacity-50">
                    {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} {t('Picked up by delivery partner')}
                </button>
            )}
        </>
    );

    if (asModal) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-6" onClick={onBack}>
                <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-slate-900">{t('Order Details')}</h2>
                        <button type="button" onClick={onBack} className="w-11 h-11 rounded-full hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
                            <X size={24} />
                        </button>
                    </div>
                    {body}
                </div>
            </div>
        );
    }
    return (
        <div className="pb-24">
            <div className="relative flex items-center justify-center mb-5">
                <button type="button" onClick={onBack} className="absolute left-0 w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Back">
                    <ArrowLeft size={28} />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">{t('Order Details')}</h1>
            </div>
            {body}
        </div>
    );
}

export default function DispatchHistoryScreen() {
    const { t, locale } = useVendorLanguage();
    const [orders, setOrders] = useState(() => (peekPage('assignments') || []).filter((o) => HISTORY_STATUSES.includes(o.status)));
    const [isLoading, setIsLoading] = useState(!peekPage('assignments'));
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetDraft, setSheetDraft] = useState(DEFAULT_FILTERS);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const res = await api.get('/procurement/vendor/my-assignments');
            setOrders(keepPage('assignments', res.data?.results || []).filter((o) => HISTORY_STATUSES.includes(o.status)));
        } catch (error) {
            if (error.response?.status !== 401) toast.error(error.response?.data?.message || t('Could not load dispatch history'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const franchises = useMemo(() => {
        const m = new Map();
        orders.forEach((o) => { const f = o.franchiseId; if (f?._id) m.set(String(f._id), franchiseNameOf(f)); });
        return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [orders]);

    const filtered = useMemo(() => {
        const range = dateRange(filters.date);
        const q = search.trim().toLowerCase();
        const statusMatch = STATUS_FILTERS.find((s) => s.value === filters.status)?.match || (() => true);
        return orders
            .filter((o) => {
                const w = whenOf(o);
                if (range && (w < range[0] || w >= range[1])) return false;
                if (filters.franchise !== 'all' && String(o.franchiseId?._id) !== filters.franchise) return false;
                if (!statusMatch(o.status)) return false;
                if (q) {
                    const hay = [franchiseNameOf(o.franchiseId), shortId(o._id), String(o._id), o.invoice?.invoiceNumber || ''].join(' ').toLowerCase();
                    if (!hay.includes(q.replace(/^#/, ''))) return false;
                }
                return true;
            })
            .sort((a, b) => whenOf(b) - whenOf(a));
    }, [orders, filters, search]);

    useEffect(() => { setPage(1); }, [filters, search]);

    const stats = useMemo(() => {
        const live = filtered.filter((o) => o.status !== 'rejected');
        const all = live.flatMap((o) => o.items || []);
        return {
            orders: live.length,
            items: new Set(all.map((it) => it.productId || it.name)).size,
            load: loadText(loadOf(all, sentQty), t),
            value: all.reduce((s, it) => s + sentQty(it) * rateOf(it), 0),
        };
    }, [filtered, t]);

    const periodLabel = filters.date.mode === 'day'
        ? formatDay(new Date(`${filters.date.day}T00:00:00`), locale)
        : t(DATE_PRESETS.find((p) => p.value === filters.date.mode)?.label || 'All dates');

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const filtersActive = filters.franchise !== 'all' || filters.status !== 'all';

    const valueOf = (o) => (o.items || []).reduce((s, it) => s + sentQty(it) * rateOf(it), 0);

    const markPickedUp = async (order) => {
        setBusy(true);
        try {
            await api.put(`/procurement/vendor/${order._id}/status`, { status: 'picked_up' });
            toast.success(t('Marked as picked up'));
            setSelected(null);
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not update. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const reset = () => { setFilters(DEFAULT_FILTERS); setSearch(''); };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="animate-spin text-green-700" size={40} />
            </div>
        );
    }

    const emptyState = (
        <div className="text-center py-14 px-4">
            <Truck size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">{t('No orders found')}</p>
            {filters.date.mode !== 'all' && (
                <button type="button" onClick={() => setFilters((f) => ({ ...f, date: { mode: 'all', day: '' } }))}
                    className="mt-4 h-12 px-6 rounded-xl bg-green-700 text-white text-base font-semibold">
                    {t('Show all dates')}
                </button>
            )}
        </div>
    );

    const selectClass = 'h-14 px-4 pr-10 rounded-2xl border border-slate-200 bg-white text-base font-medium text-slate-900 outline-none appearance-none';

    return (
        <>
            {/* ---------- Mobile ---------- */}
            <div className="lg:hidden">
                {selected ? (
                    <OrderDetail order={selected} onBack={() => setSelected(null)} onPickedUp={markPickedUp} busy={busy} />
                ) : (
                    <div className="pb-24">
                        <VendorMobileTopBar />
                        <h1 className="text-3xl font-bold text-slate-900">{t('Dispatch History')}</h1>
                        <p className="text-lg text-slate-600 mt-1 mb-4">{t('All orders you have packed and dispatched.')}</p>

                        <DatePicker value={filters.date} onChange={(date) => setFilters((f) => ({ ...f, date }))} />
                        <div className="mt-4"><KpiCards stats={stats} periodLabel={periodLabel} /></div>

                        <div className="flex gap-3 mt-4 mb-3">
                            <div className="flex-1 flex items-center gap-2.5 h-14 px-4 rounded-2xl border border-slate-200 bg-white">
                                <Search size={20} className="text-slate-400 shrink-0" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search franchise or order ID...')}
                                    className="flex-1 min-w-0 bg-transparent outline-none text-base" />
                            </div>
                            <button type="button" onClick={() => { setSheetDraft(filters); setSheetOpen(true); }}
                                className={cn('relative w-14 h-14 rounded-2xl border flex items-center justify-center', filtersActive ? 'border-green-600 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-700')}
                                aria-label="Filters">
                                <SlidersHorizontal size={22} />
                                {filtersActive && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-green-600" />}
                            </button>
                        </div>

                        {!filtered.length ? emptyState : (
                            <div className="space-y-3">
                                {filtered.map((o) => (
                                    <button key={o._id} type="button" onClick={() => setSelected(o)}
                                        className="w-full flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-left">
                                        <span className="flex-1 min-w-0">
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="min-w-0">
                                                    <span className="block text-lg font-bold text-slate-900">{shortId(o._id)}</span>
                                                    <span className="block text-base text-slate-700 truncate" translate="no">{franchiseNameOf(o.franchiseId)}</span>
                                                    <span className="block text-sm text-slate-500">{formatTime(whenOf(o), locale)}</span>
                                                </span>
                                                <StatusBadge status={o.status} />
                                            </span>
                                            <span className="flex items-end justify-between gap-2 mt-2">
                                                <ItemIcons items={o.items || []} />
                                                <span className="text-right">
                                                    <span className="block text-base text-slate-700">{loadText(loadOf(o.items || [], sentQty), t)}</span>
                                                    <span className="block text-lg font-bold text-slate-900">{rupees(valueOf(o))}</span>
                                                </span>
                                            </span>
                                        </span>
                                        <ChevronRight size={22} className="text-slate-500 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {sheetOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40" onClick={() => setSheetOpen(false)}>
                        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-4" />
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-2xl font-bold text-slate-900">{t('Filter')}</h3>
                                <button type="button" onClick={() => setSheetOpen(false)} className="w-11 h-11 flex items-center justify-center" aria-label="Close"><X size={26} /></button>
                            </div>

                            <p className="text-lg font-semibold text-slate-900 mb-2">{t('Select Date')}</p>
                            <DatePicker value={sheetDraft.date} onChange={(date) => setSheetDraft((d) => ({ ...d, date }))} />

                            <p className="text-lg font-semibold text-slate-900 mt-5 mb-2">{t('Franchise')}</p>
                            <div className="relative">
                                <UserRound size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                                <select value={sheetDraft.franchise} onChange={(e) => setSheetDraft((d) => ({ ...d, franchise: e.target.value }))}
                                    className={cn(selectClass, 'w-full pl-12')}>
                                    <option value="all">{t('All Franchises')}</option>
                                    {franchises.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                                </select>
                                <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>

                            <p className="text-lg font-semibold text-slate-900 mt-5 mb-2">{t('Status')}</p>
                            <div className="flex flex-wrap gap-3">
                                {STATUS_FILTERS.map((s) => {
                                    const on = sheetDraft.status === s.value;
                                    return (
                                        <button key={s.value} type="button" onClick={() => setSheetDraft((d) => ({ ...d, status: s.value }))}
                                            className={cn('h-12 px-5 rounded-xl border text-base font-semibold', on ? 'bg-green-700 border-green-700 text-white' : 'border-slate-200 text-slate-800')}>
                                            {t(s.label)}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-8">
                                <button type="button" onClick={() => { setSheetDraft(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS); setSheetOpen(false); }}
                                    className="flex items-center justify-center gap-2 h-14 rounded-2xl border-2 border-slate-300 text-lg font-bold text-slate-800">
                                    <RotateCcw size={20} /> {t('Reset')}
                                </button>
                                <button type="button" onClick={() => { setFilters(sheetDraft); setSheetOpen(false); }}
                                    className="flex items-center justify-center gap-2 h-14 rounded-2xl bg-green-700 text-lg font-bold text-white">
                                    <Filter size={20} /> {t('Apply')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ---------- Desktop ---------- */}
            <div className="hidden lg:block pb-6">
                <VendorDesktopHeader
                    title={t('Dispatch History')}
                    subtitle={t('Review and listing of all packed and dispatched orders.')}
                    dateSlot={<DatePicker desktop value={filters.date} onChange={(date) => setFilters((f) => ({ ...f, date }))} />}
                />
                <KpiCards stats={stats} periodLabel={periodLabel} />

                <div className="flex items-center gap-3 mt-5 p-4 rounded-3xl bg-white border border-slate-100">
                    <div className="flex-1 flex items-center gap-3 h-14 px-4 rounded-2xl border border-slate-200">
                        <Search size={20} className="text-slate-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search by franchise name or order ID...')}
                            className="flex-1 bg-transparent outline-none text-base" />
                    </div>
                    <div className="relative">
                        <select value={filters.franchise} onChange={(e) => setFilters((f) => ({ ...f, franchise: e.target.value }))} className={cn(selectClass, 'min-w-[200px]')}>
                            <option value="all">{t('All Franchises')}</option>
                            {franchises.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                        <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <div className="relative">
                        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className={cn(selectClass, 'min-w-[180px]')}>
                            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.value === 'all' ? t('All Status') : t(s.label)}</option>)}
                        </select>
                        <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <button type="button" onClick={reset} className="flex items-center gap-2 h-14 px-6 rounded-2xl bg-slate-900 text-white text-base font-bold">
                        <RotateCcw size={20} /> {t('Reset')}
                    </button>
                </div>

                <div className="mt-5 rounded-3xl bg-white border border-slate-100 overflow-hidden">
                    {!filtered.length ? emptyState : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px]">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
                                            {['#', 'Date & Time', 'Order ID', 'Franchise', 'Items (Qty)', 'Total Qty', 'Total Value', 'Status', 'Action'].map((h) => (
                                                <th key={h} className="px-3 py-4 font-semibold first:pl-5 last:pr-5">{h === '#' ? h : t(h)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pageRows.map((o, i) => (
                                            <tr key={o._id} className="hover:bg-slate-50/60">
                                                <td className="pl-5 pr-3 py-4 text-base text-slate-700">{(page - 1) * PAGE_SIZE + i + 1}</td>
                                                <td className="px-3 py-4">
                                                    <p className="text-base font-semibold text-slate-900 whitespace-nowrap">{formatDay(whenOf(o), locale)}</p>
                                                    <p className="text-sm text-slate-500">{formatTime(whenOf(o), locale)}</p>
                                                </td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900">{shortId(o._id)}</td>
                                                <td className="px-3 py-4">
                                                    <p className="text-base font-semibold text-slate-900" translate="no">{franchiseNameOf(o.franchiseId)}</p>
                                                    <p className="text-sm text-slate-500">{o.franchiseId?.city || ''}</p>
                                                </td>
                                                <td className="px-3 py-4"><ItemIcons items={o.items || []} max={2} /></td>
                                                <td className="px-3 py-4 text-base text-slate-900">{loadText(loadOf(o.items || [], sentQty), t)}</td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900 whitespace-nowrap">{rupees(valueOf(o))}</td>
                                                <td className="px-3 py-4"><StatusBadge status={o.status} /></td>
                                                <td className="px-3 py-4">
                                                    <button type="button" onClick={() => setSelected(o)}
                                                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 text-base font-semibold text-slate-900 hover:bg-slate-50">
                                                        <FileText size={18} /> {t('View')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                                <p className="text-base text-slate-500">
                                    {t('Showing')} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                                        className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-40" aria-label="Previous page">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span className="w-11 h-11 rounded-xl bg-slate-900 text-white text-base font-bold flex items-center justify-center">{page}</span>
                                    <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
                                        className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-40" aria-label="Next page">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {selected && <OrderDetail asModal order={selected} onBack={() => setSelected(null)} onPickedUp={markPickedUp} busy={busy} />}
            </div>
        </>
    );
}
