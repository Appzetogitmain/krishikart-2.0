import { ArrowRight, Check, X, Store, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rate bargaining history for a stock request: every quote, counter-offer, acceptance and
 * decline between the vendor and the admin, newest last.
 */

const ACTION_TEXT = {
    vendor: { quote: 'Vendor quoted', counter: 'Vendor sent a counter-offer', accept: 'Vendor accepted the rate', decline: 'Vendor declined and kept their rate' },
    admin: { quote: 'Admin quoted', counter: 'Admin offered a different rate', accept: 'Admin approved the rate', decline: 'Admin declined' },
};

const money = (n) => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN')}`;
const when = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export default function OfferHistory({ offers = [], viewer = 'vendor', className }) {
    if (!offers.length) return null;
    return (
        <div className={cn('bg-white rounded-2xl border border-slate-200 p-4 sm:p-5', className)}>
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Rate history</h3>
            <ol className="space-y-3">
                {offers.map((o, i) => {
                    const prev = offers.slice(0, i).reverse().find((p) => p.action === 'quote' || p.action === 'counter');
                    const mine = o.by === viewer;
                    const isFinal = o.action === 'accept';
                    return (
                        <li key={i} className={cn('rounded-xl border p-3', isFinal ? 'border-emerald-200 bg-emerald-50/60' : o.action === 'decline' ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200')}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                                    {o.by === 'vendor' ? <Store size={13} className="text-amber-600" /> : <Shield size={13} className="text-blue-600" />}
                                    {ACTION_TEXT[o.by]?.[o.action] || o.action}
                                    {mine && <span className="text-[10px] font-semibold text-slate-400">(you)</span>}
                                    {isFinal && <Check size={13} className="text-emerald-600" />}
                                    {o.action === 'decline' && <X size={13} className="text-rose-600" />}
                                </span>
                                <span className="text-[11px] text-slate-400 tabular-nums">{when(o.at)}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                                {(o.items || []).map((it) => {
                                    const before = prev?.items?.find((p) => p.productId === it.productId);
                                    const priceChanged = before && Number(before.price) !== Number(it.price);
                                    const qtyChanged = before && Number(before.quantity) !== Number(it.quantity);
                                    return (
                                        <div key={it.productId} className="flex flex-wrap items-center gap-x-2 text-[12px] text-slate-600">
                                            <span className="font-semibold text-slate-800">{it.name}</span>
                                            <span className="tabular-nums">
                                                {qtyChanged ? <><s className="text-slate-400">{before.quantity}</s> <ArrowRight size={10} className="inline" /> </> : null}
                                                {it.quantity} {it.unit} ×{' '}
                                                {priceChanged ? <><s className="text-slate-400">{money(before.price)}</s> <ArrowRight size={10} className="inline" /> </> : null}
                                                <b className={cn(priceChanged && (Number(it.price) < Number(before.price) ? 'text-rose-600' : 'text-emerald-700'))}>{money(it.price)}</b>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[12px] font-black text-slate-900 tabular-nums">Total {money(o.total)}</span>
                                {o.byName && <span className="text-[11px] text-slate-400">by {o.byName}</span>}
                            </div>
                            {o.note && <p className="mt-1.5 text-[12px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">“{o.note}”</p>}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
