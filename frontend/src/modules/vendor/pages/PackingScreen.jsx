import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Boxes,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronRight,
    History,
    Loader2,
    Minus,
    Package,
    Pencil,
    Plus,
    Search,
    Store,
    StickyNote,
    Truck,
    X,
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay } from '../components/layout/VendorPageHeader';
import { franchiseNameOf, loadOf, loadText, unitLabel } from '../lib/packing';
import { keepPage, peekPage } from '../lib/pageCache';

const OPEN = ['approved', 'preparing'];

const STATUS_STYLE = {
    pending: { label: 'To be packed', className: 'bg-amber-50 text-amber-700' },
    packing: { label: 'Packing', className: 'bg-green-100 text-green-800' },
    ready: { label: 'Ready', className: 'bg-green-100 text-green-800' },
};

// Quantity the vendor has already saved for an item; before any edit it is the ordered amount
function savedQty(request, item) {
    const edited = request.status === 'preparing' && request.items.some((i) => Number(i.dispatchedQuantity) > 0);
    return edited ? Number(item.dispatchedQuantity) || 0 : Number(item.quantity) || 0;
}

function useIsDesktop() {
    const query = '(min-width: 1024px)';
    const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const on = () => setMatch(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return match;
}

/** One franchise's work for today: the open requests (or, when everything is packed, the ones waiting for pickup). */
function buildGroups(requests) {
    const byFranchise = new Map();
    for (const r of requests) {
        const f = r.franchiseId || {};
        const key = String(f._id || r.franchiseId || r._id);
        if (!byFranchise.has(key)) byFranchise.set(key, { key, franchise: f, open: [], ready: [] });
        const g = byFranchise.get(key);
        if (OPEN.includes(r.status)) g.open.push(r);
        else if (r.status === 'ready_for_pickup') g.ready.push(r);
    }
    const groups = [];
    for (const g of byFranchise.values()) {
        const working = g.open.length ? g.open : g.ready;
        if (!working.length) continue;
        // One row per product: the same item ordered by several hotels is packed as one total
        const byProduct = new Map();
        [...working].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((r) => r.items.forEach((item) => {
            const key = `${item.productId}|${String(item.unit || '').toLowerCase()}`;
            if (!byProduct.has(key)) byProduct.set(key, { key, item, unit: item.unit, ordered: 0, saved: 0, parts: [] });
            const row = byProduct.get(key);
            const ordered = Number(item.quantity) || 0;
            const saved = g.open.length ? savedQty(r, item) : (Number(item.dispatchedQuantity) || ordered);
            row.parts.push({ requestId: r._id, productId: item.productId, ordered, saved });
            row.ordered = Math.round((row.ordered + ordered) * 100) / 100;
            row.saved = Math.round((row.saved + saved) * 100) / 100;
            if (!row.item.image && item.image) row.item = { ...row.item, image: item.image };
        }));
        const rows = [...byProduct.values()];
        const status = !g.open.length ? 'ready' : g.open.some((r) => r.status === 'preparing') ? 'packing' : 'pending';
        groups.push({ ...g, rows, status, readOnly: !g.open.length });
    }
    const order = { packing: 0, pending: 1, ready: 2 };
    return groups.sort((a, b) => order[a.status] - order[b.status] || franchiseNameOf(a.franchise).localeCompare(franchiseNameOf(b.franchise)));
}

/** Spread a product's total over its orders, oldest first (none gets more than it ordered). */
function shareOut(row, qty) {
    let left = Math.max(0, Number(qty) || 0);
    return row.parts.map((p) => {
        const give = Math.min(p.ordered, Math.round(left * 100) / 100);
        left -= give;
        return { ...p, qty: give };
    });
}

/** itemUpdates for one request from every row's quantity. */
function updatesFor(rows, requestId, qtyOf) {
    return rows.flatMap((row) => shareOut(row, qtyOf(row))
        .filter((p) => p.requestId === requestId)
        .map((p) => ({ productId: p.productId, dispatchedQuantity: p.qty })));
}

function ItemThumb({ src, size = 'md' }) {
    const box = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-9 h-9' : 'w-12 h-12';
    return src ? (
        <img src={src} alt="" className={cn(box, 'object-contain shrink-0')} loading="lazy" />
    ) : (
        <div className={cn(box, 'rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0')}>
            <Package size={20} />
        </div>
    );
}

function ItemName({ name, className }) {
    const { t } = useVendorLanguage();
    const local = t(name);
    return (
        <div className={cn('min-w-0', className)}>
            <p className="text-lg font-semibold text-slate-900 leading-snug break-words">{local}</p>
            {local !== name && <p className="text-xs text-slate-500 truncate" translate="no">{name}</p>}
        </div>
    );
}

function StatusPill({ status, className }) {
    const { t } = useVendorLanguage();
    const s = STATUS_STYLE[status];
    return <span className={cn('inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', s.className, className)}>{t(s.label)}</span>;
}

function Stepper({ value, max, unit, onChange }) {
    const { t } = useVendorLanguage();
    const step = 1;
    const set = (v) => onChange(Math.min(max, Math.max(0, Math.round(v * 100) / 100)));
    return (
        <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => set(value - step)} disabled={value <= 0} aria-label="Less"
                className="w-9 lg:w-10 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-800 disabled:opacity-30">
                <Minus size={20} />
            </button>
            <label className="w-16 lg:w-[72px] h-12 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center">
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={max}
                    step="any"
                    value={value}
                    onChange={(e) => set(parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-lg font-bold text-slate-900 leading-none bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-slate-500 leading-none mt-0.5">{t(unitLabel(unit))}</span>
            </label>
            <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label="More"
                className="w-9 lg:w-10 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-800 disabled:opacity-30">
                <Plus size={20} />
            </button>
        </div>
    );
}

export default function PackingScreen() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const focusRequest = searchParams.get('order');
    const { t, locale } = useVendorLanguage();
    const isDesktop = useIsDesktop();

    const onlyActive = (all) => (all || []).filter((r) => [...OPEN, 'ready_for_pickup'].includes(r.status));
    const [requests, setRequests] = useState(() => onlyActive(peekPage('assignments')));
    const [isLoading, setIsLoading] = useState(!peekPage('assignments'));
    const [search, setSearch] = useState('');
    const [selectedKey, setSelectedKey] = useState(null);
    const [mode, setMode] = useState('view'); // view | edit | check | done
    const [editRow, setEditRow] = useState(null); // desktop: one row being edited
    const [draft, setDraft] = useState({});
    const [checked, setChecked] = useState({});
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [sentSummary, setSentSummary] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/procurement/vendor/my-assignments');
            setRequests(onlyActive(keepPage('assignments', res.data?.results || [])));
        } catch (error) {
            if (error.response?.status !== 401) toast.error(error.response?.data?.message || t('Could not load orders'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const groups = useMemo(() => buildGroups(requests), [requests]);

    // Opened from an order link (?order=<requestId>): show that franchise
    useEffect(() => {
        if (!focusRequest || selectedKey) return;
        const g = groups.find((x) => x.rows.some((r) => r.parts.some((p) => String(p.requestId) === focusRequest)));
        if (g) setSelectedKey(g.key);
    }, [focusRequest, groups, selectedKey]);

    const activeKey = selectedKey ?? (isDesktop ? groups[0]?.key : null);
    const group = groups.find((g) => g.key === activeKey) || null;

    // Fresh draft whenever another franchise is opened or the data reloads
    useEffect(() => {
        if (!group) return;
        setDraft(Object.fromEntries(group.rows.map((r) => [r.key, r.saved])));
        setChecked(Object.fromEntries(group.rows.map((r) => [r.key, r.saved > 0])));
        setEditRow(null);
        setNote('');
    }, [group?.key, requests]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredGroups = groups.filter((g) => franchiseNameOf(g.franchise).toLowerCase().includes(search.trim().toLowerCase()));

    const qtyOf = (row) => Number(draft[row.key] ?? row.saved) || 0;
    const groupLoad = (g, useDraft = false) => loadOf(g.rows, useDraft ? (it) => qtyOf(it) : (it) => it.saved);
    const dirty = !!group && group.rows.some((r) => qtyOf(r) !== r.saved);

    const openGroup = (key) => { setSelectedKey(key); setMode('view'); setSentSummary(null); };
    const closeGroup = () => { setSelectedKey(null); setMode('view'); };

    const cancelEdit = () => {
        if (group) setDraft(Object.fromEntries(group.rows.map((r) => [r.key, r.saved])));
        setEditRow(null);
        setMode('view');
    };

    // Save edited quantities: the request moves to "preparing" (Packing) and keeps the amounts
    const saveEdits = async () => {
        if (!group || group.readOnly) return;
        setBusy(true);
        try {
            for (const r of group.open) {
                const itemUpdates = updatesFor(group.rows, r._id, qtyOf);
                await api.put(`/procurement/vendor/${r._id}/status`, { status: 'preparing', itemUpdates });
            }
            toast.success(t('List saved'));
            setEditRow(null);
            setMode('view');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not save. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const startCheck = () => {
        if (!group) return;
        if (!group.rows.some((r) => qtyOf(r) > 0)) {
            toast.error(t('Every item is at 0. Edit the list first.'));
            return;
        }
        setChecked(Object.fromEntries(group.rows.map((r) => [r.key, qtyOf(r) > 0])));
        setEditRow(null);
        setMode('check');
    };

    const sendRows = group ? group.rows.filter((r) => checked[r.key] && qtyOf(r) > 0) : [];

    // Send for delivery: each request goes to "ready for pickup"; unticked items stay in the list for later
    const sendForDelivery = async () => {
        if (!group || !sendRows.length) return;
        setBusy(true);
        try {
            const sendQty = (row) => (checked[row.key] ? qtyOf(row) : 0);
            for (const r of group.open) {
                const itemUpdates = updatesFor(group.rows, r._id, sendQty);
                if (!itemUpdates.some((u) => u.dispatchedQuantity > 0)) continue;
                const units = Object.fromEntries(group.rows.flatMap((row) => row.parts.map((p) => [String(p.productId), row.unit])));
                const weight = loadOf(itemUpdates.map((u) => ({ unit: units[String(u.productId)], qty: u.dispatchedQuantity })), (u) => u.qty).kg;
                await api.put(`/procurement/vendor/${r._id}/status`, { status: 'ready_for_pickup', weight, itemUpdates, note });
            }
            setSentSummary({
                name: franchiseNameOf(group.franchise),
                count: sendRows.length,
                load: loadText(loadOf(sendRows, (row) => qtyOf(row)), t),
            });
            setMode('done');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not send. Please try again.'));
            await load();
        } finally {
            setBusy(false);
        }
    };

    const markPickedUp = async () => {
        if (!group) return;
        setBusy(true);
        try {
            for (const r of group.ready) {
                await api.put(`/procurement/vendor/${r._id}/status`, { status: 'picked_up' });
            }
            toast.success(t('Marked as picked up'));
            closeGroup();
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not update. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const today = formatDay(new Date(), locale);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="animate-spin text-green-700" size={40} />
            </div>
        );
    }

    /* ---------- pieces ---------- */

    const listPanel = (
        <div className="lg:bg-white lg:rounded-3xl lg:border lg:border-slate-100 lg:p-5">
            <h2 className="hidden lg:block text-xl font-bold text-slate-900 mb-4">
                {t("Today's Orders")} <span className="font-semibold text-slate-700">({groups.length} {t('franchises')})</span>
            </h2>
            <div className="hidden lg:flex items-center gap-3 h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 mb-4">
                <Search size={20} className="text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search franchise...')}
                    className="flex-1 bg-transparent outline-none text-base text-slate-900 placeholder:text-slate-400" />
            </div>

            {!filteredGroups.length && (
                <div className="text-center py-14 px-4">
                    <Truck size={44} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-semibold text-slate-800">{t('Nothing to pack right now')}</p>
                    <p className="text-base text-slate-500 mt-1">{t('Orders appear here when the admin gives you a franchise order.')}</p>
                </div>
            )}

            <div className="space-y-0 lg:space-y-3">
                {filteredGroups.map((g, idx) => {
                    const active = g.key === activeKey;
                    const l = groupLoad(g);
                    const greenIcon = g.status !== 'pending';
                    return (
                        <button
                            key={g.key}
                            type="button"
                            onClick={() => openGroup(g.key)}
                            className={cn(
                                'w-full flex items-center gap-3.5 text-left px-3 py-3 lg:px-3 border-b border-slate-100 lg:border lg:rounded-2xl transition-colors',
                                active ? 'bg-green-50 border border-green-300 rounded-2xl lg:border-green-300' : 'lg:border-slate-100 hover:bg-slate-50'
                            )}
                        >
                            <span className={cn('hidden lg:flex w-9 h-9 rounded-full items-center justify-center text-base font-bold shrink-0',
                                active ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700')}>{idx + 1}</span>
                            <span className={cn('lg:hidden w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                                greenIcon ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-800')}>
                                <Store size={26} />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-xl font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(g.franchise)}</span>
                                <span className="block text-base text-slate-500 mt-0.5">
                                    {g.rows.length} {t('items')} <span className="mx-1.5">•</span> {loadText(l, t)}
                                </span>
                            </span>
                            <StatusPill status={g.status} />
                            <ChevronRight size={22} className="text-slate-500 shrink-0" />
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const franchiseHeader = group && (
        <div className="flex items-center gap-4 lg:bg-green-50 lg:rounded-2xl lg:p-5">
            <div className="w-16 h-16 rounded-full bg-green-100 lg:bg-white/70 text-green-700 flex items-center justify-center shrink-0">
                <Store size={30} />
            </div>
            <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(group.franchise)}</h2>
                <p className="text-base text-slate-500 mt-0.5">
                    {group.rows.length} {t('items')} <span className="mx-1.5">•</span> {t('Total')} {loadText(groupLoad(group, true), t)}
                </p>
                {[group.franchise?.area, group.franchise?.city].filter(Boolean).length > 0 && (
                    <p className="text-sm text-slate-400 truncate">{[group.franchise?.area, group.franchise?.city].filter(Boolean).join(', ')}</p>
                )}
            </div>
            <StatusPill status={group.status} className="hidden lg:inline-flex text-base px-4 py-2" />
        </div>
    );

    const backBar = (title) => (
        <div className="lg:hidden flex items-center gap-3 mb-4">
            <button type="button" onClick={mode === 'view' ? closeGroup : cancelEdit} className="w-11 h-11 -ml-2 flex items-center justify-center text-slate-900" aria-label="Back">
                <ArrowLeft size={28} />
            </button>
            {title && <h1 className="flex-1 text-center text-2xl font-bold text-slate-900 pr-9">{title}</h1>}
        </div>
    );

    const tableHead = (cols) => (
        <div className="grid items-center gap-2.5 lg:gap-3 px-2 lg:px-4 h-12 rounded-xl bg-slate-100 text-base font-semibold text-slate-600" style={{ gridTemplateColumns: cols }}>
            <span>#</span>
            <span>{t('Item')}</span>
            <span>{t('Quantity')}</span>
            <span className="hidden lg:block">{group && !group.readOnly ? t('Action') : ''}</span>
        </div>
    );

    const COLS = isDesktop ? '32px minmax(0,1fr) 172px 104px' : '20px minmax(0,1fr) auto';

    const itemsTable = group && (
        <div>
            {tableHead(COLS)}
            <div className="divide-y divide-slate-100">
                {group.rows.map((row, i) => {
                    const editing = !group.readOnly && (mode === 'edit' || editRow === row.key);
                    return (
                        <div key={row.key} className="grid items-center gap-2.5 lg:gap-3 px-2 lg:px-4 py-3" style={{ gridTemplateColumns: COLS }}>
                            <span className="text-lg text-slate-700">{i + 1}</span>
                            <span className="flex items-center gap-3 min-w-0">
                                <ItemThumb src={row.item.image} size={editing && !isDesktop ? 'md' : 'lg'} />
                                <span className="min-w-0">
                                    <ItemName name={row.item.name} />
                                    {row.parts.length > 1 && <span className="block text-xs font-medium text-green-700">{t('Total of')} {row.parts.length} {t('orders')}</span>}
                                </span>
                            </span>
                            {editing ? (
                                <Stepper value={qtyOf(row)} max={row.ordered} unit={row.item.unit}
                                    onChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))} />
                            ) : (
                                <span className={cn('text-lg font-semibold whitespace-nowrap', qtyOf(row) === 0 ? 'text-red-600' : 'text-slate-900')}>
                                    {qtyOf(row)} {t(unitLabel(row.item.unit))}
                                    {qtyOf(row) < row.ordered && (
                                        <span className="block text-xs font-medium text-slate-500">{t('Ordered')}: {row.ordered}</span>
                                    )}
                                </span>
                            )}
                            {isDesktop && !group.readOnly && (
                                <span>
                                    {mode !== 'edit' && (
                                        <button type="button" onClick={() => setEditRow(editRow === row.key ? null : row.key)}
                                            className={cn('inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-base font-semibold',
                                                editRow === row.key ? 'border-green-600 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-800')}>
                                            {editRow === row.key ? <Check size={18} /> : <Pencil size={18} />}
                                            {editRow === row.key ? t('Done') : t('Edit')}
                                        </button>
                                    )}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const totalsCard = group && (
        <div className="flex items-center rounded-2xl bg-green-50 px-5 py-4 mt-3">
            <Boxes size={34} className="text-green-700 shrink-0" />
            <div className="flex-1 pl-4 border-r border-green-200">
                <p className="text-sm text-slate-600">{t('Total quantity')}</p>
                <p className="text-xl font-bold text-green-800">{loadText(groupLoad(group, true), t)}</p>
            </div>
            <div className="flex-1 pl-6">
                <p className="text-sm text-slate-600">{t('Total items')}</p>
                <p className="text-2xl font-bold text-green-800">{group.rows.length}</p>
            </div>
        </div>
    );

    const bigGreen = 'flex items-center justify-center gap-3 h-16 rounded-2xl bg-green-700 text-white text-lg font-bold shadow-lg shadow-green-700/20 disabled:opacity-50 active:scale-[0.99] transition-transform';

    const viewMode = group && (
        <>
            {backBar(null)}
            {franchiseHeader}

            <div className="flex items-center justify-between gap-3 my-5 lg:my-4">
                <span className="flex items-center gap-2 text-lg text-slate-800">
                    <CalendarDays size={22} className="text-slate-600" /> {today}
                </span>
                {!group.readOnly && (
                    <button type="button" onClick={() => { setEditRow(null); setMode('edit'); }}
                        className="inline-flex items-center gap-2 h-12 px-4 rounded-xl border-2 border-slate-800 text-base font-bold text-slate-900">
                        <Pencil size={18} /> {t('Edit List')}
                    </button>
                )}
            </div>

            {group.readOnly && (
                <div className="flex items-center gap-4 rounded-2xl bg-green-50 px-5 py-4 mb-4">
                    <Truck size={36} className="text-green-700 shrink-0" />
                    <div>
                        <p className="text-lg font-bold text-slate-900">{t('Goods are ready for delivery')}</p>
                        <p className="text-base text-slate-600">{t('Waiting for the delivery partner to pick up.')}</p>
                    </div>
                </div>
            )}

            {itemsTable}
            <div className="lg:hidden">{totalsCard}</div>

            <div className="sticky bottom-[76px] lg:static mt-5 flex flex-col lg:flex-row gap-3 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent lg:bg-none pt-2">
                {group.readOnly ? (
                    <button type="button" onClick={markPickedUp} disabled={busy} className={cn(bigGreen, 'w-full lg:flex-1')}>
                        {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} {t('Picked up by delivery partner')}
                    </button>
                ) : (
                    <>
                        {isDesktop && (
                            <button type="button" onClick={saveEdits} disabled={!dirty || busy}
                                className="flex items-center justify-center gap-3 h-16 px-8 rounded-2xl border-2 border-green-200 bg-green-50 text-lg font-bold text-green-800 disabled:opacity-50 whitespace-nowrap lg:px-6">
                                {busy ? <Loader2 className="animate-spin" /> : <Boxes size={24} />} {t('Save Changes')}
                            </button>
                        )}
                        <button type="button" onClick={startCheck} disabled={busy} className={cn(bigGreen, 'w-full lg:flex-1')}>
                            <Truck size={26} /> {t('Goods are ready for delivery')} <ChevronRight size={22} />
                        </button>
                    </>
                )}
            </div>
        </>
    );

    const editMode = group && (
        <>
            <div className="lg:hidden relative text-center mb-4">
                <button type="button" onClick={cancelEdit} className="absolute left-0 top-1 w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Back">
                    <ArrowLeft size={28} />
                </button>
                <button type="button" onClick={cancelEdit} className="absolute right-0 top-1 w-11 h-11 -mr-2 flex items-center justify-center" aria-label="Close">
                    <X size={26} />
                </button>
                <h1 className="text-2xl font-bold text-slate-900 pt-2">{t('Edit List')}</h1>
                <p className="text-base text-slate-500 mt-1 flex items-center justify-center gap-1.5">
                    <Store size={16} /> <span translate="no">{franchiseNameOf(group.franchise)}</span> <span className="mx-1">•</span> {today}
                </p>
            </div>
            <div className="hidden lg:block mb-4">{franchiseHeader}</div>
            <p className="text-sm text-slate-500 mb-3">{t('You can send less than ordered, but not more.')}</p>
            {itemsTable}
            <div className="sticky bottom-[76px] lg:static mt-5 grid grid-cols-2 gap-3 bg-slate-50 lg:bg-transparent pt-2">
                <button type="button" onClick={cancelEdit} disabled={busy}
                    className="flex items-center justify-center gap-2 h-16 rounded-2xl border-2 border-slate-300 bg-white text-lg font-bold text-slate-800">
                    <X size={22} /> {t('Cancel')}
                </button>
                <button type="button" onClick={saveEdits} disabled={busy} className={bigGreen}>
                    {busy ? <Loader2 className="animate-spin" /> : null} {t('Save')}
                </button>
            </div>
        </>
    );

    const checkMode = group && (
        <>
            {backBar(null)}
            {franchiseHeader}
            <div className="flex items-center gap-4 rounded-2xl bg-green-50 px-5 py-4 my-5">
                <Truck size={40} className="text-green-700 shrink-0" />
                <div>
                    <p className="text-xl font-bold text-slate-900">{t('Goods are ready for delivery')}</p>
                    <p className="text-base text-slate-600">{t('Tick what you are sending, then send this order for delivery.')}</p>
                </div>
            </div>

            <div className="divide-y divide-slate-100">
                {group.rows.map((row) => {
                    const q = qtyOf(row);
                    const on = !!checked[row.key] && q > 0;
                    return (
                        <label key={row.key} className={cn('flex items-center gap-4 px-2 py-3', q === 0 && 'opacity-50')}>
                            <input type="checkbox" className="sr-only" checked={on} disabled={q === 0}
                                onChange={() => setChecked((c) => ({ ...c, [row.key]: !c[row.key] }))} />
                            <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center border-2 shrink-0',
                                on ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 bg-white')}>
                                {on && <Check size={20} strokeWidth={3} />}
                            </span>
                            <ItemThumb src={row.item.image} size="lg" />
                            <ItemName name={row.item.name} className="flex-1" />
                            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">{q} {t(unitLabel(row.item.unit))}</span>
                        </label>
                    );
                })}
            </div>
            {group.rows.some((r) => !checked[r.key] && qtyOf(r) > 0) && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mt-3">
                    {t('Unticked items will stay in your list to send later.')}
                </p>
            )}

            <label className="block mt-5">
                <span className="flex items-center gap-2 text-lg text-slate-700 mb-2">
                    <StickyNote size={20} /> {t('Any note (optional)')}
                </span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t('e.g. Packing is complete')}
                    className="w-full h-14 px-4 rounded-2xl border border-slate-200 bg-white text-lg outline-none focus:border-green-600" />
            </label>

            <div className="sticky bottom-[76px] lg:static mt-5 flex flex-col lg:flex-row gap-3 bg-slate-50 lg:bg-transparent pt-2">
                {isDesktop && (
                    <button type="button" onClick={() => setMode('view')} disabled={busy}
                        className="h-16 px-8 rounded-2xl border-2 border-slate-300 bg-white text-lg font-bold text-slate-800">
                        {t('Back')}
                    </button>
                )}
                <button type="button" onClick={sendForDelivery} disabled={busy || !sendRows.length} className={cn(bigGreen, 'w-full lg:flex-1')}>
                    {busy ? <Loader2 className="animate-spin" /> : <Truck size={26} />} {t('Send for delivery')} <ChevronRight size={22} />
                </button>
            </div>
        </>
    );

    const doneMode = sentSummary && (
        <div className="text-center py-12 px-4">
            <div className="w-24 h-24 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={56} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">{t('Sent for delivery')}</h2>
            <p className="text-xl text-slate-700 mt-3" translate="no">{sentSummary.name}</p>
            <p className="text-lg text-slate-500 mt-1">{sentSummary.count} {t('items')} <span className="mx-1.5">•</span> {sentSummary.load}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                <button type="button" onClick={closeGroup} className={cn(bigGreen, 'px-8')}>
                    <ArrowLeft size={22} /> {t('Back to list')}
                </button>
                <button type="button" onClick={() => navigate('/vendor/dispatch-history')}
                    className="flex items-center justify-center gap-2 h-16 px-8 rounded-2xl border-2 border-slate-300 bg-white text-lg font-bold text-slate-800">
                    <History size={22} /> {t('Dispatch History')}
                </button>
            </div>
        </div>
    );

    const detail = mode === 'done' ? doneMode : !group ? null : mode === 'edit' ? editMode : mode === 'check' ? checkMode : viewMode;

    /* ---------- page ---------- */

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader icon={Truck} title={t('Pack & Dispatch')} subtitle={t('Select a franchise, check items, pack and mark ready for delivery.')} />

            {/* Mobile: list first, then one franchise at a time */}
            <div className="lg:hidden">
                {!selectedKey && mode !== 'done' ? (
                    <>
                        <VendorMobileTopBar />
                        <h1 className="text-3xl font-bold text-slate-900">{t('Pack & Dispatch')}</h1>
                        <p className="text-lg text-slate-600 mt-1">{t('Franchises you are preparing goods for today')}</p>
                        <span className="inline-flex items-center gap-2 h-11 px-4 mt-4 mb-3 rounded-full bg-slate-100 text-base text-slate-800">
                            <CalendarDays size={20} /> {today} ({t('Today')})
                        </span>
                        {groups.length > 4 && (
                            <div className="flex items-center gap-3 h-12 px-4 rounded-xl border border-slate-200 bg-white mb-3">
                                <Search size={20} className="text-slate-400" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search franchise...')}
                                    className="flex-1 bg-transparent outline-none text-base" />
                            </div>
                        )}
                        {listPanel}
                    </>
                ) : (
                    detail
                )}
            </div>

            {/* Desktop: list on the left, the selected franchise on the right */}
            <div className="hidden lg:grid grid-cols-[minmax(280px,320px)_minmax(0,1fr)] gap-5 items-start">
                {listPanel}
                <div className="bg-white rounded-3xl border border-slate-100 p-5 min-h-[400px]">
                    {detail || (
                        <div className="h-full flex flex-col items-center justify-center text-center py-24 text-slate-500">
                            <Store size={48} className="text-slate-300 mb-3" />
                            <p className="text-lg">{t('Select a franchise to see its items')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
