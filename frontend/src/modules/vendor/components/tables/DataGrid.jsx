import React from 'react';
import { cn } from '@/lib/utils';

const DataGrid = ({ columns, data, onRowClick, className }) => {
    return (
        <div className={cn("w-full overflow-x-auto no-scrollbar bg-white rounded-[32px] border border-slate-100 shadow-sm", className)}>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-slate-100">
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className={cn(
                                    "px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]",
                                    col.align === 'right' ? 'text-right' : ''
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.map((row, rowIdx) => (
                        <tr
                            key={rowIdx}
                            onClick={() => onRowClick && onRowClick(row)}
                            className={cn(
                                "transition-colors hover:bg-slate-50 cursor-pointer group",
                                onRowClick ? "active:scale-[0.99] transition-transform" : ""
                            )}
                        >
                            {columns.map((col, colIdx) => (
                                <td
                                    key={colIdx}
                                    className={cn(
                                        "px-6 py-5 text-[11px] font-bold text-slate-600",
                                        col.align === 'right' ? 'text-right' : '',
                                        col.className
                                    )}
                                >
                                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length === 0 && (
                <div className="py-20 text-center">
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No records found</p>
                </div>
            )}
        </div>
    );
};

export default DataGrid;
