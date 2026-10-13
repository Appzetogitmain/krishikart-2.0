import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
    Download,
    MoreHorizontal,
    ArrowUpDown,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DataTable({
    columns = [],
    data = [],
    title,
    subtitle,
    actions,
    onRowClick,
    selectable = false,
    pagination = true,
    pageSize = 10,
    density = 'comfortable', // compact, comfortable, spacious
    zebra = false
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState(null);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [currentDensity, setCurrentDensity] = useState(density);

    // Filtering
    const filteredData = data.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    // Sorting
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination
    const totalPages = Math.ceil(sortedData.length / pageSize);
    const paginatedData = pagination
        ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : sortedData;

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleSelectAll = () => {
        if (selectedRows.size === paginatedData.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(paginatedData.map((_, i) => i)));
        }
    };

    const toggleSelectRow = (index) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(index)) newSelected.delete(index);
        else newSelected.add(index);
        setSelectedRows(newSelected);
    };

    const densityPadding = {
        compact: 'py-2 px-3',
        comfortable: 'py-3.5 px-4',
        spacious: 'py-5 px-6'
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Table Header */}
            {(title || subtitle || actions) && (
                <div className="p-5 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        {title && <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>}
                        {subtitle && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.trim())}
                                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500 outline-none w-48 md:w-64 transition-all"
                            />
                        </div>
                        {actions}
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition-all">
                            <Download size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            {selectable && (
                                <th className="px-4 w-10">
                                    <div
                                        onClick={toggleSelectAll}
                                        className={cn(
                                            "w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all",
                                            selectedRows.size === paginatedData.length ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                                        )}
                                    >
                                        {selectedRows.size === paginatedData.length && <Check size={10} className="text-white" />}
                                    </div>
                                </th>
                            )}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        "text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors",
                                        densityPadding[currentDensity]
                                    )}
                                    onClick={() => col.sortable !== false && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {col.header}
                                        {col.sortable !== false && <ArrowUpDown size={10} className="text-slate-300" />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedData.length > 0 ? paginatedData.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                onClick={() => onRowClick?.(row)}
                                className={cn(
                                    "group transition-colors",
                                    onRowClick ? "cursor-pointer hover:bg-slate-50/80" : "hover:bg-slate-50/40",
                                    zebra && rowIndex % 2 !== 0 ? "bg-slate-25/30" : "bg-white",
                                    selectedRows.has(rowIndex) ? "bg-blue-50/30" : ""
                                )}
                            >
                                {selectable && (
                                    <td className="px-4" onClick={(e) => e.stopPropagation()}>
                                        <div
                                            onClick={() => toggleSelectRow(rowIndex)}
                                            className={cn(
                                                "w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all",
                                                selectedRows.has(rowIndex) ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                                            )}
                                        >
                                            {selectedRows.has(rowIndex) && <Check size={10} className="text-white" />}
                                        </div>
                                    </td>
                                )}
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={cn(
                                            "text-sm font-medium text-slate-700",
                                            densityPadding[currentDensity]
                                        )}
                                    >
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-20 text-center text-slate-400 text-sm italic">
                                    No data found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Table Footer / Pagination */}
            {pagination && (
                <div className="px-5 py-4 border-t border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-25/20">
                    <div className="flex items-center gap-4">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">
                            Showing <span className="text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * pageSize, filteredData.length)}</span> of <span className="text-slate-900">{filteredData.length}</span> entries
                        </p>
                        <div className="hidden md:flex items-center gap-2 ml-4">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Row size:</span>
                            <div className="flex items-center bg-white border border-slate-200 rounded p-0.5">
                                {['compact', 'comfortable', 'spacious'].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setCurrentDensity(d)}
                                        className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                                            currentDensity === d ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {d[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                        >
                            <ChevronsLeft size={14} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                        >
                            <ChevronLeft size={14} />
                        </button>

                        <div className="flex items-center gap-1 mx-2">
                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={cn(
                                            "w-7 h-7 rounded-md text-[11px] font-bold transition-all",
                                            currentPage === pageNum ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
                        >
                            <ChevronsRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
