import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    ShoppingBag,
    Truck,
    CheckCircle2,
    Zap,
    History,
    Home,
    ChevronRight,
    Search as SearchIcon,
    Settings2,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    IndianRupee,
    RefreshCw,
    Info,
    Package,
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { cn } from '@/lib/utils';
import { useInventory } from '../contexts/InventoryContext';
import {
    X,
    UserCircle2,
    Check
} from 'lucide-react';
import { toast } from 'sonner';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';
import OrderHistoryModal from '../components/modals/OrderHistoryModal';

export default function OrdersScreen() {
    const navigate = useNavigate();
    const {
        orders: allOrders,
        updateOrderStatus,
        acceptOrder,
        rejectFranchiseOrder,
        assignDeliveryPartner,
        deliveryPartners,
        stats,
        refreshOrders
    } = useFranchiseOrders();
    const { inventory, refreshInventory } = useInventory();
    const [activeTab, setActiveTab] = useState('new');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [processingOrderId, setProcessingOrderId] = useState(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [packageCount, setPackageCount] = useState(0);
    const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState(null);
    const [selectedOrderForPacking, setSelectedOrderForPacking] = useState(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [rejectingOrderId, setRejectingOrderId] = useState(null);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [quickFilter, setQuickFilter] = useState('all');
    const filterMenuRef = useRef(null);

    useEffect(() => {
        if (!isFilterMenuOpen) return;

        const handleClickOutside = (event) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
                setIsFilterMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isFilterMenuOpen]);

    const handleAcceptOrder = async (orderId) => {
        setProcessingOrderId(orderId);
        await acceptOrder(orderId);
        setProcessingOrderId(null);
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 600);
        return () => clearTimeout(timer);
    }, [activeTab]);

    const handleAction = async (orderId, newStatus, extraData = {}) => {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        if (newStatus === 'accept') {
            setProcessingOrderId(orderId);
            await acceptOrder(orderId);
            setProcessingOrderId(null);
            return;
        }

        if (newStatus === 'procure') {
            setProcessingOrderId(orderId);
            await updateOrderStatus(orderId, 'procuring');
            setProcessingOrderId(null);
            navigate('/franchise/procurement');
            toast.info("Not enough stock. Opening the stock request screen...");
            return;
        }

        if (newStatus === 'Packed' && !extraData.numberOfPackages) {
            setSelectedOrderForPacking(orderId);
            setIsPackageModalOpen(true);
            return;
        }

        // Logic for marking packed (preparing or ready)
        const mappedStatus = (newStatus === 'preparing' || newStatus === 'ready') ? 'Packed' : newStatus;

        setProcessingOrderId(orderId);
        await updateOrderStatus(orderId, mappedStatus, extraData);
        setProcessingOrderId(null);

        if (mappedStatus === 'Packed') {
            refreshInventory();
        }
    };

    const handleConfirmPacking = async () => {
        if (!selectedOrderForPacking) return;
        await handleAction(selectedOrderForPacking, 'Packed', { numberOfPackages: packageCount });
        setIsPackageModalOpen(false);
        setSelectedOrderForPacking(null);
        setPackageCount(0);
    };

    const handleAssignDelivery = async (partnerId) => {
        if (!selectedOrderForDispatch || !partnerId) return;
        setIsAssigning(true);
        const success = await assignDeliveryPartner(selectedOrderForDispatch, partnerId);
        if (success) {
            setIsAssignModalOpen(false);
            setSelectedOrderForDispatch(null);
            refreshInventory(); // Stock is deducted on the backend during dispatch
        }
        setIsAssigning(false);
    };

    const tabs = [
        { id: 'new', label: 'New', icon: ShoppingBag },
        { id: 'ready', label: 'Ready to Dispatch', icon: Zap },
        { id: 'completed', label: 'Completed', icon: History }
    ];

    const filteredOrders = allOrders.filter(order => {
        let matchesTab = false;
        const status = (order.status || '').toLowerCase();

        if (activeTab === 'new') {
            matchesTab = ['placed', 'pending', 'new', 'procuring', 'assigned', 'accepted'].includes(status);
        } else if (activeTab === 'ready') {
            matchesTab = ['packed', 'dispatched', 'ready'].includes(status);
        } else if (activeTab === 'completed') {
            matchesTab = ['delivered', 'received', 'completed'].includes(status);
        }

        const hotelName = order.hotelName || order.userId?.fullName || 'Unknown';
        const orderId = (order._id || order.id || '').toString();
        const matchesSearch = orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            hotelName.toLowerCase().includes(searchQuery.toLowerCase());
        const hasShortage = order.items.some(i => i.isShortage) && !order.allowPartialFulfillment;
        const hasDeliveryPartner = !!order.deliveryPartner;
        const isAutoAssigned = !!order.franchiseAutoAccepted;
        const isPartialFulfillment = !!order.allowPartialFulfillment;

        let matchesQuickFilter = true;
        if (quickFilter === 'auto-assigned') matchesQuickFilter = isAutoAssigned;
        if (quickFilter === 'procurement-needed') matchesQuickFilter = hasShortage;
        if (quickFilter === 'delivery-assigned') matchesQuickFilter = hasDeliveryPartner;
        if (quickFilter === 'partial-fulfillment') matchesQuickFilter = isPartialFulfillment;

        return matchesTab && matchesSearch && matchesQuickFilter;
    });

    const filterOptions = [
        { id: 'all', label: 'All Orders' },
        { id: 'auto-assigned', label: 'Auto Assigned' },
        { id: 'procurement-needed', label: 'Needs Stock' },
        { id: 'delivery-assigned', label: 'Delivery Assigned' },
        { id: 'partial-fulfillment', label: 'Partial Delivery Allowed' },
    ];

    const activeFilterLabel = filterOptions.find((option) => option.id === quickFilter)?.label || 'All Orders';

    const orderColumns = [
        {
            header: 'Customer Name',
            key: 'hotelName',
            render: (val, row) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-sm tracking-tight">{val}</span>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-[0.05em] mt-0.5">Order #{row.id}</span>
                </div>
            )
        },
        {
            header: 'Date & Time',
            key: 'dateTime',
            render: (val, row) => {
                const safeDate = (dateStr) => {
                    const d = new Date(dateStr);
                    return isNaN(d.getTime()) ? new Date() : d;
                };

                const displayDate = row.date || safeDate(row.timeline?.[0]?.time || Date.now()).toLocaleDateString();
                const displayTime = row.time || safeDate(row.timeline?.[0]?.time || Date.now()).toLocaleTimeString();

                return (
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm tracking-tight">{displayDate}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-[0.05em] mt-0.5">{displayTime}</span>
                        {row.scheduledDateFormatted || row.scheduledDate ? (
                             <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-md mt-2 w-fit border-2 border-amber-200 shadow-sm flex items-center gap-1.5 animate-pulse uppercase tracking-wider">
                                <Clock size={10} strokeWidth={3} />
                                Target: {row.scheduledDateFormatted || new Date(row.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                             </span>
                        ) : null}
                    </div>
                );
            }
        },
        {
            header: 'Delivery Slot',
            key: 'deliverySlot',
            render: (val, row) => (
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{val}</span>
                    {row.scheduledDateFormatted || row.scheduledDate ? (
                        <div className="flex items-center gap-1 mt-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-amber-200">
                                ADVANCE BOOKING
                            </span>
                        </div>
                    ) : null}
                </div>
            )
        },
        {
            header: 'Amount',
            key: 'total',
            align: 'right',
            render: (val) => <span className="text-sm font-bold text-slate-900 tabular-nums">₹{(val || 0).toLocaleString()}</span>
        },
        {
            header: 'Total Items',
            key: 'items',
            render: (items) => <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{items.length} units</span>
        },
        {
            header: 'Payment',
            key: 'paymentMode',
            render: (val) => {
                const method = (val || 'COD').toUpperCase();
                const isCOD = method === 'COD';
                const isUPI = method === 'UPI';
                const isWallet = method.includes('WALLET');
                const isCredit = method.includes('CREDIT');
                return (
                    <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border',
                        isCOD ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        isUPI ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        isWallet ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        isCredit ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                        {isCOD ? '💵' : isUPI ? '📲' : isWallet ? '👛' : '💳'} {method}
                    </span>
                );
            }
        },
        {
            header: 'Action',
            key: 'actions',
            align: 'right',
            render: (_, row) => (
                <div className="flex items-center justify-end gap-2">
                    {row.status === 'procuring' && (
                        <div className="flex items-center gap-2 mr-4 bg-amber-50 px-2 py-1 rounded-sm border border-amber-200">
                            <RefreshCw size={12} className="text-amber-600 animate-spin" />
                            <span className="text-[10px] font-black text-amber-700 uppercase">Waiting for Stock</span>
                        </div>
                    )}
                    {activeTab === 'ready' && row.status === 'dispatched' && row.deliveryPartner && (
                        <div className="flex items-center gap-2 mr-4 bg-emerald-50 px-2 py-1 rounded-sm border border-emerald-100">
                            <UserCircle2 size={12} className="text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-700 uppercase">{row.deliveryPartner?.fullName}</span>
                        </div>
                    )}
                    {activeTab === 'new' && (
                        (row.status === 'placed' || row.status === 'assigned' || row.status === 'new') ? (
                            <button
                                onClick={() => handleAction(row.id, 'accept')}
                                disabled={processingOrderId === row.id}
                                className="p-1.5 px-3 text-[10px] font-black uppercase text-slate-900 border-2 border-slate-900 rounded-sm hover:bg-slate-900 hover:text-white transition-all disabled:opacity-50"
                            >
                                Accept Order
                            </button>
                        ) : row.status === 'accepted' && (
                            <>
                                {row.franchiseAutoAccepted && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setRejectingOrderId(row.id);
                                            await rejectFranchiseOrder(row.id);
                                            setRejectingOrderId(null);
                                            refreshOrders();
                                        }}
                                        disabled={rejectingOrderId === row.id}
                                        className="p-1.5 px-3 text-[10px] font-black uppercase text-rose-600 border-2 border-rose-600 rounded-sm hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                                    >
                                        {rejectingOrderId === row.id ? '…' : 'Reject'}
                                    </button>
                                )}
                                {row.items.some(i => i.isShortage) && !row.allowPartialFulfillment ? (
                                    <button
                                        onClick={() => handleAction(row.id, 'procure')}
                                        className="p-1.5 px-3 text-[10px] font-black uppercase text-amber-600 border-2 border-amber-600 rounded-sm hover:bg-amber-600 hover:text-white transition-all flex items-center gap-1.5"
                                    >
                                        <Info size={12} /> Request Stock
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleAction(row.id, 'Packed')}
                                        disabled={processingOrderId === row.id}
                                        className="p-1.5 px-3 text-[10px] font-black uppercase text-emerald-600 border-2 border-emerald-600 rounded-sm hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 shadow-sm"
                                    >
                                        {row.allowPartialFulfillment ? 'Pack Available Stock' : 'Mark Packed'}
                                    </button>
                                )}
                            </>
                        )
                    )}
                    {activeTab === 'ready' && row.status === 'packed' && (
                        <button
                            onClick={() => {
                                setSelectedOrderForDispatch(row.id);
                                setIsAssignModalOpen(true);
                            }}
                            className="p-1.5 px-3 text-xs font-bold uppercase text-orange-600 border border-orange-600 rounded-sm hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1.5"
                        >
                            <Truck size={12} /> Assign & Dispatch
                        </button>
                    )}
                    <button
                        onClick={() => navigate(`/franchise/orders/${row.id}`)}
                        className="p-1.5 px-3 text-xs font-bold uppercase text-slate-900 border border-slate-900 rounded-sm hover:bg-slate-900 hover:text-white transition-all"
                    >
                        View
                    </button>
                </div>
            )
        }
    ];

    if (isLoading && !filteredOrders.length) {
        return (
            <div className="p-4 space-y-4 animate-pulse bg-slate-50 min-h-screen">
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-16 bg-white border border-slate-200" />
                <div className="h-[500px] bg-white border border-slate-200" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={14} />
                            <ChevronRight size={12} />
                            <span>Franchise</span>
                            <ChevronRight size={12} />
                            <span className="text-slate-900 uppercase tracking-widest">Orders</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">Order Management</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                refreshOrders();
                                refreshInventory();
                                toast.info("Loading orders...");
                            }}
                            className="p-2 text-slate-400 hover:text-slate-900 transition-colors border border-slate-200 rounded-sm bg-white"
                        >
                            <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
                        </button>
                        <div className="relative" ref={filterMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                                aria-label="Open order filters"
                                title={quickFilter === 'all' ? 'Filter orders' : `Filter active: ${activeFilterLabel}`}
                                className={cn(
                                    "p-2 transition-colors border border-slate-200 rounded-sm bg-white",
                                    quickFilter === 'all'
                                        ? "text-slate-400 hover:text-slate-900"
                                        : "text-slate-900 border-slate-300 bg-slate-50"
                                )}
                            >
                                <Settings2 size={16} />
                            </button>
                            <AnimatePresence>
                                {isFilterMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-sm shadow-xl z-40 overflow-hidden"
                                    >
                                        <div className="px-3 py-2 border-b border-slate-100">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick Filters</p>
                                        </div>
                                        <div className="p-1">
                                            {filterOptions.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setQuickFilter(option.id);
                                                        setIsFilterMenuOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 rounded-sm text-[11px] font-black uppercase tracking-wide transition-colors",
                                                        quickFilter === option.id
                                                            ? "bg-slate-900 text-white"
                                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                    )}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={() => setIsHistoryModalOpen(true)}
                            className="bg-slate-900 text-white px-4 py-2 rounded-sm text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm uppercase tracking-widest"
                        >
                            <History size={14} />
                            Order History
                        </button>
                    </div>
                </div>
            </div>

            {/* Performance Strip */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-5">
                <MetricRow
                    label="New Orders"
                    value={stats.newOrders}
                    icon={ShoppingBag}
                />
                <MetricRow
                    label="Ready to Dispatch"
                    value={stats.readyToDispatch}
                    icon={CheckCircle2}
                />
                <MetricRow
                    label="Out for Delivery"
                    value={stats.outForDelivery}
                    icon={Truck}
                />
                <MetricRow
                    label="Completed"
                    value={stats.completedCount}
                    icon={History}
                />
                <MetricRow
                    label="Total Revenue"
                    value={`₹${stats.revenue.toLocaleString()}`}
                    trend="Stable"
                    icon={IndianRupee}
                />
            </div>

            <div className="p-px bg-slate-200">
                <FilterBar
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
                            <div className="relative group w-full max-w-xs">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search by Order ID or Customer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.trim())}
                                    className="bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:border-slate-400 transition-all font-sans min-w-[240px]"
                                />
                            </div>
                        </div>
                    }
                />

                <div className="bg-white border-t border-slate-200">
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
                                key="grid"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <DataGrid
                                    columns={orderColumns}
                                    data={filteredOrders}
                                    density="compact"
                                    showSearch={false}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Delivery Assignment Modal */}
            <AnimatePresence>
                {isAssignModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAssignModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-white rounded-sm shadow-2xl overflow-hidden"
                        >
                            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        <Truck size={16} className="text-emerald-400" />
                                        Assign Delivery Partner
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Order #{selectedOrderForDispatch?.slice(-6)}</p>
                                </div>
                                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {deliveryPartners.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No active partners found</p>
                                        </div>
                                    ) : (
                                        deliveryPartners.map((partner) => (
                                            <button
                                                key={partner._id}
                                                onClick={() => handleAssignDelivery(partner._id)}
                                                disabled={isAssigning}
                                                className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-sm hover:border-slate-900 hover:bg-white transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-slate-200 rounded-sm flex items-center justify-center text-slate-500 font-black text-xs uppercase">
                                                        {partner.fullName.slice(0, 2)}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{partner.fullName}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{partner.vehicleNumber} • {partner.vehicleType}</p>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setIsAssignModalOpen(false)}
                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Package Count Modal */}
            <AnimatePresence>
                {isPackageModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsPackageModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-white rounded-sm shadow-2xl overflow-hidden"
                        >
                            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        <Package size={16} className="text-emerald-400" />
                                        Pack Order
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Enter package count</p>
                                </div>
                                <button onClick={() => setIsPackageModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Number of Packages</label>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            min="0"
                                            value={packageCount === 0 ? '' : packageCount}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '') setPackageCount(0);
                                                else setPackageCount(Math.max(0, parseInt(v, 10) || 0));
                                            }}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-sm py-4 px-6 text-3xl font-black text-slate-900 outline-none focus:border-slate-900 transition-all text-center tabular-nums"
                                            placeholder="0"
                                            autoFocus
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                                            <button type="button" onClick={() => setPackageCount(p => p + 1)} className="p-1 hover:bg-white border border-slate-200 rounded text-slate-400 hover:text-slate-900 shadow-sm transition-all"><ArrowUpRight size={12} /></button>
                                            <button type="button" onClick={() => setPackageCount(p => Math.max(0, p - 1))} className="p-1 hover:bg-white border border-slate-200 rounded text-slate-400 hover:text-slate-900 shadow-sm transition-all"><ArrowDownRight size={12} /></button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tight leading-relaxed">
                                        How many boxes/bags is this order packed in? This number is printed on the delivery slip (Bilty).
                                    </p>
                                </div>

                                <button
                                    onClick={handleConfirmPacking}
                                    disabled={packageCount < 1 || processingOrderId === selectedOrderForPacking}
                                    title={packageCount < 1 ? 'Enter at least 1 package' : ''}
                                    className="w-full h-14 bg-slate-900 text-white rounded-sm font-black uppercase text-[11px] tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    Confirm & Mark Packed
                                    <Check size={16} className="text-emerald-400" />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Order History Modal */}
            <OrderHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
            />
        </div >
    );
}
