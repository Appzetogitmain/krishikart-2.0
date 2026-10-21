import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, Loader2, Package, Search } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../contexts/VendorAuthContext';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import { keepPage, peekPage } from '../lib/pageCache';
import { franchiseNameOf, loadOf, loadText, rupees, shortId } from '../lib/packing';
import { DONE, NEEDS_RATES, NEEDS_REPLY, READY, TO_PACK, statusOf } from '../lib/requestStatus';

const TABS = [
    { value: 'new', label: 'New', statuses: [...NEEDS_RATES, ...NEEDS_REPLY, 'quoted'] },
    { value: 'pack', label: 'Packing', statuses: TO_PACK },
    { value: 'ready', label: 'Ready', statuses: READY },
    { value: 'done', label: 'Completed', statuses: DONE },
];

// Amount to show: the agreed/quoted total once there is one, else the estimate
const amountOf = (r) => Number(r.totalQuotedAmount) || Number(r.vendorQuoteTotal)
    || (r.items || []).reduce((s, i) => s + (Number(i.quotedPrice) || 0) * (Number(i.quantity) || 0), 0)
    || Number(r.totalEstimatedAmount) || 0;

function Thumb({ src }) {
    return src
        ? <img src={src} alt="" className="w-9 h-9 object-contain" loading="lazy" />
        : <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center"><Package size={16} /></span>;
}

export default function OrdersScreen() {
    const navigate = useNavigate();
    const { newAssignmentData, statusAlertData } = useVendorAuth();
    const { t, locale } = useVendorLanguage();
    const [requests, setRequests] = useState(() => peekPage('assignments') || []);
    const [loading, setLoading] = useState(!peekPage('assignments'));
    const [tab, setTab] = useState('new');
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

    // Refresh on a new request / admin update, when the vendor comes back, and every minute
    useEffect(() => { load(); }, [load, newAssignmentData, statusAlertData]);
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        const timer = setInterval(load, 60000);
        return () => { window.removeEventListener('focus', onFocus); clearInterval(timer); };
    }, [load]);

    const q = search.trim().toLowerCase().replace(/^#/, '');
    const inTab = (v) => requests.filter((r) => TABS.find((x) => x.value === v).statuses.includes(r.status));
    const shown = useMemo(() => inTab(tab)
        .filter((r) => !q || [franchiseNameOf(r.franchiseId), shortId(r._id), String(r._id), ...(r.items || []).map((i) => i.name)].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (NEEDS_REPLY.includes(b.status) - NEEDS_REPLY.includes(a.status)) || new Date(b.createdAt) - new Date(a.createdAt)),
    [requests, tab, q]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const open = (r) => navigate(`/vendor/orders/${r._id}`);

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
            <ClipboardList size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">{t('No orders here')}</p>
        </div>
    );

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader icon={ClipboardList} title={t('Manage Orders')} subtitle={t('Requests from franchises. Enter your rates, then pack when the admin approves.')} />

            {/* Mobile */}
            <div className="lg:hidden">
                <VendorMobileTopBar />
                <h1 className="text-3xl font-bold text-slate-900">{t('Orders')}</h1>
                <p className="text-lg text-slate-600 mt-1 mb-4">{t('Requests from franchises')}</p>
                <div className="mb-3">{tabs}</div>
                <div className="mb-3">{searchBox}</div>
                {!shown.length ? empty : (
                    <div className="space-y-3">
                        {shown.map((r) => {
                            const st = statusOf(r.status);
                            return (
                                <button key={r._id} type="button" onClick={() => open(r)} className="w-full flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-left">
                                    <span className="flex-1 min-w-0">
                                        <span className="flex items-start justify-between gap-2">
                                            <span className="min-w-0">
                                                <span className="block text-lg font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(r.franchiseId)}</span>
                                                <span className="block text-sm text-slate-500"><span translate="no">{shortId(r._id)}</span> • {formatTime(new Date(r.createdAt), locale)}</span>
                                            </span>
                                            <span className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>{t(st.label)}</span>
                                        </span>
                                        <span className="flex items-end justify-between gap-2 mt-2">
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                {(r.items || []).slice(0, 3).map((i, k) => <Thumb key={k} src={i.image} />)}
                                                {(r.items || []).length > 3 && <span className="h-8 min-w-8 px-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 flex items-center justify-center">+{r.items.length - 3}</span>}
                                            </span>
                                            <span className="text-right shrink-0">
                                                <span className="block text-base text-slate-700">{loadText(loadOf(r.items || [], (i) => i.quantity), t)}</span>
                                                {amountOf(r) > 0 && <span className="block text-lg font-bold text-slate-900">{rupees(amountOf(r))}</span>}
                                            </span>
                                        </span>
                                        {st.next && <span className="block mt-2 text-sm font-semibold text-green-700">{t(st.next)} →</span>}
                                    </span>
                                    <ChevronRight size={22} className="text-slate-500 shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block">
                <div className="flex items-center justify-between gap-4 mb-4">
                    {tabs}
                    <div className="w-[380px]">{searchBox}</div>
                </div>
                <div className="rounded-3xl bg-white border border-slate-100 overflow-hidden">
                    {!shown.length ? empty : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px]">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-sm font-semibold uppercase tracking-wide text-slate-500">
                                        {['#', 'Date & Time', 'Order ID', 'Franchise', 'Items (Qty)', 'Total Qty', 'Amount', 'Status', 'Action'].map((h) => (
                                            <th key={h} className="px-3 py-4 first:pl-5 last:pr-5">{h === '#' ? h : t(h)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {shown.map((r, k) => {
                                        const st = statusOf(r.status);
                                        const when = new Date(r.createdAt);
                                        return (
                                            <tr key={r._id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => open(r)}>
                                                <td className="pl-5 pr-3 py-4 text-base text-slate-700">{k + 1}</td>
                                                <td className="px-3 py-4">
                                                    <p className="text-base font-semibold text-slate-900 whitespace-nowrap">{formatDay(when, locale)}</p>
                                                    <p className="text-sm text-slate-500">{formatTime(when, locale)}</p>
                                                </td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900" translate="no">{shortId(r._id)}</td>
                                                <td className="px-3 py-4">
                                                    <p className="text-base font-semibold text-slate-900" translate="no">{franchiseNameOf(r.franchiseId)}</p>
                                                    <p className="text-sm text-slate-500">{r.franchiseId?.city || ''}</p>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <span className="flex items-center gap-1.5">
                                                        {(r.items || []).slice(0, 3).map((i, n) => <Thumb key={n} src={i.image} />)}
                                                        {(r.items || []).length > 3 && <span className="h-8 min-w-8 px-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 flex items-center justify-center">+{r.items.length - 3}</span>}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-base text-slate-900">{loadText(loadOf(r.items || [], (i) => i.quantity), t)}</td>
                                                <td className="px-3 py-4 text-base font-semibold text-slate-900 whitespace-nowrap">{amountOf(r) > 0 ? rupees(amountOf(r)) : '—'}</td>
                                                <td className="px-3 py-4"><span className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>{t(st.label)}</span></td>
                                                <td className="pl-3 pr-5 py-4">
                                                    <span className={cn('inline-flex items-center h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap', st.next ? 'bg-green-700 text-white' : 'border border-slate-200 text-slate-800')}>
                                                        {t(NEEDS_RATES.includes(r.status) ? 'Enter rates' : NEEDS_REPLY.includes(r.status) ? 'Reply' : 'View')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
