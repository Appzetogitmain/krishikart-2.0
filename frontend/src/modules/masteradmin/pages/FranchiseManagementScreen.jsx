import React, { useState, useEffect } from 'react';
import TablePagination from '../components/tables/TablePagination';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Store,
    Search,
    ChevronDown,
    ChevronUp,
    Globe,
    Activity,
    BarChart2,
    Power,
    ExternalLink,
    MapPin,
    Calendar,
    Home,
    ChevronRight,
    FileText,
    Server,
    ShieldCheck,
    Cpu,
    Network,
    Plus,
    Edit3,
    Trash2,
    Layers
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useAdmin } from '../contexts/AdminContext';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import FilterBar from '../components/tables/FilterBar';
import { toast } from 'sonner';
import FranchiseOnboardingDrawer from '../components/drawers/FranchiseOnboardingDrawer';
import FranchiseServiceAreaDrawer from '../components/drawers/FranchiseServiceAreaDrawer';
import FranchiseCategoryDrawer from '../components/drawers/FranchiseCategoryDrawer';

export default function FranchiseManagementScreen() {
    const { createFranchiseByAdmin, updateFranchise, deleteFranchise } = useAdmin();
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [franchises, setFranchises] = useState([]);
    const [isOnboardOpen, setIsOnboardOpen] = useState(false);
    const [isCoverageOpen, setIsCoverageOpen] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [selectedFranchise, setSelectedFranchise] = useState(null);
    const PAGE_SIZE = 20;
    const [page, setPage] = useState(1);

    const fetchFranchises = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/masteradmin/franchises');
            if (response.data.success) {
                setFranchises(response.data.results || []);
            }
        } catch (error) {
            console.error("Error fetching franchises:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFranchises();
    }, []);

    const handleDeleteFranchise = async (id) => {
        if (!window.confirm("Are you sure you want to remove this franchise? It will stop receiving orders.")) return;
        
        const success = await deleteFranchise(id);
        if (success) fetchFranchises();
    };

    const handleStatusChange = async (id, newStatus) => {
        const action = newStatus === 'blocked' ? 'decommission' : 'reactivate';
        if (!window.confirm(`Are you sure you want to ${action} this franchise?`)) return;

        try {
            const response = await api.put(`/masteradmin/franchises/${id}/status`, { status: newStatus });
            if (response.data.success) {
                toast.success(`Franchise ${newStatus === 'blocked' ? 'decommissioned' : 'reactivated'} successfully`);
                fetchFranchises();
            } else {
                toast.error(response.data.message || 'Failed to update status');
            }
        } catch (error) {
            console.error("Error updating franchise status:", error);
            toast.error(error.response?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    const filteredFranchises = franchises.filter(f => {
        const name = (f.franchiseName || "").toLowerCase();
        const city = (f.city || "").toLowerCase();
        const owner = (f.ownerName || "").toLowerCase();

        const searchKeywords = searchTerm.toLowerCase().trim().split(/\s+/);
        const matchesSearch = searchTerm.trim() === '' ? true : searchKeywords.every(kw =>
            name.includes(kw) || city.includes(kw) || owner.includes(kw)
        );

        const matchesStatus = statusFilter === 'All' ||
            (statusFilter === 'Verified' && f.status === 'active') ||
            (statusFilter === 'Pending' && f.status === 'pending');

        return matchesSearch && matchesStatus;
    });

    useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);
    const pagedFranchises = filteredFranchises.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (isLoading) {
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
                            <span>Master Admin</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Franchises</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">All franchise stores</h1>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedFranchise(null);
                            setIsOnboardOpen(true);
                        }}
                        className="px-3 py-2 bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                        <Plus size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Add Franchise</span>
                    </button>
                </div>
            </div>

            {/* Network KPIs */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Franchises Online"
                    value={franchises.filter(f => f.status === 'active').length.toString()}
                    change={4.2}
                    trend="up"
                    icon={Cpu}
                    sparklineData={[22, 23, 24, 23, 24, 24, 24].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Efficiency"
                    value="89.4%"
                    change={1.2}
                    trend="up"
                    icon={Activity}
                    sparklineData={[88, 88.5, 89, 88.8, 89.4, 89.2, 89.4].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Orders Handled"
                    value="1.2M/h"
                    change={8.4}
                    trend="up"
                    icon={BarChart2}
                    sparklineData={[1.0, 1.1, 1.2, 1.1, 1.2, 1.3, 1.2].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="On-Time Rate"
                    value="99.2%"
                    change={0.1}
                    trend="up"
                    icon={ShieldCheck}
                    sparklineData={[99, 99.1, 99.2, 99, 99.2, 99.3, 99.2].map(v => ({ value: v }))}
                />
            </div>

            {/* Node Management Ledger */}
            <div className="flex flex-col gap-0 p-px">
                <FilterBar
                    onSearch={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                    activeFilter={statusFilter}
                    onFilterChange={setStatusFilter}
                    onRefresh={fetchFranchises}
                />

                <div className="bg-white border-t border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums font-sans">Total Franchises: {filteredFranchises.length}</span>
                        </div>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-200">
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Franchise</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Efficiency</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Yearly Sales</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Orders</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pagedFranchises.map((franchise, idx) => (
                                <React.Fragment key={franchise._id || idx}>
                                    <tr
                                        className={cn(
                                            "group cursor-pointer hover:bg-slate-50/80 transition-all",
                                            expandedRow === (franchise._id || idx) ? "bg-slate-50" : "bg-white"
                                        )}
                                        onClick={() => setExpandedRow(expandedRow === (franchise._id || idx) ? null : (franchise._id || idx))}
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-9 h-9 rounded-sm flex items-center justify-center border",
                                                    franchise.status === 'active' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                                                )}>
                                                    <Store size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-[11px] tracking-tight leading-none mb-1">{franchise.franchiseName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{franchise.city}</p>
                                                        {franchise.servedCategories?.length > 0 && (
                                                            <div className="flex gap-1">
                                                                {franchise.servedCategories.slice(0, 2).map((cat, i) => (
                                                                    <span key={cat._id || i} className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded-sm font-black uppercase border border-emerald-100/50">
                                                                        {cat.name}
                                                                    </span>
                                                                ))}
                                                                {franchise.servedCategories.length > 2 && (
                                                                    <span className="text-[10px] text-slate-400 font-bold">+{franchise.servedCategories.length - 2}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${franchise.performance || 85}%` }}
                                                        className={cn(
                                                            "h-full",
                                                            (franchise.performance || 85) > 90 ? "bg-emerald-500" :
                                                                (franchise.performance || 85) > 80 ? "bg-slate-900" : "bg-amber-400"
                                                        )}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-900 tabular-nums">{franchise.performance || 85}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 text-[11px] tabular-nums">₹{((franchise.orderVolume || 15000) / 1000).toFixed(1)}k</span>
                                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">Total Sales</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded-sm uppercase tracking-widest tabular-nums">
                                                {franchise.activeOrders || 0} Load
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-wider border",
                                                franchise.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                                            )}>
                                                <div className={cn("w-1 h-1 rounded-full animate-pulse", franchise.status === 'active' ? "bg-emerald-400" : "bg-rose-400")} />
                                                {franchise.status}
                                            </div>
                                        </td>

                                    </tr>

                                    <AnimatePresence>
                                        {expandedRow === (franchise._id || idx) && (
                                            <tr>
                                                <td colSpan="5" className="p-0 border-b border-slate-200">
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="bg-slate-50/50"
                                                    >
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 divide-x divide-slate-100 border-b border-slate-100">
                                                            <div className="p-4 space-y-4">
                                                                <div className="flex items-center gap-2 text-slate-900">
                                                                    <MapPin size={13} />
                                                                    <h5 className="text-[10px] font-black uppercase tracking-widest">Contact</h5>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Owner</span>
                                                                        <p className="text-[11px] font-bold text-slate-900">{franchise.ownerName}</p>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Franchise ID</span>
                                                                        <p className="text-[11px] font-bold text-slate-900">{franchise.mobile}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="p-4 space-y-4">
                                                                <div className="flex items-center gap-2 text-slate-900">
                                                                    <Activity size={13} />
                                                                    <h5 className="text-[10px] font-black uppercase tracking-widest">Categories Served</h5>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {franchise.servedCategories?.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {franchise.servedCategories.map((cat, i) => (
                                                                                <div key={cat._id || i} className="flex items-center gap-1.5 bg-white px-2 py-1 border border-slate-100 rounded-sm">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">{cat.name}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="bg-amber-50 border border-amber-100 p-2 rounded-sm">
                                                                            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest text-center">No categories assigned</p>
                                                                        </div>
                                                                    )}
                                                                    <div className="pt-2 flex justify-between items-center border-t border-slate-100 mt-2">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Categories</span>
                                                                        <span className="text-[10px] font-black text-slate-900">{franchise.servedCategories?.length || 0} Categories</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="p-4 space-y-4">
                                                                <div className="flex items-center gap-2 text-slate-900">
                                                                    <FileText size={13} />
                                                                    <h5 className="text-[10px] font-black uppercase tracking-widest">Documents</h5>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {[
                                                                        { label: 'Aadhaar', key: 'aadhaarImage' },
                                                                        { label: 'PAN', key: 'panImage' },
                                                                        { label: 'FSSAI', key: 'fssaiCertificate' },
                                                                        { label: 'Shop/Trade', key: 'shopEstablishmentCertificate' },
                                                                        { label: 'GST', key: 'gstCertificate' }
                                                                    ].map((doc) => {
                                                                        const url = franchise.kyc?.[doc.key];
                                                                        return (
                                                                            <div key={doc.key} className={cn(
                                                                                "flex flex-col gap-1 p-2 border rounded-sm transition-all",
                                                                                url ? "bg-white border-slate-200 hover:border-slate-400" : "bg-slate-50 border-slate-100 opacity-50"
                                                                            )}>
                                                                                <span className="text-[10px] font-black uppercase text-slate-400">{doc.label}</span>
                                                                                {url ? (
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <a 
                                                                                            href={url} 
                                                                                            target="_blank" 
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-[10px] font-bold text-slate-900 truncate hover:underline"
                                                                                        >
                                                                                            View File
                                                                                        </a>
                                                                                        <a 
                                                                                            href={url} 
                                                                                            download 
                                                                                            className="p-1 hover:bg-slate-100 rounded-sm text-slate-400 hover:text-slate-900 transition-colors"
                                                                                        >
                                                                                            <ExternalLink size={10} />
                                                                                        </a>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[10px] font-bold text-slate-400 italic">Not Uploaded</span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            <div className="p-4 grid grid-cols-1 gap-2 bg-slate-100/30">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedFranchise(franchise);
                                                                        setIsCoverageOpen(true);
                                                                    }}
                                                                    className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Globe size={12} />
                                                                    Manage Coverage
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedFranchise(franchise);
                                                                        setIsCategoryOpen(true);
                                                                    }}
                                                                    className="bg-white border border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-widest py-2 rounded-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Layers size={12} />
                                                                    Manage Categories
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStatusChange(franchise._id, franchise.status === 'blocked' ? 'active' : 'blocked')}
                                                                    className={cn(
                                                                        "bg-white border text-[10px] font-black uppercase tracking-widest py-2 rounded-sm transition-all flex items-center justify-center gap-2 group",
                                                                        franchise.status === 'blocked' ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" : "border-slate-200 text-rose-600 hover:bg-rose-50"
                                                                    )}
                                                                >
                                                                    <Power size={12} />
                                                                    {franchise.status === 'blocked' ? 'Reactivate Franchise' : 'Remove Franchise'}
                                                                </button>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedFranchise(franchise);
                                                                            setIsOnboardOpen(true);
                                                                        }}
                                                                        className="bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest py-2 rounded-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <Edit3 size={12} />
                                                                        Edit Franchise
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteFranchise(franchise._id)}
                                                                        className="bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest py-2 rounded-sm hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                        Delete Franchise
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={filteredFranchises.length} onPageChange={(p) => { setPage(p); setExpandedRow(null); }} />

                    {filteredFranchises.length === 0 && (
                        <div className="py-20 flex flex-col items-center text-center bg-white border-t border-slate-100">
                            <div className="w-12 h-12 bg-slate-50 rounded-sm flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                                <Network size={24} />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">No franchises match your search</h3>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-widest">Try a different search or filter</p>
                        </div>
                    )}
                </div>
            </div>

            <FranchiseOnboardingDrawer
                isOpen={isOnboardOpen}
                onClose={() => {
                    setIsOnboardOpen(false);
                    setSelectedFranchise(null);
                }}
                initialData={selectedFranchise}
                onSave={async (payload, id) => {
                    const success = id 
                        ? await updateFranchise(id, payload)
                        : await createFranchiseByAdmin(payload);
                    if (success) fetchFranchises();
                    return success;
                }}
            />

            <FranchiseServiceAreaDrawer
                isOpen={isCoverageOpen}
                onClose={() => {
                    setIsCoverageOpen(false);
                    fetchFranchises();
                }}
                franchise={selectedFranchise}
            />
            <FranchiseCategoryDrawer
                isOpen={isCategoryOpen}
                onClose={() => {
                    setIsCategoryOpen(false);
                    fetchFranchises();
                }}
                franchise={selectedFranchise}
            />
        </div>
    );
}
