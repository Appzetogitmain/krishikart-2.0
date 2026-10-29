import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    AlertTriangle,
    RefreshCw,
    Package,
    Coins,
    LayoutGrid,
    Leaf,
    Apple,
    Milk,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    PackageCheck,
    ChevronDown,
    X,
} from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { FranchisePageHeader, StatTile, HindiOnly } from '../components/layout/FranchisePageHeader';
import { hindiName, hindiCategory } from '../utils/hindiNames';
import { useFranchiseLanguage } from '../contexts/FranchiseLanguageContext';

/* Store stock, built to the client's mockup: counts, a low-stock warning, category chips and a table. */

const CAT_STYLE = [
    [/veg/i, Leaf, 'bg-green-50 text-green-700'],
    [/fruit/i, Apple, 'bg-rose-50 text-rose-600'],
    [/dairy|milk/i, Milk, 'bg-blue-50 text-blue-600'],
];
const catStyle = (name) => {
    const hit = CAT_STYLE.find(([re]) => re.test(name || ''));
    return hit ? { Icon: hit[1], cls: hit[2] } : { Icon: Package, cls: 'bg-slate-100 text-slate-600' };
};
const qty = (v) => Math.round((Number(v) || 0) * 100) / 100;

export default function InventoryScreen() {
    const { lang } = useFranchiseLanguage();
    const showHindi = lang === 'hi'; // Hindi product names only in Hindi; other languages translate the English name
    const navigate = useNavigate();
    const { inventory, categories, getStockStats, loading: inventoryLoading, refreshInventory } = useInventory();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [lowOnly, setLowOnly] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    // Latest deliveries from vendors and what happened to their stock
    const [receipts, setReceipts] = useState([]);
    const [showReceipts, setShowReceipts] = useState(false);

    const loadReceipts = async () => {
        try {
            const res = await api.get('/procurement/franchise/my-requests');
            const list = (res.data?.results || res.data?.result || [])
                .filter((r) => r.receiptSummary?.at)
                .sort((a, b) => new Date(b.receiptSummary.at) - new Date(a.receiptSummary.at))
                .slice(0, 5);
            setReceipts(list);
        } catch {
            setReceipts([]);
        }
    };

    useEffect(() => {
        loadReceipts();
    }, []);

    // Reloads the real stock from the server
    const handleRefresh = async () => {
        setIsResetting(true);
        try {
            await Promise.all([refreshInventory(), loadReceipts()]);
        } finally {
            setIsResetting(false);
        }
    };

    const stats = getStockStats();
    const isLow = (item) => item.currentStock <= item.mbq;

    const filteredItems = inventory.filter(item => {
        const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
        // Match the name (English or Hindi) or the item code
        const term = searchQuery.trim().toLowerCase();
        const matchesSearch = !term ||
            (item.name || '').toLowerCase().includes(term) ||
            hindiName(item.name).includes(term) ||
            String(item.id || '').toLowerCase().includes(term.replace(/^#/, ''));
        return matchesCategory && matchesSearch && (!lowOnly || isLow(item));
    }).sort((a, b) => (lowOnly ? a.currentStock - b.currentStock : 0));

    const addStock = (item) => navigate('/franchise/procurement', { state: item ? { addProductId: String(item.productId || item.id) } : undefined });

    if (inventoryLoading && inventory.length === 0) {
        return (
            <div className="p-4 lg:p-6 space-y-4 animate-pulse bg-[#f6f8f7] min-h-screen">
                <div className="h-14 w-72 bg-slate-200 rounded-2xl" />
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-2xl" />)}</div>
                <div className="h-[400px] bg-white rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-24 lg:pb-8">
            <FranchisePageHeader
                icon={Package}
                title="स्टॉक / Stock"
                subtitle="अपने स्टोर में मौजूद सभी सामान का स्टॉक देखें और ज़रूरत पड़ने पर नया स्टॉक जोड़ें।"
                showDate={false}
                right={
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} disabled={isResetting}
                            className="h-14 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50">
                            <RefreshCw size={20} className={cn(isResetting && 'animate-spin')} />
                            <span className="leading-tight text-left"><span className="block text-[14px] font-semibold">रिफ्रेश</span><HindiOnly className="block text-[12px] text-slate-500">Refresh</HindiOnly></span>
                        </button>
                        <button onClick={() => addStock(null)}
                            className="h-14 px-5 rounded-2xl bg-green-700 text-white flex items-center gap-2 hover:bg-green-800">
                            <Plus size={22} />
                            <span className="leading-tight text-left"><span className="block text-[15px] font-bold">स्टॉक जोड़ें</span><HindiOnly className="block text-[13px]">Add Stock</HindiOnly></span>
                        </button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 px-4 lg:px-6">
                <StatTile tone="red" icon={AlertTriangle} label="कम स्टॉक" value={`${stats.lowStockCount} सामान`} note="दोबारा मंगवाएँ" onClick={() => setLowOnly(true)} active={lowOnly} />
                <StatTile tone="green" icon={Package} label="कुल सामान" value={`${stats.totalItems} सामान`} note="आपके स्टोर में मौजूद" onClick={() => setLowOnly(false)} active={!lowOnly && activeCategory === 'All'} />
                <StatTile tone="blue" icon={Coins} label="स्टॉक की कुल कीमत" value={`₹ ${Math.round(stats.totalValue || 0).toLocaleString('en-IN')}`} note="लगभग (वर्तमान रेट के अनुसार)" />
                <div className="hidden xl:flex items-center justify-between rounded-2xl bg-gradient-to-r from-green-50 to-lime-50 border border-green-100 p-4">
                    <p className="text-lg font-bold text-green-800 leading-snug">ताज़ा स्टॉक<br />खुश ग्राहक<br />मज़बूत कारोबार</p>
                    <span className="text-5xl" aria-hidden>🥕🍅</span>
                </div>
            </div>

            {stats.lowStockCount > 0 && (
                <div className="px-4 lg:px-6 mt-4">
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-orange-50 border border-orange-100 p-4">
                        <AlertTriangle size={30} className="text-orange-500 shrink-0" />
                        <div className="flex-1 min-w-[220px]">
                            <p className="text-[17px] font-bold text-orange-700">इन सामानों का स्टॉक कम है — दोबारा मंगवाएँ</p>
                            <p className="text-[14px] text-slate-600">नीचे दिए गए सामानों का स्टॉक कम है या खत्म हो गया है। समय पर स्टॉक मंगवाकर अपने स्टोर को चालू रखें।</p>
                        </div>
                        <button onClick={() => setLowOnly((v) => !v)}
                            className="h-12 px-5 rounded-xl bg-orange-500 text-white text-[15px] font-bold flex items-center gap-2 hover:bg-orange-600">
                            {lowOnly ? 'सभी सामान देखें' : 'कम स्टॉक वाले सामान देखें'} <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {receipts.length > 0 && (
                <div className="px-4 lg:px-6 mt-4">
                    <div className="bg-white rounded-2xl border border-slate-100">
                        <button type="button" onClick={() => setShowReceipts((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                            <PackageCheck size={22} className="text-green-700" />
                            <span className="flex-1 text-[15px] font-semibold text-slate-900">हाल में वेंडर से आया माल <HindiOnly className="text-slate-500 font-normal">(Recently received)</HindiOnly></span>
                            <ChevronDown size={20} className={cn('text-slate-400 transition-transform', showReceipts && 'rotate-180')} />
                        </button>
                        {showReceipts && (
                            <ul className="px-4 pb-4 space-y-2">
                                {receipts.map((r) => {
                                    const s = r.receiptSummary;
                                    const lines = (s.lines || []).filter((l) => l.added > 0 || l.received > 0 || l.rejected);
                                    return (
                                        <li key={r._id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 text-[14px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                                            <div className="space-y-0.5">
                                                {lines.map((l, i) => (
                                                    <p key={i}>
                                                        <span className="font-bold text-slate-900">{l.name}</span>{': '}
                                                        {l.rejected
                                                            ? 'rejected, not added to stock'
                                                            : <><span className="font-bold text-green-700">+{l.added} {l.unit} added to stock</span>
                                                                {l.damaged > 0 && <span className="text-amber-700">, {l.damaged} damaged</span>}
                                                                {l.usedForOrder > 0 && <span>, <b>{l.usedForOrder} {l.unit}</b> used right away to pack customer order <b>#{String(s.orderId || '').slice(-6).toUpperCase()}</b></span>}</>}
                                                    </p>
                                                ))}
                                            </div>
                                            <span className="text-[13px] text-slate-400 shrink-0 tabular-nums">
                                                {new Date(s.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                            </span>
                                        </li>
                                    );
                                })}
                                <li className="text-[13px] text-slate-400">Stock that arrives for a waiting customer order is used for that order straight away, so the number here can show 0.</li>
                            </ul>
                        )}
                    </div>
                </div>
            )}

            <div className="px-4 lg:px-6 mt-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="search"
                        placeholder="सब्जी या सामान खोजें... (जैसे टमाटर, आलू, दूध, सेब...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-10 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-green-600"
                    />
                    {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X size={18} /></button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {['All', ...categories].map((cat) => {
                        const { Icon, cls } = cat === 'All' ? { Icon: LayoutGrid } : catStyle(cat);
                        const active = activeCategory === cat;
                        return (
                            <button key={cat} onClick={() => setActiveCategory(cat)}
                                className={cn('h-12 px-4 rounded-xl border text-[15px] font-semibold flex items-center gap-2 transition-colors',
                                    active ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')}>
                                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', active ? 'bg-white/15' : cls)}><Icon size={16} /></span>
                                {cat === 'All' ? 'सभी' : ((showHindi && hindiCategory(cat)) || cat)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="px-4 lg:px-6 mt-4">
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[15px] min-w-[900px]">
                            <thead>
                                <tr className="bg-green-50/60 text-[13px] font-semibold text-slate-600 text-left">
                                    <th className="px-4 py-3 w-12">#</th>
                                    <th className="px-4 py-3">उत्पाद (Product)</th>
                                    <th className="px-4 py-3">श्रेणी (Category)</th>
                                    <th className="px-4 py-3">वर्तमान स्टॉक<HindiOnly className="block">(Current Stock)</HindiOnly></th>
                                    <th className="px-4 py-3">स्थिति (Status)</th>
                                    <th className="px-4 py-3">प्रति इकाई कीमत<HindiOnly className="block">(Rate per Unit)</HindiOnly></th>
                                    <th className="px-4 py-3">कुल कीमत<HindiOnly className="block">(Total Value)</HindiOnly></th>
                                    <th className="px-4 py-3 text-center">कार्य (Action)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredItems.map((item, idx) => {
                                    const out = item.currentStock <= 0;
                                    const low = !out && isLow(item);
                                    const { Icon, cls } = catStyle(item.category);
                                    const hi = showHindi ? hindiName(item.name) : '';
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3 text-slate-500 tabular-nums">{idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-3">
                                                    {item.image
                                                        ? <img src={item.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-50 shrink-0" loading="lazy" />
                                                        : <span className="w-14 h-14 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><Package size={22} /></span>}
                                                    <span className="min-w-0">
                                                        <span className="block font-bold text-slate-900">{hi || item.name}</span>
                                                        {hi && <span translate="no" className="block text-[13px] text-slate-500">{item.name}</span>}
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold', cls)}>
                                                    <Icon size={15} /> {(showHindi && hindiCategory(item.category)) || item.category}
                                                </span>
                                            </td>
                                            <td className={cn('px-4 py-3 font-bold tabular-nums whitespace-nowrap', out ? 'text-slate-900' : low ? 'text-orange-600' : 'text-green-700')}>
                                                {qty(item.currentStock)} {item.unit}
                                            </td>
                                            <td className="px-4 py-3">
                                                {out
                                                    ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[13px] font-semibold"><AlertCircle size={16} /> स्टॉक खत्म</span>
                                                    : low
                                                        ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-[13px] font-semibold"><AlertCircle size={16} /> कम है</span>
                                                        : <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-[13px] font-semibold"><CheckCircle2 size={16} /> पर्याप्त</span>}
                                            </td>
                                            <td className="px-4 py-3 tabular-nums whitespace-nowrap">₹ {Number(item.price || 0).toLocaleString('en-IN')} <span className="text-slate-500">/ {item.unit}</span></td>
                                            <td className="px-4 py-3 font-bold tabular-nums whitespace-nowrap">₹ {Math.round(item.currentStock * (item.price || 0)).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => addStock(item)}
                                                    className={cn('h-11 px-4 rounded-xl text-[14px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap',
                                                        out || low ? 'bg-green-700 text-white hover:bg-green-800' : 'border border-green-700 text-green-800 bg-white hover:bg-green-50')}>
                                                    <Plus size={18} /> स्टॉक जोड़ें
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredItems.length === 0 && (
                                    <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                                        {searchQuery.trim() ? `"${searchQuery.trim()}" के लिए कोई सामान नहीं मिला` : 'कोई सामान नहीं'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
