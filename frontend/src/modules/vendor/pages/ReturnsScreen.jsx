import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FileText,
    Loader2,
    Minus,
    Package,
    Plus,
    Search,
    StickyNote,
    Store,
    Undo2,
    X,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { keepPage, peekPage } from '../lib/pageCache';
import { franchiseNameOf, loadOf, loadText, unitLabel } from '../lib/packing';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay, formatTime } from '../components/layout/VendorPageHeader';
import DatePicker, { dateRange } from '../components/DateRangePicker';

const REASON_LABEL = {
    damaged_from_supplier: 'Damaged goods',
    rejected_at_receiving: 'Rejected at delivery',
    spoiled_in_stock: 'Spoiled / expired',
    franchise_closing: 'Franchise closing',
    other: 'Other',
};

// What the vendor sees for each return
const stateOf = (r) => {
    if (r.status === 'approved') return 'coming';
    if (r.status === 'sent') return 'pending';
    if (r.vendorOutcome === 'rejected') return 'rejected';
    if (r.vendorOutcome === 'partial') return 'partial';
    return 'accepted';
};
const STATE = {
    coming: { label: 'On the way', pill: 'bg-blue-50 text-blue-700', tile: 'bg-blue-50 text-blue-700', card: 'bg-blue-50' },
    pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700', tile: 'bg-amber-50 text-amber-600', card: 'bg-rose-50' },
    accepted: { label: 'Accepted', pill: 'bg-green-50 text-green-700', tile: 'bg-green-50 text-green-700', card: 'bg-green-50' },
    partial: { label: 'Partly accepted', pill: 'bg-green-50 text-green-700', tile: 'bg-green-50 text-green-700', card: 'bg-green-50' },
    rejected: { label: 'Rejected', pill: 'bg-red-50 text-red-700', tile: 'bg-red-50 text-red-600', card: 'bg-red-50' },
};
const TABS = [
    { value: 'all', label: 'All', match: () => true },
    { value: 'pending', label: 'Pending', match: (s) => s === 'pending' || s === 'coming' },
    { value: 'accepted', label: 'Accepted', match: (s) => s === 'accepted' || s === 'partial' },
    { value: 'rejected', label: 'Rejected', match: (s) => s === 'rejected' },
];

const refOf = (r) => `#RTN-${String(r._id).slice(-6).toUpperCase()}`;
const whenOf = (r) => new Date(r.sentAt || r.createdAt);
const qtyText = (q, unit, t) => `${Math.round(Number(q) * 100) / 100} ${t(unitLabel(unit))}`;
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Thumb({ src, className }) {
    return src
        ? <img src={src} alt="" className={cn('object-cover rounded-lg', className)} loading="lazy" />
        : <span className={cn('rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center', className)}><Package size={18} /></span>;
}

function Pill({ state, className }) {
    const { t } = useVendorLanguage();
    return <span className={cn('inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap', STATE[state].pill, className)}>{t(STATE[state].label)}</span>;
}

function Stepper({ value, max, unit, onChange }) {
    const { t } = useVendorLanguage();
    const set = (v) => onChange(Math.min(max, Math.max(0, Math.round(v * 100) / 100)));
    return (
        <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <button type="button" onClick={() => set(value - 1)} disabled={value <= 0} className="w-16 h-16 flex items-center justify-center disabled:opacity-30" aria-label="Less"><Minus size={22} /></button>
            <label className="flex-1 flex flex-col items-center justify-center border-x border-slate-200">
                <input type="number" inputMode="decimal" min="0" max={max} step="any" value={value} onChange={(e) => set(parseFloat(e.target.value) || 0)}
                    className="w-full text-center text-2xl font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-xs text-slate-500">{t(unitLabel(unit))}</span>
            </label>
            <button type="button" onClick={() => set(value + 1)} disabled={value >= max} className="w-16 h-16 flex items-center justify-center disabled:opacity-30" aria-label="More"><Plus size={22} /></button>
        </div>
    );
}

/* ---------- one return: check items, review, done ---------- */

function ReturnDetail({ ret, onBack, onSaved, isDesktop }) {
    const { t, locale } = useVendorLanguage();
    const state = stateOf(ret);
    const canReview = ret.status === 'sent';
    const [decisions, setDecisions] = useState({}); // itemId -> { decision, quantity }
    const [note, setNote] = useState('');
    const [step, setStep] = useState('items'); // items | review | done
    const [sheetItem, setSheetItem] = useState(null);
    const [photoIdx, setPhotoIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);

    const decide = (item, decision, quantity) => setDecisions((d) => ({
        ...d,
        [item._id]: { decision, quantity: decision === 'accepted' ? (quantity ?? d[item._id]?.quantity ?? Number(item.quantity)) : 0 },
    }));

    const accepted = ret.items.filter((i) => decisions[i._id]?.decision === 'accepted');
    const allDecided = ret.items.every((i) => decisions[i._id]);
    const needsNote = ret.items.some((i) => decisions[i._id]?.decision === 'rejected' || (decisions[i._id]?.decision === 'accepted' && decisions[i._id].quantity < Number(i.quantity)));
    const keptLoad = loadOf(accepted, (i) => decisions[i._id].quantity);
    const totalLoad = loadOf(ret.items, (i) => i.quantity);

    const goReview = () => {
        if (!allDecided) { toast.error(t('Accept or reject every item first')); return; }
        setStep('review');
    };

    const submit = async () => {
        if (needsNote && !note.trim()) { toast.error(t('Please write a short note on why you are rejecting or accepting less')); return; }
        setSaving(true);
        try {
            const res = await api.put(`/stock-returns/vendor/${ret._id}/review`, {
                note: note.trim(),
                items: ret.items.map((i) => ({ itemId: i._id, decision: decisions[i._id].decision, quantity: decisions[i._id].quantity })),
            });
            setResult(res.data?.result || null);
            setStep('done');
            onSaved();
        } catch (error) {
            toast.error(error.response?.data?.message || t('Could not save. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    const franchiseCard = (
        <div className={cn('flex items-center gap-4 rounded-2xl px-4 py-4', STATE[state].card)}>
            <span className="w-14 h-14 rounded-xl bg-white text-blue-800 flex items-center justify-center shrink-0"><Store size={28} /></span>
            <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 truncate" translate="no">{franchiseNameOf(ret.fromFranchiseId)}</p>
                <p className="text-base text-slate-600" translate="no">{refOf(ret)}</p>
                <p className="text-sm text-slate-600">{formatDay(whenOf(ret), locale)}, {formatTime(whenOf(ret), locale)}</p>
            </div>
        </div>
    );

    const greenBtn = 'flex items-center justify-center gap-2 rounded-2xl bg-green-700 text-white font-bold disabled:opacity-50';

    /* ----- item sheet: photos, quantity, accept / reject ----- */
    const sheet = sheetItem && (() => {
        const item = sheetItem;
        const photos = item.photos?.length ? item.photos : item.image ? [item.image] : [];
        const d = decisions[item._id];
        const qty = d?.quantity ?? Number(item.quantity);
        const close = () => { setSheetItem(null); setPhotoIdx(0); };
        return (
            <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-end lg:items-center justify-center" onClick={close}>
                <div className="w-full lg:max-w-lg max-h-[94vh] overflow-y-auto bg-white rounded-t-3xl lg:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 lg:hidden" />
                    <div className="relative flex items-center justify-center mb-4">
                        <h3 className="text-2xl font-bold text-slate-900">{t('Item photo')}</h3>
                        <button type="button" onClick={close} className="absolute right-0 w-11 h-11 flex items-center justify-center" aria-label="Close"><X size={26} /></button>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-[4/3]">
                        {photos.length ? <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Package size={56} /></div>}
                        {photos.length > 1 && (
                            <>
                                <button type="button" onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center" aria-label="Previous photo"><ChevronLeft size={24} /></button>
                                <button type="button" onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center" aria-label="Next photo"><ChevronRight size={24} /></button>
                                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/60 text-white text-sm font-semibold">{photoIdx + 1} / {photos.length}</span>
                            </>
                        )}
                        {!item.photos?.length && <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 text-xs text-slate-600">{t('No photo from the franchise')}</span>}
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 mt-3">
                        <Thumb src={item.image} className="w-12 h-12" />
                        <div>
                            <p className="text-lg font-bold text-slate-900">{t(item.name)} — {qtyText(item.quantity, item.unit, t)}</p>
                            <p className={cn('text-sm font-semibold', item.condition === 'good' ? 'text-green-700' : 'text-red-600')}>{t(item.condition === 'good' ? 'Good condition' : 'Damaged / spoiled')}</p>
                        </div>
                    </div>
                    {ret.note && <p className="text-base text-slate-600 mt-3"><span className="font-semibold">{t("Franchise's note")}:</span> {ret.note}</p>}

                    {canReview && (
                        <>
                            <p className="text-lg font-bold text-slate-900 mt-5 mb-2">{t('Quantity you accept')}</p>
                            <Stepper value={qty} max={Number(item.quantity)} unit={item.unit} onChange={(v) => decide(item, v > 0 ? 'accepted' : 'rejected', v)} />
                            <div className="grid grid-cols-2 gap-3 mt-5">
                                <button type="button" onClick={() => { decide(item, 'accepted', qty > 0 ? qty : Number(item.quantity)); close(); }}
                                    className={cn('flex items-center justify-center gap-2 h-14 rounded-2xl border-2 text-lg font-bold', d?.decision === 'accepted' ? 'border-green-700 bg-green-700 text-white' : 'border-green-600 text-green-700 bg-green-50')}>
                                    <Check size={22} /> {t('Accept this item')}
                                </button>
                                <button type="button" onClick={() => { decide(item, 'rejected'); close(); }}
                                    className={cn('flex items-center justify-center gap-2 h-14 rounded-2xl border-2 text-lg font-bold', d?.decision === 'rejected' ? 'border-red-600 bg-red-600 text-white' : 'border-red-300 text-red-600 bg-white')}>
                                    <X size={22} /> {t('Reject this item')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    })();

    /* ----- step: done ----- */
    if (step === 'done') {
        const r = result || ret;
        const out = r.vendorOutcome || 'accepted';
        return (
            <div className="text-center py-8 px-2">
                <div className={cn('w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-5', out === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700')}>
                    {out === 'rejected' ? <XCircle size={64} /> : <CheckCircle2 size={64} />}
                </div>
                <h2 className="text-3xl font-bold text-slate-900">{t(out === 'rejected' ? 'Return rejected' : out === 'partial' ? 'Return partly accepted' : 'Return accepted')}</h2>
                {out !== 'rejected' && (
                    <p className="text-lg text-slate-600 mt-2">{accepted.length} {t('items')} ({loadText(keptLoad, t)}) {t('accepted')}</p>
                )}
                {r.creditNote?.number && (
                    <div className="flex items-start gap-4 text-left rounded-2xl border border-slate-200 bg-white px-5 py-4 mt-6 max-w-md mx-auto">
                        <FileText size={30} className="text-green-700 shrink-0" />
                        <div>
                            <p className="text-sm text-slate-500">{t('Credit note')}</p>
                            <p className="text-xl font-bold text-slate-900" translate="no">{r.creditNote.number} • {money(r.creditNote.amount)}</p>
                            <p className="text-base text-slate-600" translate="no">{franchiseNameOf(ret.fromFranchiseId)}</p>
                            <p className="text-sm text-slate-500">{formatDay(new Date(), locale)}, {formatTime(new Date(), locale)}</p>
                        </div>
                    </div>
                )}
                <div className="flex flex-col gap-3 mt-8 max-w-md mx-auto">
                    <button type="button" onClick={onBack} className={cn(greenBtn, 'h-14 text-lg')}>{t('OK')}</button>
                </div>
            </div>
        );
    }

    /* ----- step: review ----- */
    if (step === 'review') {
        return (
            <div className="pb-6">
                <div className="relative flex items-center justify-center mb-5">
                    <button type="button" onClick={() => setStep('items')} className="absolute left-0 w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Back"><ArrowLeft size={28} /></button>
                    <h1 className="text-2xl font-bold text-slate-900">{t('Review return')}</h1>
                </div>
                {franchiseCard}
                <h3 className="text-xl font-bold text-slate-900 mt-6 mb-2">{t('Selected items')} ({ret.items.length})</h3>
                <div className="rounded-2xl border border-slate-100 bg-white divide-y divide-slate-100">
                    {ret.items.map((i) => {
                        const d = decisions[i._id];
                        const ok = d.decision === 'accepted';
                        return (
                            <div key={i._id} className="flex items-center gap-3 px-4 py-3">
                                <Thumb src={i.image} className="w-12 h-12" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-semibold text-slate-900">{t(i.name)}</p>
                                    <p className="text-sm text-slate-500">{ok ? qtyText(d.quantity, i.unit, t) : qtyText(i.quantity, i.unit, t)}{ok && d.quantity < Number(i.quantity) ? ` / ${qtyText(i.quantity, i.unit, t)}` : ''}</p>
                                </div>
                                <span className={cn('px-4 py-2 rounded-xl text-base font-bold', ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>{t(ok ? 'Accept' : 'Reject')}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-2 rounded-2xl border border-slate-100 bg-white px-5 py-4 mt-4">
                    <div className="border-r border-slate-100">
                        <p className="text-sm text-slate-500">{t('Accepted quantity')}</p>
                        <p className="text-2xl font-bold text-slate-900">{loadText(keptLoad, t)}</p>
                    </div>
                    <div className="pl-5">
                        <p className="text-sm text-slate-500">{t('Accepted items')}</p>
                        <p className="text-2xl font-bold text-slate-900">{accepted.length} / {ret.items.length}</p>
                    </div>
                </div>
                <label className="block mt-5">
                    <span className="text-lg text-slate-700">{t(needsNote ? 'Note (required: why reject / less)' : 'Note (optional)')}</span>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3}
                        className={cn('w-full mt-2 px-4 py-3 rounded-2xl border bg-white text-base outline-none focus:border-green-600', needsNote && !note.trim() ? 'border-amber-400' : 'border-slate-200')}
                        placeholder={t('e.g. All items accepted as per condition')} />
                </label>
                <button type="button" onClick={submit} disabled={saving} className={cn(greenBtn, 'w-full h-16 text-lg mt-5', !accepted.length && 'bg-red-600')}>
                    {saving ? <Loader2 className="animate-spin" /> : accepted.length ? <Check size={24} /> : <X size={24} />}
                    {t(accepted.length ? 'Confirm return' : 'Reject return')}
                </button>
            </div>
        );
    }

    /* ----- step: items ----- */
    const decisionButtons = (i) => {
        const d = decisions[i._id];
        return (
            <div className="flex gap-2">
                <button type="button" onClick={() => decide(i, 'accepted')}
                    className={cn('h-11 px-4 lg:h-10 lg:px-3 rounded-xl text-base lg:text-sm font-bold border-2', d?.decision === 'accepted' ? 'bg-green-700 border-green-700 text-white' : 'border-green-600 text-green-700 bg-white')}>
                    {t('Accept')}
                </button>
                <button type="button" onClick={() => decide(i, 'rejected')}
                    className={cn('h-11 px-4 lg:h-10 lg:px-3 rounded-xl text-base lg:text-sm font-bold border-2', d?.decision === 'rejected' ? 'bg-red-600 border-red-600 text-white' : 'border-red-300 text-red-600 bg-white')}>
                    {t('Reject')}
                </button>
            </div>
        );
    };
    const outcomeChip = (i) => {
        if (!i.vendorDecision) return ret.status === 'received' ? <span className="text-base font-semibold text-green-700">{t('Accepted')}</span> : null;
        const ok = i.vendorDecision === 'accepted';
        return (
            <span className={cn('px-3 py-1.5 rounded-lg text-sm font-bold', ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                {t(ok ? 'Accepted' : 'Rejected')}{ok && Number(i.acceptedQuantity) < Number(i.quantity) ? ` ${qtyText(i.acceptedQuantity, i.unit, t)}` : ''}
            </span>
        );
    };
    const conditionCell = (i) => (
        <button type="button" onClick={() => setSheetItem(i)} className="flex items-center gap-2 text-left">
            <Thumb src={i.photos?.[0] || i.image} className="w-11 h-11" />
            <span className={cn('text-sm font-semibold', i.condition === 'good' ? 'text-green-700' : 'text-red-600')}>{t(i.condition === 'good' ? 'Good' : 'Damaged')}</span>
        </button>
    );

    return (
        <div className="pb-6">
            {!isDesktop && (
                <div className="relative flex items-center justify-center mb-4">
                    <button type="button" onClick={onBack} className="absolute left-0 w-11 h-11 -ml-2 flex items-center justify-center" aria-label="Back"><ArrowLeft size={28} /></button>
                    <h1 className="text-2xl font-bold text-slate-900">{t('Return details')}</h1>
                </div>
            )}
            <div className="flex items-center justify-between mb-3">
                {isDesktop ? <h2 className="text-xl font-bold text-slate-900">{t('Return details')}</h2> : <span />}
                <Pill state={state} />
            </div>
            {franchiseCard}

            <h3 className="text-lg font-bold text-slate-900 mt-5">{t('Reason for return')}</h3>
            <p className="text-base text-slate-600 mt-1">{t(REASON_LABEL[ret.reason] || ret.reason)}{ret.note ? ` — ${ret.note}` : ''}</p>

            <div className="rounded-2xl border border-slate-100 bg-white divide-y divide-slate-100 mt-4">
                {[
                    ['Total items', ret.items.length],
                    ['Total quantity', loadText(totalLoad, t)],
                    ['Credit note', ret.creditNote?.number ? `${ret.creditNote.number} • ${money(ret.creditNote.amount)}` : '—'],
                ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-3 text-base">
                        <span className="text-slate-500">{t(k)}</span>
                        <span className="font-semibold text-slate-900" translate="no">{v}</span>
                    </div>
                ))}
            </div>

            {ret.status === 'approved' && (
                <p className="rounded-2xl bg-blue-50 text-blue-800 text-base px-4 py-3 mt-4">{t('Approved by the admin. You can check the items once the franchise hands them over.')}</p>
            )}

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-2">{t('Item list')}</h3>
            {isDesktop ? (
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 text-left text-sm font-semibold text-slate-600">
                                <th className="px-3 py-3">{t('Item')}</th><th className="px-3 py-3">{t('Quantity')}</th>
                                <th className="px-3 py-3">{t('Condition')}</th><th className="px-3 py-3">{t('Action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {ret.items.map((i) => (
                                <tr key={i._id}>
                                    <td className="px-3 py-3"><span className="flex items-center gap-3"><Thumb src={i.image} className="w-11 h-11" /><span className="text-base font-semibold text-slate-900">{t(i.name)}</span></span></td>
                                    <td className="px-3 py-3 text-base font-semibold text-red-600 whitespace-nowrap">
                                        {canReview && decisions[i._id]?.decision === 'accepted' && decisions[i._id].quantity < Number(i.quantity)
                                            ? <>{qtyText(decisions[i._id].quantity, i.unit, t)} <span className="text-slate-400 font-normal">/ {qtyText(i.quantity, i.unit, t)}</span></>
                                            : qtyText(i.quantity, i.unit, t)}
                                    </td>
                                    <td className="px-3 py-3">{conditionCell(i)}</td>
                                    <td className="px-3 py-3">{canReview ? decisionButtons(i) : outcomeChip(i)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-100 bg-white divide-y divide-slate-100">
                    {ret.items.map((i) => (
                        <div key={i._id} className="flex items-center gap-3 px-3 py-3">
                            <button type="button" onClick={() => setSheetItem(i)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                <Thumb src={i.image} className="w-14 h-14" />
                                <span className="min-w-0">
                                    <span className="block text-lg font-semibold text-slate-900">{t(i.name)}</span>
                                    <span className="block text-sm text-slate-500">
                                        {canReview && decisions[i._id]?.decision === 'accepted' && decisions[i._id].quantity < Number(i.quantity)
                                            ? `${qtyText(decisions[i._id].quantity, i.unit, t)} / ${qtyText(i.quantity, i.unit, t)}`
                                            : qtyText(i.quantity, i.unit, t)}
                                    </span>
                                </span>
                            </button>
                            <div className="flex flex-col items-end gap-2">
                                {conditionCell(i)}
                                {canReview ? decisionButtons(i) : outcomeChip(i)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {ret.receivedNote && <p className="rounded-2xl bg-amber-50 text-base text-slate-800 px-4 py-3 mt-4"><span className="font-semibold">{t('Your note')}:</span> {ret.receivedNote}</p>}

            {canReview && (
                <div className="sticky bottom-[76px] lg:static mt-5 pt-2 bg-slate-50 lg:bg-transparent flex flex-col lg:flex-row gap-3">
                    <label className="flex-1 flex items-center gap-2 h-14 px-4 rounded-2xl border border-slate-200 bg-white">
                        <StickyNote size={20} className="text-slate-400 shrink-0" />
                        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('Add note (optional)...')} className="flex-1 min-w-0 bg-transparent outline-none text-base" />
                    </label>
                    <button type="button" onClick={goReview} className={cn(greenBtn, 'h-14 px-6 text-lg', !allDecided && 'opacity-60')}>
                        <Check size={22} /> {t(accepted.length || !allDecided ? 'Accept selected' : 'Reject return')} ({accepted.length})
                    </button>
                </div>
            )}
            {sheet}
        </div>
    );
}

/* ---------- page ---------- */

export default function ReturnsScreen() {
    const { t, locale } = useVendorLanguage();
    const [rows, setRows] = useState(() => peekPage('returns') || []);
    const [loading, setLoading] = useState(!peekPage('returns'));
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');
    const [date, setDate] = useState({ mode: 'all', day: '' });
    const [selectedId, setSelectedId] = useState(null);
    const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const on = () => setIsDesktop(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/stock-returns/vendor');
            setRows(keepPage('returns', res.data?.results || []));
        } catch (error) {
            if (error.response?.status !== 401) toast.error(error.response?.data?.message || 'Could not load returns');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const socket = getSocket();
        const onUpdate = (data) => {
            if (data?.message) toast.info(data.message);
            load();
        };
        socket.on('stock_return_update', onUpdate);
        return () => socket.off('stock_return_update', onUpdate);
    }, [load]);

    const inDate = useMemo(() => {
        const range = dateRange(date);
        return rows.filter((r) => !range || (whenOf(r) >= range[0] && whenOf(r) < range[1]));
    }, [rows, date]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase().replace(/^#/, '');
        const match = TABS.find((x) => x.value === tab).match;
        // Returns waiting for the vendor's check come first, then newest
        const order = { pending: 0, coming: 1 };
        return inDate
            .filter((r) => match(stateOf(r)) && (!q || [franchiseNameOf(r.fromFranchiseId), refOf(r), r.creditNote?.number || '', ...r.items.map((i) => i.name)].join(' ').toLowerCase().includes(q)))
            .sort((a, b) => (order[stateOf(a)] ?? 2) - (order[stateOf(b)] ?? 2) || whenOf(b) - whenOf(a));
    }, [inDate, tab, search]);

    const count = (v) => inDate.filter((r) => TABS.find((x) => x.value === v).match(stateOf(r))).length;
    // Desktop always shows a return (the one picked, else the first); phones show the list until one is picked.
    // Neither depends on the screen-size check, so a resize/rotation never throws away the vendor's choices.
    const activeId = selectedId ?? shown[0]?._id;
    const selected = rows.find((r) => r._id === activeId) || null;

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const tabs = (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((x) => (
                <button key={x.value} type="button" onClick={() => setTab(x.value)}
                    className={cn('h-11 px-4 rounded-xl text-base font-semibold whitespace-nowrap border', tab === x.value ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700')}>
                    {t(x.label)} ({count(x.value)})
                </button>
            ))}
        </div>
    );

    const searchBox = (
        <div className="flex items-center gap-2.5 h-12 px-4 rounded-xl border border-slate-200 bg-white">
            <Search size={20} className="text-slate-400 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search by franchise, item or return ID...')} className="flex-1 min-w-0 bg-transparent outline-none text-base" />
        </div>
    );

    const list = (
        <div className="space-y-3">
            {!shown.length && (
                <div className="text-center py-14 px-4 rounded-2xl bg-white border border-slate-100">
                    <Undo2 size={44} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-semibold text-slate-800">{t('No returns')}</p>
                </div>
            )}
            {shown.map((r) => {
                const s = stateOf(r);
                const active = r._id === activeId && isDesktop;
                return (
                    <button key={r._id} type="button" onClick={() => setSelectedId(r._id)}
                        className={cn('w-full flex items-center gap-3 rounded-2xl border bg-white p-4 text-left', active ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-100')}>
                        <span className={cn('w-14 h-14 rounded-xl flex items-center justify-center shrink-0', STATE[s].tile)}><Store size={26} /></span>
                        <span className="flex-1 min-w-0">
                            <span className="flex items-start justify-between gap-2">
                                <span className="min-w-0">
                                    <span className="block text-base font-bold text-slate-900" translate="no">{refOf(r)}</span>
                                    <span className="block text-base text-slate-800 truncate" translate="no">{franchiseNameOf(r.fromFranchiseId)}</span>
                                    <span className="block text-sm text-slate-500">{isDesktop ? `${formatDay(whenOf(r), locale)}, ` : ''}{formatTime(whenOf(r), locale)}</span>
                                </span>
                                <Pill state={s} />
                            </span>
                            <span className="flex items-center gap-2 mt-2">
                                {r.items.slice(0, 3).map((i) => <Thumb key={i._id} src={i.image} className="w-8 h-8" />)}
                                <span className="text-sm text-slate-500 ml-1">{r.items.length} {t('items')} • {loadText(loadOf(r.items, (i) => i.quantity), t)}</span>
                            </span>
                        </span>
                        <ChevronRight size={22} className="text-slate-500 shrink-0" />
                    </button>
                );
            })}
        </div>
    );

    const detailFor = (desktop) => selected && (
        <ReturnDetail key={selected._id} ret={selected} isDesktop={desktop} onBack={() => setSelectedId(null)} onSaved={load} />
    );

    return (
        <div className="pb-24 lg:pb-6">
            <VendorDesktopHeader
                icon={Undo2}
                title={t('Returns')}
                subtitle={t('Items returned from franchises. Check each item and accept or reject it.')}
                dateSlot={<DatePicker desktop value={date} onChange={setDate} />}
            />

            {/* Mobile */}
            <div className="lg:hidden">
                {(selectedId && detailFor(false)) || (
                    <>
                        <VendorMobileTopBar />
                        <h1 className="text-3xl font-bold text-slate-900">{t('Returns')}</h1>
                        <p className="text-lg text-slate-600 mt-1 mb-4">{t('Goods franchises are sending back to you')}</p>
                        <DatePicker value={date} onChange={setDate} />
                        <div className="my-4">{tabs}</div>
                        {rows.length > 4 && <div className="mb-3">{searchBox}</div>}
                        {list}
                    </>
                )}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block">
                <div className="flex items-center justify-between gap-4 mb-4">
                    {tabs}
                    <div className="w-[380px]">{searchBox}</div>
                </div>
                <div className="grid xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] gap-5 items-start">
                    {list}
                    <div className="bg-white rounded-3xl border border-slate-100 p-5 min-h-[400px]">
                        {detailFor(true) || (
                            <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                                <Undo2 size={48} className="text-slate-300 mb-3" />
                                <p className="text-lg">{t('Select a return to check its items')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
