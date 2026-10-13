import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Simple tab switcher for report pages that combine the new report with an existing screen. */
export default function ReportTabs({ tabs, initial = 0 }) {
    const [active, setActive] = useState(initial);
    const Current = tabs[active];
    return (
        <div className="space-y-4">
            <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 w-full md:w-fit overflow-x-auto">
                {tabs.map((t, i) => (
                    <button
                        key={t.label}
                        onClick={() => setActive(i)}
                        className={cn(
                            'flex-1 md:flex-none shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap',
                            i === active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div>{Current.render()}</div>
        </div>
    );
}
