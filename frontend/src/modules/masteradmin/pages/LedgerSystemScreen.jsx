import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Download,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    BookOpen,
    Building2,
    Users,
    Briefcase,
    Home,
    ChevronRight,
    Settings2,
    RefreshCw,
    ShieldCheck,
    Lock
} from 'lucide-react';
import LedgerTable from '../components/tables/LedgerTable';
import mockLedgers from '../data/mockLedgers.json';
import { cn } from '@/lib/utils';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import FilterBar from '../components/tables/FilterBar';

import { exportToCSV } from '@/lib/exportToCSV';

export default function LedgerSystemScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('hotel');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [activeRangeLabel, setActiveRangeLabel] = useState('All Time');

    const quickRanges = [
        { label: 'Today', getValue: () => ({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }) },
        {
            label: 'Yesterday', getValue: () => {
                const d = new Date(); d.setDate(d.getDate() - 1);
                const s = d.toISOString().split('T')[0];
                return { start: s, end: s };
            }
        },
        {
            label: 'Last 7 Days', getValue: () => {
                const end = new Date();
                const start = new Date(); start.setDate(start.getDate() - 7);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
            }
        },
        {
            label: 'Last 30 Days', getValue: () => {
                const end = new Date();
                const start = new Date(); start.setDate(start.getDate() - 30);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
            }
        },
        {
            label: 'This Month', getValue: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
            }
        },
        { label: 'All Time', getValue: () => ({ start: '', end: '' }) }
    ];

    const handleQuickRange = (range) => {
        const value = range.getValue();
        setDateRange(value);
        setActiveRangeLabel(range.label);
        setIsDatePickerOpen(false);
    };

    const handleExport = () => {
        const columns = [
            { header: 'ID', key: 'id' },
            { header: 'From', key: 'name' },
            { header: 'Type', key: 'type' },
            { header: 'Amount', key: 'amount' },
            { header: 'Date', key: 'date' },
            { header: 'Status', key: 'status' }
        ];

        const data = currentTransactions.map(txn => ({
            ...txn,
            name: txn.hotelName || txn.vendorName || txn.franchiseName || txn.source || 'N/A',
            amount: `₹${txn.amount?.toLocaleString()}`
        }));

        exportToCSV(`Ledger_${activeTab}`, columns, data);
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, [activeTab]);

    const tabs = [
        { id: 'hotel', label: 'Hotel Dues', icon: Building2 },
        { id: 'vendor', label: 'Vendor Payments', icon: Users },
        { id: 'franchise', label: 'Shop Accounts', icon: Briefcase },
        { id: 'company', label: 'Main Balance', icon: BookOpen }
    ];

    const getLedgerData = () => {
        switch (activeTab) {
            case 'hotel': return mockLedgers.hotelLedger;
            case 'vendor': return mockLedgers.vendorLedger;
            case 'franchise': return mockLedgers.franchiseLedger;
            case 'company': return mockLedgers.companyLedger;
            default: return [];
        }
    };

    const currentTransactions = getLedgerData().filter(txn => {
        const name = txn.hotelName || txn.vendorName || txn.franchiseName || txn.source || '';
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesDate = true;
        if (dateRange.start && dateRange.end) {
            const txnDate = new Date(txn.date);
            matchesDate = txnDate >= new Date(dateRange.start) && txnDate <= new Date(dateRange.end);
        }

        return matchesSearch && matchesDate;
    });

    if (isLoading && !currentTransactions.length) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-50 border border-slate-200" />
                <div className="h-[500px] bg-slate-50 border border-slate-200" />
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
                            <span>Accounts</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Payment History</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Transactions</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className="flex flex-col items-center justify-center min-w-[100px] px-4 py-1.5 bg-white border border-slate-200 rounded-sm hover:bg-slate-50 transition-all group shadow-sm active:scale-95"
                            >
                                <div className="flex items-center gap-2">
                                    <Calendar size={13} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">
                                        {activeRangeLabel}
                                    </span>
                                    <ChevronRight size={10} className={cn("text-slate-400 transition-transform duration-200", isDatePickerOpen ? "rotate-90" : "rotate-0")} />
                                </div>
                                {dateRange.start && (
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {dateRange.start} → {dateRange.end}
                                    </span>
                                )}
                            </button>

                            <AnimatePresence>
                                {isDatePickerOpen && (
                                    <>
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onClick={() => setIsDatePickerOpen(false)}
                                            className="fixed inset-0 z-40 bg-slate-900/5 backdrop-blur-[1px]"
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-sm shadow-2xl z-50 p-4 font-sans origin-top-right"
                                        >
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Select Period</h4>

                                            <div className="grid grid-cols-2 gap-1 mb-4">
                                                {quickRanges.map((range) => (
                                                    <button
                                                        key={range.label}
                                                        onClick={() => handleQuickRange(range)}
                                                        className={cn(
                                                            "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left rounded-sm transition-all",
                                                            activeRangeLabel === range.label
                                                                ? "bg-slate-900 text-white shadow-lg"
                                                                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        {range.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="border-t border-slate-100 pt-4 mt-2">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Custom Range</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From</label>
                                                        <input
                                                            type="date"
                                                            value={dateRange.start}
                                                            onChange={(e) => {
                                                                setDateRange(prev => ({ ...prev, start: e.target.value }));
                                                                setActiveRangeLabel('Custom');
                                                            }}
                                                            className="w-full bg-slate-50 border border-slate-100 rounded-sm py-1.5 px-3 text-[10px] font-bold text-slate-900 outline-none focus:border-slate-400 transition-all font-sans"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To</label>
                                                        <input
                                                            type="date"
                                                            value={dateRange.end}
                                                            onChange={(e) => {
                                                                setDateRange(prev => ({ ...prev, end: e.target.value }));
                                                                setActiveRangeLabel('Custom');
                                                            }}
                                                            className="w-full bg-slate-50 border border-slate-100 rounded-sm py-1.5 px-3 text-[10px] font-bold text-slate-900 outline-none focus:border-slate-400 transition-all font-sans"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setIsDatePickerOpen(false)}
                                                className="w-full mt-6 bg-slate-900 text-white py-2 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                                            >
                                                Apply Filter
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={handleExport}
                            className="bg-slate-900 text-white px-4 py-1.5 h-[38px] rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors uppercase tracking-widest shadow-sm active:scale-95"
                        >
                            <Download size={13} />
                            Download
                        </button>
                    </div>
                </div>
            </div>

            {/* Fiscal Performance Corridor */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Outstanding Payments"
                    value="₹40,250"
                    change={-12.4}
                    trend="up"
                    icon={ArrowUpRight}
                    sparklineData={[45, 42, 43, 41, 40, 40.5, 40.25].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Money Settled"
                    value="₹1.24M"
                    change={8.2}
                    trend="up"
                    icon={ShieldCheck}
                    sparklineData={[1.1, 1.15, 1.2, 1.22, 1.24].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Main Wallet Balance"
                    value="₹2.54M"
                    sub="Available Cash"
                    icon={BookOpen}
                />
                <MetricRow
                    label="Payment Success"
                    value="99.8%"
                    trend="Stable"
                    icon={RefreshCw}
                />
            </div>

            <div className="p-px bg-slate-200">
                <FilterBar
                    onSearch={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                    onRefresh={() => {
                        setIsLoading(true);
                        setTimeout(() => setIsLoading(false), 800);
                    }}
                    actions={
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-sm mr-4">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setIsLoading(true);
                                            setActiveTab(tab.id);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                            activeTab === tab.id
                                                ? "bg-white text-slate-900 shadow-sm rounded-sm"
                                                : "text-slate-500 hover:text-slate-900"
                                        )}
                                    >
                                        <tab.icon size={12} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <button className="p-1.5 border border-slate-300 rounded-sm hover:bg-slate-100 transition-colors text-slate-400 bg-white">
                                <Settings2 size={14} />
                            </button>
                        </div>
                    }
                />

                <div className="bg-white border-t border-slate-200">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] tabular-nums">Status: Live {currentTransactions.length} Records</span>
                        </div>
                    </div>

                    <div className="min-h-[500px]">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="p-8 space-y-4"
                                >
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="h-12 bg-slate-50 rounded-sm animate-pulse" />
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="table"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <LedgerTable transactions={currentTransactions} type={activeTab} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
