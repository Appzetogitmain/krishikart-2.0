import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tags,
    CheckCircle2,
    XCircle,
    Home,
    ChevronRight,
    Search,
    RefreshCw,
    Building,
    Check,
    X,
    Clock,
    AlertCircle
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CategoryApprovalScreen() {
    const { 
        categoryRequests, 
        fetchPendingCategoryRequests, 
        reviewCategoryRequest,
        vendorCategoryRequests,
        fetchPendingVendorCategoryRequests,
        reviewVendorCategoryRequest,
        isLoading 
    } = useAdmin();
    
    const [activeTab, setActiveTab] = useState('franchise'); // 'franchise' or 'vendor'
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (activeTab === 'franchise') {
            fetchPendingCategoryRequests();
        } else {
            fetchPendingVendorCategoryRequests();
        }
    }, [activeTab]);

    const currentRequests = activeTab === 'franchise' ? categoryRequests : vendorCategoryRequests;

    const filteredRequests = (currentRequests || []).filter(f => {
        const name = activeTab === 'franchise' ? f.franchiseName : f.fullName;
        const owner = activeTab === 'franchise' ? f.ownerName : f.farmLocation;
        return (
            name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            owner?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    const handleReview = async (entityId, categoryId, status) => {
        if (activeTab === 'franchise') {
            await reviewCategoryRequest(entityId, categoryId, status);
        } else {
            await reviewVendorCategoryRequest(entityId, categoryId, status);
        }
    };

    if (isLoading && currentRequests.length === 0) {
        return (
            <div className="p-8 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-64 bg-white border border-slate-200 rounded-sm" />
                <div className="h-64 bg-white border border-slate-200 rounded-sm" />
            </div>
        );
    }

    return (
        <div className="bg-[#f8fafd] min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Approvals</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900">Category Ownership</span>
                        </div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">Category Requests</h1>
                    </div>
                    <button 
                        onClick={() => activeTab === 'franchise' ? fetchPendingCategoryRequests() : fetchPendingVendorCategoryRequests()}
                        disabled={isLoading}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"
                    >
                        <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-8 max-w-7xl mx-auto space-y-8">
                {/* Tab Switcher */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-sm w-fit border border-slate-200 shadow-inner">
                    <button
                        onClick={() => setActiveTab('franchise')}
                        className={cn(
                            "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm flex items-center gap-2",
                            activeTab === 'franchise' 
                                ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Building size={12} />
                        Franchise Requests
                    </button>
                    <button
                        onClick={() => setActiveTab('vendor')}
                        className={cn(
                            "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm flex items-center gap-2",
                            activeTab === 'vendor' 
                                ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Tags size={12} />
                        Vendor Requests
                    </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="bg-white p-4 border border-slate-200 rounded-sm flex items-center gap-4 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={activeTab === 'franchise' ? "SEARCH BY FRANCHISE NAME OR OWNER..." : "SEARCH BY VENDOR NAME OR LOCATION..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-sm text-[10px] font-black uppercase tracking-widest focus:bg-white focus:border-slate-900 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Requests List */}
                <div className="grid grid-cols-1 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredRequests.map((entity) => (
                            <motion.div
                                key={entity._id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm hover:border-slate-400 transition-all"
                            >
                                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 bg-slate-50/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-white border border-slate-200 rounded-sm flex items-center justify-center text-slate-900 shadow-sm">
                                            {activeTab === 'franchise' ? <Building size={24} /> : <Tags size={24} />}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                {activeTab === 'franchise' ? entity.franchiseName : entity.fullName}
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                                                <span>{activeTab === 'franchise' ? `Owner: ${entity.ownerName}` : `Location: ${entity.farmLocation}`}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                <span>{activeTab === 'franchise' ? entity.city : entity.mobile}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right hidden md:block">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-900 uppercase">{entity.requestedCategories.length} Categories Pending</span>
                                                <Clock size={12} className="text-amber-500 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {entity.requestedCategories.map((cat) => (
                                            <div key={cat._id} className="bg-white border border-slate-100 rounded-sm p-4 flex items-center justify-between group hover:border-slate-300 transition-all shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-sm flex items-center justify-center border border-slate-100">
                                                        <img src={cat.image} className="w-6 h-6 object-contain" alt={cat.name} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{cat.name}</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Approval Required</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleReview(entity._id, cat._id, 'rejected')}
                                                        className="w-8 h-8 rounded-sm border border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center justify-center shadow-sm"
                                                        title="Reject Request"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReview(entity._id, cat._id, 'approved')}
                                                        className="w-8 h-8 rounded-sm bg-slate-900 text-white hover:bg-emerald-600 transition-all flex items-center justify-center shadow-lg shadow-slate-200"
                                                        title="Approve Request"
                                                    >
                                                        <Check size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer / Context info */}
                                    <div className="mt-6 pt-6 border-t border-slate-50 flex items-center gap-4">
                                        <div className="flex -space-x-2">
                                            {(entity.servedCategories || []).slice(0, 5).map((cat, i) => (
                                                <div key={i} className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase ring-2 ring-white shadow-sm" title={cat.name}>
                                                    {cat.name.charAt(0)}
                                                </div>
                                            ))}
                                            {entity.servedCategories?.length > 5 && (
                                                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 ring-2 ring-white">
                                                    +{entity.servedCategories.length - 5}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Currently serving {entity.servedCategories?.length || 0} categories
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {filteredRequests.length === 0 && !isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-32 flex flex-col items-center justify-center bg-white border border-slate-200 border-dashed rounded-sm"
                            >
                                <div className="w-16 h-16 bg-slate-50 rounded-sm flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">All done</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">No pending {activeTab} category requests found</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
