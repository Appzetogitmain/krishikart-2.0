import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Filter,
    Download,
    Plus,
    ChevronDown,
    X,
    Users,
    Star,
    MapPin,
    ArrowRight,
    ShoppingBag,
    Home,
    ChevronRight,
    ShoppingBasket,
    Activity,
    Clock,
    CheckCircle2,
    Briefcase,
    FileText,
    Settings2,
    AlertCircle,
    XCircle
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import OrdersTable from '../components/tables/OrdersTable';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getSocket, joinAdminDeliveryTracking } from '@/lib/socket';

import OrderDetailModal from '../components/modals/OrderDetailModal';
import { exportToCSV } from '@/lib/exportToCSV';
import { useNotificationSound } from '@/hooks/useNotificationSound';

export default function OrdersScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [allOrders, setAllOrders] = useState([]);
    const [selectedOrderForProcurement, setSelectedOrderForProcurement] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [procurementQuantities, setProcurementQuantities] = useState({});
    const [procurementMode, setProcurementMode] = useState('full'); // 'full' or 'partial'
    const [selectedProcurementIds, setSelectedProcurementIds] = useState(new Set());
    const { playNotificationSound } = useNotificationSound();

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Real Vendors Data
    const [vendors, setVendors] = useState([]);
    const [isVendorsLoading, setIsVendorsLoading] = useState(false);
    const [compatibleVendors, setCompatibleVendors] = useState([]);

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    /** period: 'today' | 'month' | 'year' | 'current' (whatever is filtered on screen) */
    const handleExport = (period = 'current') => {
        setIsExportMenuOpen(false);
        const now = new Date();
        const startOf = {
            today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            month: new Date(now.getFullYear(), now.getMonth(), 1),
            year: new Date(now.getFullYear(), 0, 1),
        }[period];
        const source = period === 'current' ? filteredOrders : allOrders;
        const rows = startOf ? source.filter(o => new Date(o.createdAt) >= startOf) : source;

        if (!rows.length) {
            toast.info('No orders found for the selected period');
            return;
        }

        const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN') : '');
        const columns = [
            { header: 'Order ID', key: '_id' },
            { header: 'Order Date', key: 'orderDate' },
            { header: 'Customer', key: 'customerName' },
            { header: 'Customer Mobile', key: 'customerMobile' },
            { header: 'Franchise', key: 'franchiseName' },
            { header: 'Status', key: 'orderStatus' },
            { header: 'Payment Method', key: 'paymentMethod' },
            { header: 'Payment Status', key: 'paymentStatus' },
            { header: 'Subtotal', key: 'subtotal' },
            { header: 'Delivery Fee', key: 'deliveryFee' },
            { header: 'Tax', key: 'tax' },
            { header: 'Discount', key: 'discount' },
            { header: 'Coupon', key: 'coupon' },
            { header: 'Total Amount', key: 'totalAmount' },
            { header: 'Delivery Date', key: 'deliveryDate' },
            { header: 'Delivery Slot', key: 'deliveryShift' },
            { header: 'Items', key: 'itemsSummary' },
        ];

        const data = rows.map(order => ({
            _id: order._id,
            orderDate: fmtDate(order.createdAt),
            customerName: order.userId?.fullName || 'Unknown',
            customerMobile: order.userId?.mobile || '',
            franchiseName: order.franchiseId?.franchiseName || '',
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            subtotal: order.subtotal ?? '',
            deliveryFee: order.deliveryFee ?? '',
            tax: order.tax ?? '',
            discount: order.discountAmount || 0,
            coupon: order.couponCode || '',
            totalAmount: order.totalAmount,
            deliveryDate: order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('en-IN') : '',
            deliveryShift: order.deliveryShift || '',
            itemsSummary: (order.items || []).map(i => `${i.name} x ${i.quantity} ${i.unit || ''}`.trim()).join('; '),
        }));

        const label = { today: 'Today', month: 'This_Month', year: 'This_Year', current: 'Filtered' }[period];
        exportToCSV(`Orders_${label}`, columns, data);
        toast.success(`Downloaded ${data.length} orders`);
    };

    const normalizeOrders = (results) => {
        if (!results || !Array.isArray(results)) return [];
        let flattened = [];
        results.forEach(item => {
            const data = item;
            if (data.isSplitOrder && data.orders && Array.isArray(data.orders)) {
                data.orders.forEach(subOrder => {
                    const subData = subOrder;
                    flattened.push({
                        ...subData,
                        isPartOfGroup: true,
                        groupId: data.orderGroupId,
                        groupTotal: data.grandTotal
                    });
                });
            } else {
                flattened.push(data);
            }
        });
        return flattened;
    };

    const fetchAllOrders = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const response = await api.get('/orders/admin/all');
            if (response.data.success) {
                const normalized = normalizeOrders(response.data.results || []);
                setAllOrders(normalized);
            }
        } catch (error) {
            console.error('Fetch all orders error:', error);
            if (!silent) toast.error('Failed to load orders');
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initialize socket before fetching orders
        const socket = getSocket();

        // Re-join admin room on reconnection to ensure we receive events
        const handleReconnect = () => {
            console.log('[Socket] Reconnected, joining admin room');
            joinAdminDeliveryTracking();
            fetchAllOrders(true); // Refresh orders after reconnect
        };

        socket.on('connect', handleReconnect);

        // Join the admin delivery tracking room
        joinAdminDeliveryTracking();

        // Initial fetch
        fetchAllOrders();

        socket.on('new_order_placed', (data) => {
            playNotificationSound();
            toast.info(data.message || "A new order has been placed!", {
                description: `Order ID: #${data.orderId.slice(-6)}`
            });
            // Auto refresh list
            fetchAllOrders(true);
        });

        socket.on('order_status_updated', (updatedOrder) => {
            setAllOrders(prev => {
                const index = prev.findIndex(o => o._id === updatedOrder._id);
                if (index !== -1) {
                    const newOrders = [...prev];
                    newOrders[index] = updatedOrder;
                    return newOrders;
                }
                return [updatedOrder, ...prev];
            });
        });

        socket.on('order_franchise_rejected', (data) => {
            playNotificationSound();
            toast.warning(`A franchise has rejected an order.`, {
                description: `Order ID: #${data.orderId.slice(-6)}`
            });
            fetchAllOrders(true);
        });

        socket.on('admin_notification', (data) => {
            playNotificationSound();
            toast.info(data.title || "Notification Received", {
                description: data.message
            });
            fetchAllOrders(true);
        });

        return () => {
            socket.off('new_order_placed');
            socket.off('order_status_updated');
            socket.off('order_franchise_rejected');
            socket.off('admin_notification');
            socket.off('connect', handleReconnect);
        };
    }, []);

    const handleOrderAction = async (orderId, newStatus, additionalData = {}) => {
        try {
            const response = await api.put(`/orders/admin/${orderId}/status`, {
                status: newStatus
            });
            if (response.data.success) {
                toast.success(`Order status updated to ${newStatus}`);
                setAllOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: newStatus } : o));
            }
        } catch (error) {
            console.error('Update status error:', error);
            toast.error('Failed to update status');
        }
    };

    const fetchCompatibleVendors = async (order) => {
        setIsVendorsLoading(true);
        try {
            const shortageProductIds = order.items
                .filter(item => item.isShortage)
                .map(item => item.productId?._id || item.productId);

            const response = await api.get('/masteradmin/vendors', {
                params: { status: 'active' }
            });

            if (response.data.success) {
                const allActiveVendors = response.data.results || response.data.result || [];
                setVendors(allActiveVendors);

                // 1. Identify all unique product IDs and Category IDs from the shortages
                const shortageProducts = order.items
                    .filter(item => item.isShortage)
                    .map(item => item.productId)
                    .filter(Boolean);

                const shortageProductIds = shortageProducts.map(p => (p._id || p).toString());
                const shortageCategoryIds = shortageProducts
                    .map(p => p.category?.toString())
                    .filter(Boolean);

                const franchiseCity = order.franchiseId?.city?.toLowerCase() || '';

                // 2. Filter vendors who:
                // - Match the city (if franchise city is known)
                // - AND (have the product OR serve the category)
                const compatible = allActiveVendors.filter(vendor => {
                    // City Filter: Vendor farmLocation or city should contain the franchise city
                    const vendorLocation = (vendor.farmLocation || vendor.city || '').toLowerCase();
                    if (franchiseCity && !vendorLocation.includes(franchiseCity)) {
                        return false;
                    }

                    // Product/Category Filter
                    // Check explicit products
                    const hasProduct = vendor.products?.some(p => {
                        const vendorProdId = (p._id || p).toString();
                        return shortageProductIds.includes(vendorProdId);
                    });

                    if (hasProduct) return true;

                    // Check served categories
                    const vendorCategories = (vendor.servedCategories || []).map(c => (c._id || c).toString());
                    const matchesCategory = shortageCategoryIds.some(catId => vendorCategories.includes(catId));

                    return matchesCategory;
                });

                setCompatibleVendors(compatible.length > 0 ? compatible : allActiveVendors);
            }
        } catch (error) {
            console.error('Fetch vendors error:', error);
            toast.error('Failed to load vendors');
        } finally {
            setIsVendorsLoading(false);
        }
    };

    const handleProcure = (order) => {
        setSelectedOrderForProcurement({
            ...order,
            id: order._id,
            customer: order.userId?.fullName || 'Guest',
            total: order.totalAmount
        });

        const initialQtys = {};
        const initialIds = new Set();
        order.items?.filter(i => i.isShortage).forEach(item => {
            const prodId = item.productId?._id || item.productId;
            initialQtys[prodId] = item.shortageQty;
            initialIds.add(prodId.toString());
        });
        setProcurementQuantities(initialQtys);
        setSelectedProcurementIds(initialIds);
        setProcurementMode('full');

        fetchCompatibleVendors(order);
    };

    const handleFinalizeProcurement = async (vendor) => {
        if (!selectedOrderForProcurement) return;

        try {
            const finalQuantities = {};
            selectedOrderForProcurement.items?.filter(i => i.isShortage).forEach(item => {
                const prodId = (item.productId?._id || item.productId).toString();
                if (procurementMode === 'full' || selectedProcurementIds.has(prodId)) {
                    finalQuantities[prodId] = procurementQuantities[prodId];
                }
            });

            if (Object.keys(finalQuantities).length === 0) {
                toast.error("Please select at least one item to request");
                return;
            }

            // Using the new bridging API
            const response = await api.post(`/procurement/admin/from-order/${selectedOrderForProcurement._id}`, {
                vendorId: vendor.id || vendor._id,
                customQuantities: finalQuantities
            });
            if (response.data.success) {
                toast.success(`Stock request ${vendor.fullName || vendor.name} ko bhej di gayi`);
                setSelectedOrderForProcurement(null);
                fetchAllOrders();
            }
        } catch (error) {
            console.error('Procurement error:', error);
            const message = error?.response?.data?.message || 'Failed to initiate procurement';
            toast.error(message);
        }
    };

    const handleAllowAvailableDelivery = async (order) => {
        try {
            const response = await api.put(`/orders/admin/${order._id}/status`, {
                allowPartialFulfillment: true
            });
            if (response.data.success) {
                toast.success('Franchise can now proceed with currently available stock');
                fetchAllOrders(true);
            }
        } catch (error) {
            console.error('Partial delivery approval error:', error);
            toast.error(error?.response?.data?.message || 'Failed to allow available delivery');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 700);
        return () => clearTimeout(timer);
    }, []);

    const franchiseRejectedCount = allOrders.filter(order =>
        ['Placed', 'Assigned'].includes(order.orderStatus) &&
        Array.isArray(order.assignmentAttempts) &&
        order.assignmentAttempts.some(a => a.reason === 'rejected')
    ).length;

    const filteredOrders = allOrders.filter(order => {
        const customerName = (order.userId?.fullName || '').toLowerCase();
        const customerMobile = (order.userId?.mobile || '').toLowerCase();
        const franchiseName = (order.franchiseId?.franchiseName || '').toLowerCase();
        const franchiseOwnerName = (order.franchiseId?.ownerName || '').toLowerCase();

        // Multi-keyword search logic
        const searchKeywords = searchTerm.toLowerCase().trim().split(/\s+/);
        const matchesSearch = searchKeywords.every(keyword =>
            customerName.includes(keyword) || 
            customerMobile.includes(keyword) ||
            franchiseName.includes(keyword) ||
            franchiseOwnerName.includes(keyword)
        );

        let matchesFilter;
        if (activeFilter === 'all') {
            matchesFilter = true;
        } else if (activeFilter === 'franchise_rejected') {
            matchesFilter = ['placed', 'assigned'].includes((order.orderStatus || '').toLowerCase()) &&
                Array.isArray(order.assignmentAttempts) &&
                order.assignmentAttempts.some(a => a.reason === 'rejected');
        } else {
            matchesFilter = (order.orderStatus || '').toLowerCase().trim() === activeFilter.toLowerCase().trim();
        }

        return matchesSearch && matchesFilter;
    });

    // Reset to page 1 on search/filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilter]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

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
                            <span>Admin</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900">Orders</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Orders Management</h1>
                    </div>

                    <div className="flex items-center gap-2 relative">
                        <button
                            onClick={() => setIsExportMenuOpen(v => !v)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <Download size={13} className="text-slate-400" />
                            <span>Download Excel</span>
                            <ChevronDown size={12} className="text-slate-400" />
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white border border-slate-200 rounded-sm shadow-lg py-1">
                                    {[
                                        { id: 'today', label: "Today's orders" },
                                        { id: 'month', label: "This month's orders" },
                                        { id: 'year', label: "This year's orders" },
                                        { id: 'current', label: 'Orders shown on screen' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleExport(opt.id)}
                                            className="w-full text-left px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>


            {/* Operational Ledger */}
            <div className="flex flex-col gap-0 p-px">

                <div className="bg-white border-t border-slate-200">
                    {/* Filter Tabs */}
                    <div className="px-4 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'All Orders', count: allOrders.length },
                            { id: 'Accepted', label: 'Order Accepted' },
                            { id: 'Packed', label: 'Packed' },
                            { id: 'Dispatched', label: 'Dispatched' },
                            { id: 'Delivered', label: 'Delivered' },
                            { id: 'franchise_rejected', label: 'Franchise Rejected', count: franchiseRejectedCount, highlight: true },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all',
                                    activeFilter === tab.id
                                        ? tab.highlight
                                            ? 'border-rose-500 text-rose-600'
                                            : 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                )}
                            >
                                {tab.highlight && <XCircle size={11} />}
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className={cn(
                                        'px-1.5 py-0.5 rounded-sm text-[10px] font-black tabular-nums',
                                        tab.highlight && tab.count > 0
                                            ? 'bg-rose-100 text-rose-600'
                                            : 'bg-slate-100 text-slate-500'
                                    )}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
                        <div className="relative group w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search by Customer Name, Mobile..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.trim())}
                                className="w-full bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-medium placeholder:text-slate-400 focus:border-slate-400 transition-all font-sans"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">Showing {filteredOrders.length} records</span>
                        </div>
                    </div>

                    <OrdersTable
                        orders={paginatedOrders}
                        onAction={handleOrderAction}
                        onOrderClick={(id) => {
                            setSelectedOrderId(id);
                            setIsDetailModalOpen(true);
                        }}
                        onProcure={handleProcure}
                        onAllowPartial={handleAllowAvailableDelivery}
                    />

                    {/* Pagination Footer */}
                    {filteredOrders.length > 0 && (
                        <div className="px-4 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Page {currentPage} of {totalPages || 1}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 border border-slate-200 rounded-sm text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider"
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={cn(
                                                "w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-bold border transition-all",
                                                currentPage === i + 1
                                                    ? "bg-slate-900 border-slate-900 text-white"
                                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                                            )}
                                        >
                                            {i + 1}
                                        </button>
                                    )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-3 py-1.5 border border-slate-200 rounded-sm text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {filteredOrders.length === 0 && (
                        <div className="py-20 flex flex-col items-center text-center bg-white border-t border-slate-100">
                            <div className="w-12 h-12 bg-slate-50 rounded-sm flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                                <ShoppingBasket size={24} />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">No orders found</h3>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-widest">Try changing your search or filters</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Assign Vendor Drawer */}
            <AnimatePresence>
                {selectedOrderForProcurement && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedOrderForProcurement(null)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[60]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "tween", duration: 0.3, ease: "circOut" }}
                            className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] z-[70] overflow-hidden flex flex-col border-l border-slate-200"
                        >
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-sm bg-slate-900 flex items-center justify-center text-white">
                                            <Briefcase size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Assignment</span>
                                            <span className="text-xs font-bold text-slate-900 mt-1 uppercase tracking-tight">Assign Vendor</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedOrderForProcurement(null)}
                                        className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-400 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums">#{selectedOrderForProcurement._id?.slice(-8)}</h2>
                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">{selectedOrderForProcurement.customer}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Order Total</span>
                                        <span className="text-xl font-black text-slate-900 tabular-nums">₹{selectedOrderForProcurement.total?.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Shortage Items Summary */}
                            <div className="px-6 py-3 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-rose-600">
                                        <AlertCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Stock Mangwayein</span>
                                    </div>
                                    <div className="flex bg-white rounded-sm border border-rose-200 p-0.5">
                                        <button
                                            onClick={() => {
                                                setProcurementMode('full');
                                                const allIds = new Set(selectedOrderForProcurement.items?.filter(i => i.isShortage).map(i => (i.productId?._id || i.productId).toString()));
                                                setSelectedProcurementIds(allIds);
                                            }}
                                            className={cn(
                                                "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-[1px] transition-all",
                                                procurementMode === 'full' ? "bg-rose-600 text-white" : "text-rose-400 hover:text-rose-600"
                                            )}
                                        >
                                            Bundle
                                        </button>
                                        <button
                                            onClick={() => setProcurementMode('partial')}
                                            className={cn(
                                                "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-[1px] transition-all",
                                                procurementMode === 'partial' ? "bg-rose-600 text-white" : "text-rose-400 hover:text-rose-600"
                                            )}
                                        >
                                            Partial
                                        </button>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                                    {procurementMode === 'full' ? 'BUNDLE MODE' : `${selectedProcurementIds.size} SELECTED`}
                                </span>
                            </div>
                            <div className="px-6 py-3 bg-white flex flex-col gap-2 max-h-48 overflow-y-auto border-b border-slate-100 custom-scrollbar shadow-inner">
                                {selectedOrderForProcurement.items?.filter(i => i.isShortage).map((item, idx) => {
                                    const prodId = (item.productId?._id || item.productId).toString();
                                    const isSelected = procurementMode === 'full' || selectedProcurementIds.has(prodId);

                                    return (
                                        <div key={idx} className={cn(
                                            "flex justify-between items-center group p-2 rounded-sm transition-all border",
                                            isSelected ? "border-rose-100 bg-rose-50/20" : "border-transparent opacity-50 grayscale"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                {procurementMode === 'partial' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedProcurementIds.has(prodId)}
                                                        onChange={() => {
                                                            const newSet = new Set(selectedProcurementIds);
                                                            if (newSet.has(prodId)) newSet.delete(prodId);
                                                            else newSet.add(prodId);
                                                            setSelectedProcurementIds(newSet);
                                                        }}
                                                        className="w-4 h-4 rounded-sm accent-rose-600 cursor-pointer"
                                                    />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{item.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order: {item.quantity} {item.unit}</span>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "flex items-center gap-2 px-3 py-1 rounded-sm border transition-all",
                                                isSelected ? "bg-white border-rose-100" : "bg-slate-50 border-slate-200"
                                            )}>
                                                <input
                                                    type="number"
                                                    disabled={!isSelected}
                                                    min="1"
                                                    value={procurementQuantities[prodId] || ''}
                                                    onChange={(e) => setProcurementQuantities(prev => ({ ...prev, [prodId]: Number(e.target.value) }))}
                                                    className="w-16 px-1 py-0.5 text-[10px] font-black tabular-nums outline-none rounded-sm focus:border-rose-400 text-rose-600 bg-transparent disabled:text-slate-400"
                                                />
                                                <span className="text-[10px] font-black text-rose-600 tabular-nums"> {item.unit}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Vendor Selection List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Compatible Vendors</h3>
                                    {isVendorsLoading && <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />}
                                </div>

                                {isVendorsLoading ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-32 bg-white border border-slate-200 rounded-sm animate-pulse" />
                                        ))}
                                    </div>
                                ) : compatibleVendors.length === 0 ? (
                                    <div className="py-10 text-center bg-white border border-dashed border-slate-200 rounded-sm">
                                        <Users className="mx-auto text-slate-200 mb-2" size={24} />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No matching vendors found</p>
                                    </div>
                                ) : (
                                    compatibleVendors.map((vendor) => (
                                        <div
                                            key={vendor._id}
                                            className="bg-white p-4 border border-slate-200 rounded-sm hover:border-slate-400 transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="flex gap-4">
                                                    <div className="w-10 h-10 rounded-sm bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                                        <Users size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{vendor.fullName || vendor.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                                {vendor.products?.length || 0} Products
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1 tracking-widest">Status</span>
                                                    <span className="text-xs font-bold text-slate-900 capitalize">{vendor.status || 'active'}</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <MapPin size={12} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[150px]">
                                                        {vendor.farmLocation || vendor.city || 'Vendor Location'}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleFinalizeProcurement(vendor)}
                                                    className="bg-white border border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2"
                                                >
                                                    Assign Vendor
                                                    <ArrowRight size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 bg-white border-t border-slate-200">
                                <div className="bg-slate-900 rounded-sm p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Activity size={16} className="text-emerald-400" />
                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Status: Online</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pr-2">Kisaankart</span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Order Detail Modal */}
            <OrderDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setSelectedOrderId(null);
                }}
                orderId={selectedOrderId}
                onProcure={handleProcure}
                onAllowPartial={handleAllowAvailableDelivery}
            />
        </div>
    );
}
