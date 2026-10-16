import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollText, Search, Download, RefreshCw, Loader2, X, ChevronDown, ArrowRight, ShieldAlert, Activity,
    AlertTriangle, UserRound, Package, Tags, TicketPercent, Store, Tractor, Bike, ShoppingBag, Undo2,
    Boxes, Wallet, Settings, Users, KeyRound, Receipt, Truck, ClipboardCheck, Filter, History, Globe, Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

// Section → icon and colour
const MODULE_STYLE = {
    'Product Management': { icon: Package, tone: 'emerald' },
    'Categories': { icon: Tags, tone: 'teal' },
    'Coupons & Offers': { icon: TicketPercent, tone: 'pink' },
    'Franchise Management': { icon: Store, tone: 'blue' },
    'Franchise Stock': { icon: Boxes, tone: 'blue' },
    'Vendor Management': { icon: Tractor, tone: 'amber' },
    'Vendor Stock': { icon: Boxes, tone: 'amber' },
    'Delivery Partners': { icon: Bike, tone: 'violet' },
    'Orders': { icon: ShoppingBag, tone: 'sky' },
    'Returns': { icon: Undo2, tone: 'orange' },
    'Stock Requests': { icon: Truck, tone: 'cyan' },
    'Store Billing (POS)': { icon: Receipt, tone: 'lime' },
    'Customer Credit': { icon: Wallet, tone: 'rose' },
    'Cash Deposits': { icon: Wallet, tone: 'green' },
    'Payments & Payouts': { icon: Wallet, tone: 'green' },
    'Approvals': { icon: ClipboardCheck, tone: 'indigo' },
    'Settings': { icon: Settings, tone: 'slate' },
    'Team & Access': { icon: Users, tone: 'fuchsia' },
    'Sign-in & Security': { icon: KeyRound, tone: 'slate' },
    'City Rates': { icon: Tags, tone: 'emerald' },
};

const TONES = {
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    teal: 'bg-teal-50 text-teal-600 ring-teal-100',
    pink: 'bg-pink-50 text-pink-600 ring-pink-100',
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
    cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
    lime: 'bg-lime-50 text-lime-700 ring-lime-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    green: 'bg-green-50 text-green-600 ring-green-100',
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100',
};

const ROLE_TABS = [
    { key: 'all', label: 'Everyone' },
    { key: 'admin', label: 'Admin team' },
    { key: 'franchise', label: 'Franchises' },
    { key: 'vendor', label: 'Vendors' },
    { key: 'delivery', label: 'Delivery partners' },
];

const RANGES = [
    { key: 'today', label: 'Today', days: 0 },
    { key: '7d', label: 'Last 7 days', days: 6 },
    { key: '30d', label: 'Last 30 days', days: 29 },
];

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const istDaysAgo = (n) => new Date(Date.now() + 5.5 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

const timeOf = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const dayLabel = (key) => {
    if (key === istToday()) return 'Today';
    if (key === istDaysAgo(1)) return 'Yesterday';
    return new Date(`${key}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
};
const relative = (d) => {
    const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return null;
};

function useDebounced(value, ms = 350) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

function StatCard({ icon: Icon, label, value, hint, tone = 'slate', onClick, active }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                'text-left bg-white rounded-2xl border p-4 transition-all',
                onClick ? 'hover:border-slate-300 hover:shadow-sm active:scale-[0.99]' : 'cursor-default',
                active ? 'border-slate-900 ring-2 ring-slate-900/5' : 'border-slate-200'
            )}
        >
            <div className="flex items-center gap-2.5">
                <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1', TONES[tone])}>
                    <Icon size={17} />
                </span>
                <span className="text-[12px] font-semibold text-slate-500 leading-tight">{label}</span>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 tabular-nums">{value}</div>
            {hint && <div className="mt-0.5 text-[11px] text-slate-400 truncate">{hint}</div>}
        </button>
    );
}

function Severity({ value, outcome }) {
    if (outcome === 'failed') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">Failed</span>;
    if (outcome === 'denied') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 ring-1 ring-red-200">Blocked</span>;
    if (value === 'critical') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-200">High importance</span>;
    if (value === 'important') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">Important</span>;
    return null;
}

function ChangeRow({ change }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(120px,180px)_1fr] gap-x-4 gap-y-1 py-2 border-t border-slate-100 first:border-t-0">
            <div className="text-[12px] font-semibold text-slate-500">{change.field}</div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] min-w-0">
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 line-through decoration-rose-300 break-all">{change.from || 'Empty'}</span>
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold break-all">{change.to || 'Empty'}</span>
            </div>
        </div>
    );
}

function LogEntry({ log, onPerson, onRecord }) {
    const [open, setOpen] = useState(false);
    const style = MODULE_STYLE[log.module] || { icon: Activity, tone: 'slate' };
    const Icon = style.icon;
    const changes = log.changes || [];
    const details = log.details || [];
    const shownChanges = open ? changes : changes.slice(0, 4);
    const hasMore = changes.length > 4 || details.length > 0 || log.ip || log.device;
    const rel = relative(log.createdAt);

    return (
        <li className="relative pl-12 sm:pl-14">
            <span className={cn('absolute left-0 top-1 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ring-1 shadow-sm', TONES[style.tone])}>
                {log.outcome === 'denied' ? <ShieldAlert size={18} /> : <Icon size={18} />}
            </span>
            <div className={cn(
                'bg-white rounded-2xl border p-4 sm:p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]',
                log.outcome !== 'success' ? 'border-red-200' : log.severity === 'critical' ? 'border-rose-200' : 'border-slate-200'
            )}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[15px] font-bold text-slate-900 leading-snug">{log.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                        <Severity value={log.severity} outcome={log.outcome} />
                        <span className="text-[12px] text-slate-500 tabular-nums" title={new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}>
                            {timeOf(log.createdAt)}{rel ? ` · ${rel}` : ''}
                        </span>
                    </div>
                </div>
                <div className="mt-0.5 text-[12px] font-medium text-slate-400">{log.module}</div>

                <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <UserRound size={14} className="text-slate-400 shrink-0" />
                        <span className="text-slate-500">{log.module === 'Sign-in & Security' || log.outcome !== 'success' ? 'Done by:' : 'Changed by:'}</span>
                        {log.actorId ? (
                            <button type="button" onClick={() => onPerson(log)} className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline truncate" title="Show everything this person did">
                                {log.actorName || 'Unknown'}
                            </button>
                        ) : (
                            <span className="font-semibold text-slate-900 truncate">{log.actorName || 'Unknown'}</span>
                        )}
                        {log.actorRole && <span className="text-slate-500 shrink-0">({log.actorRole})</span>}
                    </div>
                    {log.targetLabel && (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-slate-500">{log.targetType || 'Record'}:</span>
                            {log.targetId ? (
                                <button type="button" onClick={() => onRecord(log)} className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline truncate" title="Show the full history of this record">
                                    {log.targetLabel}
                                </button>
                            ) : (
                                <span className="font-semibold text-slate-900 truncate">{log.targetLabel}</span>
                            )}
                        </div>
                    )}
                </div>

                {changes.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50/70 border border-slate-100 px-3 sm:px-4 py-1">
                        {shownChanges.map((c, i) => <ChangeRow key={`${c.field}-${i}`} change={c} />)}
                    </div>
                )}

                {log.outcome !== 'success' && log.message && (
                    <div className="mt-3 text-[12px] text-red-700 bg-red-50 rounded-lg px-3 py-2">{log.message}</div>
                )}

                {open && (
                    <div className="mt-3 space-y-3">
                        {details.length > 0 && (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                                {details.map((d, i) => (
                                    <div key={`${d.label}-${i}`} className="flex gap-2 min-w-0">
                                        <dt className="text-slate-500 shrink-0">{d.label}:</dt>
                                        <dd className="font-medium text-slate-800 break-words min-w-0">{d.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-slate-500">
                            {log.actorContact && <span className="flex items-center gap-1"><UserRound size={12} /> {log.actorContact}</span>}
                            {log.device && <span className="flex items-center gap-1"><Smartphone size={12} /> {log.device}</span>}
                            {log.ip && <span className="flex items-center gap-1"><Globe size={12} /> {log.ip}</span>}
                        </div>
                    </div>
                )}

                {hasMore && (
                    <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:text-emerald-800">
                        {open ? 'Show less' : changes.length > 4 ? `Show all ${changes.length} changes and details` : 'More details'}
                        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
                    </button>
                )}
            </div>
        </li>
    );
}

export default function AuditLogScreen() {
    const [summary, setSummary] = useState(null);
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [search, setSearch] = useState('');
    const [actorType, setActorType] = useState('all');
    const [moduleName, setModuleName] = useState('all');
    const [severity, setSeverity] = useState('all');
    const [outcome, setOutcome] = useState('all');
    const [range, setRange] = useState('7d');
    const [from, setFrom] = useState(istDaysAgo(6));
    const [to, setTo] = useState(istToday());
    const [person, setPerson] = useState(null); // { id, name }
    const [record, setRecord] = useState(null); // { id, label }
    const [showFilters, setShowFilters] = useState(false);

    const debouncedSearch = useDebounced(search);
    const requestId = useRef(0);

    const params = useMemo(() => {
        const p = { q: debouncedSearch || undefined, actorType, module: moduleName, severity, outcome, from, to };
        if (person) p.actorId = person.id;
        if (record) p.targetId = record.id;
        return p;
    }, [debouncedSearch, actorType, moduleName, severity, outcome, from, to, person, record]);

    const loadSummary = useCallback(async () => {
        try {
            const res = await api.get('/masteradmin/audit-logs/summary');
            setSummary(res.data.result);
        } catch { /* cards are optional */ }
    }, []);

    const load = useCallback(async (nextPage = 1) => {
        const id = ++requestId.current;
        nextPage === 1 ? setLoading(true) : setLoadingMore(true);
        try {
            const res = await api.get('/masteradmin/audit-logs', { params: { ...params, page: nextPage, limit: 30 } });
            if (id !== requestId.current) return;
            const r = res.data.result || {};
            setItems((prev) => (nextPage === 1 ? r.items || [] : [...prev, ...(r.items || [])]));
            setTotal(r.total || 0);
            setPage(r.page || nextPage);
            setPages(r.pages || 1);
        } catch (err) {
            if (id === requestId.current) toast.error(err.response?.data?.message || 'Could not load the activity log');
        } finally {
            if (id === requestId.current) { setLoading(false); setLoadingMore(false); }
        }
    }, [params]);

    useEffect(() => { load(1); }, [load]);
    useEffect(() => { loadSummary(); }, [loadSummary]);

    const pickRange = (key) => {
        const r = RANGES.find((x) => x.key === key);
        setRange(key);
        if (r) { setFrom(istDaysAgo(r.days)); setTo(istToday()); }
    };

    const clearAll = () => {
        setSearch(''); setActorType('all'); setModuleName('all'); setSeverity('all'); setOutcome('all');
        setPerson(null); setRecord(null); pickRange('7d');
    };

    const activeFilterCount = [actorType !== 'all', moduleName !== 'all', severity !== 'all', outcome !== 'all', !!person, !!record, !!debouncedSearch].filter(Boolean).length;

    const exportExcel = async () => {
        setExporting(true);
        try {
            const res = await api.get('/masteradmin/audit-logs/export', { params, responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kisaankart-activity-log-${from}-to-${to}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Could not download the activity log');
        } finally {
            setExporting(false);
        }
    };

    const grouped = useMemo(() => {
        const out = [];
        for (const log of items) {
            const key = dayKey(log.createdAt);
            const last = out[out.length - 1];
            if (last && last.key === key) last.logs.push(log);
            else out.push({ key, logs: [log] });
        }
        return out;
    }, [items]);

    const topPerson = summary?.mostActive24h?.[0];
    const retention = summary?.retentionDays || 30;

    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 shrink-0">
                            <ScrollText size={20} />
                        </span>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Activity Log</h1>
                            <p className="text-[13px] text-slate-500 mt-0.5 max-w-xl">
                                Who changed what, and when — across the admin team, franchises, vendors and delivery partners.
                                Entries are kept for {retention} days.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { load(1); loadSummary(); }} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50" aria-label="Refresh">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button type="button" onClick={exportExcel} disabled={exporting || !total} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50">
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Download Excel
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard icon={Activity} tone="emerald" label="Changes in last 24 hours" value={summary ? summary.last24h.toLocaleString('en-IN') : '–'}
                        onClick={() => { clearAll(); pickRange('today'); }} />
                    <StatCard icon={AlertTriangle} tone="rose" label="High-importance changes (24 h)" value={summary ? summary.critical24h : '–'}
                        hint="Deletions, credit, settings, team access"
                        active={severity === 'critical'} onClick={() => setSeverity(severity === 'critical' ? 'all' : 'critical')} />
                    <StatCard icon={ShieldAlert} tone="amber" label="Failed sign-ins & blocked attempts (24 h)" value={summary ? summary.problems24h : '–'}
                        active={outcome === 'problems'} onClick={() => setOutcome(outcome === 'problems' ? 'all' : 'problems')} />
                    <StatCard icon={UserRound} tone="blue" label="Most active today" value={topPerson ? topPerson.count : '–'}
                        hint={topPerson ? `${topPerson.name}${topPerson.role ? ` · ${topPerson.role}` : ''}` : 'No activity yet'}
                        active={!!person && topPerson && person.id === topPerson._id}
                        onClick={topPerson ? () => setPerson({ id: topPerson._id, name: topPerson.name }) : undefined} />
                </div>

                {/* Filters */}
                <div className="mt-5 bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 space-y-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search a product, person, order number, coupon…"
                                className="w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:bg-white focus:border-slate-400"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X size={16} /></button>
                            )}
                        </div>
                        <button type="button" onClick={() => setShowFilters((v) => !v)} className={cn('h-10 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2', showFilters ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                            <Filter size={15} /> <span className="hidden sm:inline">Filters</span>
                            {activeFilterCount > 0 && <span className={cn('min-w-5 h-5 px-1 rounded-full text-[11px] flex items-center justify-center', showFilters ? 'bg-white text-slate-900' : 'bg-emerald-600 text-white')}>{activeFilterCount}</span>}
                        </button>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                        {ROLE_TABS.map((t) => (
                            <button key={t.key} type="button" onClick={() => setActorType(t.key)}
                                className={cn('h-8 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors',
                                    actorType === t.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                                {t.label}
                                {t.key !== 'all' && summary?.byActorType?.[t.key] ? <span className="ml-1.5 opacity-70 tabular-nums">{summary.byActorType[t.key]}</span> : null}
                            </button>
                        ))}
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">Section</span>
                                <select value={moduleName} onChange={(e) => setModuleName(e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                                    <option value="all">All sections</option>
                                    {(summary?.modules || []).map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">Importance</span>
                                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                                    <option value="all">All</option>
                                    <option value="critical">High</option>
                                    <option value="important">Important</option>
                                    <option value="info">Normal</option>
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">From</span>
                                <input type="date" value={from} max={to} min={istDaysAgo(retention - 1)} onChange={(e) => { setFrom(e.target.value); setRange('custom'); }} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-semibold text-slate-500">To</span>
                                <input type="date" value={to} min={from} max={istToday()} onChange={(e) => { setTo(e.target.value); setRange('custom'); }} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                            </label>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                        {RANGES.map((r) => (
                            <button key={r.key} type="button" onClick={() => pickRange(r.key)}
                                className={cn('h-7 px-2.5 rounded-lg text-[12px] font-semibold border', range === r.key ? 'border-slate-900 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800')}>
                                {r.label}
                            </button>
                        ))}
                        {range === 'custom' && <span className="text-[12px] text-slate-500 ml-1">{from} → {to}</span>}

                        {person && (
                            <span className="ml-auto sm:ml-2 inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-lg bg-blue-50 text-blue-800 text-[12px] font-semibold">
                                <UserRound size={13} /> {person.name}
                                <button type="button" onClick={() => setPerson(null)} className="w-5 h-5 rounded hover:bg-blue-100 flex items-center justify-center" aria-label="Remove person filter"><X size={13} /></button>
                            </span>
                        )}
                        {record && (
                            <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-lg bg-emerald-50 text-emerald-800 text-[12px] font-semibold">
                                <History size={13} /> History of {record.label}
                                <button type="button" onClick={() => setRecord(null)} className="w-5 h-5 rounded hover:bg-emerald-100 flex items-center justify-center" aria-label="Remove record filter"><X size={13} /></button>
                            </span>
                        )}
                        {outcome === 'problems' && (
                            <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-lg bg-amber-50 text-amber-800 text-[12px] font-semibold">
                                Failed & blocked only
                                <button type="button" onClick={() => setOutcome('all')} className="w-5 h-5 rounded hover:bg-amber-100 flex items-center justify-center" aria-label="Remove filter"><X size={13} /></button>
                            </span>
                        )}
                        {activeFilterCount > 0 && (
                            <button type="button" onClick={clearAll} className="h-7 px-2 text-[12px] font-semibold text-slate-500 hover:text-slate-900 underline underline-offset-2">Clear all</button>
                        )}
                    </div>
                </div>

                {/* Results */}
                <div className="mt-5 flex items-center justify-between">
                    <p className="text-[13px] text-slate-500">
                        {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} ${total === 1 ? 'entry' : 'entries'}`}
                    </p>
                </div>

                {loading ? (
                    <div className="mt-3 space-y-3">
                        {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="mt-3 bg-white rounded-2xl border border-dashed border-slate-300 py-16 px-6 text-center">
                        <span className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center"><ScrollText size={22} /></span>
                        <p className="mt-3 font-bold text-slate-800">No activity found</p>
                        <p className="mt-1 text-[13px] text-slate-500">
                            {activeFilterCount > 0 ? 'Nothing matches these filters. Try a wider date range or clear the filters.' : 'Changes made from now on will appear here.'}
                        </p>
                        {activeFilterCount > 0 && <button type="button" onClick={clearAll} className="mt-4 h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold">Clear filters</button>}
                    </div>
                ) : (
                    <div className="mt-3 space-y-6">
                        {grouped.map((g) => (
                            <section key={g.key}>
                                <h2 className="sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-slate-50/95 backdrop-blur text-[12px] font-bold uppercase tracking-wider text-slate-500">
                                    {dayLabel(g.key)} <span className="font-semibold normal-case tracking-normal text-slate-400">· {g.logs.length}</span>
                                </h2>
                                <ol className="mt-2 space-y-3 relative before:absolute before:left-[17px] sm:before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                                    {g.logs.map((log) => (
                                        <LogEntry
                                            key={log._id}
                                            log={log}
                                            onPerson={(l) => { setPerson({ id: l.actorId, name: l.actorName }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                            onRecord={(l) => { setRecord({ id: l.targetId, label: l.targetLabel }); pickRange('30d'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                        />
                                    ))}
                                </ol>
                            </section>
                        ))}
                        {page < pages && (
                            <div className="flex justify-center pt-2">
                                <button type="button" onClick={() => load(page + 1)} disabled={loadingMore} className="h-10 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                    {loadingMore && <Loader2 size={15} className="animate-spin" />} Show older entries
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
