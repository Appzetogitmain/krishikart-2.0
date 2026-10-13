import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardList,
    Clock,
    CheckCircle2,
    Truck,
    Search,
    ChevronRight,
    AlertCircle,
    Package,
    IndianRupee,
    ArrowRight,
    LayoutGrid,
    List as ListIcon,
    Calendar
} from 'lucide-react';
import mockOrders from '../data/mockVendorOrders.json';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '@/modules/user/contexts/OrderContext';
// import { useProcurement } from '@/modules/franchise/contexts/ProcurementContext';
import FilterBar from '../components/tables/FilterBar';
import DataGrid from '../components/tables/DataGrid';
import VendorBackBar from '../components/navigation/VendorBackBar';

import api from '@/lib/axios';
import { useVendorAuth } from '../contexts/VendorAuthContext';

export default function OrdersScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('New');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    // const { orders: contextOrders } = useOrders();
    const tabs = ['New', 'Preparing', 'Ready', 'Completed'];

    // Map context orders that require procurement into the vendor format
    /* const liveVendorOrders = contextOrders
        .filter(o => o.fulfillmentType === 'requires_procurement')
        .map(o => ({
            id: o.id,
            franchiseName: o.franchise || 'Main Center',
            total: o.procurementTotal || o.total,
            procurementTotal: o.procurementTotal,
            status: (o.status === 'assigned' || !o.status) ? 'new' : o.status,
            items: o.items,
            priority: o.priority || 'normal',
            deadline: o.deadline || new Date(Date.now() + 3600000).toISOString()
        })); */

    const [procurementRequests, setProcurementRequests] = useState([]);
    const { newAssignmentData } = useVendorAuth();

    const fetchAssignments = async () => {
        try {
            const response = await api.get('/procurement/vendor/my-assignments');
            if (response.data.success) {
                setProcurementRequests(response.data.results);
            }
        } catch (error) {
            console.error("Failed to fetch vendor assignments", error);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, []);

    useEffect(() => {
        if (newAssignmentData) {
            fetchAssignments();
        }
    }, [newAssignmentData]);

    const mappedProcurementRequests = procurementRequests.map(req => ({
        id: req._id,
        franchiseName: req.franchiseId?.shopName || req.franchiseId?.ownerName || 'Franchise Request',
        franchiseMobile: req.franchiseId?.mobile || '+91 00000 00000',
        total: req.totalEstimatedAmount || 0,
        status: req.status,
        items: req.items.map(i => ({
            ...i,
            image: i.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=20" // Placeholder
        })),
        date: req.createdAt,
        isProcurement: true,
        priority: 'high',
        deadline: new Date((req.createdAt ? new Date(req.createdAt).getTime() : Date.now()) + 7200000).toISOString()
    }));

    // const allOrders = [...mappedProcurementRequests, ...liveVendorOrders, ...mockOrders.filter(m => !liveVendorOrders.find(l => l.id === m.id))];
    const allOrders = mappedProcurementRequests;

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 600);
        return () => clearTimeout(timer);
    }, []);

    const filteredOrders = allOrders.filter(order => {
        const statusMap = {
            'New': ['new', 'assigned', 'bidding', 'accepted', 'requested', 'quoted'],
            'Preparing': ['preparing', 'approved'],
            'Ready': ['ready', 'ready_for_pickup'],
            'Completed': ['completed', 'delivered', 'shipped']
        };

        const matchesTab = statusMap[activeTab].includes(order.status);
        const matchesSearch = (order.franchiseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.items?.some(item => (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

        return matchesTab && matchesSearch;
    });

    const columns = [
        {
            header: 'Order Reference',
            key: 'id',
            render: (val, row) => (
                <div>
                    <p className="text-primary font-black uppercase tracking-widest">{val}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{row.franchiseName}</p>
                </div>
            )
        },
        {
            header: 'Items',
            key: 'items',
            render: (val) => (
                <div className="flex -space-x-2">
                    {val?.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 overflow-hidden shadow-sm">
                            <img src={item.image} className="w-full h-full object-cover" alt="" />
                        </div>
                    ))}
                    {val?.length > 3 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                            +{val.length - 3}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Status',
            key: 'status',
            align: 'right',
            render: (val) => (
                <span className={cn(
                    "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                    statusColors[val] || "bg-slate-50 text-slate-400 border-slate-100"
                )}>
                    {val}
                </span>
            )
        }
    ];

    const statusColors = {
        'new': "bg-blue-50 text-blue-600 border-blue-100",
        'assigned': "bg-blue-50 text-blue-600 border-blue-100",
        'bidding': "bg-amber-50 text-amber-600 border-amber-100",
        'accepted': "bg-emerald-50 text-emerald-600 border-emerald-100",
        'ready': "bg-emerald-50 text-emerald-600 border-emerald-100",
        'preparing': "bg-amber-50 text-amber-600 border-amber-100",
        'completed': "bg-slate-50 text-slate-400 border-slate-100",
        'delivered': "bg-slate-50 text-slate-400 border-slate-100",
        'requested': "bg-indigo-50 text-indigo-600 border-indigo-100",
        'quoted': "bg-amber-50 text-amber-600 border-amber-100",
        'approved': "bg-emerald-50 text-emerald-600 border-emerald-100"
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-slate-100 rounded-xl" />
                <div className="h-14 w-full bg-slate-100 rounded-2xl" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-[32px]" />)}
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
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Supply Requests</h1>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">Active: {allOrders.length} orders</p>
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
                onSearchChange={(v) => setSearchTerm(typeof v === 'string' ? v.trim() : v)}
                placeholder="Search orders..."
            />

            {viewMode === 'list' ? (
                <DataGrid
                    columns={columns}
                    data={filteredOrders}
                    onRowClick={(row) => navigate(`/vendor/orders/${row.id}`)}
                />
            ) : (
                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {filteredOrders.map((order, index) => (
                            <motion.div
                                key={order.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                onClick={() => navigate(`/vendor/orders/${order.id}`, { state: { order } })}
                                className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white rotate-3 shadow-lg group-hover:rotate-0 transition-transform">
                                            <ClipboardList size={22} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px]">ID: {order.id}</p>
                                            <h4 className="text-lg font-black text-slate-900 tracking-tighter">{order.franchiseName}</h4>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                        statusColors[order.status] || "bg-slate-50 text-slate-400 border-slate-100"
                                    )}>
                                        {order.status}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
                                    {order.items?.map((item, idx) => (
                                        <div key={idx} className="flex-shrink-0 flex items-center gap-2 bg-slate-50 p-2 pr-4 rounded-xl border border-slate-100 group-hover:bg-white transition-colors duration-500">
                                            <div className="w-10 h-10 rounded-lg bg-white overflow-hidden border border-slate-100">
                                                <img src={item.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none">{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.quantity} {item.unit}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-slate-400 capitalize">
                                            <Calendar size={14} />
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                                {new Date(order.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:translate-x-1">
                                        <ChevronRight size={18} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {filteredOrders.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4 border border-dashed border-slate-200">
                        <AlertCircle size={32} />
                    </div>
                    <h4 className="text-slate-900 font-black tracking-tight uppercase tracking-widest">No orders right now</h4>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">No orders match your search</p>
                </div>
            )}
        </div>
    );
}
