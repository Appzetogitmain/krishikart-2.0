import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Simple pager used under admin list tables.
 * Works for both server-side (pass totalItems from the API) and client-side lists.
 */
export default function TablePagination({ page, pageSize, totalItems, onPageChange, className }) {
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / pageSize));
    if (!totalItems || totalItems <= pageSize) return null;

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalItems);

    // Show up to 5 page numbers around the current page
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

    return (
        <div className={cn("px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap", className)}>
            <span className="text-[11px] font-semibold text-slate-500">
                Showing {from}–{to} of {totalItems}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Previous page"
                >
                    <ChevronLeft size={14} />
                </button>
                {pages.map(p => (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={cn(
                            "h-8 min-w-8 px-2 rounded-md text-[11px] font-bold border",
                            p === page ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        {p}
                    </button>
                ))}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Next page"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
