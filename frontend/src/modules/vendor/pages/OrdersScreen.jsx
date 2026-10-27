import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ChevronDown, ChevronRight, ClipboardList, Loader2, Package, Search, Store, Truck } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../contexts/VendorAuthContext';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import { keepPage, peekPage } from '../lib/pageCache';
import { franchiseNameOf, loadOf, loadText, rateOf, rupees, sentQty, shortId, unitLabel } from '../lib/packing';
import { DONE, NEEDS_RATES, NEEDS_REPLY, READY, TO_PACK, statusOf } from '../lib/requestStatus';

const TABS = [
    { value: 'open', label: 'Open orders', statuses: [...TO_PACK, ...READY] },
    { value: 'done', label: 'Completed', statuses: DONE },
];
// Old requests from before the rate list, still waiting for the vendor's rate or reply
const OLD_QUOTES = [...NEEDS_RATES, ...NEEDS_REPLY, 'quoted'];

const round = (n) => Math.round(n * 100) / 100;

/** Franchise-wise orders with the same product added up (each order kept for the detail view). */
function consolidate(requests, done) {
    const byFranchise = new Map();
    for (const r of requests) {
        const f = r.franchiseId || {};
        const key = String(f._id || r.franchiseId || r._id);
        if (!byFranchise.has(key)) byFranchise.set(key, { key, franchise: f, requests: [], products: new Map(), latest: 0 });
        const g = byFranchise.get(key);
        g.requests.push(r);
        g.latest = Math.max(g.latest, new Date(r.createdAt).getTime() || 0);
        for (const item of r.items || []) {
            const pk = `${item.productId}|${String(item.unit || '').toLowerCase()}`;
            if (!g.products.has(pk)) g.products.set(pk, { key: pk, name: item.name, unit: item.unit, image: item.image, qty: 0, amount: 0, parts: [] });
            const p = g.products.get(pk);
            const qty = done ? sentQty(item) : Number(item.quantity) || 0;
            p.qty = round(p.qty + qty);
            p.amount = round(p.amount + qty * rateOf(item));
            if (!p.image && item.image) p.image = item.image;
            p.parts.push({ requestId: r._id, qty, rate: rateOf(item), createdAt: r.createdAt, status: r.status, hasOrder: !!r.orderId });
        }
    }
    return [...byFranchise.values()].map((g) => {
        const products = [...g.products.values()].sort((a, b) => b.qty - a.qty);
        const statuses = new Set(g.requests.map((r) => r.status));
        const status = statuses.has('approved') ? 'approved' : statuses.has('preparing') ? 'preparing' : [...statuses][0];
        return {
            ...g,
            products,
            status,
            amount: round(products.reduce((s, p) => s + p.amount, 0)),
            load: loadOf(products, (p) => p.qty),
        };
    }).sort((a, b) => b.latest - a.latest);
}

function Thumb({ src, size = 'w-12 h-12' }) {
    return src
        ? <img src={src} alt="" className={cn(size, 'object-contain shrink-0')} loading="lazy" />
        : <span className={cn(size, 'rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0')}><Package size={18} /></span>;
}

export default function OrdersScreen() {
    const navigate = useNavigate();
    const { newAssignmentData, statusAlertData } = useVendorAuth();
    const { t, locale } = useVendorLanguage();
    const [requests, setRequests] = useState(() => peekPage('assignments') || []);
    const [loading, setLoading] = useState(!peekPage('assignments'));
    const [tab, setTab] = useState('open');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [openProduct, setOpenProduct] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/procurement/vendor/my-assignments');
            setRequests(keepPage('assignments', res.data?.results || []));
        } catch (error) {
            console.error('Failed to fetch vendor assignments', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Refresh on a new order / admin update, when the vendor comes back, and every minute
    useEffect(() => { load(); }, [load, newAssignmentData, statusAlertData]);
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        const timer = setInterval(load, 60000);
        return () => { window.removeEventListener('focus', onFocus); clearInterval(timer); };
    }, [load]);

    const groupsFor = useCallback((value) => {
        const statuses = TABS.find((x) => x.value === value).statuses;
        return consolidate(requests.filter((r) => statuses.includes(r.status)), value === 'done');
    }, [requests]);
    const groups = useMemo(() => groupsFor(tab), [groupsFor, tab]);
    const counts = useMemo(() => Object.fromEntries(TABS.map((x) => [x.value, groupsFor(x.value).length])), [groupsFor]);
    const oldQuotes = useMemo(() => requests.filter((r) => OLD_QUOTES.includes(r.status)), [requests]);

    const q = search.trim().toLowerCase();
    const shown = groups.filter((g) => !q || [franchiseNameOf(g.franchise), ...g.products.map((p) => p.name)].join(' ').toLowerCase().includes(q));
    const group = groups.find((g) => g.key === selected) || null;

    useEffect(() => { setOpenProduct(null); }, [selected, tab]);

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const tabs = (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((x) => (
                <button key={x.value} type="button" onClick={() => { setTab(x.value); setSelected(null); }}
                    className={cn('h-11 px-4 rounded-xl text-base font-semibold whitespace-nowrap border', tab === x.value ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700')}>
                    {t(x.label)} ({counts[x.value]})
                </button>
            ))}
        </div>
    );

    const searchBox = (
        <div className="flex items-center gap-2.5 h-12 px-4 rounded-xl border border-slate-200 bg-white">
            <Search size={20} className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search franchise or item...')} className="flex-1 min-w-0 bg-transparent outline-none text-base" />
        </div>
    );

    // Items still waiting for a rate are agreed on the Quotation page
    const oldQuotesCard = oldQuotes.length > 0 && (
        <button type="button" onClick={() => navigate('/vendor/quotations')}
            className="w-full flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4 text-left">
            <AlertCircle size={24} className="text-amber-600 shrink-0" />
            <span className="flex-1 min-w-0">
                <span className="block text-base font-bold text-amber-800">{t('Orders waiting for rate agreement')} ({oldQuotes.length})</span>
                <span className="block text-sm text-slate-600">{t('Send your rates on the Quotation page.')}</span>
            </span>
            <span className="text-sm font-bold text-amber-800 whitespace-nowrap">{t('Quotation')} →</span>
        </button>
    );

    const empty = (
        <div className="text-center py-14 px-4 rounded-2xl bg-white border border-slate-100">
            <ClipboardList size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">{t('No orders here')}</p>
            {tab === 'open' && <p className="text-base text-slate-500 mt-1">{t('Orders appear here when the admin gives you a franchise order.')}</p>}
        </div>
    );

    const list = !shown.length ? empty : (
        <div className="space-y-3">
            {shown.map((g) => {
                const st = statusOf(g.status);
                const active = g.key === group?.key;
                return (
                    <button key={g.key} type="button" onClick={() => setSelected(g.key)}
                        className={cn('w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-left', active ? 'bg-green-50 border-green-300' : 'bg-white border-slate-100')}>
                        <span className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0"><Store size={26} /></span>
                        <span className="flex-1 min-w-0">
                            <span className="flex items-start justify-between gap-2">
                                <span className="block text-xl font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(g.franchise)}</span>
                                <span className={cn('px-3 py-1 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>{t(st.label)}</span>
                            </span>
                            <span className="block text-base text-slate-600 mt-0.5">{g.products.length} {t('items')} <span className="mx-1">•</span> {loadText(g.load, t)}</span>
                            <span className="flex items-center justify-between gap-2 mt-1">
                                <span className="text-sm text-slate-500">{g.requests.length} {t(g.requests.length === 1 ? 'Order' : 'orders')}</span>
                                {g.amount > 0 && <span className="text-lg font-bold text-slate-900">{rupees(g.amount)}</span>}
                            </span>
                        </span>
                        <ChevronRight size={22} className="text-slate-500 shrink-0" />
                    </button>
                );
            })}
        </div>
    );

    const detail = group && (
        <div>
            <div className="lg:hidden flex items-center gap-3 mb-4">
                <button type="button" onClick={() => setSelected(null)} className="w-11 h-11 -ml-2 flex items-center justify-center text-slate-900" aria-label="Back">
                    <ArrowLeft size={28} />
                </button>
                <h1 className="flex-1 text-center text-2xl font-bold text-slate-900 pr-9">{t('Order Details')}</h1>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-green-50 p-4 lg:p-5">
                <span className="w-16 h-16 rounded-full bg-white/70 text-green-700 flex items-center justify-center shrink-0"><Store size={30} /></span>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(group.franchise)}</h2>
                    <p className="text-base text-slate-600">{group.products.length} {t('items')} <span className="mx-1">•</span> {t('Total')} {loadText(group.load, t)}</p>
                    {[group.franchise?.area, group.franchise?.city].filter(Boolean).length > 0 && (
                        <p className="text-sm text-slate-500 truncate">{[group.franchise?.area, group.franchise?.city].filter(Boolean).join(', ')}</p>
                    )}
                </div>
            </div>

            <p className="text-sm text-slate-500 mt-4 mb-2">{t('Same items from all orders are added up. Tap an item to see each order.')}</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 items-center px-3 h-11 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
                <span>{t('Item')}</span><span className="text-right">{t('Total quantity')}</span><span className="text-right w-24">{t('Amount')}</span>
            </div>
            <div className="divide-y divide-slate-100">
                {group.products.map((p) => {
                    const isOpen = openProduct === p.key;
                    return (
                        <div key={p.key}>
                            <button type="button" onClick={() => setOpenProduct(isOpen ? null : p.key)}
                                className="w-full grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 items-center px-3 py-3 text-left">
                                <span className="flex items-center gap-3 min-w-0">
                                    <Thumb src={p.image} />
                                    <span className="min-w-0">
                                        <span className="block text-lg font-semibold text-slate-900 break-words">{t(p.name)}</span>
                                        <span className="flex items-center gap-1 text-sm text-green-700 font-medium">
                                            {p.parts.length} {t(p.parts.length === 1 ? 'Order' : 'orders')} <ChevronDown size={16} className={cn('transition-transform', isOpen && 'rotate-180')} />
                                        </span>
                                    </span>
                                </span>
                                <span className="text-lg font-bold text-slate-900 whitespace-nowrap text-right">{p.qty} {t(unitLabel(p.unit))}</span>
                                <span className="w-24 text-right">
                                    <span className="block text-base font-semibold text-slate-900">{p.amount > 0 ? rupees(p.amount) : '—'}</span>
                                    {p.qty > 0 && p.amount > 0 && <span className="block text-xs text-slate-500">@ {rupees(p.amount / p.qty)}</span>}
                                </span>
                            </button>
                            {isOpen && (
                                <div className="mx-3 mb-3 rounded-xl bg-slate-50 divide-y divide-slate-200/70">
                                    {p.parts.map((part, k) => (
                                        <div key={`${part.requestId}-${k}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                            <span className="min-w-0">
                                                <span className="block text-base font-semibold text-slate-800">
                                                    {t('Order')} {k + 1} <span className="text-slate-500 font-normal" translate="no">{shortId(part.requestId)}</span>
                                                </span>
                                                <span className="block text-sm text-slate-500">{formatDay(new Date(part.createdAt), locale)}, {formatTime(new Date(part.createdAt), locale)}</span>
                                            </span>
                                            <span className="text-base font-bold text-slate-900 whitespace-nowrap">{part.qty} {t(unitLabel(p.unit))}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center rounded-2xl bg-green-50 px-5 py-4 mt-3">
                <div className="flex-1 border-r border-green-200">
                    <p className="text-sm text-slate-600">{t('Total quantity')}</p>
                    <p className="text-xl font-bold text-green-800">{loadText(group.load, t)}</p>
                </div>
                <div className="flex-1 pl-5">
                    <p className="text-sm text-slate-600">{t('Total Value')}</p>
                    <p className="text-xl font-bold text-green-800">{rupees(group.amount)}</p>
                </div>
            </div>

            {tab === 'open' && (
                <button type="button" onClick={() => navigate(`/vendor/dispatch?order=${group.requests[0]._id}`)}
                    className="mt-4 w-full flex items-center justify-center gap-3 h-16 rounded-2xl bg-green-700 text-white text-lg font-bold">
                    <Truck size={26} /> {t('Pack & Dispatch')} <ChevronRight size={22} />
                </button>
            )}
        </div>
    );

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader icon={ClipboardList} title={t('Manage Orders')} subtitle={t('Franchise orders with the same items added up.')} />

            {/* Mobile: list first, then one franchise */}
            <div className="lg:hidden">
                {group ? detail : (
                    <>
                        <VendorMobileTopBar />
                        <h1 className="text-3xl font-bold text-slate-900">{t('Orders')}</h1>
                        <p className="text-lg text-slate-600 mt-1 mb-4">{t('Franchise-wise total of all orders')}</p>
                        {oldQuotesCard}
                        <div className="mb-3">{tabs}</div>
                        <div className="mb-3">{searchBox}</div>
                        {list}
                    </>
                )}
            </div>

            {/* Desktop: franchises on the left, the selected one on the right */}
            <div className="hidden lg:block">
                {oldQuotesCard}
                <div className="flex items-center justify-between gap-4 mb-4">
                    {tabs}
                    <div className="w-[380px]">{searchBox}</div>
                </div>
                <div className="grid grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-5 items-start">
                    <div>{list}</div>
                    <div className="bg-white rounded-3xl border border-slate-100 p-5 min-h-[400px]">
                        {detail || (
                            <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                                <Store size={48} className="text-slate-300 mb-3" />
                                <p className="text-lg">{t('Select a franchise to see its items')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
