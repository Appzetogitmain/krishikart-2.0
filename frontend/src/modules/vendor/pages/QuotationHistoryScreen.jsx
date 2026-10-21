import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardList,
    Clock,
    CheckCircle2,
    Search,
    ChevronRight,
    AlertCircle,
    Package,
    IndianRupee,
    ArrowRight,
    LayoutGrid,
    List as ListIcon,
    Calendar,
    ArrowUpRight,
    TrendingDown,
    TrendingUp,
    Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/tables/FilterBar';
import DataGrid from '../components/tables/DataGrid';
import VendorBackBar from '../components/navigation/VendorBackBar';
import api from '@/lib/axios';

export default function QuotationHistoryScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [procurementRequests, setProcurementRequests] = useState([]);
    
    const tabs = ['All', 'Quoted', 'Approved', 'Rejected'];

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await api.get('/procurement/vendor/my-assignments');
                if (response.data.success) {
                    // Filter for requests that have at least been quoted
                    const quotedOnly = response.data.results.filter(req => 
                        ['quoted', 'negotiating', 'approved', 'preparing', 'ready_for_pickup', 'picked_up', 'completed', 'rejected'].includes(req.status)
                    );
                    setProcurementRequests(quotedOnly);
                }
            } catch (error) {
                console.error("Failed to fetch vendor assignments", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAssignments();
    }, []);

    const filteredOrders = procurementRequests.filter(order => {
        const matchesTab = activeTab === 'All' || 
            (activeTab === 'Quoted' && (order.status === 'quoted' || order.status === 'negotiating')) ||
            (activeTab === 'Approved' && ['approved', 'preparing', 'ready_for_pickup', 'picked_up', 'completed'].includes(order.status)) ||
            (activeTab === 'Rejected' && order.status === 'rejected');

        const matchesSearch = (order.franchiseId?.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            order._id.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const columns = [
        {
            header: 'Quotation Ref',
            key: '_id',
            render: (val, row) => (
                <div>
                    <p className="text-primary font-black uppercase tracking-widest text-[10px]">ID: {val.slice(-6).toUpperCase()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{row.franchiseId?.shopName || 'Franchise'}</p>
                </div>
            )
        },
        {
            header: 'Vendor Quote',
            key: 'vendorQuoteTotal',
            render: (val, row) => (
                <div className="flex items-baseline gap-1">
                    <span className="text-[11px] font-black tabular-nums text-slate-900">₹{val?.toLocaleString() || row.totalQuotedAmount?.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">INR</span>
                </div>
            )
        },
        {
            header: 'Admin Price',
            key: 'totalQuotedAmount',
            render: (val, row) => {
                const amount = Number(val) || 0; // older requests may not have a total yet
                const vendorTotal = Number(row.vendorQuoteTotal || row.totalQuotedAmount) || 0;
                const variance = amount - vendorTotal;
                const hasBeenAudited = variance !== 0;

                return (
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-1">
                            <span className={cn(
                                "text-[11px] font-black tabular-nums",
                                hasBeenAudited ? "text-slate-900" : "text-slate-300"
                            )}>
                                ₹{amount.toLocaleString()}
                            </span>
                        </div>
                        {hasBeenAudited && (
                            <p className={cn(
                                "text-[10px] font-bold uppercase tracking-tighter flex items-center gap-0.5",
                                variance < 0 ? "text-rose-500" : "text-amber-500"
                            )}>
                                {variance < 0 ? <TrendingDown size={8} /> : <TrendingUp size={8} />}
                                {Math.abs(variance).toLocaleString()} {variance < 0 ? 'Reduced' : 'Revised'}
                            </p>
                        )}
                    </div>
                );
            }
        },
        {
            header: 'Status',
            key: 'status',
            align: 'right',
            render: (val) => {
                const displayStatus = ['approved', 'preparing', 'ready_for_pickup', 'picked_up', 'completed'].includes(val) ? 'Approved' : val;
                return (
                    <span className={cn(
                        "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border capitalize",
                        statusColors[val] || "bg-slate-50 text-slate-400 border-slate-100"
                    )}>
                        {displayStatus}
                    </span>
                );
            }
        }
    ];

    const statusColors = {
        'quoted': "bg-amber-50 text-amber-600 border-amber-100",
        'negotiating': "bg-orange-100 text-orange-700 border-orange-200",
        'approved': "bg-emerald-50 text-emerald-600 border-emerald-100",
        'preparing': "bg-emerald-50 text-emerald-600 border-emerald-100",
        'ready_for_pickup': "bg-emerald-50 text-emerald-600 border-emerald-100",
        'picked_up': "bg-emerald-50 text-emerald-600 border-emerald-100",
        'completed': "bg-slate-50 text-slate-400 border-slate-100",
        'rejected': "bg-rose-50 text-rose-600 border-rose-100"
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse p-8">
                <div className="h-10 w-48 bg-slate-100 rounded-xl" />
                <div className="h-14 w-full bg-slate-100 rounded-2xl" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <VendorBackBar className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Quotations</h1>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">Your quotations and the admin’s decisions</p>
                    </div>
                </div>
                <div className="flex bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn("p-2 rounded-xl transition-all", viewMode === 'grid' ? "bg-slate-900 text-white" : "text-slate-400")}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn("p-2 rounded-xl transition-all", viewMode === 'list' ? "bg-slate-900 text-white" : "text-slate-400")}
                    >
                        <ListIcon size={18} />
                    </button>
                </div>
            </header>

            <FilterBar
                categories={tabs}
                activeCategory={activeTab}
                onCategoryChange={setActiveTab}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="Search quotations..."
            />

            {viewMode === 'list' ? (
                <DataGrid
                    columns={columns}
                    data={filteredOrders}
                    onRowClick={(row) => navigate(`/vendor/orders/${row._id}`)}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredOrders.map((order, index) => {
                            const vendorTotal = Number(order.vendorQuoteTotal || order.totalQuotedAmount) || 0;
                            const authorizedTotal = Number(order.totalQuotedAmount) || 0;
                            const variance = authorizedTotal - vendorTotal;
                            const hasBeenAudited = variance !== 0;
                            const isApproved = ['approved', 'preparing', 'ready_for_pickup', 'picked_up', 'completed'].includes(order.status);

                            return (
                                <motion.div
                                    key={order._id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    onClick={() => navigate(`/vendor/orders/${order._id}`)}
                                    className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                                <ClipboardList size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">REQ #{order._id.slice(-6).toUpperCase()}</p>
                                                <h4 className="text-sm font-black text-slate-900 tracking-tight">{order.franchiseId?.shopName || 'Franchise'}</h4>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            statusColors[order.status] || "bg-slate-50 text-slate-400 border-slate-100"
                                        )}>
                                            {isApproved ? 'Approved' : order.status === 'negotiating' ? 'New rate offered' : order.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">My Quote</p>
                                            <p className="text-sm font-black text-slate-900 tabular-nums">₹{vendorTotal.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Admin Price</p>
                                            <div className="flex items-center gap-2">
                                                <p className={cn(
                                                    "text-sm font-black tabular-nums",
                                                    hasBeenAudited ? "text-slate-900" : "text-slate-300"
                                                )}>
                                                    ₹{authorizedTotal.toLocaleString()}
                                                </p>
                                                {hasBeenAudited && (
                                                    <span className={cn(
                                                        "text-[10px] font-black flex items-center",
                                                        variance < 0 ? "text-rose-500" : "text-amber-500"
                                                    )}>
                                                        {variance < 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex -space-x-1.5">
                                        {order.items.slice(0, 4).map((item, i) => (
                                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-50 overflow-hidden">
                                                <img src={item.image} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                        {order.items.length > 4 && (
                                            <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                +{order.items.length - 4}
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 translate-x-0">
                                        <ChevronRight size={18} className="text-slate-300" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {filteredOrders.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-dashed border-slate-200">
                        <ArrowUpRight size={32} strokeWidth={1} />
                    </div>
                    <h4 className="text-slate-900 font-black tracking-tight uppercase tracking-widest">No quotations yet</h4>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Quotations you send will appear here with the admin's decision</p>
                </div>
            )}
        </div>
    );
}
