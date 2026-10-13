import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Search,
    FileText,
    Truck,
    Clock,
    Filter,
    Download,
    CheckCircle2,
    IndianRupee,
    ChevronRight,
    MapPin,
    Building,
    Store,
    Home,
    AlertCircle,
    Package,
    ArrowUpRight
} from 'lucide-react';
import POCreationDrawer from '../components/drawers/POCreationDrawer';
import MultiVendorAssignmentDrawer from '../components/drawers/MultiVendorAssignmentDrawer';
import DeliveryAssignmentDrawer from '../components/drawers/DeliveryAssignmentDrawer';
import StatusBadge from '../components/common/StatusBadge';
import MetricRow from '../components/cards/MetricRow';
import FilterBar from '../components/tables/FilterBar';
import mockPOs from '../data/mockPurchaseOrders.json';
import { cn } from '@/lib/utils';

export default function PurchaseManagerScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedPOForAssignment, setSelectedPOForAssignment] = useState(null);
    const [selectedPOForDelivery, setSelectedPOForDelivery] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    const filteredPOs = mockPOs.purchaseOrders.filter(po => {
        const matchesSearch = po.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || po.status === activeFilter;
        return matchesSearch && matchesFilter;
    });

    const handleFinalizeAssignment = (assignments) => {
        setSelectedPOForAssignment(null);
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 800);
    };

    const handleDeliveryAssignment = (partner) => {
        setSelectedPOForDelivery(null);
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 800);
    };

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-20 bg-slate-50 border border-slate-200" />
                <div className="h-10 bg-slate-100 rounded-sm" />
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-50 border border-slate-200 rounded-sm" />)}
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
                            <span>Procurement</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Purchases</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Purchase Order Management</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-400 transition-colors">
                            <Download size={14} />
                        </button>
                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-sm text-[11px] font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <Plus size={13} />
                            Create New PO
                        </button>
                    </div>
                </div>
            </div>

            {/* Procurement Stats Strip */}
            <div className="grid grid-cols-1 md:grid-cols-4 bg-white border-b border-slate-200">
                <MetricRow label="Pending Approval" value="12" change={4.2} trend="up" icon={Clock} />
                <MetricRow label="Awaiting Dispatch" value="08" change={-2.1} trend="down" icon={Truck} />
                <MetricRow label="Active Transit" value="04" change={1.2} trend="up" icon={MapPin} />
                <MetricRow label="Daily Fulfillment" value="42" change={8.5} trend="up" icon={CheckCircle2} />
            </div>

            {/* Operational Workspace */}
            <div className="p-4 space-y-4">
                <FilterBar
                    onSearch={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                    filters={['all', 'pending_approval', 'approved', 'draft']}
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                />


                {/* PO Operational List */}
                <div className="space-y-1">
                    {filteredPOs.map((po) => (
                        <motion.div
                            key={po.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-slate-200 rounded-sm p-4 hover:border-slate-400 transition-all group flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                        >
                            <div className="flex items-start gap-4 flex-1">
                                <div className="w-10 h-10 border border-slate-100 bg-slate-50 rounded-sm flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors">
                                    <Package size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-900 text-sm uppercase tracking-tight">{po.id}</span>
                                        <div className={cn(
                                            "px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border",
                                            po.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                po.status === 'pending_approval' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                    "bg-slate-50 text-slate-500 border-slate-100"
                                        )}>
                                            {po.status.replace('_', ' ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <Building size={12} />
                                            {po.vendorName}
                                        </div>
                                        <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <Store size={12} />
                                            {po.franchiseName}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-10 lg:px-10 lg:border-x border-slate-100">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Value</span>
                                    <div className="text-sm font-black text-slate-900 tabular-nums">
                                        ₹{po.totalAmount.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Items</span>
                                    <div className="text-sm font-black text-slate-900 tabular-nums uppercase">
                                        {po.items.length} Units
                                    </div>
                                </div>
                                <div className="hidden xl:block">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">Origin Date</span>
                                    <div className="text-sm font-black text-slate-900 tabular-nums">
                                        {new Date(po.createdAt).toLocaleDateString('en-GB')}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {po.status === 'pending_approval' ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPOForAssignment(po);
                                        }}
                                        className="bg-slate-900 text-white px-4 py-2 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        Procure Items
                                        <ArrowUpRight size={14} />
                                    </button>
                                ) : po.status === 'approved' && po.dispatchStatus === 'ready_for_pickup' ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPOForDelivery(po);
                                        }}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        Assign Delivery
                                        <Truck size={14} />
                                    </button>
                                ) : (
                                    <button className="bg-white border border-slate-200 text-slate-400 px-4 py-2 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:text-slate-900 hover:border-slate-400 transition-all">
                                        View Details
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {filteredPOs.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                        <FileText size={40} className="text-slate-300 mb-4" />
                        <h3 className="text-sm font-bold text-slate-900">No Purchase Records</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-1">Try a different search</p>
                    </div>
                )}
            </div>

            {/* System Context Footer */}
            <div className="px-4 py-1.5 bg-slate-900 text-white/50 flex items-center justify-between border-t border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
                        <div className="w-1 h-1 rounded-full bg-emerald-400" />
                        Kisaankart
                    </div>
                    <div className="h-3 w-px bg-slate-700" />
                    <div className="text-[10px] font-bold tabular-nums"></div>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest">Purchases</div>
            </div>

            <POCreationDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onSave={() => setIsDrawerOpen(false)}
            />

            <MultiVendorAssignmentDrawer
                isOpen={!!selectedPOForAssignment}
                onClose={() => setSelectedPOForAssignment(null)}
                po={selectedPOForAssignment}
                onFinalize={handleFinalizeAssignment}
            />

            <DeliveryAssignmentDrawer
                isOpen={!!selectedPOForDelivery}
                onClose={() => setSelectedPOForDelivery(null)}
                assignment={selectedPOForDelivery}
                onAssign={handleDeliveryAssignment}
            />
        </div>
    );
}
