import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calculator, CheckCircle2, Clock, FileText, Info, Loader2, MessageSquare, Package, Send } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useVendorAuth } from '../contexts/VendorAuthContext';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import { keepPage, peekPage } from '../lib/pageCache';
import { rupees, unitLabel } from '../lib/packing';

/*
 * Today's quotation list: everything the admin gave this vendor, added up product-wise across franchises.
 * The vendor writes the total amount for each item (the per-KG rate is worked out), the admin accepts or
 * offers another amount, and both reply on this one page. Agreed items leave the list and go to packing.
 */

const STATUS = {
    open: { label: 'Not sent', cls: 'bg-slate-100 text-slate-600', icon: Clock },
    sent: { label: 'Pending', cls: 'bg-amber-50 text-amber-700', icon: Clock },
    countered: { label: 'Admin offer', cls: 'bg-orange-50 text-orange-700', icon: Clock },
    final: { label: 'Accepted', cls: 'bg-green-50 text-green-700', icon: CheckCircle2 },
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const totalOf = (rate, qty) => Math.round((Number(rate) || 0) * (Number(qty) || 0));

function Thumb({ src, className = 'w-12 h-12' }) {
    return src
        ? <img src={src} alt="" className={cn(className, 'object-contain shrink-0')} loading="lazy" />
        : <span className={cn(className, 'rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0')}><Package size={18} /></span>;
}

/** Ring showing how many items are agreed. */
function Progress({ done, total, t }) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const part = total ? done / total : 0;
    return (
        <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={r} fill="none" stroke="#fb923c" strokeWidth="12" />
                <circle cx="60" cy="60" r={r} fill="none" stroke="#16a34a" strokeWidth="12" strokeDasharray={`${part * c} ${c}`} strokeLinecap={part > 0 && part < 1 ? 'round' : 'butt'} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-slate-900">{done}/{total}</span>
                <span className="text-xs text-slate-600 leading-tight px-2">{t('Items Finalized')}</span>
            </div>
        </div>
    );
}

export default function RateSheetScreen() {
    const navigate = useNavigate();
    const { newAssignmentData, statusAlertData } = useVendorAuth();
    const { t, locale } = useVendorLanguage();
    const [sheet, setSheet] = useState(() => peekPage('ratesheet') || null);
    const [loading, setLoading] = useState(!peekPage('ratesheet'));
    const [tab, setTab] = useState('open');
    const [draft, setDraft] = useState({}); // key -> total amount typed
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(null); // 'all' | row key | 'msg'

    const apply = useCallback((s) => { setSheet(keepPage('ratesheet', s)); }, []);
    const load = useCallback(async () => {
        try {
            const res = await api.get('/procurement/vendor/rate-sheet');
            apply(res.data?.result || null);
        } catch (error) {
            if (error.response?.status !== 401) toast.error(error.response?.data?.message || t('Could not load'));
        } finally {
            setLoading(false);
        }
    }, [apply, t]);

    // Refresh when the admin replies, when the vendor comes back, and every 30 seconds
    useEffect(() => { load(); }, [load, newAssignmentData, statusAlertData]);
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        const timer = setInterval(load, 30000);
        return () => { window.removeEventListener('focus', onFocus); clearInterval(timer); };
    }, [load]);

    const items = useMemo(() => sheet?.items || [], [sheet]);
    const final = sheet?.final || [];
    const s = sheet?.summary || {};

    // The amount shown in a row's box: what the vendor typed, else their last rate, else their rate list
    const suggested = (row) => totalOf(row.vendorRate || row.listRate, row.qty);
    const valueOf = (row) => (draft[row.key] !== undefined ? draft[row.key] : suggested(row) ? String(suggested(row)) : '');
    const rateFrom = (row) => round2((Number(valueOf(row)) || 0) / (row.qty || 1));
    // Rows that would be sent: never sent yet, or the amount was changed
    const toSend = items.filter((row) => Number(valueOf(row)) > 0 && (row.status === 'open' || rateFrom(row) !== round2(row.vendorRate)));

    const send = async (rows, key) => {
        if (!rows.length && !message.trim()) {
            toast.error(t('Enter a rate for at least one item'));
            return;
        }
        setBusy(key);
        try {
            const res = await api.post('/procurement/vendor/rate-sheet/send', {
                rates: rows.map((row) => ({ productId: row.productId, unit: row.unit, rate: rateFrom(row) })),
                message: key === 'all' ? message : undefined,
            });
            apply(res.data?.result?.sheet || null);
            setDraft((d) => { const n = { ...d }; rows.forEach((row) => delete n[row.key]); return n; });
            if (key === 'all') setMessage('');
            toast.success(t(res.data?.message || 'Rates sent to admin'));
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not send. Please try again.'));
        } finally {
            setBusy(null);
        }
    };

    const accept = async (row) => {
        setBusy(row.key);
        try {
            const res = await api.post('/procurement/vendor/rate-sheet/accept', { productId: row.productId, unit: row.unit });
            apply(res.data?.result?.sheet || null);
            toast.success(t('Rate agreed — item moved to packing'));
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not update. Please try again.'));
        } finally {
            setBusy(null);
        }
    };

    const sendMessage = async () => {
        const text = message.trim();
        if (!text) return;
        setBusy('msg');
        try {
            await api.post('/procurement/vendor/rate-sheet/message', { text });
            setMessage('');
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not send. Please try again.'));
        } finally {
            setBusy(null);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const today = formatDay(new Date(), locale);
    const total = items.length + final.length;
    const nothingSent = items.length > 0 && items.every((row) => row.status === 'open');
    const sendLabel = nothingSent ? `${t('Send All Rates')} (${toSend.length})` : `${t('Send Updated Quotation')}${toSend.length ? ` (${toSend.length})` : ''}`;

    const callout = (() => {
        if (!items.length && final.length) return { cls: 'bg-green-50', icon: CheckCircle2, iconCls: 'text-green-700', title: 'All rates agreed', text: 'Agreed items are in Pack & Dispatch.' };
        if (s.waitingVendor) return { cls: 'bg-orange-50', icon: Info, iconCls: 'text-orange-600', title: 'Admin has replied', text: 'Accept the admin rate or send your new rate.' };
        if (s.open) return { cls: 'bg-amber-50', icon: Clock, iconCls: 'text-amber-500', title: 'Send your rates', text: 'So that we can confirm and proceed with packing.' };
        return { cls: 'bg-blue-50', icon: Clock, iconCls: 'text-blue-600', title: 'Waiting for admin', text: 'Admin will review and respond.' };
    })();

    const statusPill = (status) => {
        const st = STATUS[status];
        return (
            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', st.cls)}>
                <st.icon size={16} /> {t(st.label)}
            </span>
        );
    };

    const amountBox = (row) => (
        <label className="block">
            <span className="flex items-center h-11 px-3 rounded-xl border border-slate-300 bg-white focus-within:border-green-600">
                <span className="text-slate-500 mr-1.5">₹</span>
                <input type="number" inputMode="decimal" min="0" step="any" value={valueOf(row)} placeholder="0"
                    onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                    className="w-full min-w-0 text-lg font-bold text-slate-900 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label={`${row.name} amount`} />
            </span>
            <span className="block text-xs text-slate-500 mt-0.5 pl-1" translate="no">({rupees(rateFrom(row))}/{t(unitLabel(row.unit)).toLowerCase()})</span>
        </label>
    );

    const adminBox = (row) => (row.adminRate > 0 ? (
        <span className={cn('block rounded-xl px-3 py-1.5', row.status === 'countered' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50')}>
            <span className="block text-lg font-bold text-slate-900">{rupees(totalOf(row.adminRate, row.qty))}</span>
            <span className="block text-xs text-slate-500" translate="no">({rupees(row.adminRate)}/{t(unitLabel(row.unit)).toLowerCase()})</span>
        </span>
    ) : <span className="text-base text-slate-400">—</span>);

    const actions = (row) => (
        <span className="flex flex-col gap-1.5">
            {row.status === 'countered' && (
                <button type="button" onClick={() => accept(row)} disabled={!!busy}
                    className="h-10 px-3 rounded-xl border-2 border-green-600 text-green-700 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <CheckCircle2 size={16} /> {t('Accept')}
                </button>
            )}
            <button type="button" onClick={() => send([row], row.key)} disabled={!!busy || !(Number(valueOf(row)) > 0)}
                className="h-10 px-4 rounded-xl bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {busy === row.key ? <Loader2 size={16} className="animate-spin" /> : null} {t(row.status === 'open' ? 'Send' : 'Update')}
            </button>
        </span>
    );

    const tabs = (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100">
            {[['open', `${t('Negotiation')} (${items.length})`], ['final', `${t('Final')} (${final.length})`]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                    className={cn('h-11 rounded-xl text-base font-bold', tab === k ? 'bg-green-700 text-white' : 'text-slate-600')}>{label}</button>
            ))}
        </div>
    );

    const empty = (
        <div className="text-center py-14 px-4">
            <FileText size={44} className="mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">{t(tab === 'final' ? 'No item finalized today' : 'No items waiting for your rate')}</p>
            {tab === 'open' && <p className="text-base text-slate-500 mt-1">{t('Items appear here when the admin gives you franchise orders.')}</p>}
        </div>
    );

    const finalRows = final.map((row, k) => (
        <div key={row.key} className="grid grid-cols-[24px_minmax(0,1fr)_auto] lg:grid-cols-[32px_minmax(0,1.4fr)_120px_160px_150px] gap-3 items-center px-2 lg:px-4 py-3 bg-green-50/50">
            <span className="text-base text-slate-600">{k + 1}</span>
            <span className="flex items-center gap-3 min-w-0">
                <Thumb src={row.image} />
                <span className="min-w-0">
                    <span className="block text-lg font-semibold text-slate-900 break-words">{t(row.name)}</span>
                    <span className="lg:hidden block text-sm font-semibold text-green-700">{row.finalQty} {t(unitLabel(row.unit))} • {rupees(row.finalRate)}/{t(unitLabel(row.unit)).toLowerCase()}</span>
                </span>
            </span>
            <span className="hidden lg:block text-lg font-semibold text-slate-900">{row.finalQty} {t(unitLabel(row.unit))}</span>
            <span className="hidden lg:block">
                <span className="block text-lg font-bold text-slate-900">{rupees(totalOf(row.finalRate, row.finalQty))}</span>
                <span className="block text-xs text-slate-500" translate="no">({rupees(row.finalRate)}/{t(unitLabel(row.unit)).toLowerCase()})</span>
            </span>
            <span className="flex justify-end lg:justify-start">{statusPill('final')}</span>
        </div>
    ));

    /* ---------- desktop ---------- */
    const desktop = (
        <div className="hidden lg:grid 2xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <div className="bg-white rounded-3xl border border-slate-100 p-5">
                <div className="flex items-center gap-5 mb-5">
                    <span className="w-20 h-20 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0"><Package size={40} /></span>
                    <div>
                        <p className="text-lg font-bold text-slate-900">{t("Today's Total Requirement")}</p>
                        <div className="flex items-end gap-5 mt-1">
                            <span className="text-3xl font-bold text-green-700">{s.itemCount || 0} {t('items')}</span>
                            <span className="h-10 w-px bg-slate-200" />
                            <span>
                                <span className="block text-3xl font-bold text-green-700">{(s.totalKg || 0).toLocaleString('en-IN')} KG</span>
                                <span className="block text-sm text-slate-500">{t('Total Quantity')}</span>
                            </span>
                        </div>
                    </div>
                    <div className={cn('ml-auto flex items-center gap-3 rounded-2xl px-5 py-4 max-w-[340px]', callout.cls)}>
                        <callout.icon size={34} className={cn('shrink-0', callout.iconCls)} />
                        <span>
                            <span className="block text-base font-bold text-slate-900">{t(callout.title)}</span>
                            <span className="block text-sm text-slate-600">{t(callout.text)}</span>
                        </span>
                    </div>
                </div>

                <div className="w-80 mb-4">{tabs}</div>

                <div className="grid grid-cols-[32px_minmax(180px,1.4fr)_100px_150px_140px_130px_110px] gap-3 items-center px-4 h-14 rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
                    {tab === 'open' ? (
                        <>
                            <span>#</span><span>{t('Item')}</span><span>{t('Required Qty')}</span>
                            <span>{t('My Quotation')}<span className="block font-normal text-xs">({t('Rate I am giving')})</span></span>
                            <span>{t('Admin Response')}</span><span>{t('Status')}</span><span>{t('Action')}</span>
                        </>
                    ) : (
                        <><span>#</span><span>{t('Item')}</span><span>{t('Quantity')}</span><span>{t('Final price')}</span><span>{t('Status')}</span><span /><span /></>
                    )}
                </div>
                <div className="divide-y divide-slate-100">
                    {tab === 'open' ? (items.length ? items.map((row, k) => (
                        <div key={row.key} className={cn('grid grid-cols-[32px_minmax(180px,1.4fr)_100px_150px_140px_130px_110px] gap-3 items-center px-4 py-3', row.status === 'countered' && 'bg-orange-50/40')}>
                            <span className="text-base text-slate-600">{k + 1}</span>
                            <span className="flex items-center gap-3 min-w-0">
                                <Thumb src={row.image} />
                                <span className="min-w-0">
                                    <span className="block text-lg font-semibold text-slate-900 break-words">{t(row.name)}</span>
                                    <span className="block text-xs text-slate-500">{row.franchises} {t('franchises')} • {row.lines} {t('orders')}</span>
                                </span>
                            </span>
                            <span className="text-lg font-semibold text-slate-900">{row.qty} {t(unitLabel(row.unit))}</span>
                            {amountBox(row)}
                            {adminBox(row)}
                            <span>{statusPill(row.status)}</span>
                            {actions(row)}
                        </div>
                    )) : empty) : (final.length ? finalRows : empty)}
                </div>

                {tab === 'open' && items.length > 0 && (
                    <div className="flex items-center gap-4 mt-5">
                        <div className="flex-1 flex items-center gap-3 rounded-2xl bg-blue-50 px-5 py-4 text-sm text-slate-700">
                            <Info size={22} className="text-blue-600 shrink-0" />
                            {t('Update rates for pending items and send to admin. Accepted items will be removed from this list.')}
                        </div>
                        <button type="button" onClick={() => send(toSend, 'all')} disabled={!!busy || (!toSend.length && !message.trim())}
                            className="flex items-center justify-center gap-3 h-16 px-8 rounded-2xl bg-green-700 text-white text-lg font-bold disabled:opacity-50">
                            {busy === 'all' ? <Loader2 className="animate-spin" /> : <Send size={22} />} {sendLabel}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 2xl:grid-cols-1 gap-4 items-start">
                <div className="bg-white rounded-3xl border border-slate-100 p-5">
                    <p className="text-lg font-bold text-slate-900 mb-3">{t('Negotiation Progress')}</p>
                    <div className="flex items-center gap-4">
                        <Progress done={final.length} total={total} t={t} />
                        <div className="space-y-2 text-sm">
                            <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-600" /> <b>{final.length}</b> {t('Accepted')}</p>
                            <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400" /> <b>{items.length}</b> {t('Pending')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-4">
                    <Calculator size={34} className="text-slate-500 shrink-0" />
                    <div>
                        <p className="text-base font-bold text-slate-900">{t('Total Quotation Value')}</p>
                        <p className="text-3xl font-bold text-slate-900">{rupees(s.quotationValue)}</p>
                        <p className="text-sm text-slate-500">({total} {t('items')})</p>
                    </div>
                </div>
                {messagesPanel()}
            </div>
        </div>
    );

    function messagesPanel(mobile = false) {
        const list = sheet?.messages || [];
        return (
            <div className={cn('bg-white rounded-3xl border border-slate-100 p-5', mobile && 'mt-4')}>
                <p className="text-lg font-bold text-slate-900 mb-3">{t('Recent Messages')}</p>
                {!list.length && <p className="text-sm text-slate-500 mb-3">{t('No messages yet')}</p>}
                <div className="space-y-4 max-h-[360px] overflow-y-auto">
                    {list.slice(-8).map((m) => (
                        <div key={m._id} className="flex gap-3">
                            <span className={cn('w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shrink-0', m.by === 'admin' ? 'bg-blue-600' : 'bg-green-600')}>{m.by === 'admin' ? 'A' : 'V'}</span>
                            <span className="flex-1 min-w-0">
                                <span className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-slate-900">{m.by === 'admin' ? t('Admin') : t('You')}</span>
                                    <span className="text-xs text-slate-500">{formatTime(new Date(m.createdAt), locale)}</span>
                                </span>
                                <span className="block text-sm text-slate-700 break-words" translate="no">{m.text}</span>
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-4">
                    <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder={t('e.g. Can you do a little less?')}
                        onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                        className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-slate-200 text-base outline-none focus:border-green-600" />
                    <button type="button" onClick={sendMessage} disabled={!message.trim() || !!busy} aria-label={t('Send')}
                        className="w-11 h-11 rounded-xl bg-green-700 text-white flex items-center justify-center disabled:opacity-50">
                        {busy === 'msg' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-green-50 p-4 mt-4 text-sm text-slate-700">
                    <CheckCircle2 size={22} className="text-green-700 shrink-0" />
                    {t('After accepting all items, quotation will be finalized.')}
                </div>
            </div>
        );
    }

    /* ---------- mobile ---------- */
    const mobile = (
        <div className="lg:hidden">
            <div className="relative text-center mb-4">
                <button type="button" onClick={() => navigate(-1)} className="absolute left-0 top-1 w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Back">
                    <ArrowLeft size={28} />
                </button>
                <h1 className="text-2xl font-bold text-slate-900 pt-2">{t(nothingSent ? "Today's Quotation List" : 'Negotiation')}</h1>
                <p className="text-base text-slate-500 mt-1">{today}</p>
            </div>
            <div className="flex items-center rounded-2xl bg-green-50 px-4 py-4 mb-4">
                <Package size={40} className="text-green-700 shrink-0" />
                <div className="flex-1 pl-4 border-r border-green-200">
                    <p className="text-sm text-slate-600">{t('Total items')}</p>
                    <p className="text-2xl font-bold text-slate-900">{s.itemCount || 0}</p>
                </div>
                <div className="flex-1 pl-4">
                    <p className="text-sm text-slate-600">{t('Total quantity')}</p>
                    <p className="text-2xl font-bold text-slate-900">{(s.totalKg || 0).toLocaleString('en-IN')} KG</p>
                </div>
            </div>
            {final.length > 0 && tab === 'open' && (
                <button type="button" onClick={() => setTab('final')} className="w-full flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 mb-3 text-left">
                    <CheckCircle2 size={26} className="text-green-700 shrink-0" />
                    <span className="flex-1">
                        <span className="block text-base font-bold text-slate-900">{final.length} {t('items finalized')}</span>
                        <span className="block text-sm text-slate-600">{t('They have been removed from this list.')}</span>
                    </span>
                    <ArrowRight size={20} className="text-slate-500" />
                </button>
            )}
            <div className="mb-3">{tabs}</div>
            {tab === 'open' ? (items.length ? (
                <div className="divide-y divide-slate-100">
                    {items.map((row) => (
                        <div key={row.key} className="py-3">
                            <div className="flex items-start gap-3">
                                <Thumb src={row.image} className="w-14 h-14" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="min-w-0">
                                            <span className="block text-lg font-bold text-slate-900 break-words">{t(row.name)}</span>
                                            <span className="block text-base font-bold text-green-700">{row.qty} {t(unitLabel(row.unit))}</span>
                                        </span>
                                        {statusPill(row.status)}
                                    </div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-2 mt-2">
                                        {amountBox(row)}
                                        <ArrowRight size={16} className="text-slate-400" />
                                        {adminBox(row)}
                                    </div>
                                    <div className="flex gap-2 mt-2 [&>span]:flex-row [&>span]:flex-1 [&_button]:flex-1">{actions(row)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : empty) : (final.length ? <div className="divide-y divide-slate-100">{finalRows}</div> : empty)}

            {messagesPanel(true)}

            {tab === 'open' && items.length > 0 && (
                <div className="sticky bottom-[76px] mt-4 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
                    <button type="button" onClick={() => send(toSend, 'all')} disabled={!!busy || (!toSend.length && !message.trim())}
                        className="w-full flex items-center justify-center gap-3 h-16 rounded-2xl bg-green-700 text-white text-lg font-bold disabled:opacity-50">
                        {busy === 'all' ? <Loader2 className="animate-spin" /> : <Send size={22} />} {sendLabel}
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader icon={MessageSquare} title={t('Quotation / Rate Negotiation')} subtitle={t("Send your rates for today's list. Admin will review and respond.")} />
            {desktop}
            {mobile}
        </div>
    );
}
