import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    ClipboardList,
    FileText,
    History,
    IndianRupee,
    LayoutDashboard,
    Loader2,
    Package,
    PackageCheck,
    Tags,
    Truck,
    Undo2,
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../contexts/VendorAuthContext';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { useVendorInventory } from '../contexts/VendorInventoryContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import { keepPage, peekPage } from '../lib/pageCache';
import { franchiseNameOf, loadOf, loadText, rupees, shortId } from '../lib/packing';
import { DONE, NEEDS_RATES, NEEDS_REPLY, READY, TO_PACK, statusOf } from '../lib/requestStatus';

function Thumb({ src }) {
    return src
        ? <img src={src} alt="" className="w-9 h-9 object-contain" loading="lazy" />
        : <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center"><Package size={16} /></span>;
}

export default function DashboardScreen() {
    const navigate = useNavigate();
    const { vendor, newAssignmentData, statusAlertData } = useVendorAuth();
    const { t, locale } = useVendorLanguage();
    const { inventory } = useVendorInventory();
    const [requests, setRequests] = useState(() => peekPage('assignments') || []);
    const [stats, setStats] = useState(() => peekPage('dashboard')?.stats || null);
    const [returns, setReturns] = useState(() => peekPage('returns') || []);
    const [loading, setLoading] = useState(!peekPage('assignments'));

    const load = useCallback(async () => {
        const [reqs, st, rets] = await Promise.allSettled([
            api.get('/procurement/vendor/my-assignments'),
            api.get('/procurement/vendor/dashboard-stats'),
            api.get('/stock-returns/vendor'),
        ]);
        if (reqs.status === 'fulfilled') setRequests(keepPage('assignments', reqs.value.data?.results || []));
        if (st.status === 'fulfilled') {
            const s = st.value.data?.result || st.value.data?.results || null;
            setStats(s);
            keepPage('dashboard', { ...peekPage('dashboard'), stats: s });
        }
        if (rets.status === 'fulfilled') setReturns(keepPage('returns', rets.value.data?.results || []));
        setLoading(false);
    }, []);

    // Refresh on a new request / admin update, and when the vendor comes back to the app
    useEffect(() => { load(); }, [load, newAssignmentData, statusAlertData]);
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [load]);

    const count = useMemo(() => {
        const n = (list) => requests.filter((r) => list.includes(r.status)).length;
        return {
            rates: n(NEEDS_RATES),
            reply: n(NEEDS_REPLY),
            pack: n(TO_PACK),
            ready: n(READY),
            done: n(DONE),
            returns: returns.filter((r) => r.status === 'sent').length,
            // Franchises with goods to pack, and the total weight to pack
            franchises: new Set(requests.filter((r) => TO_PACK.includes(r.status)).map((r) => String(r.franchiseId?._id || r.franchiseId))).size,
            load: loadOf(requests.filter((r) => TO_PACK.includes(r.status)).flatMap((r) => r.items || []), (i) => i.quantity),
        };
    }, [requests, returns]);

    const noRate = inventory.filter((i) => !(Number(i.rate) > 0)).length;
    const recent = useMemo(() => [...requests].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 6), [requests]);
    const firstName = String(vendor?.fullName || '').trim().split(/\s+/)[0] || '';

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const tiles = [
        { label: "Today's Orders", sub: 'franchises', value: count.franchises, icon: ClipboardList, tone: 'bg-blue-50', iconTone: 'bg-blue-100 text-blue-700', go: '/vendor/orders' },
        { label: 'To pack', sub: 'Pack & Dispatch', value: loadText(count.load, t), icon: Package, tone: 'bg-amber-50', iconTone: 'bg-amber-100 text-amber-600', go: '/vendor/dispatch' },
        { label: 'Ready for pickup', sub: 'Waiting for delivery', value: count.ready, icon: PackageCheck, tone: 'bg-green-50', iconTone: 'bg-green-100 text-green-700', go: '/vendor/dispatch' },
        { label: 'Payment pending', sub: 'To be paid to you', value: rupees(stats?.pendingSettlement), icon: IndianRupee, tone: 'bg-violet-50', iconTone: 'bg-violet-100 text-violet-700', go: '/vendor/reports' },
    ];

    const actions = [
        { label: 'New orders', hint: 'Franchise-wise total of all orders', icon: ClipboardList, go: '/vendor/orders', badge: count.franchises },
        { label: 'Pack & Dispatch', hint: "Pack today's goods and send for delivery", icon: Truck, go: '/vendor/dispatch', badge: count.pack },
        { label: 'My Rates', hint: noRate ? `${noRate} products have no rate` : 'Set your own rates', icon: Tags, go: '/vendor/inventory', badge: noRate },
        { label: 'Returns', hint: 'Check goods franchises sent back', icon: Undo2, go: '/vendor/returns', badge: count.returns },
        { label: 'Dispatch History', hint: 'Orders you have dispatched', icon: History, go: '/vendor/dispatch-history', badge: 0 },
        ...(count.rates + count.reply ? [{ label: 'Old requests waiting for your rate', hint: 'Enter rates for new requests', icon: FileText, go: '/vendor/orders', badge: count.rates + count.reply }] : []),
    ];

    const recentList = (
        <div className="space-y-3">
            {!recent.length && <p className="text-base text-slate-500 text-center py-8">{t('No orders yet')}</p>}
            {recent.map((r) => {
                const st = statusOf(r.status);
                return (
                    <button key={r._id} type="button" onClick={() => navigate(`/vendor/orders/${r._id}`)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left">
                        <span className="flex-1 min-w-0">
                            <span className="flex items-start justify-between gap-2">
                                <span className="min-w-0">
                                    <span className="block text-lg font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(r.franchiseId)}</span>
                                    <span className="block text-sm text-slate-500"><span translate="no">{shortId(r._id)}</span> • {formatDay(new Date(r.createdAt), locale)}, {formatTime(new Date(r.createdAt), locale)}</span>
                                </span>
                                <span className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>{t(st.label)}</span>
                            </span>
                            <span className="flex items-center gap-1.5 mt-2">
                                {(r.items || []).slice(0, 3).map((i, k) => <Thumb key={k} src={i.image} />)}
                                <span className="text-sm text-slate-500 ml-1">{(r.items || []).length} {t('items')} • {loadText(loadOf(r.items || [], (i) => i.quantity), t)}</span>
                            </span>
                        </span>
                        <ChevronRight size={22} className="text-slate-500 shrink-0" />
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader icon={LayoutDashboard} title={`${t('Namaste')}${firstName ? `, ${firstName}` : ''}`} subtitle={t("Here is today's work.")} />

            <div className="lg:hidden">
                <VendorMobileTopBar />
                <h1 className="text-3xl font-bold text-slate-900">{t('Namaste')}{firstName ? <span translate="no">, {firstName}</span> : ''}</h1>
                <p className="text-lg text-slate-600 mt-1 mb-4">{t("Here is today's work.")}</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {tiles.map((k) => (
                    <button key={k.label} type="button" onClick={() => navigate(k.go)}
                        className={cn('rounded-2xl p-4 lg:p-5 flex items-start gap-3 text-left lg:bg-white lg:border lg:border-slate-100', k.tone)}>
                        <span className={cn('w-11 h-11 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center shrink-0', k.iconTone)}><k.icon size={24} /></span>
                        <span className="min-w-0">
                            <span className="block text-sm lg:text-base text-slate-600 leading-tight">{t(k.label)}</span>
                            <span className="block text-2xl lg:text-3xl font-bold text-slate-900 mt-1 break-words">{k.value}</span>
                            <span className="block text-xs lg:text-sm text-slate-500 mt-0.5">{t(k.sub)}</span>
                        </span>
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 mt-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">{t("Today's work")}</h2>
                    <div className="space-y-3">
                        {actions.map((a) => (
                            <button key={a.label} type="button" onClick={() => navigate(a.go)}
                                className="w-full flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left active:scale-[0.99] transition-transform">
                                <span className="w-14 h-14 rounded-full bg-green-50 text-green-700 flex items-center justify-center shrink-0"><a.icon size={26} /></span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-lg font-bold text-slate-900">{t(a.label)}</span>
                                    <span className="block text-sm text-slate-500">{t(a.hint)}</span>
                                </span>
                                {a.badge > 0 && <span className="min-w-8 h-8 px-2 rounded-full bg-green-700 text-white text-base font-bold flex items-center justify-center">{a.badge}</span>}
                                <ChevronRight size={22} className="text-slate-500 shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-bold text-slate-900">{t('Recent orders')}</h2>
                        <button type="button" onClick={() => navigate('/vendor/orders')} className="text-base font-semibold text-green-700">{t('View All')}</button>
                    </div>
                    {recentList}
                </div>
            </div>
        </div>
    );
}
