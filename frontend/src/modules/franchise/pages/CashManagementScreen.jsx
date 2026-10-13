import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet,
    Landmark,
    ArrowUpRight,
    Search,
    ChevronLeft,
    CheckCircle2,
    Calendar,
    ArrowRight,
    TrendingUp,
    History,
    FileText,
    Banknote,
    Home,
    ChevronRight,
    Download,
    RefreshCw,
    ShieldCheck,
    Settings2,
    CreditCard,
    ArrowDownRight
} from 'lucide-react';
import { useCOD } from '../contexts/CODContext';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/exportToCSV';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';

export default function CashManagementScreen() {
    const { transactions, summary, markAsDeposited } = useCOD();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTx, setSelectedTx] = useState(null);
    const [referenceId, setReferenceId] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const handleExport = () => {
        const columns = [
            { header: 'Order ID', key: 'orderId' },
            { header: 'Customer', key: 'hotelName' },
            { header: 'Amount', key: 'amount' },
            { header: 'Status', key: 'status' },
            { header: 'Date', key: 'date' },
            { header: 'Reference', key: 'bankReference' }
        ];

        const data = filteredTransactions.map(tx => ({
            ...tx,
            amount: `₹${tx.amount?.toLocaleString()}`,
            status: tx.status === 'pending' ? 'Not Verified' : 'Deposited'
        }));

        exportToCSV('Cash_Reconciliation_Report', columns, data);
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 700);
        return () => clearTimeout(timer);
    }, []);

    const filteredTransactions = transactions.filter(tx =>
        tx.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.hotelName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDeposit = (txId) => {
        if (!referenceId) return;
        markAsDeposited(txId, referenceId);
        setSelectedTx(null);
        setReferenceId('');
    };

    const cashColumns = [
        {
            header: 'Customer',
            key: 'hotelName',
            render: (val, row) => (
                <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-[11px] tracking-tight leading-none mb-1">{val}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{row.orderId}</span>
                </div>
            )
        },
        {
            header: 'Status',
            key: 'status',
            render: (val) => (
                <div className={cn(
                    "px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border w-fit",
                    val === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}>
                    {val === 'pending' ? 'Not Verified' : 'Deposited'}
                </div>
            )
        },
        {
            header: 'Collection Date',
            key: 'date',
            render: (val) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(val).toLocaleDateString()}</span>
        },
        {
            header: 'Gross Amount',
            key: 'amount',
            align: 'right',
            render: (val) => <span className="text-[11px] font-black text-slate-900 tabular-nums">₹{val?.toLocaleString() ?? 0}</span>
        },
        {
            header: 'Bank Reference (UTR)',
            key: 'bankReference',
            render: (val) => val ? (
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck size={10} /> {val}
                </span>
            ) : (
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Awaiting Verification</span>
            )
        },
        {
            header: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, row) => (
                <div className="flex items-center justify-end gap-2">
                    {row.status === 'pending' && (
                        <button
                            onClick={() => setSelectedTx(row)}
                            className="p-1 px-3 text-[10px] font-black uppercase text-slate-900 border border-slate-900 rounded-sm hover:bg-slate-900 hover:text-white transition-all underline decoration-slate-300 underline-offset-4"
                        >
                            Verify Deposit
                        </button>
                    )}
                    <button className="p-1.5 hover:bg-slate-100 rounded-sm text-slate-400 transition-colors">
                        <FileText size={14} />
                    </button>
                </div>
            )
        }
    ];

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse bg-slate-50 min-h-screen">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-16 bg-white border border-slate-200" />
                <div className="h-[500px] bg-white border border-slate-200" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Franchise</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Cash Collection</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">COD Cash Verification</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors border border-slate-200 rounded-sm bg-white"
                        >
                            <Download size={14} />
                        </button>
                        <button className="bg-slate-900 text-white px-3 py-1.5 rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm uppercase tracking-widest">
                            <Landmark size={14} />
                            Cash Records
                        </button>
                    </div>
                </div>
            </div>

            {/* Reconciliation Performance Strip */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <div className="bg-slate-900 text-white px-6 py-4 flex flex-col justify-center border-r border-slate-800">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1.5">Cash To Deposit</p>
                    <h3 className="text-xl font-black tracking-tight tabular-nums leading-none text-white">
                        ₹{summary?.totalToDeposit?.toLocaleString() ?? 0}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cash collected</span>
                    </div>
                </div>
                <MetricRow
                    label="Cash Collected"
                    value={`₹${summary?.totalDeposited?.toLocaleString() ?? 0}`}
                    trend="up"
                    change={5.2}
                    icon={TrendingUp}
                />
                <MetricRow
                    label="Pending Deposits"
                    value={summary.pendingTxCount}
                    trend="Stable"
                    icon={Banknote}
                    sub="Waiting to be verified"
                />
                <MetricRow
                    label="Status"
                    value="Stabilized"
                    trend="Stable"
                    icon={ShieldCheck}
                />
            </div>

            <div className="p-px bg-slate-200">
                <FilterBar
                    actions={
                        <div className="flex items-center gap-2">
                            <div className="relative group w-full max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search by order ID or customer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.trim())}
                                    className="bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:border-slate-400 transition-all font-sans min-w-[240px]"
                                />
                            </div>
                            <button className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-100 transition-colors text-slate-400 bg-white">
                                <Settings2 size={14} />
                            </button>
                        </div>
                    }
                />

                <div className="bg-white border-t border-slate-200">
                    <DataGrid
                        columns={cashColumns}
                        data={filteredTransactions}
                        density="compact"
                        showSearch={false}
                    />
                </div>
            </div>

            {/* Reconciliation Verification Interface */}
            <AnimatePresence>
                {selectedTx && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedTx(null)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[60] shadow-2xl border-l border-slate-200"
                        >
                            <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Verify Bank Deposit</h3>
                                <button onClick={() => setSelectedTx(null)} className="p-1 text-slate-400 hover:text-slate-900">
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-8 overflow-y-auto h-[calc(100%-3.5rem)]">
                                <div className="flex items-center gap-4 p-6 bg-slate-900 text-white rounded-sm">
                                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-sm">
                                        <Banknote size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1.5">Amount Collected</p>
                                        <h2 className="text-2xl font-black tracking-tight leading-none">₹{selectedTx?.amount?.toLocaleString() ?? 0}</h2>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden">
                                        <div className="bg-slate-50 p-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                                            <p className="text-[11px] font-black text-slate-900 uppercase">{selectedTx.hotelName}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order ID</p>
                                            <p className="text-[11px] font-black text-slate-900 uppercase">{selectedTx.orderId}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bank Reference Number (UTR)</label>
                                        <input
                                            type="text"
                                            placeholder="Enter the 12-digit UTR number"
                                            value={referenceId}
                                            onChange={(e) => setReferenceId(e.target.value)}
                                            className="w-full h-12 px-4 bg-white border border-slate-200 rounded-sm text-xs font-black focus:border-slate-900 transition-all outline-none uppercase placeholder:text-slate-300"
                                        />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                                            Only verify after you have checked that this cash has reached the company bank account.
                                        </p>
                                    </div>

                                    <div className="pt-8 space-y-3">
                                        <button
                                            disabled={!referenceId}
                                            onClick={() => handleDeposit(selectedTx.id)}
                                            className={cn(
                                                "w-full h-12 rounded-sm font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                                                referenceId
                                                    ? "bg-slate-900 text-white shadow-lg hover:bg-slate-800"
                                                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                            )}
                                        >
                                            <ShieldCheck size={16} /> Mark as Verified
                                        </button>
                                        <button
                                            onClick={() => setSelectedTx(null)}
                                            className="w-full h-12 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
