import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendorLanguage } from '../contexts/VendorLanguageContext';
import { formatDay } from './layout/VendorPageHeader';

export const DATE_PRESETS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All dates' },
];

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const dayInput = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

export function dateRange({ mode, day }) {
    const today = startOfDay(new Date());
    const DAY = 86400000;
    if (mode === 'today') return [today, new Date(+today + DAY)];
    if (mode === 'yesterday') return [new Date(+today - DAY), today];
    if (mode === '7d') return [new Date(+today - 6 * DAY), new Date(+today + DAY)];
    if (mode === '30d') return [new Date(+today - 29 * DAY), new Date(+today + DAY)];
    if (mode === 'day' && day) { const s = startOfDay(new Date(`${day}T00:00:00`)); return [s, new Date(+s + DAY)]; }
    return null;
}

/** Date filter: presets (today, yesterday, 7/30 days, all) or one picked day. */
export default function DatePicker({ value, onChange, desktop }) {
    const { t, locale } = useVendorLanguage();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const label = value.mode === 'day' && value.day
        ? formatDay(new Date(`${value.day}T00:00:00`), locale)
        : value.mode === 'today'
            ? `${formatDay(new Date(), locale)} (${t('Today')})`
            : t(DATE_PRESETS.find((p) => p.value === value.mode)?.label || 'All dates');

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)}
                className={cn('w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white text-left', desktop ? 'h-16 px-4 min-w-[230px]' : 'h-14 px-4')}>
                <CalendarDays size={22} className="text-slate-700 shrink-0" />
                <span className="flex-1 min-w-0">
                    {desktop && <span className="block text-xs text-slate-500">{t('Select Date')}</span>}
                    <span className="block text-base lg:text-lg font-semibold text-slate-900 truncate">{label}</span>
                </span>
                <ChevronDown size={20} className="text-slate-500 shrink-0" />
            </button>
            {open && (
                <div className="absolute z-30 mt-2 left-0 right-0 lg:right-auto lg:w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2">
                    {DATE_PRESETS.map((p) => (
                        <button key={p.value} type="button" onClick={() => { onChange({ mode: p.value, day: '' }); setOpen(false); }}
                            className={cn('w-full text-left px-4 py-3 rounded-xl text-base', value.mode === p.value ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-800 hover:bg-slate-50')}>
                            {t(p.label)}
                        </button>
                    ))}
                    <div className="border-t border-slate-100 mt-1 pt-2 px-2 pb-1">
                        <p className="text-sm text-slate-500 mb-1">{t('Pick a day')}</p>
                        <input type="date" max={dayInput(new Date())} value={value.mode === 'day' ? value.day : ''}
                            onChange={(e) => { if (e.target.value) { onChange({ mode: 'day', day: e.target.value }); setOpen(false); } }}
                            className="w-full h-11 px-3 rounded-xl border border-slate-200 text-base" />
                    </div>
                </div>
            )}
        </div>
    );
}
