import { CalendarDays, ChevronRight, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext';

/*
 * Shared look for the franchise portal (client mockups, Oct 2026): a page header with a green icon tile,
 * title and subtitle, today's date and the store; and coloured stat cards.
 */

export const todayLabel = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function FranchisePageHeader({ icon: Icon, title, subtitle, right, showDate = true }) {
    const { franchise } = useFranchiseAuth();
    return (
        <div className="flex flex-wrap items-center gap-4 px-4 lg:px-6 pt-5 pb-4">
            {Icon && (
                <span className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0">
                    <Icon size={28} />
                </span>
            )}
            <div className="min-w-[200px] flex-1">
                <h1 className="text-2xl lg:text-[28px] font-bold text-slate-900 leading-tight">{title}</h1>
                {subtitle && <p className="text-[15px] text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {right}
            {showDate && (
                <div className="hidden md:flex items-center gap-3 h-14 px-4 rounded-2xl border border-slate-200 bg-white">
                    <CalendarDays size={20} className="text-slate-600" />
                    <span className="text-[15px] font-semibold text-slate-900">{todayLabel()}</span>
                </div>
            )}
            <div className="hidden md:flex items-center gap-3 h-14 pl-2 pr-4 rounded-2xl border border-slate-200 bg-white">
                <span className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center overflow-hidden">
                    {franchise?.profilePicture ? <img src={franchise.profilePicture} alt="" className="w-full h-full object-cover" /> : <Store size={20} />}
                </span>
                <span className="leading-tight max-w-[180px]">
                    <span className="block text-[15px] font-bold text-slate-900 truncate">{franchise?.franchiseName || 'My Store'}</span>
                    <span className="block text-xs text-slate-500 truncate">{franchise?.city || 'Franchise Store'}</span>
                </span>
            </div>
        </div>
    );
}

const TONES = {
    blue: { bg: 'bg-blue-50/70', icon: 'bg-blue-100 text-blue-600', border: 'border-blue-100' },
    orange: { bg: 'bg-orange-50/70', icon: 'bg-orange-100 text-orange-500', border: 'border-orange-100' },
    purple: { bg: 'bg-violet-50/70', icon: 'bg-violet-100 text-violet-600', border: 'border-violet-100' },
    green: { bg: 'bg-green-50/70', icon: 'bg-green-600 text-white', border: 'border-green-100' },
    red: { bg: 'bg-rose-50/70', icon: 'bg-rose-100 text-rose-600', border: 'border-rose-100' },
};

/** Coloured stat card: icon tile, label, big number, small note. Clickable when onClick is given. */
export function StatTile({ tone = 'blue', icon: Icon, label, value, note, onClick, active }) {
    const t = TONES[tone] || TONES.blue;
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag type={onClick ? 'button' : undefined} onClick={onClick}
            className={cn('w-full flex items-center gap-3 sm:gap-4 rounded-2xl border p-3 sm:p-4 lg:p-5 text-left transition-shadow', t.bg, t.border, onClick && 'hover:shadow-md', active && 'ring-2 ring-green-600')}>
            {Icon && <span className={cn('w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-7 sm:[&>svg]:h-7', t.icon)}><Icon size={28} /></span>}
            <span className="flex-1 min-w-0">
                <span className="block text-[14px] sm:text-[15px] font-semibold text-slate-800 leading-snug">{label}</span>
                <span className="block text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tabular-nums">{value}</span>
                {note && <span className="hidden sm:block text-[13px] text-slate-500">{note}</span>}
            </span>
            {onClick && <ChevronRight size={20} className="hidden sm:block text-slate-400 shrink-0" />}
        </Tag>
    );
}

/** Pill-style tabs used across the franchise pages. tabs: [{ id, label, icon?, count? }] */
export function PillTabs({ tabs, active, onChange }) {
    return (
        <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
                <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
                    className={cn('inline-flex items-center gap-2 h-11 px-5 rounded-xl text-[15px] font-semibold transition-colors',
                        active === tab.id ? 'bg-green-700 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
                    {tab.icon && <tab.icon size={18} />}
                    {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
                </button>
            ))}
        </div>
    );
}
