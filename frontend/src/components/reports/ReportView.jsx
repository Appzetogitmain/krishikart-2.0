import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Download, RefreshCw, Loader2, CalendarDays, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { exportToCSV } from '@/lib/exportToCSV';
import { cn } from '@/lib/utils';

/**
 * Shared report screen used by every panel. `endpoint` returns the standard report shape
 * from the backend (kpis, chart, sections); `${endpoint}/export` returns the Excel file.
 */

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function presetRange(id) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    switch (id) {
        case 'today': return { from: dayKey(today), to: dayKey(today) };
        case 'yesterday': { const d = new Date(y, m, today.getDate() - 1); return { from: dayKey(d), to: dayKey(d) }; }
        case '7days': return { from: dayKey(new Date(y, m, today.getDate() - 6)), to: dayKey(today) };
        case 'month': return { from: dayKey(new Date(y, m, 1)), to: dayKey(today) };
        case 'lastMonth': return { from: dayKey(new Date(y, m - 1, 1)), to: dayKey(new Date(y, m, 0)) };
        case 'year': return { from: dayKey(new Date(y, 0, 1)), to: dayKey(today) };
        default: return null;
    }
}

const PRESETS = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'year', label: 'This Year' },
    { id: 'custom', label: 'Custom' },
];

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const formatValue = (value, format) => {
    if (value === null || value === undefined || value === '') return '—';
    if (format === 'currency') return `₹${inr.format(Number(value) || 0)}`;
    if (format === 'number') return inr.format(Number(value) || 0);
    if (format === 'date') {
        const [y, m, d] = String(value).split('-');
        return d ? `${d}-${m}-${y}` : value;
    }
    return String(value);
};
const shortDate = (k) => { const [, m, d] = String(k).split('-'); return d ? `${d}/${m}` : k; };

function ReportSection({ section }) {
    const [expanded, setExpanded] = useState(false);
    const LIMIT = 10;
    const rows = expanded ? section.rows : section.rows.slice(0, LIMIT);

    const download = () => {
        if (!section.rows.length) {
            toast.info('Nothing to download for this table');
            return;
        }
        exportToCSV(
            section.title.replace(/[^A-Za-z0-9]+/g, '_'),
            section.columns.map((c) => ({ header: c.label, key: c.key })),
            section.rows.map((r) => Object.fromEntries(section.columns.map((c) => [c.key, c.format === 'date' ? formatValue(r[c.key], 'date') : r[c.key]]))),
        );
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                    {section.description && <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>}
                </div>
                <button
                    onClick={download}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                    <Download size={13} /> Download
                </button>
            </div>
            {section.rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No data for this period.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {section.columns.map((c) => (
                                    <th
                                        key={c.key}
                                        className={cn(
                                            'px-4 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap',
                                            (c.format === 'currency' || c.format === 'number') && 'text-right'
                                        )}
                                    >
                                        {c.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50/60">
                                    {section.columns.map((c) => (
                                        <td
                                            key={c.key}
                                            className={cn(
                                                'px-4 py-2 text-slate-700 whitespace-nowrap',
                                                (c.format === 'currency' || c.format === 'number') && 'text-right tabular-nums',
                                                c.key === 'address' && 'whitespace-normal min-w-[220px]'
                                            )}
                                        >
                                            {formatValue(r[c.key], c.format)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {section.rows.length > LIMIT && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="w-full py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1"
                >
                    {expanded ? <>Show less <ChevronUp size={14} /></> : <>Show all {section.rows.length} rows <ChevronDown size={14} /></>}
                </button>
            )}
        </div>
    );
}

export default function ReportView({ endpoint, title, subtitle, defaultPreset = 'month' }) {
    const [preset, setPreset] = useState(defaultPreset);
    const [range, setRange] = useState(() => presetRange(defaultPreset));
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const today = dayKey(new Date());

    const load = useCallback(async () => {
        if (!range?.from || !range?.to) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.get(endpoint, { params: range });
            setReport(res.data.result);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not load the report. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [endpoint, range]);

    useEffect(() => { load(); }, [load]);

    const choosePreset = (id) => {
        setPreset(id);
        if (id !== 'custom') setRange(presetRange(id));
    };

    const setCustom = (field, value) => {
        if (!value) return;
        setRange((prev) => {
            const next = { ...prev, [field]: value > today ? today : value };
            if (next.from > next.to) {
                if (field === 'from') next.to = next.from; else next.from = next.to;
            }
            return next;
        });
    };

    const downloadExcel = async () => {
        setDownloading(true);
        try {
            const res = await api.get(`${endpoint}/export`, { params: range, responseType: 'blob' });
            const disposition = res.headers['content-disposition'] || '';
            const name = disposition.match(/filename="?([^"]+)"?/)?.[1] || `Kisaankart_Report_${range.from}_to_${range.to}.xlsx`;
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success('Report downloaded');
        } catch {
            toast.error('Could not download the report. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    const chart = report?.chart;
    const [barSeries, lineSeries] = chart?.series || [];
    const chartHasData = useMemo(
        () => (chart?.data || []).some((d) => (chart.series || []).some((s) => Number(d[s.key]) > 0)),
        [chart]
    );

    return (
        <div className="space-y-4">
            {/* Header + period */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{report?.title || title}</h1>
                        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                        {report?.period && (
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <CalendarDays size={13} /> {formatValue(report.period.from, 'date')} to {formatValue(report.period.to, 'date')}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={load}
                            disabled={loading}
                            className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Refresh
                        </button>
                        <button
                            onClick={downloadExcel}
                            disabled={downloading || loading || !report}
                            className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                            Download Excel
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {PRESETS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => choosePreset(p.id)}
                            className={cn(
                                'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                                preset === p.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {preset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1.5 text-slate-600 font-semibold">
                            From
                            <input type="date" value={range.from} max={today} onChange={(e) => setCustom('from', e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-slate-800" />
                        </label>
                        <label className="flex items-center gap-1.5 text-slate-600 font-semibold">
                            To
                            <input type="date" value={range.to} max={today} onChange={(e) => setCustom('to', e.target.value)} className="h-9 px-2 border border-slate-200 rounded-lg text-slate-800" />
                        </label>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-2xl p-4 flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button onClick={load} className="font-semibold underline shrink-0">Try again</button>
                </div>
            )}

            {loading && !report ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
                </div>
            ) : report && (
                <div className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                        {report.kpis.map((k) => (
                            <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-3.5">
                                <p className="text-xs text-slate-500 font-medium leading-snug">{k.label}</p>
                                <p className="text-lg md:text-xl font-bold text-slate-900 mt-1 tabular-nums break-words">{formatValue(k.value, k.format)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Trend chart */}
                    {chart && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-slate-900 mb-3">{chart.title}</h3>
                            {chartHasData ? (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chart.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={16} />
                                            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} width={60}
                                                tickFormatter={(v) => (barSeries?.format === 'currency' ? `₹${inr.format(v)}` : inr.format(v))} />
                                            {lineSeries && (
                                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} width={50}
                                                    tickFormatter={(v) => (lineSeries.format === 'currency' ? `₹${inr.format(v)}` : inr.format(v))} />
                                            )}
                                            <Tooltip
                                                labelFormatter={(l) => formatValue(l, 'date')}
                                                formatter={(value, name, item) => {
                                                    const s = chart.series.find((x) => x.key === item.dataKey);
                                                    return [formatValue(value, s?.format), s?.label || name];
                                                }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            {barSeries && <Bar yAxisId="left" dataKey={barSeries.key} name={barSeries.label} fill="#10b981" radius={[4, 4, 0, 0]} />}
                                            {lineSeries && (
                                                lineSeries.format === barSeries?.format
                                                    ? <Bar yAxisId="left" dataKey={lineSeries.key} name={lineSeries.label} fill="#6366f1" radius={[4, 4, 0, 0]} />
                                                    : <Line yAxisId="right" type="monotone" dataKey={lineSeries.key} name={lineSeries.label} stroke="#6366f1" strokeWidth={2} dot={false} />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <p className="py-10 text-center text-sm text-slate-400">No activity in this period.</p>
                            )}
                        </div>
                    )}

                    {/* Detailed tables */}
                    {report.sections.map((s) => <ReportSection key={s.id} section={s} />)}
                </div>
            )}
        </div>
    );
}
