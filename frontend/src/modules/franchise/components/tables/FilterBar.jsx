import React from 'react';
import { cn } from '@/lib/utils';

export default function FilterBar({ actions, className }) {
    return (
        <div className={cn("bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm", className)}>
            {actions ? (
                actions
            ) : (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters</span>
                </div>
            )}
        </div>
    );
}
