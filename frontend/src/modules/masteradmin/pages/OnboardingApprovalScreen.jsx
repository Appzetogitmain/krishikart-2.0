import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    ShieldCheck,
    CreditCard,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    UserPlus,
    Building,
    FileText,
    ChevronRight,
    Home,
    AlertCircle,
    Truck
} from 'lucide-react';
import ApprovalCard from '../components/cards/ApprovalCard';
import ApprovalDetailDrawer from '../components/drawers/ApprovalDetailDrawer';
import FilterBar from '../components/tables/FilterBar';
import mockApprovals from '../data/mockApprovals.json';
import { useAdmin } from '../contexts/AdminContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function OnboardingApprovalScreen() {
    const { vendors, franchises, deliveryPartners, isLoading: adminLoading, fetchVendors, fetchPendingFranchises, fetchDeliveryPartners, updateVendorStatus, reviewFranchiseKYC, updateDeliveryPartnerStatus, reviewDeliveryDocs } = useAdmin();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('type') || 'vendor';
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        const mappedStatus = statusFilter === 'Verified'
            ? (activeTab === 'vendor' ? 'active' : 'verified')
            : statusFilter.toLowerCase();

        if (activeTab === 'vendor') {
            fetchVendors(mappedStatus);
        } else if (activeTab === 'franchise') {
            fetchPendingFranchises(mappedStatus);
        } else if (activeTab === 'delivery') {
            fetchDeliveryPartners(statusFilter.toLowerCase());
        }
    }, [activeTab, statusFilter]);

    const tabs = [
        { id: 'vendor', label: 'Vendor KYC', icon: Users, count: vendors?.length || 0 },
        { id: 'franchise', label: 'Franchise Docs', icon: Building, count: franchises?.length || 0 },
        { id: 'delivery', label: 'Delivery Partners', icon: Truck, count: deliveryPartners?.length || 0 }
    ];

    const currentItems = activeTab === 'vendor' ? (vendors || []).filter(v =>
        (v.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    ) : activeTab === 'franchise' ? (franchises || []).filter(f =>
        (f.franchiseName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.ownerName || "").toLowerCase().includes(searchTerm.toLowerCase())
    ) : activeTab === 'delivery' ? (deliveryPartners || []).filter(p =>
        (p.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.mobile || "").toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const handleApprove = async (idOrItem, approvedCategories) => {
        let id = idOrItem;
        if (typeof idOrItem === 'object' && idOrItem !== null) {
            id = idOrItem._id ?? idOrItem.id;
            if (id == null && typeof idOrItem.toString === 'function') id = idOrItem.toString();
        }
        if (id == null || id === '') return;
        const idStr = String(id);
        if (activeTab === 'vendor') {
            const success = await updateVendorStatus(idStr, 'active', approvedCategories);
            if (success) setSelectedItem(null);
        } else if (activeTab === 'franchise') {
            const success = await reviewFranchiseKYC(idStr, 'verified', null, approvedCategories);
            if (success) setSelectedItem(null);
        } else if (activeTab === 'delivery') {
            const item = typeof idOrItem === 'object' ? idOrItem : deliveryPartners.find(p => String(p._id || p.id) === idStr);
            if (item?.pendingDocs?.status === 'pending') {
                const success = await reviewDeliveryDocs(idStr, 'approve');
                if (success) setSelectedItem(null);
            } else {
                const success = await updateDeliveryPartnerStatus(idStr, true);
                if (success) setSelectedItem(null);
            }
        }
    };

    const handleReject = async (idOrItem, reason) => {
        let id = idOrItem;
        if (typeof idOrItem === 'object' && idOrItem !== null) {
            id = idOrItem._id ?? idOrItem.id;
            if (id == null && typeof idOrItem.toString === 'function') id = idOrItem.toString();
        }
        if (id == null || id === '') return;
        const idStr = String(id);
        if (activeTab === 'vendor') {
            const success = await updateVendorStatus(idStr, 'blocked');
            if (success) setSelectedItem(null);
        } else if (activeTab === 'franchise') {
            const success = await reviewFranchiseKYC(idStr, 'rejected', reason);
            if (success) setSelectedItem(null);
        } else if (activeTab === 'delivery') {
            const item = typeof idOrItem === 'object' ? idOrItem : deliveryPartners.find(p => String(p._id || p.id) === idStr);
            if (item?.pendingDocs?.status === 'pending') {
                const success = await reviewDeliveryDocs(idStr, 'reject', reason);
                if (success) setSelectedItem(null);
            } else {
                const success = await updateDeliveryPartnerStatus(idStr, false);
                if (success) setSelectedItem(null);
            }
        }
    };

    if (adminLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-slate-50 border border-slate-200 rounded-sm" />)}
                </div>
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
                            <span>Approvals</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Document Approvals</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">
                            {tabs.find(t => t.id === activeTab)?.label} Verification
                        </h1>
                    </div>
                </div>

                {/* Horizontal Tab Switcher */}
                <div className="flex border-t border-slate-100 bg-white overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setSearchParams({ type: tab.id })}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-3 border-r border-slate-100 min-w-fit transition-all relative",
                                    isActive ? "bg-slate-50" : "hover:bg-slate-50/50"
                                )}
                            >
                                <Icon size={14} className={isActive ? "text-slate-900" : "text-slate-400"} />
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest",
                                    isActive ? "text-slate-900" : "text-slate-500"
                                )}>{tab.label}</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-sm text-[10px] font-black tabular-nums transition-colors",
                                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                                )}>{tab.count}</span>
                                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Global Stats Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 bg-white border-b border-slate-200">
                <div className="px-6 py-4 border-r border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{statusFilter} Records</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900 tabular-nums">
                            {activeTab === 'vendor' ? (vendors?.length || 0) : activeTab === 'franchise' ? (franchises?.length || 0) : activeTab === 'delivery' ? (deliveryPartners?.length || 0) : 0}
                        </span>
                        <div className={cn(
                            "px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border",
                            statusFilter === 'Pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                statusFilter === 'Verified' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                    "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                            {statusFilter === 'All' ? 'Processed' : statusFilter}
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-r border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Time</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900 tabular-nums">4.2h</span>
                        <span className="text-[10px] font-bold text-emerald-500">-12% vs LY</span>
                    </div>
                </div>
                <div className="px-6 py-4 border-r border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-slate-900 tabular-nums">92.4%</span>
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">942 Approved</span>
                    </div>
                </div>
                <div className="px-6 py-4 flex items-center justify-center bg-slate-50/50">
                </div>
            </div>

            <FilterBar
                onSearch={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                activeFilter={statusFilter}
                onFilterChange={setStatusFilter}
                filters={['Pending', 'Verified']}
                onRefresh={() => {
                    const mappedStatus = statusFilter === 'Verified'
                        ? (activeTab === 'vendor' ? 'active' : 'verified')
                        : statusFilter.toLowerCase();
                    if (activeTab === 'vendor') fetchVendors(mappedStatus);
                    else if (activeTab === 'franchise') fetchPendingFranchises(mappedStatus);
                    else if (activeTab === 'delivery') fetchDeliveryPartners(statusFilter.toLowerCase());
                }}
            />

            {/* Verification Deck */}
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest tabular-nums leading-none">
                        Status: Live {currentItems.length} Waiting for Review
                    </div>

                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    >
                        {currentItems.map((item) => (
                            <ApprovalCard
                                key={item._id}
                                item={item}
                                type={activeTab}
                                onApprove={() => handleApprove(item)}
                                onReject={() => handleReject(item)}
                                onViewDoc={(it) => setSelectedItem(it)}
                            />
                        ))}

                        {currentItems.length === 0 && (
                            <div className="col-span-full py-24 flex flex-col items-center text-center bg-white border border-slate-200 border-dashed rounded-sm">
                                <div className="w-12 h-12 bg-slate-50 rounded-sm flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm">All caught up</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Nothing waiting for verification</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <ApprovalDetailDrawer
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                item={selectedItem}
                type={activeTab}
                onApprove={(it, categories) => handleApprove(it || selectedItem, categories)}
                onReject={(it, reason) => handleReject(it || selectedItem, reason)}
            />
        </div>
    );
}
