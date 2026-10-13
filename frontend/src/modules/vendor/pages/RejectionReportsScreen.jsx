import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Info, RefreshCw, Archive, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import VendorBackBar from '../components/navigation/VendorBackBar';
import DataGrid from '../components/tables/DataGrid';

export default function RejectionReportsScreen() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [rejections, setRejections] = useState([]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/procurement/vendor/rejected-stock');
            if (res.data.success) {
                setRejections(res.data.results || res.data.result || []);
            }
        } catch (e) {
            console.error(e);
            setRejections([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const columns = [
        {
            header: 'Product Info',
            key: 'productName',
            render: (val, row) => (
                <div>
                    <p className="text-[11px] font-black text-slate-900 tracking-tight">{val}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Ref: #{row.requestRef}
                    </p>
                </div>
            ),
        },
        {
            header: 'Franchise',
            key: 'franchise',
            render: (val, row) => (
                <div>
                    <p className="text-[11px] font-bold text-slate-700">{val}</p>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight">{row.franchiseLocation}</p>
                </div>
            ),
        },
        {
            header: 'Quantity',
            key: 'rejectedQty',
            render: (val, row) => (
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded",
                            row.type === 'Rotten/Rejected' ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50"
                        )}>
                            {row.type === 'Rotten/Rejected' ? `Rejected: ${val}` : `Damaged: ${row.damagedQty}`} {row.unit}
                        </span>
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 tabular-nums">
                        Dispatched: {row.dispatchedQty} {row.unit}
                    </p>
                </div>
            ),
        },
        {
            header: 'Date',
            key: 'date',
            render: (val) => (
                <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                    {new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
            ),
        },
        {
            header: 'Type',
            key: 'type',
            render: (val) => (
                <span
                    className={cn(
                        'inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tight border',
                        val === 'Rotten/Rejected'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                    )}
                >
                    {val}
                </span>
            ),
        },
        {
            header: 'Action',
            key: 'requestId',
            align: 'right',
            render: (val) => (
                <button
                    onClick={() => navigate(`/vendor/orders/${val}`)}
                    className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
                >
                    <Info size={16} />
                </button>
            )
        }
    ];

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse pb-24">
                <div className="h-10 w-56 bg-slate-100 rounded-xl" />
                <div className="h-32 bg-slate-100 rounded-[28px]" />
                <div className="h-64 bg-slate-100 rounded-[32px]" />
            </div>
        );
    }

    const totalLogs = rejections.length;

    return (
        <div className="space-y-8 pb-24 px-1 sm:px-0">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                    <VendorBackBar className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-1">
                            Quality Control Report
                        </p>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Archive className="w-7 h-7 text-slate-800 shrink-0" />
                            Rejected Stock
                        </h1>
                        <p className="text-[11px] text-slate-500 mt-2 max-w-xl leading-relaxed">
                            Log of items rejected or marked as damaged by franchises during receiving. 
                            These rejections are subtracted from your final settlement.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => load()}
                    className="inline-flex items-center gap-2 self-start px-5 py-3 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </header>

            {rejections.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-[28px] bg-red-950 text-white flex items-center gap-4 border border-red-900/50"
                >
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/20">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-red-300/60 uppercase tracking-[0.2em]">
                            Current Summary
                        </p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-3xl font-black tabular-nums tracking-tight">
                                {totalLogs}
                            </span>
                            <span className="text-sm font-bold text-red-300/80">Rejection Logs</span>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
                        Detailed Log
                    </h2>
                </div>

                {rejections.length === 0 ? (
                    <div className="py-20 text-center rounded-[32px] border border-dashed border-slate-200 bg-white">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <ShoppingBag className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-600 font-bold text-sm">No rejections found</p>
                        <p className="text-[11px] text-slate-400 mt-2 max-w-md mx-auto">
                            Great! No items have been rejected or marked as damaged by franchises recently.
                        </p>
                    </div>
                ) : (
                    <DataGrid
                        columns={columns}
                        data={rejections}
                        className="border-none shadow-none bg-transparent"
                    />
                )}
            </div>
        </div>
    );
}
