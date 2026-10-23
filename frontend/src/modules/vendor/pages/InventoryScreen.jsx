import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, IndianRupee, Loader2, Package, Search, Tags, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVendorInventory } from '../contexts/VendorInventoryContext';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { VendorDesktopHeader, VendorMobileTopBar, formatDay } from '../components/layout/VendorPageHeader';
import { unitLabel } from '../lib/packing';

/**
 * The vendor's own rate list. The admin compares these rates and gives franchise orders at the
 * vendor's rate — there is no quotation to send for each order.
 */
export default function InventoryScreen() {
    const { inventory, loading, toggleAvailability, saveRates, refreshInventory } = useVendorInventory();
    const { t, locale } = useVendorLanguage();
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);

    // Pick up products the admin assigned since the portal was opened
    useEffect(() => {
        refreshInventory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const q = search.trim().toLowerCase();
    const shown = useMemo(() => inventory.filter((i) => !q || String(i.name || '').toLowerCase().includes(q) || String(i.category || '').toLowerCase().includes(q)), [inventory, q]);

    const valueOf = (item) => (draft[item.id] !== undefined ? draft[item.id] : item.rate ? String(item.rate) : '');
    const changed = inventory.filter((i) => draft[i.id] !== undefined && Number(draft[i.id] || 0) !== Number(i.rate || 0));
    const withRate = inventory.filter((i) => Number(i.rate) > 0).length;
    const lastUpdate = inventory.reduce((m, i) => (i.rateUpdatedAt && new Date(i.rateUpdatedAt) > m ? new Date(i.rateUpdatedAt) : m), new Date(0));

    const save = async () => {
        if (!changed.length) return;
        const bad = changed.find((i) => !(Number(draft[i.id]) >= 0));
        if (bad) {
            toast.error(t('Enter a correct rate'));
            return;
        }
        setSaving(true);
        const ok = await saveRates(changed.map((i) => ({ productId: i.id, rate: Number(draft[i.id] || 0) })));
        setSaving(false);
        if (ok) {
            setDraft({});
            toast.success(t('Rates saved'));
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-green-700" size={40} /></div>;
    }

    const summary = (
        <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-sm text-slate-600">{t('Products with rate')}</p>
                <p className="text-2xl font-bold text-green-800">{withRate} / {inventory.length}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm text-slate-600">{t('Last Updated')}</p>
                <p className="text-lg font-bold text-slate-900">{lastUpdate.getTime() > 0 ? formatDay(lastUpdate, locale) : '—'}</p>
            </div>
        </div>
    );

    return (
        <div className="pb-28 lg:pb-6">
            <VendorDesktopHeader icon={Tags} title={t('My Products & Rates')} subtitle={t('Set your own rate. The admin gives you orders at this rate.')} />
            <div className="lg:hidden">
                <VendorMobileTopBar />
                <h1 className="text-3xl font-bold text-slate-900">{t('My Rates')}</h1>
                <p className="text-lg text-slate-600 mt-1 mb-4">{t('Set your own rate. The admin gives you orders at this rate.')}</p>
            </div>

            {summary}

            <div className="flex items-center gap-2.5 h-12 px-4 rounded-xl border border-slate-200 bg-white mb-4">
                <Search size={20} className="text-slate-400 shrink-0" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search product...')} className="flex-1 min-w-0 bg-transparent outline-none text-base" />
            </div>

            {!inventory.length ? (
                <div className="text-center py-14 px-4 rounded-2xl bg-white border border-slate-100">
                    <Package size={44} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-semibold text-slate-800">{t('No products assigned yet')}</p>
                    <p className="text-base text-slate-500 mt-1">{t('The admin adds the products you supply. Then you can set their rates here.')}</p>
                </div>
            ) : (
                <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
                    <div className="hidden lg:grid grid-cols-[minmax(0,1fr)_200px_140px] gap-4 px-5 h-12 items-center bg-slate-50 text-sm font-semibold text-slate-600">
                        <span>{t('Item')}</span><span>{t('Your rate')}</span><span className="text-right">{t('Available')}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {shown.map((item) => {
                            const v = valueOf(item);
                            const edited = draft[item.id] !== undefined && Number(draft[item.id] || 0) !== Number(item.rate || 0);
                            return (
                                <div key={item.id} className={cn('grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_200px_140px] gap-x-4 gap-y-2 items-center px-4 lg:px-5 py-3', !item.available && 'opacity-60')}>
                                    <span className="flex items-center gap-3 min-w-0">
                                        {item.image
                                            ? <img src={item.image} alt="" className="w-12 h-12 object-contain shrink-0" loading="lazy" />
                                            : <span className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><Package size={18} /></span>}
                                        <span className="min-w-0">
                                            <span className="block text-lg font-semibold text-slate-900 break-words">{t(item.name)}</span>
                                            <span className="block text-sm text-slate-500">{t(item.category)}</span>
                                            {!(Number(item.rate) > 0) && draft[item.id] === undefined && <span className="block text-xs font-semibold text-amber-700">{t('No rate yet')}</span>}
                                        </span>
                                    </span>
                                    <label className={cn('flex items-center h-12 rounded-xl border bg-white px-3 w-36 lg:w-full', edited ? 'border-green-600 ring-2 ring-green-100' : 'border-slate-200')}>
                                        <IndianRupee size={18} className="text-slate-500 shrink-0" />
                                        <input type="number" inputMode="decimal" min="0" step="any" value={v} placeholder="0"
                                            onChange={(e) => setDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                                            className="w-full min-w-0 text-lg font-bold text-slate-900 bg-transparent outline-none px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                            aria-label={`${item.name} rate`} />
                                        <span className="text-sm text-slate-500 whitespace-nowrap">/ {t(unitLabel(item.unit))}</span>
                                    </label>
                                    <span className="col-span-2 lg:col-span-1 flex lg:justify-end">
                                        <button type="button" onClick={() => toggleAvailability(item.id)}
                                            className={cn('inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold border',
                                                item.available ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200')}>
                                            {item.available ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                            {item.available ? t('Available') : t('Not available')}
                                        </button>
                                    </span>
                                </div>
                            );
                        })}
                        {!shown.length && <p className="text-center text-base text-slate-500 py-10">{t('No matching products')}</p>}
                    </div>
                </div>
            )}

            {inventory.length > 0 && (
                <div className="sticky bottom-[76px] lg:static mt-4 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent lg:bg-none flex lg:justify-end">
                    <button type="button" onClick={save} disabled={!changed.length || saving}
                        className="w-full lg:w-auto lg:px-10 flex items-center justify-center gap-3 h-16 rounded-2xl bg-green-700 text-white text-lg font-bold disabled:opacity-50">
                        {saving ? <Loader2 className="animate-spin" /> : <Tags size={24} />}
                        {t('Save Rates')}{changed.length ? ` (${changed.length})` : ''}
                    </button>
                </div>
            )}
        </div>
    );
}
