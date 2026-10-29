import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, ListChecks, MapPin, Package,
    ShieldCheck, Store, Sun, Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { useFranchiseLanguage } from '../contexts/FranchiseLanguageContext';
import { StatTile } from '../components/layout/FranchisePageHeader';

/*
 * Franchise Home, built to the client's mockup: today's counts, today's orders, and the three daily jobs.
 * Text is in Hindi like the mockup; numbers and names stay as they are.
 */

const NEW = ['placed', 'pending', 'new', 'assigned'];
const TO_PACK = ['accepted', 'procuring'];
const ON_THE_WAY = ['dispatched', 'out for delivery'];
const DONE = ['delivered', 'received', 'completed'];

const STATUS = {
    new: { label: 'नया ऑर्डर', cls: 'bg-orange-50 text-orange-600' },
    pack: { label: 'तैयार करना है', cls: 'bg-amber-50 text-amber-700' },
    ready: { label: 'तैयार है', cls: 'bg-yellow-50 text-yellow-700' },
    way: { label: 'रास्ते में', cls: 'bg-violet-50 text-violet-700' },
    done: { label: 'डिलीवर हो गया', cls: 'bg-green-50 text-green-700' },
    cancelled: { label: 'रद्द हुआ', cls: 'bg-rose-50 text-rose-600' },
};
const statusOf = (s) => (NEW.includes(s) ? STATUS.new : TO_PACK.includes(s) ? STATUS.pack : ['packed', 'ready'].includes(s) ? STATUS.ready
    : ON_THE_WAY.includes(s) ? STATUS.way : DONE.includes(s) ? STATUS.done : s === 'cancelled' ? STATUS.cancelled : { label: s, cls: 'bg-slate-100 text-slate-600' });

const dayKey = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const hiDate = (d) => new Date(d).toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const dayLabel = (d, locale) => new Date(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
// The order's day: its delivery date for advance orders, else when it was placed
const orderDay = (o) => o.scheduledDate || o.createdAt;

function Thumb({ src }) {
    return src
        ? <img src={src} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-50" loading="lazy" />
        : <span className="w-14 h-14 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0"><Package size={24} /></span>;
}

export default function DashboardScreen() {
    const navigate = useNavigate();
    const { franchise } = useFranchiseAuth();
    const { orders } = useFranchiseOrders();
    const { locale } = useFranchiseLanguage();
    const [showKYCModal, setShowKYCModal] = useState(false);
    const [day, setDay] = useState(dayKey(new Date()));

    useEffect(() => {
        if (franchise && !franchise.isVerified) setShowKYCModal(true);
    }, [franchise]);

    const today = dayKey(new Date());
    const count = useMemo(() => ({
        new: orders.filter((o) => NEW.includes(o.status)).length,
        pack: orders.filter((o) => TO_PACK.includes(o.status)).length,
        way: orders.filter((o) => ON_THE_WAY.includes(o.status)).length,
        doneToday: orders.filter((o) => DONE.includes(o.status) && dayKey(orderDay(o)) === today).length,
    }), [orders, today]);

    const dayOrders = useMemo(() => orders
        .filter((o) => dayKey(orderDay(o)) === day)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [orders, day]);

    const tasks = [
        { n: 1, tone: 'bg-blue-600', iconTone: 'bg-blue-50 text-blue-600', icon: FileText, title: 'नए ऑर्डर देखें', text: 'आज मिले नए होटल ऑर्डर चेक करें और तैयारी शुरू करें', go: '/franchise/orders' },
        { n: 2, tone: 'bg-amber-500', iconTone: 'bg-amber-50 text-amber-500', icon: Package, title: 'सामान और स्टॉक चेक करें', text: 'स्टॉक देखें और कमी होने पर वेंडर को भेजें', go: '/franchise/inventory' },
        { n: 3, tone: 'bg-violet-600', iconTone: 'bg-violet-50 text-violet-600', icon: Truck, title: 'डिलीवरी की स्थिति देखें', text: 'तैयार और डिलीवर हुए ऑर्डर की स्थिति चेक करें', go: '/franchise/dispatch' },
    ];

    return (
        <div className="min-h-full bg-[#f6f8f7] pb-24 lg:pb-8">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-4 px-4 lg:px-6 pt-5 pb-4">
                <Sun size={44} className="text-amber-400 shrink-0" />
                <div className="flex-1 min-w-[220px]">
                    <h1 className="text-2xl lg:text-[30px] font-bold text-slate-900 leading-tight">नमस्ते! आज का काम</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="text-[15px] text-slate-500">{dayLabel(new Date(), locale)}</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
                            <CheckCircle2 size={16} className="text-green-600" /> आज के ऑर्डर समय पर पूरा करें
                        </span>
                    </div>
                </div>
                <button type="button" onClick={() => navigate('/franchise/orders')} className="relative w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center" aria-label="New orders">
                    <Bell size={22} className="text-slate-700" />
                    {count.new > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">{count.new}</span>}
                </button>
                <div className="hidden md:flex items-center gap-3 h-14 pl-2 pr-4 rounded-2xl border border-slate-200 bg-white">
                    <span className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center overflow-hidden">
                        {franchise?.profilePicture ? <img src={franchise.profilePicture} alt="" className="w-full h-full object-cover" /> : <Store size={20} />}
                    </span>
                    <span className="leading-tight max-w-[180px]">
                        <span translate="no" className="block text-[15px] font-bold text-slate-900 truncate">{franchise?.franchiseName || 'My Store'}</span>
                        <span className="block text-xs text-slate-500 truncate">{franchise?.city || ''}</span>
                    </span>
                </div>
            </div>

            {/* Today's counts */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4 px-4 lg:px-6">
                <StatTile tone="blue" icon={FileText} label="नए ऑर्डर" value={count.new} note="आज मिले नए ऑर्डर" onClick={() => navigate('/franchise/orders')} />
                <StatTile tone="orange" icon={Package} label="तैयार करने हैं" value={count.pack} note="पैकिंग के लिए तैयार करें" onClick={() => navigate('/franchise/orders')} />
                <StatTile tone="purple" icon={Truck} label="डिलीवरी में" value={count.way} note="रास्ते में हैं" onClick={() => navigate('/franchise/dispatch')} />
                <StatTile tone="green" icon={CheckCircle2} label="पूरे हुए" value={count.doneToday} note="आज डिलीवर हो गए" onClick={() => navigate('/franchise/orders')} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-5 px-4 lg:px-6 mt-5">
                {/* Today's orders */}
                <div className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5">
                    <div className="flex flex-wrap items-start gap-3 mb-4">
                        <ListChecks size={28} className="text-slate-700 mt-1" />
                        <div className="flex-1 min-w-[180px]">
                            <h2 className="text-xl lg:text-2xl font-bold text-slate-900">आज के ऑर्डर</h2>
                            <p className="text-[15px] text-slate-500">आज मिले सभी होटल ऑर्डर की सूची</p>
                        </div>
                        <label className="flex items-center gap-2 h-12 px-3 rounded-xl border border-slate-200 bg-white">
                            <CalendarDays size={18} className="text-slate-600" />
                            <input type="date" value={day} onChange={(e) => setDay(e.target.value || today)}
                                className="text-[15px] font-semibold text-slate-900 bg-transparent outline-none" aria-label="Date" />
                        </label>
                    </div>
                    <div className="space-y-3">
                        {!dayOrders.length && (
                            <div className="text-center py-14 text-slate-500">
                                <Package size={40} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-[15px]">{`${hiDate(day)} को कोई ऑर्डर नहीं`}</p>
                            </div>
                        )}
                        {dayOrders.slice(0, 8).map((o) => {
                            const st = statusOf(o.status);
                            return (
                                <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3 hover:shadow-sm transition-shadow 2xl:grid 2xl:grid-cols-[56px_minmax(150px,1fr)_112px_96px_auto_auto]">
                                    <Thumb src={o.items?.[0]?.image} />
                                    <div className="min-w-[150px] flex-1 2xl:min-w-0">
                                        <p className="text-[15px] font-bold text-slate-900 whitespace-nowrap">ऑर्डर #{String(o.id).slice(-4).toUpperCase()}</p>
                                        <p translate="no" className="text-[15px] text-slate-700 truncate">{o.hotelName}</p>
                                        {o.city && <p className="text-[13px] text-slate-500 flex items-center gap-1"><MapPin size={13} /> {o.city}</p>}
                                    </div>
                                    <div className="min-w-[104px]">
                                        <p className="text-[12px] text-slate-500">डिलीवरी समय</p>
                                        <p className="text-[15px] font-bold text-slate-900 whitespace-nowrap">{o.deliverySlot}</p>
                                        <p className="text-[13px] text-slate-500 flex items-center gap-1"><Clock size={13} /> {new Date(orderDay(o)).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</p>
                                    </div>
                                    <div className="min-w-[84px]">
                                        <p className="text-[12px] text-slate-500">कुल राशि</p>
                                        <p className="text-[15px] font-bold text-slate-900 tabular-nums">₹ {Number(o.total || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <span className={cn('px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-center', st.cls)}>{st.label}</span>
                                    <button type="button" onClick={() => navigate(`/franchise/orders/${o.id}`)}
                                        className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-green-700 text-white text-[15px] font-semibold hover:bg-green-800 whitespace-nowrap">
                                        ऑर्डर देखें <ArrowRight size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <button type="button" onClick={() => navigate('/franchise/orders')}
                        className="mt-4 w-full h-14 rounded-2xl bg-green-50 text-green-800 text-[17px] font-bold flex items-center justify-center gap-2 hover:bg-green-100">
                        सभी ऑर्डर देखें <ArrowRight size={20} />
                    </button>
                </div>

                {/* Daily jobs */}
                <div className="space-y-4">
                    <div className="bg-green-50/60 rounded-3xl border border-green-100 p-4 lg:p-5">
                        <div className="flex items-start gap-3 mb-4">
                            <span className="w-11 h-11 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0"><CheckCircle2 size={24} /></span>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">आज के जरूरी काम</h2>
                                <p className="text-[14px] text-slate-600">दिन का काम जल्दी और आसान तरीके से पूरा करें</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {tasks.map((t) => (
                                <button key={t.n} type="button" onClick={() => navigate(t.go)}
                                    className="w-full flex items-center gap-3 rounded-2xl bg-white p-3 text-left hover:shadow-sm transition-shadow">
                                    <span className={cn('w-9 h-9 rounded-full text-white text-base font-bold flex items-center justify-center shrink-0', t.tone)}>{t.n}</span>
                                    <span className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', t.iconTone)}><t.icon size={22} /></span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[16px] font-bold text-slate-900">{t.title}</span>
                                        <span className="block text-[13px] text-slate-600 leading-snug">{t.text}</span>
                                    </span>
                                    <ChevronRight size={20} className="text-slate-400 shrink-0" />
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => navigate('/franchise/orders')}
                            className="mt-4 w-full h-14 rounded-2xl bg-green-700 text-white text-[17px] font-bold flex items-center justify-center gap-2 hover:bg-green-800">
                            नए ऑर्डर देखें <ArrowRight size={20} />
                        </button>
                    </div>
                    <div className="rounded-3xl bg-gradient-to-r from-green-50 to-lime-50 border border-green-100 p-5 flex items-center justify-between gap-3">
                        <p className="text-xl font-bold text-slate-800 leading-snug">ताजा माल, खुश ग्राहक<br />मजबूत कारोबार</p>
                        <span className="text-5xl" aria-hidden>🥦🍅</span>
                    </div>
                </div>
            </div>

            {/* Account not verified yet */}
            <AnimatePresence>
                {showKYCModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 p-8 text-center space-y-5">
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto"><ShieldCheck size={40} className="text-amber-500" /></div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Account verification required</h3>
                                <p className="text-[15px] text-slate-600 mt-2">Your franchise account is not verified yet. Please upload your documents so you can start receiving orders and payments.</p>
                            </div>
                            <button type="button" onClick={() => navigate('/franchise/documentation')} className="w-full h-14 rounded-2xl bg-green-700 text-white text-[16px] font-bold">Go to Documentation</button>
                            <button type="button" onClick={() => setShowKYCModal(false)} className="w-full text-[15px] font-semibold text-slate-500">I'll do it later</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
