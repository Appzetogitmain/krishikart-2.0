import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Download,
    Eye,
    Search,
    Calendar,
    Filter,
    User,
    Building,
    IndianRupee,
    Scale,
    ExternalLink,
    Loader2,
    Package,
    AlertTriangle,
    ShieldCheck,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import DocumentViewer from '../../vendor/components/documents/DocumentViewer';
import { describeLoad } from '@/lib/dispatchLoad';

// "Kisaankart 1 (Tikam Singh)": the franchise's name with its owner in brackets
const franchiseLabel = (franchise) => {
    const name = franchise?.franchiseName;
    const owner = franchise?.ownerName;
    if (name && owner) return `${name} (${owner})`;
    return name || owner || 'Unknown Franchise';
};

export default function VendorReportsScreen() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [shouldAutoDownload, setShouldAutoDownload] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Filter State
    const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await api.get('/procurement/admin/reports');
                if (response.data.success) {
                    setReports(response.data.results);
                }
            } catch (error) {
                console.error("Failed to fetch vendor reports", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    const getFilteredReports = () => {
        return reports.filter(report => {
            const matchesSearch =
                report.invoice?.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                report.franchiseId?.franchiseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                report.franchiseId?.ownerName?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (dateFilter === 'all') return true;

            const reportDate = new Date(report.invoice?.invoiceDate);
            const today = new Date();

            if (dateFilter === 'today') {
                return reportDate.toDateString() === today.toDateString();
            }
            if (dateFilter === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(today.getDate() - 7);
                return reportDate >= weekAgo;
            }
            if (dateFilter === 'month') {
                return reportDate.getMonth() === today.getMonth() && reportDate.getFullYear() === today.getFullYear();
            }

            return true;
        });
    };

    const filteredReports = getFilteredReports();

    const handleExportAuditLog = () => {
        const headers = [
            'Invoice Number',
            'Invoice Date',
            'Franchise',
            'Owner',
            'Item Count',
            'Actual Weight (KG)',
            'Order Value (₹)',
            'Damaged Deduction (₹)',
            'Net Settlement (₹)',
            'Status'
        ];
        const rows = filteredReports.map((report) => {
            const totalValue = report.totalQuotedAmount || 0;
            const damagedLoss = calculateDamagedLoss(report);
            const netSettlement = totalValue - damagedLoss;
            return [
                report.invoice?.invoiceNumber ?? '',
                report.invoice?.invoiceDate ? new Date(report.invoice.invoiceDate).toLocaleDateString() : '',
                report.franchiseId?.franchiseName ?? '',
                report.franchiseId?.ownerName ?? '',
                report.items?.length ?? 0,
                report.actualWeight ?? 0,
                totalValue.toLocaleString(),
                damagedLoss.toLocaleString(),
                netSettlement.toLocaleString(),
                report.status ?? ''
            ];
        });
        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Pagination Logic
    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const calculateReceivedValue = (report) => {
        return report.items.reduce((acc, item) => {
            const qty = item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity;
            const price = item.quotedPrice || item.price || 0;
            return acc + (qty * price);
        }, 0);
    };

    const calculateDamagedLoss = (report) => {
        return report.items.reduce((acc, item) => {
            const dmgQty = item.damagedQuantity || 0;
            const price = item.quotedPrice || item.price || 0;
            return acc + (dmgQty * price);
        }, 0);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-primary" size={48} />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading reports...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vendor Dispatch Reports</h1>
                    <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-[0.3em] flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-500" /> Everything vendors have delivered
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportAuditLog}
                        className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        <Download size={18} />
                        Download
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-blue-200 transition-colors">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[24px] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText size={28} />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Invoices</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{reports.length}</p>
                    </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-emerald-200 transition-colors">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[24px] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Scale size={28} />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Weight</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{reports.reduce((acc, r) => acc + (r.actualWeight || 0), 0).toFixed(2)} KG</p>
                    </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-primary/20 transition-colors">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-[24px] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <IndianRupee size={28} />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Purchase Value</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{reports.reduce((acc, r) => acc + (r.totalQuotedAmount || 0), 0).toLocaleString()}</p>
                    </div>
                </motion.div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Invoice #, Franchise Name or Owner..."
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-primary/10 focus:bg-white rounded-2xl focus:ring-0 text-sm font-bold transition-all"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value.trim());
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <select
                        className="flex-1 md:flex-none bg-slate-100 px-6 py-4 rounded-2xl text-[12px] font-black text-slate-600 hover:bg-slate-200 transition-all uppercase tracking-widest outline-none appearance-none cursor-pointer"
                        value={dateFilter}
                        onChange={(e) => {
                            setDateFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Invoice</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Franchise</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Items</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Delivery</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Financials</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedReports.map((report) => {
                                const receivedValue = calculateReceivedValue(report);
                                const totalValue = report.totalQuotedAmount || 0;
                                const hasDamages = report.items.some(i => i.damagedQuantity > 0);
                                const isDiscrepancy = totalValue !== receivedValue && report.status === 'completed';

                                return (
                                    <tr key={report._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-7">
                                            <div className="flex flex-col">
                                                <span className="text-base font-black text-slate-900 group-hover:text-primary transition-colors tracking-tight">{report.invoice?.invoiceNumber}</span>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {new Date(report.invoice?.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
                                                    <Building size={18} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-900 uppercase tracking-tight leading-snug">{franchiseLabel(report.franchiseId)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className="flex flex-col gap-2 max-w-[240px]">
                                                {report.items.slice(0, 3).map((item, idx) => (
                                                    <div key={idx} className="flex flex-col gap-1 border-b border-dashed border-slate-100 pb-2 mb-1 last:border-0 last:pb-0 last:mb-0">
                                                        <div className="flex items-center justify-between text-[11px] font-black text-slate-900 uppercase">
                                                            <span className="truncate mr-3">{item.name}</span>
                                                            <span className="text-slate-400 shrink-0 tabular-nums">/{item.quantity} {item.unit}</span>
                                                        </div>
                                                        {report.status === 'completed' && (
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-tighter",
                                                                    item.damagedQuantity > 0 ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                                                                )}>
                                                                    RECV: {item.receivedQuantity || 0}
                                                                </span>
                                                                {item.damagedQuantity > 0 && (
                                                                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-tighter">
                                                                        DMG: {item.damagedQuantity}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {report.items.length > 3 && (
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">
                                                        +{report.items.length - 3} more items
                                                    </span>
                                                )}
                                                {hasDamages && (
                                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 shadow-sm">
                                                        <AlertTriangle size={12} className="animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Damage Reported</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className="inline-flex flex-col gap-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl">
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Scale size={16} />
                                                    <span className="text-sm font-black tabular-nums">{describeLoad(report.items, report.actualWeight)}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{Number(report.actualWeight) > 0 ? 'Weight' : 'Quantity'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className="flex flex-col gap-2.5">
                                                <div className="flex flex-col leading-tight">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Value</span>
                                                    <span className="text-[13px] font-black text-slate-600 tabular-nums leading-none">₹{totalValue.toLocaleString()}</span>
                                                </div>

                                                {report.status === 'completed' && (
                                                    <>
                                                        {hasDamages && (
                                                            <div className="flex flex-col leading-tight text-rose-600">
                                                                <span className="text-[10px] font-black uppercase tracking-widest mb-1">Deduction for Damage</span>
                                                                <span className="text-[13px] font-black tabular-nums leading-none">- ₹{calculateDamagedLoss(report).toLocaleString()}</span>
                                                            </div>
                                                        )}

                                                        <div className={cn(
                                                            "flex flex-col leading-tight pt-3 border-t border-slate-100",
                                                            isDiscrepancy ? "text-primary" : "text-emerald-600"
                                                        )}>
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Final Amount</span>
                                                                {isDiscrepancy && <ShieldCheck size={10} className="text-primary" />}
                                                            </div>
                                                            <span className="text-lg font-black tabular-nums leading-none">₹{(totalValue - calculateDamagedLoss(report)).toLocaleString()}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => {
                                                        setSelectedReport(report);
                                                        setShouldAutoDownload(false);
                                                        setIsViewerOpen(true);
                                                    }}
                                                    className="w-11 h-11 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 rounded-2xl transition-all shadow-sm active:scale-90"
                                                    title="View Document"
                                                >
                                                    <Eye size={20} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedReport(report);
                                                        setShouldAutoDownload(true);
                                                        setIsViewerOpen(true);
                                                    }}
                                                    className="w-11 h-11 flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-2xl transition-all active:scale-90 shadow-sm"
                                                    title="Download Report"
                                                >
                                                    <Download size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination and Empty State */}
                {filteredReports.length > 0 ? (
                    <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)}</span> of <span className="text-slate-900">{filteredReports.length}</span> Invoices
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1.5">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={cn(
                                            "w-9 h-9 rounded-xl text-[11px] font-black transition-all flex items-center justify-center",
                                            currentPage === i + 1
                                                ? "bg-primary text-white shadow-lg shadow-primary/20"
                                                : "bg-white border border-slate-200 text-slate-400 hover:bg-slate-50"
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-24 text-center">
                        <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText size={40} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">No reports found</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Nothing matches your filters</p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setDateFilter('all');
                            }}
                            className="mt-8 text-[11px] font-black text-primary uppercase tracking-[0.3em] hover:underline"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {selectedReport && (
                <DocumentViewer
                    isOpen={isViewerOpen}
                    onClose={() => {
                        setIsViewerOpen(false);
                        setShouldAutoDownload(false);
                    }}
                    autoDownload={shouldAutoDownload}
                    type="INVOICE"
                    data={{
                        invoiceNumber: selectedReport.invoice?.invoiceNumber,
                        invoiceDate: selectedReport.invoice?.invoiceDate,
                        items: selectedReport.items?.map(i => ({
                            name: i.name,
                            quantity: i.quantity || 0,
                            dispatchedQuantity: i.dispatchedQuantity || 0,
                            unit: i.unit || 'KG',
                            quotedPrice: i.quotedPrice || 0,
                            price: i.price || 0
                        })),
                        totalWeight: selectedReport.actualWeight,
                        franchise: franchiseLabel(selectedReport.franchiseId),
                        destNode: [selectedReport.franchiseId?.area, selectedReport.franchiseId?.city].filter(Boolean).join(', '),
                        vendor: selectedReport.assignedVendorId?.shopName || 'Kisaankart Partner',
                        deductionAmount: calculateDamagedLoss(selectedReport),
                        netSettlement: (selectedReport.totalQuotedAmount || 0) - calculateDamagedLoss(selectedReport)
                    }}
                />
            )}
        </div>
    );
}
