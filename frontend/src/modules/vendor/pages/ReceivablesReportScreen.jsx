import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, FileText, Truck, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import VendorBackBar from '../components/navigation/VendorBackBar';
import DataGrid from '../components/tables/DataGrid';

function formatStatus(status) {
    const map = {
        ready_for_pickup: 'Ready for pickup',
        completed: 'Completed',
    };
    return map[status] || status?.replace(/_/g, ' ') || '—';
}

export default function ReceivablesReportScreen() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [rows, setRows] = useState([]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/procurement/vendor/receivables-report');
            if (res.data.success) {
                const data = res.data.result || res.data.results || {};
                setSummary(data.summary || null);
                setRows(Array.isArray(data.rows) ? data.rows : []);
            }
        } catch (e) {
            console.error(e);
            setSummary(null);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const totalAmount = summary?.totalAmount ?? 0;
    const count = summary?.count ?? 0;

    const columns = [
        {
            header: 'Ref / Franchise',
            key: 'ref',
            render: (val, row) => (
                <div>
                    <p className="text-[11px] font-black text-slate-900 tracking-tight">#{val}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {row.franchiseName}
                        {row.cityArea ? ` · ${row.cityArea}` : ''}
                    </p>
                </div>
            ),
        },
        {
            header: 'Delivery status',
            key: 'status',
            render: (val) => (
                <span
                    className={cn(
                        'inline-flex px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border',
                        val === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-sky-50 text-sky-700 border-sky-100'
                    )}
                >
                    {formatStatus(val)}
                </span>
            ),
        },
        {
            header: 'Amount (from admin)',
            key: 'amount',
            align: 'right',
            render: (val) => (
                <div className="flex items-center justify-end gap-1 text-slate-900">
                    <IndianRupee size={11} className="text-slate-400" />
                    <span className="text-[12px] font-black tabular-nums">
                        {(Number(val) || 0).toLocaleString()}
                    </span>
                </div>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse pb-24">
                <div className="h-10 w-56 bg-slate-100 rounded-xl" />
                <div className="h-28 bg-slate-100 rounded-[28px]" />
                <div className="h-64 bg-slate-100 rounded-[32px]" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-24">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                    <VendorBackBar className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
                            Post-delivery only
                        </p>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <FileText className="w-7 h-7 text-slate-800 shrink-0" />
                            Reports
                        </h1>
                        <p className="text-[11px] text-slate-500 mt-2 max-w-xl leading-relaxed">
                            Only visible once delivery or handoff is complete (pickup ready or 
                            received by franchise). Shows requests linked to your account.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => load()}
                    className="inline-flex items-center gap-2 self-start px-5 py-3 rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-[28px] bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                        <Truck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            Post-delivery - total from admin
                        </p>
                        <div className="flex items-baseline gap-2 mt-2">
                            <IndianRupee className="w-6 h-6 text-emerald-400 opacity-90" />
                            <span className="text-3xl font-black tabular-nums tracking-tight">
                                {totalAmount.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">
                            {count} supply order{count !== 1 ? 's' : ''} (for your account)
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
                        Detail
                    </h2>
                    <button
                        type="button"
                        onClick={() => navigate('/vendor/orders')}
                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                    >
                        Open orders
                    </button>
                </div>

                {rows.length === 0 ? (
                    <div className="py-16 text-center rounded-[32px] border border-dashed border-slate-200 bg-white">
                        <p className="text-slate-600 font-bold text-sm">No post-delivery amounts yet</p>
                        <p className="text-[11px] text-slate-400 mt-2 max-w-md mx-auto">
                            Amounts will show here once dispatch reaches the ready for pickup 
                            or completed stages.
                        </p>
                    </div>
                ) : (
                    <DataGrid
                        columns={columns}
                        data={rows}
                        className="border-none shadow-none bg-transparent"
                    />
                )}
            </div>
        </div>
    );
}
