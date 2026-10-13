import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    AlertCircle, 
    RefreshCw, 
    Archive, 
    ShoppingBag, 
    Search, 
    Download,
    Building,
    User,
    ArrowUpRight,
    Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

export default function RejectionReportsScreen() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [rejections, setRejections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/procurement/admin/rejected-stock');
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

    const filtered = rejections.filter(r => {
        const matchesSearch = 
            r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.franchise.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.requestRef.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = filterType === 'all' || 
            (filterType === 'rotten' && r.type === 'Rotten/Rejected') ||
            (filterType === 'damaged' && r.type === 'Damaged/Partial');
            
        return matchesSearch && matchesType;
    });

    const handleExport = () => {
        const headers = ['Ref', 'Product', 'Vendor', 'Franchise', 'Type', 'Dispatched', 'Rejected/Damaged', 'Date'];
        const rows = filtered.map(r => [
            r.requestRef,
            r.productName,
            r.vendor,
            r.franchise,
            r.type,
            `${r.dispatchedQty} ${r.unit}`,
            `${r.type === 'Rotten/Rejected' ? r.rejectedQty : r.damagedQty} ${r.unit}`,
            new Date(r.date).toLocaleDateString()
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rejection-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rejected Stock</h1>
                    <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-[0.3em] flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500" /> Items rejected or damaged at franchises
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        <Download size={18} />
                        Export Log
                    </button>
                    <button
                        onClick={load}
                        className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by Product, Vendor, Franchise or Ref..."
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-primary/10 focus:bg-white rounded-2xl focus:ring-0 text-sm font-bold transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <select
                        className="flex-1 md:flex-none bg-slate-100 px-6 py-4 rounded-2xl text-[12px] font-black text-slate-600 hover:bg-slate-200 transition-all uppercase tracking-widest outline-none appearance-none cursor-pointer"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="rotten">Rotten Only</option>
                        <option value="damaged">Damaged Only</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Procurement Ref</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Vendor / Franchise</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Details</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Quality Issue</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                                <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.length > 0 ? filtered.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-7">
                                        <div className="flex flex-col">
                                            <span className="text-base font-black text-slate-900 tracking-tight">#{row.requestRef}</span>
                                            <span className="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">Procurement Order</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                    <User size={14} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Vendor</span>
                                                    <span className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{row.vendor}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <Building size={14} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Franchise</span>
                                                    <span className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{row.franchise}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-900 tracking-tight">{row.productName}</span>
                                            <span className="text-[11px] font-bold text-slate-400 mt-1 tabular-nums">Dispatched: {row.dispatchedQty} {row.unit}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <div className="flex flex-col gap-2">
                                            <span className={cn(
                                                "inline-flex self-start px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                                                row.type === 'Rotten/Rejected' ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                            )}>
                                                {row.type}
                                            </span>
                                            <span className="text-[13px] font-black text-slate-900 tabular-nums">
                                                {row.type === 'Rotten/Rejected' ? row.rejectedQty : row.damagedQty} {row.unit} Loss
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-7">
                                        <span className="text-[11px] font-black text-slate-600 tabular-nums uppercase tracking-widest">
                                            {new Date(row.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </td>
                                    <td className="px-8 py-7 text-right">
                                        <button
                                            onClick={() => navigate(`/masteradmin/purchasemanager?id=${row.requestId}`)}
                                            className="inline-flex items-center gap-2 text-[11px] font-black text-primary uppercase tracking-widest hover:underline"
                                        >
                                            View Request <ArrowUpRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <ShoppingBag size={40} />
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">No Quality Issues Found</h3>
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">No rejected or damaged items</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
