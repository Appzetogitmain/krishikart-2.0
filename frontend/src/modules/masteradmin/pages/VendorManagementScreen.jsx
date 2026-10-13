import { useState, useEffect, useRef } from 'react';
import {
    Users,
    Search,
    MoreVertical,
    Star,
    Package,
    Activity,
    TrendingUp,
    ShieldCheck,
    Filter,
    Plus,
    Home,
    ChevronRight,
    Download,
    FileText,
    Settings2,
    Shield,
    CheckCircle2,
    Clock,
    UserPlus,
    BarChart3,
    Eye,
    Trash2
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAdmin } from '../contexts/AdminContext';
import { cn } from '@/lib/utils';
import VendorOnboardingDrawer from '../components/drawers/VendorOnboardingDrawer';
import ApprovalDetailDrawer from '../components/drawers/ApprovalDetailDrawer';
import VendorProductDrawer from '../components/drawers/VendorProductDrawer';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';

export default function VendorManagementScreen() {
    const { vendors, fetchVendors, isLoading: adminLoading, updateVendorStatus, createVendorByAdmin } = useAdmin();
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isOnboardOpen, setIsOnboardOpen] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [productDrawerVendor, setProductDrawerVendor] = useState(null);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);

    useEffect(() => {
        fetchVendors(); // Fetch all vendors
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
                setIsFilterMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredVendors = (vendors || []).filter(v => {
        const name = (v.fullName || "").toLowerCase();
        const email = (v.email || "").toLowerCase();
        const mobile = (v.mobile || "").toLowerCase();
        const searchKeywords = searchTerm.toLowerCase().trim().split(/\s+/);
        const matchesSearch = searchTerm.trim() === '' ? true : searchKeywords.every(kw =>
            name.includes(kw) || email.includes(kw) || mobile.includes(kw)
        );
        const matchesStatus = statusFilter === 'All' ||
            (statusFilter === 'Verified' && v.status === 'active') ||
            (statusFilter === 'Pending' && v.status === 'pending') ||
            (statusFilter === 'Blocked' && v.status === 'blocked');

        return matchesSearch && matchesStatus;
    });

    const handleDeleteVendor = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to permanently delete this vendor? This action cannot be undone.")) return;
        try {
            await api.delete(`/masteradmin/vendors/${id}`);
            toast.success("Vendor deleted successfully");
            fetchVendors();
        } catch (error) {
            console.error("Failed to delete vendor:", error);
            toast.error("Failed to delete vendor");
        }
    };

    const vendorColumns = [
        {
            header: 'Vendor Name',
            key: 'fullName',
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Users size={14} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-[11px] leading-none mb-1">{val}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{row._id}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Location',
            key: 'farmLocation',
            render: (val) => <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-sm border border-slate-200 uppercase tracking-tight">{val || 'N/A'}</span>
        },

        {
            header: 'Mobile',
            key: 'mobile',
            render: (val) => <span className="text-[11px] font-bold text-slate-900 tabular-nums">{val}</span>
        },
        {
            header: 'Email',
            key: 'email',
            render: (val) => <span className="text-[10px] font-bold text-slate-600 truncate max-w-[150px] inline-block">{val}</span>
        },
        {
            header: 'Status',
            key: 'status',
            render: (val) => (
                <div className={cn(
                    "px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest border w-fit",
                    val === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                )}>
                    {val}
                </div>
            )
        },
        {
            header: 'Actions',
            key: 'actions',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVendor(row);
                        }}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        title="View Vendor Details"
                    >
                        <Eye size={14} />
                    </button>
                    <button 
                        onClick={(e) => handleDeleteVendor(row._id, e)}
                        className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors"
                        title="Delete Vendor"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    if (adminLoading) {
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
                            <span>Admin Panel</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Vendors</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Vendor List</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsOnboardOpen(true)}
                            className="px-3 py-2 bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
                        >
                            <Plus size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Add Vendor</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Performance KPIs */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4">
                <MetricRow
                    label="Total Partners"
                    value={vendors?.length || 0}
                    change={0}
                    trend="up"
                    icon={ShieldCheck}
                    sparklineData={[...Array(7)].map(() => ({ value: vendors?.length || 0 }))}
                />
                <MetricRow
                    label="Performance"
                    value="98.4%"
                    change={0.2}
                    trend="up"
                    icon={BarChart3}
                    sparklineData={[97.5, 98, 98.2, 98.1, 98.4, 98.3, 98.4].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Average Rating"
                    value="4.82"
                    change={0.15}
                    trend="up"
                    icon={Shield}
                    sparklineData={[4.7, 4.75, 4.8, 4.78, 4.82, 4.81, 4.82].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Average Time"
                    value="2.4h"
                    change={-5.8}
                    trend="up"
                    icon={Clock}
                    sparklineData={[2.8, 2.7, 2.5, 2.6, 2.4, 2.5, 2.4].map(v => ({ value: v }))}
                />
            </div>

            {/* Operational Management */}
            <div className="flex flex-col gap-0 p-px">
                <FilterBar
                    onSearch={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                    searchValue={searchTerm}
                    activeFilter={statusFilter}
                    onFilterChange={setStatusFilter}
                    onRefresh={() => fetchVendors()}
                    actions={
                        <div className="flex items-center gap-2 relative" ref={filterMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                                aria-label="Open vendor filter options"
                                aria-expanded={isFilterMenuOpen}
                                title="Vendor filter options"
                                className={cn(
                                    "p-1.5 border border-slate-200 rounded-sm transition-colors",
                                    isFilterMenuOpen
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "hover:bg-slate-100 text-slate-400"
                                )}
                            >
                                <Settings2 size={14} />
                            </button>

                            {isFilterMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-sm shadow-xl z-20 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Vendor Filters
                                        </p>
                                    </div>

                                    <div className="p-2 space-y-1">
                                        {['All', 'Pending', 'Verified', 'Blocked'].map((filter) => (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => {
                                                    setStatusFilter(filter);
                                                    setIsFilterMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 rounded-sm text-[11px] font-bold transition-colors",
                                                    statusFilter === filter
                                                        ? "bg-slate-900 text-white"
                                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                )}
                                            >
                                                <span>{filter}</span>
                                                {statusFilter === filter ? <CheckCircle2 size={12} /> : null}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="px-2 py-2 border-t border-slate-100 bg-slate-50/70">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStatusFilter('All');
                                                setSearchTerm('');
                                                setIsFilterMenuOpen(false);
                                            }}
                                            className="w-full px-3 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    }
                />

                <div className="bg-white border-t border-slate-200">
                    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums font-sans">Total Vendors: {filteredVendors.length}</span>
                        </div>
                    </div>

                    <DataGrid
                        title="Vendor List"
                        columns={vendorColumns}
                        data={filteredVendors}
                        onRowClick={(row) => setSelectedVendor(row)}
                        density="compact"
                    />

                    {filteredVendors.length === 0 && (
                        <div className="py-20 flex flex-col items-center text-center bg-white border-t border-slate-100">
                            <div className="w-12 h-12 bg-slate-50 rounded-sm flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                                <Users size={24} />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">No vendors found</h3>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-widest">Try changing your search or filters</p>
                        </div>
                    )}
                </div>
            </div>

            <VendorOnboardingDrawer
                isOpen={isOnboardOpen}
                onClose={() => setIsOnboardOpen(false)}
                onSave={async (payload) => {
                    const created = await createVendorByAdmin(payload);
                    if (created) fetchVendors();
                    return created;
                }}
            />

            <ApprovalDetailDrawer
                isOpen={!!selectedVendor}
                onClose={() => setSelectedVendor(null)}
                item={selectedVendor}
                type="vendor"
                onApprove={async (item, approvedCategories) => {
                    await updateVendorStatus(item._id, 'active', approvedCategories);
                    setSelectedVendor(null);
                    fetchVendors();
                }}
                onReject={async (item) => {
                    await updateVendorStatus(item._id, 'blocked');
                    setSelectedVendor(null);
                    fetchVendors();
                }}
            />

            <VendorProductDrawer
                isOpen={!!productDrawerVendor}
                onClose={() => {
                    setProductDrawerVendor(null);
                    fetchVendors();
                }}
                vendor={productDrawerVendor}
            />
        </div>
    );
}
