import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Loader2, Package, Search, TrendingDown, TrendingUp } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import { keepPage, peekPage } from '../lib/pageCache';
import { franchiseNameOf, loadOf, loadText, rupees, shortId } from '../lib/packing';
import { statusOf } from '../lib/requestStatus';
import { pageForRequest } from '../lib/requestStatus';

const QUOTED = ['quoted', 'negotiating', 'approved', 'preparing', 'ready_for_pickup', 'picked_up', 'completed', 'rejected'];
const TABS = [
    { value: 'all', label: 'All', statuses: QUOTED },
    { value: 'sent', label: 'Quote sent', statuses: ['quoted', 'negotiating'] },
    { value: 'approved', label: 'Approved', statuses: ['approved', 'preparing', 'ready_for_pickup', 'picked_up', 'completed'] },
    { value: 'rejected', label: 'Rejected', statuses: ['rejected'] },
];

// Your quote vs. the price the admin finally agreed
// (older requests have no saved totals: work them out from the item rates)
const sumOf = (r, rate) => (r.items || []).reduce((s, i) => s + (Number(rate(i)) || 0) * (Number(i.quantity) || 0), 0);
const yourQuote = (r) => Number(r.vendorQuoteTotal) || sumOf(r, (i) => i.originalQuotedPrice || i.quotedPrice) || Number(r.totalQuotedAmount) || 0;
const finalPrice = (r) => (["quoted", "negotiating", "rejected"].includes(r.status) ? 0 : Number(r.totalQuotedAmount) || sumOf(r, (i) => i.quotedPrice));

function Thumb({ src }) {
    return src
        ? <img src={src} alt="" className="w-9 h-9 object-contain" loading="lazy" />
        : <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center"><Package size={16} /></span>;
}

function Change({ r }) {
    const { t } = useVendorLanguage();
    const diff = Math.round(finalPrice(r) - yourQuote(r));
    if (!diff || !finalPrice(r)) return null;
    const down = diff < 0;
    return (
        <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', down ? 'text-red-600' : 'text-amber-600')}>
            {down ? <TrendingDown size={16} /> : <TrendingUp size={16} />} {rupees(Math.abs(diff))} {t(down ? 'reduced' : 'raised')}
        </span>
    );
}

export default function QuotationHistoryScreen() {
    const navigate = useNavigate();
    const { t, locale } = useVendorLanguage();
    const [requests, setRequests] = useState(() => peekPage('assignments') || []);
    const [loading, setLoading] = useState(!peekPage('assignments'));
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');

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
    useEffect(() => { load(); }, [load]);

    const q = search.trim().toLowerCase().replace(/^#/, '');
    const inTab = (v) => requests.filter((r) => TABS.find((x) => x.value === v).statuses.includes(r.status));
    const shown = useMemo(() => inTab(tab)
        .filter((r) => !q || [franchiseNameOf(r.franchiseId), shortId(r._id), ...(r.items || []).map((i) => i.name)].join(' ').toLowerCase().includes(q))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
    [requests, tab, q]); // eslint-disable-line react-hooks/exhaustive-deps

    const totals = useMemo(() => {
        const all = inTab('all');
        return {
            sent: inTab('sent').length,
            approved: inTab('approved').length,
            value: inTab('approved').reduce((s, r) => s + finalPrice(r), 0),
            count: all.length,
        };
    }, [requests]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const open = (r) => navigate(pageForRequest(r));

    const kpis = [
        { label: 'Total quotations', value: totals.count, tone: 'bg-blue-50' },
        { label: 'Waiting for admin', value: totals.sent, tone: 'bg-amber-50' },
        { label: 'Approved', value: totals.approved, tone: 'bg-green-50' },
        { label: 'Approved value', value: rupees(totals.value), tone: 'bg-violet-50' },
    ];

    const tabs = (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((x) => (
                <button key={x.value} type="button" onClick={() => setTab(x.value)}
                    className={cn('h-11 px-4 rounded-xl text-base font-semibold whitespace-nowrap border', tab === x.value ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700')}>
                    {t(x.label)} ({inTab(x.value).length})
                </button>
            ))}
        </div>
    );

    const searchBox = (
        <div className="flex items-center gap-2.5 h-12 px-4 rounded-xl border border-slate-200 bg-white">
            <Search size={20} className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search franchise, item or order ID...')} className="flex-1 min-w-0 bg-transparent outline-none text-base" />
        </div>
    );

    const empty = (
        <div className="text-center py-14 px-4 rounded-2xl bg-white border border-slate-100">
            <FileText size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">{t('No quotations here')}</p>
        </div>
    );

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader icon={FileText} title={t('My Quotations')} subtitle={t('Rates you sent and the final price the admin agreed.')} />

            <div className="lg:hidden">
                <VendorMobileTopBar />
                <h1 className="text-3xl font-bold text-slate-900">{t('My Quotations')}</h1>
                <p className="text-lg text-slate-600 mt-1 mb-4">{t('Rates you sent and the final price')}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4">
                {kpis.map((k) => (
                    <div key={k.label} className={cn('rounded-2xl p-4 lg:bg-white lg:border lg:border-slate-100', k.tone)}>
                        <p className="text-sm lg:text-base text-slate-600">{t(k.label)}</p>
                        <p className="text-2xl lg:text-3xl font-bold text-slate-900 mt-1">{k.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                {tabs}
                <div className="lg:w-[380px]">{searchBox}</div>
            </div>

            {!shown.length ? empty : (
                <>
                    {/* Mobile cards */}
                    <div className="lg:hidden space-y-3">
                        {shown.map((r) => {
                            const st = statusOf(r.status);
                            return (
                                <button key={r._id} type="button" onClick={() => open(r)} className="w-full flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-left">
                                    <span className="flex-1 min-w-0">
                                        <span className="flex items-start justify-between gap-2">
                                            <span className="min-w-0">
                                                <span className="block text-lg font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(r.franchiseId)}</span>
                                                <span className="block text-sm text-slate-500"><span translate="no">{shortId(r._id)}</span> • {formatDay(new Date(r.updatedAt || r.createdAt), locale)}</span>
                                            </span>
                                            <span className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>{t(st.label)}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5 mt-2">
                                            {(r.items || []).slice(0, 3).map((i, k) => <Thumb key={k} src={i.image} />)}
                                            <span className="text-sm text-slate-500 ml-1">{(r.items || []).length} {t('items')} • {loadText(loadOf(r.items || [], (i) => i.quantity), t)}</span>
                                        </span>
                                        <span className="grid grid-cols-2 gap-2 mt-3 rounded-xl bg-slate-50 px-3 py-2">
                                            <span>
                                                <span className="block text-xs text-slate-500">{t('Your quote')}</span>
                                                <span className="block text-lg font-bold text-slate-900">{rupees(yourQuote(r))}</span>
                                            </span>
                                            <span>
                                                <span className="block text-xs text-slate-500">{t('Final price')}</span>
                                                <span className="block text-lg font-bold text-slate-900">{finalPrice(r) ? rupees(finalPrice(r)) : '—'}</span>
                                                <Change r={r} />
                                            </span>
                                        </span>
                                    </span>
                                    <ChevronRight size={22} className="text-slate-500 shrink-0" />
                                </button>
                            );
                        })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block rounded-3xl bg-white border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px]">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
                                        {['#', 'Date', 'Order ID', 'Franchise', 'Items (Qty)', 'Your quote', 'Final price', 'Status', 'Action'].map((h) => (
                                            <th key={h} className="px-3 py-4 first:pl-5 last:pr-5">{h === '#' ? h : t(h)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {shown.map((r, k) => {
                                        const st = statusOf(r.status);
                                        const when = new Date(r.updatedAt || r.createdAt);
                                        return (
                                            <tr key={r._id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => open(r)}>
                                                <td className="pl-5 pr-3 py-4 text-base text-slate-700">{k + 1}</td>
                                                <td className="px-3 py-4">
                                                    <p className="text-base font-semibold text-slate-900 whitespace-nowrap">{formatDay(when, locale)}</p>
                                                    <p className="text-sm text-slate-500">{formatTime(when, locale)}</p>
                                                </td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900" translate="no">{shortId(r._id)}</td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900" translate="no">{franchiseNameOf(r.franchiseId)}</td>
                                                <td className="px-3 py-4">
                                                    <span className="flex items-center gap-1.5">
                                                        {(r.items || []).slice(0, 3).map((i, n) => <Thumb key={n} src={i.image} />)}
                                                        <span className="text-sm text-slate-500 ml-1">{loadText(loadOf(r.items || [], (i) => i.quantity), t)}</span>
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900 whitespace-nowrap">{rupees(yourQuote(r))}</td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <p className="text-base font-semibold text-slate-900">{finalPrice(r) ? rupees(finalPrice(r)) : '—'}</p>
                                                    <Change r={r} />
                                                </td>
                                                <td className="px-3 py-4"><span className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>{t(st.label)}</span></td>
                                                <td className="pl-3 pr-5 py-4">
                                                    <span className={cn('inline-flex items-center h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap', r.status === 'negotiating' ? 'bg-green-700 text-white' : 'border border-slate-200 text-slate-800')}>
                                                        {t(r.status === 'negotiating' ? 'Reply' : 'View')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
