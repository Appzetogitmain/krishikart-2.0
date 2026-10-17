import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Star,
    MapPin,
    ArrowRight,
    X,
    Home,
    Terminal,
    Cpu,
    Activity,
    Zap,
    Warehouse
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { cityKeyOf, cityLabelOf } from '../utils/city';

export default function VendorAssignmentScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignmentSuccess, setAssignmentSuccess] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [isLoadingVendors, setIsLoadingVendors] = useState(false);
    // City filter (starts on the requesting franchise's city) and name search for the vendor list
    const [vendorCity, setVendorCity] = useState('all');
    const [vendorSearch, setVendorSearch] = useState('');
    const [showVendorList, setShowVendorList] = useState(false);
    // 'vendor' or 'mother': what the right-hand list shows
    const [supplierKind, setSupplierKind] = useState('vendor');
    const [mothers, setMothers] = useState([]);
    const [isLoadingMothers, setIsLoadingMothers] = useState(false);

    const fetchPendingRequests = async () => {
        try {
            const response = await api.get('/procurement/admin/all?status=pending_assignment');
            if (response.data.success) {
                const mappedRequests = response.data.results.map(req => ({
                    id: req._id,
                    ownerName: req.franchiseId?.ownerName || 'Unknown Owner',
                    franchiseName: req.franchiseId?.franchiseName || '',
                    source: req.source || 'vendor',
                    lastDecline: req.lastDecline,
                    mobile: req.franchiseId?.mobile || '',
                    city: req.franchiseId?.city || '',
                    items: req.items || [],
                    total: req.totalEstimatedAmount || 0,
                    createdAt: new Date(req.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                }));
                // Sort by newest first
                const sortedRequests = mappedRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setPendingRequests(sortedRequests);
            }
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingRequests();
    }, []);

    const fetchVendorsForOrder = async (order, specificProductId = null, specificProductName = null) => {
        if (!order || !order.items || order.items.length === 0) {
            setVendors([]);
            return;
        }
        setIsLoadingVendors(true);
        try {
            // Use specific product if clicked, otherwise default to first item
            const productId = specificProductId || order.items[0].productId;
            const productName = specificProductName || order.items[0].name;

            const response = await api.get(`/masteradmin/vendors?productId=${productId}&productName=${encodeURIComponent(productName)}`);
            if (response.data.success) {
                const allVendors = response.data.results || [];

                // Keep every vendor that sells the product; the list starts filtered to the
                // franchise's own city and the admin can switch city if none is there.
                const mappedVendors = allVendors.map(v => ({
                    id: v._id,
                    name: v.fullName,
                    farmLocation: v.farmLocation,
                    cityKey: cityKeyOf(v.farmLocation || v.city),
                    status: v.status,
                    products: v.products
                }));
                setVendors(mappedVendors);
                setVendorSearch('');
                setVendorCity(cityKeyOf(order.city) || 'all');
            }
        } catch (error) {
            console.error('Failed to fetch vendors for order:', error);
            setVendors([]);
        } finally {
            setIsLoadingVendors(false);
        }
    };

    useEffect(() => {
        if (selectedOrder) {
            setShowVendorList(false);
            // Don't auto-fetch on open, wait for user to click assign on specific product
            // or fetch default (first item) if general view is needed,
            // but user requested "Assign button per product".
            // We can pre-fetch default just in case, but let's stick to the flow.
            // Actually, let's pre-fetch for the first item so the list isn't empty if they somehow see it,
            // but the filtered fetch happens on click.
        } else {
            setVendors([]);
        }
    }, [selectedOrder]);

    const [selectedItemToAssign, setSelectedItemToAssign] = useState(null);

    const fetchMothers = async (order, item) => {
        setIsLoadingMothers(true);
        try {
            const params = new URLSearchParams({ requestId: order.id });
            if (item) params.set('productId', item.productId || item.id);
            const response = await api.get(`/procurement/admin/mother-franchises?${params}`);
            setMothers(response.data?.results || []);
        } catch (error) {
            setMothers([]);
            toast.error(error.response?.data?.message || 'Could not load mother franchises');
        } finally {
            setIsLoadingMothers(false);
        }
    };

    const handleAssignProduct = (item, kind) => {
        const productId = item.productId || item.id;
        const useKind = kind || (selectedOrder?.source === 'mother_franchise' ? 'mother' : 'vendor');
        setSelectedItemToAssign(item);
        setSupplierKind(useKind);
        if (useKind === 'mother') fetchMothers(selectedOrder, item);
        else fetchVendorsForOrder(selectedOrder, productId, item.name);
        setShowVendorList(true);
    };

    // Give the whole request (all items) to one mother franchise
    const handleWholeToMother = () => {
        setSelectedItemToAssign(null);
        setSupplierKind('mother');
        fetchMothers(selectedOrder, null);
        setShowVendorList(true);
    };

    const switchKind = (kind) => {
        setSupplierKind(kind);
        if (kind === 'mother') fetchMothers(selectedOrder, selectedItemToAssign);
        else if (selectedItemToAssign) fetchVendorsForOrder(selectedOrder, selectedItemToAssign.productId || selectedItemToAssign.id, selectedItemToAssign.name);
    };

    const handleAssignMother = async (mother) => {
        setIsAssigning(true);
        try {
            const assignedItem = selectedItemToAssign;
            const response = await api.put(`/procurement/admin/${selectedOrder.id}/assign-mother`, {
                supplierFranchiseId: mother._id,
                itemId: assignedItem ? (assignedItem.productId || assignedItem._id || assignedItem.id) : undefined,
            });
            if (response.data.success) {
                setAssignmentSuccess(true);
                if (assignedItem && selectedOrder.items.length > 1) {
                    const pid = assignedItem.productId || assignedItem._id || assignedItem.id;
                    const remainingItems = selectedOrder.items.filter(i => (i.productId || i._id || i.id) !== pid);
                    setSelectedOrder(prev => ({ ...prev, items: remainingItems }));
                    setPendingRequests(prev => prev.map(r => r.id === selectedOrder.id ? { ...r, items: remainingItems } : r));
                } else {
                    setPendingRequests(prev => prev.filter(r => r.id !== selectedOrder.id));
                    setTimeout(() => setSelectedOrder(null), 2000);
                }
                setTimeout(() => {
                    setAssignmentSuccess(false);
                    setShowVendorList(false);
                }, 2000);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not assign the mother franchise');
        } finally {
            setIsAssigning(false);
        }
    };

    // Vendor list: chosen city + name search, vendors of the franchise's own city first
    const franchiseCityKey = cityKeyOf(selectedOrder?.city);
    const vendorCityCounts = vendors.reduce((acc, v) => {
        if (v.cityKey) acc[v.cityKey] = (acc[v.cityKey] || 0) + 1;
        return acc;
    }, {});
    const otherVendorCities = Object.keys(vendorCityCounts)
        .filter((k) => k !== franchiseCityKey)
        .sort((a, b) => a.localeCompare(b));
    const searchText = vendorSearch.trim().toLowerCase();
    const visibleVendors = vendors
        .filter((v) => vendorCity === 'all' || v.cityKey === vendorCity)
        .filter((v) => !searchText || String(v.name || '').toLowerCase().includes(searchText))
        .sort((a, b) =>
            (Number(b.cityKey === franchiseCityKey) - Number(a.cityKey === franchiseCityKey)) ||
            String(a.name || '').localeCompare(String(b.name || ''))
        );

    const handleAssign = async (vendor) => {
        setIsAssigning(true);
        try {
            const response = await api.put(`/procurement/admin/${selectedOrder.id}/status`, {
                status: 'assigned',
                vendorId: vendor.id,
                itemId: selectedItemToAssign ? (selectedItemToAssign.productId || selectedItemToAssign._id || selectedItemToAssign.id) : undefined
            });

            if (response.data.success) {
                setAssignmentSuccess(true);
                // Remove the assigned item from the local state
                if (selectedItemToAssign && selectedOrder.items.length > 1) {
                    const originalProductId = selectedItemToAssign.productId || selectedItemToAssign._id || selectedItemToAssign.id;
                    const remainingItems = selectedOrder.items.filter(i =>
                        (i.productId || i._id || i.id) !== originalProductId
                    );
                    setSelectedOrder(prev => ({ ...prev, items: remainingItems }));
                    setPendingRequests(prev => prev.map(r => r.id === selectedOrder.id ? { ...r, items: remainingItems } : r));
                } else {
                    // Remove the whole order from local list if it's fully assigned
                    setPendingRequests(prev => prev.filter(r => r.id !== selectedOrder.id));
                    setTimeout(() => {
                        setSelectedOrder(null);
                    }, 2000);
                }

                setTimeout(() => {
                    setAssignmentSuccess(false);
                    setShowVendorList(false); // go back to order details or close if null
                }, 2000);
            }
        } catch (error) {
            console.error('Assign vendor error:', error);
            toast.error('Failed to assign vendor');
        } finally {
            setIsAssigning(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-[600px] bg-slate-50 border border-slate-200 rounded-sm" />
                    <div className="h-[400px] bg-slate-900 rounded-sm" />
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
                            <span>Delivery</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Assign Vendors</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Order Assignments</h1>
                    </div>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Dense Pending Orders Ledger */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="text-amber-500" size={14} />
                                Pending Orders
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black rounded-sm uppercase tracking-widest tabular-nums">
                                    {pendingRequests.length} Orders Waiting
                                </span>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {pendingRequests.map((order, index) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => setSelectedOrder(order)}
                                    className={cn(
                                        "px-4 py-4 flex items-start justify-between cursor-pointer transition-all border-l-2 group",
                                        selectedOrder?.id === order.id
                                            ? "bg-slate-50 border-slate-900"
                                            : "hover:bg-slate-50 border-transparent hover:border-slate-200"
                                    )}
                                >
                                    <div className="flex gap-4 w-full">
                                        <div className="w-8 h-8 bg-slate-100 rounded-sm flex items-center justify-center shrink-0 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                            <Users size={14} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Franchise</span>
                                                    <h4 className="font-black text-slate-900 text-xs tracking-tight uppercase">{order.franchiseName || order.ownerName}</h4>
                                                    {order.source === 'mother_franchise' && (
                                                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-sm">Wants it from a mother franchise</span>
                                                    )}
                                                    {order.lastDecline?.reason && (
                                                        <span className="block mt-1 text-[10px] font-bold text-amber-600">Last supplier: {order.lastDecline.reason}</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 tabular-nums">{order.createdAt}</span>
                                            </div>

                                            <p className="text-[10px] text-slate-500 font-bold tracking-tight mb-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                {order.mobile}
                                            </p>

                                            <div className="bg-slate-50 border border-slate-100 rounded-sm p-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-200 pb-1">
                                                    Required Items ({order.items.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="flex justify-between text-[10px] font-bold text-slate-700">
                                                            <span>{item.name}</span>
                                                            <span className="tabular-nums opacity-60 font-black">{item.quantity} * {item.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center self-center pl-4">
                                        <ChevronRight size={14} className={cn("text-slate-200 transition-all", selectedOrder?.id === order.id ? "text-slate-900 translate-x-1" : "")} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {pendingRequests.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 border border-slate-200 border-dashed rounded-sm bg-white">
                            <Zap size={32} className="text-slate-300 mb-2" />
                            <h3 className="text-sm font-bold text-slate-900">All Done</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest">No active orders need assignment</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Protocols & Intelligence */}
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Terminal size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-6">
                                <Cpu className="text-emerald-400" size={16} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">How it Works</span>
                            </div>
                            <h3 className="text-lg font-black tracking-tight leading-none mb-8">Assignment Steps</h3>
                            <div className="space-y-5">
                                {[
                                    { step: "01", label: "Select an Order", desc: "Pick an order from the list that needs a vendor." },
                                    { step: "02", label: "Check Vendors", desc: "Compare vendors based on distance and capacity." },
                                    { step: "03", label: "Finish Assignment", desc: "Assign the vendor and notify all parties." }
                                ].map((step) => (
                                    <div key={step.step} className="flex gap-4">
                                        <span className="text-[10px] font-black tabular-nums text-slate-600 border border-slate-800 h-fit px-1.5 py-0.5 rounded-sm">{step.step}</span>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-white tracking-widest mb-1">{step.label}</p>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Assignment Drawer */}
            <AnimatePresence>
                {selectedOrder && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedOrder(null)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[60]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-[70] overflow-hidden flex flex-col"
                        >
                            {!isAssigning && !showVendorList ? (
                                /* STATE 1: ORDER DETAILS VIEW */
                                <div className="flex flex-col h-full">
                                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded-sm uppercase tracking-widest">Order ID: {String(selectedOrder.id).slice(-4).toUpperCase()}</div>
                                            <button onClick={() => setSelectedOrder(null)} className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-400 transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Procurement Details</h2>
                                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest opacity-60">Review requirements before assignment</p>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        {/* Franchise Info Card */}
                                        <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                                    <Users size={20} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Franchise Request From</span>
                                                    <h3 className="font-black text-slate-900 text-sm">{selectedOrder.ownerName}</h3>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contact</span>
                                                    <span className="text-xs font-bold text-slate-700">{selectedOrder.mobile}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Requested On</span>
                                                    <span className="text-xs font-bold text-slate-700">{selectedOrder.createdAt}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="space-y-3">
                                            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Required Items List</h3>
                                            <div className="bg-slate-50 border border-slate-200 rounded-sm overflow-hidden border-b-0">
                                                {selectedOrder.items.map((item, index) => (
                                                    <div key={index} className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white group hover:bg-slate-50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <div>
                                                                <span className="block text-xs font-bold text-slate-700">{item.name}</span>
                                                                <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                                                    Qty: {item.quantity} * {item.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleAssignProduct(item, 'vendor')}
                                                                className="text-[10px] font-black uppercase text-slate-900 bg-white border border-slate-200 rounded-sm px-2 py-1.5 hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-1"
                                                            >
                                                                Vendor <ArrowRight size={10} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleAssignProduct(item, 'mother')}
                                                                className="text-[10px] font-black uppercase text-indigo-700 bg-white border border-indigo-200 rounded-sm px-2 py-1.5 hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-1"
                                                            >
                                                                Mother <ArrowRight size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 border-t border-slate-400/10 bg-slate-50 space-y-3">
                                        {selectedOrder.source === 'mother_franchise' && (
                                            <p className="text-[10px] text-indigo-700 font-bold text-center">The franchise asked for this from a mother franchise.</p>
                                        )}
                                        <button
                                            onClick={handleWholeToMother}
                                            className="w-full h-10 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-indigo-700 flex items-center justify-center gap-2"
                                        >
                                            <Warehouse size={12} /> Give all items to a mother franchise
                                        </button>
                                        <p className="text-[10px] text-slate-400 font-bold text-center">Or pick a vendor / mother franchise per item above</p>
                                    </div>
                                </div>
                            ) : (
                                /* STATE 2: VENDOR SELECTION VIEW */
                                <div className="flex flex-col h-full">
                                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                        <div className="flex items-center justify-between mb-4">
                                            <button
                                                onClick={() => setShowVendorList(false)}
                                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                                            >
                                                <ChevronRight size={12} className="rotate-180" /> Back to Details
                                            </button>
                                            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-900">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">{supplierKind === 'mother' ? 'Select A Mother Franchise' : 'Select A Vendor'}</h2>
                                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest italic opacity-60">
                                            {selectedItemToAssign ? `For ${selectedItemToAssign.name}` : 'For all items'} • {selectedOrder.franchiseName || selectedOrder.ownerName}
                                        </p>
                                        {selectedItemToAssign && (
                                            <div className="mt-3 grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-sm">
                                                {[{ k: 'vendor', l: 'Vendors' }, { k: 'mother', l: 'Mother franchises' }].map(({ k, l }) => (
                                                    <button
                                                        key={k}
                                                        onClick={() => switchKind(k)}
                                                        className={cn("h-8 text-[10px] font-black uppercase tracking-wider rounded-sm", supplierKind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
                                                    >
                                                        {l}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {supplierKind === 'vendor' && (<>
                                        <div className="relative mt-4 group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={12} />
                                            <input
                                                type="text"
                                                value={vendorSearch}
                                                onChange={(e) => setVendorSearch(e.target.value)}
                                                placeholder="Search by vendor name..."
                                                className="w-full bg-white border border-slate-200 rounded-sm py-2 pl-9 pr-4 outline-none text-[11px] font-bold focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all font-sans"
                                            />
                                        </div>
                                        <label className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <MapPin size={12} />
                                            City
                                            <select
                                                value={vendorCity}
                                                onChange={(e) => setVendorCity(e.target.value)}
                                                className="flex-1 h-8 bg-white border border-slate-200 rounded-sm px-2 text-[11px] font-bold text-slate-900 normal-case tracking-normal focus:outline-none focus:border-slate-400"
                                            >
                                                {franchiseCityKey && (
                                                    <option value={franchiseCityKey}>
                                                        {cityLabelOf(franchiseCityKey)} (franchise city) · {vendorCityCounts[franchiseCityKey] || 0}
                                                    </option>
                                                )}
                                                <option value="all">All cities · {vendors.length}</option>
                                                {otherVendorCities.map((key) => (
                                                    <option key={key} value={key}>{cityLabelOf(key)} · {vendorCityCounts[key]}</option>
                                                ))}
                                            </select>
                                        </label>
                                        </>)}
                                    </div>

                                    {supplierKind === 'mother' ? (
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-slate-50">
                                        {isLoadingMothers ? (
                                            <div className="py-10 flex justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Loading...</div>
                                        ) : mothers.length === 0 ? (
                                            <div className="py-16 text-center border border-dashed border-slate-200 bg-white rounded-sm px-8">
                                                <Warehouse size={28} className="text-slate-300 mx-auto mb-2" />
                                                <p className="text-xs font-bold text-slate-700">No mother franchise available</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Mark a franchise as "Mother Franchise" on the Franchises page first.</p>
                                            </div>
                                        ) : mothers.map((m) => (
                                            <div key={m._id} className="bg-white p-4 border border-slate-200 rounded-sm space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="font-black text-slate-900 text-xs">{m.franchiseName}</h4>
                                                        <p className="text-[10px] text-slate-400 font-bold">{[m.area, m.city].filter(Boolean).join(', ')}</p>
                                                    </div>
                                                    <span className={cn("px-1.5 py-0.5 text-[9px] font-black uppercase rounded-sm border", m.hasAll ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                                                        {m.hasAll ? 'Has all stock' : 'Stock short'}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {m.lines.map((l) => (
                                                        <div key={l.productId} className="flex justify-between text-[10px] font-bold">
                                                            <span className="text-slate-600">{l.name}</span>
                                                            <span className={l.inStock >= l.needed ? 'text-emerald-600' : 'text-rose-600'}>{l.inStock} in stock / {l.needed} {l.unit} needed</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    disabled={isAssigning}
                                                    onClick={() => handleAssignMother(m)}
                                                    className="w-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {isAssigning ? 'Assigning...' : 'Give to this mother franchise'} <ArrowRight size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    ) : (
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-slate-50">
                                        {isLoadingVendors ? (
                                            <div className="py-10 flex flex-col items-center justify-center text-slate-400">
                                                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Finding Best Matches...</span>
                                            </div>
                                        ) : visibleVendors.length > 0 ? (
                                            visibleVendors.map((vendor, index) => (
                                                <motion.div
                                                    key={vendor.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="bg-white p-4 border border-slate-200 rounded-sm hover:border-slate-400 transition-all flex flex-col gap-4 group"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex gap-3">
                                                            <div className="w-10 h-10 border border-slate-100 bg-slate-50 text-slate-400 rounded-sm flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                                                <Users size={18} />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-slate-900 text-xs tracking-tight leading-tight">{vendor.name}</h4>
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{vendor.products?.length || 0} products</span>
                                                                    {franchiseCityKey && vendor.cityKey === franchiseCityKey && (
                                                                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm">Same city</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</div>
                                                            <div className="text-xs font-black text-slate-900 leading-none capitalize">{vendor.status || 'active'}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-50">
                                                        <div className="flex items-center gap-1.5 text-slate-400">
                                                            <MapPin size={10} />
                                                            <span className="text-[10px] font-bold tabular-nums">{vendor.farmLocation || vendor.location || "Location not set"}</span>
                                                        </div>
                                                        <button
                                                            disabled={isAssigning}
                                                            onClick={() => handleAssign(vendor)}
                                                            className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                                        >
                                                            {isAssigning ? 'Assigning...' : 'Assign Vendor'}
                                                            <ArrowRight size={12} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <div className="py-20 flex flex-col items-center justify-center text-center border border-slate-200 border-dashed rounded-sm bg-white">
                                                <Users size={32} className="text-slate-300 mb-2" />
                                                <h3 className="text-sm font-bold text-slate-900">No Match</h3>
                                                <p className="text-[10px] font-bold uppercase tracking-widest px-10">
                                                    {vendors.length === 0
                                                        ? 'No vendors sell this product'
                                                        : vendorSearch.trim()
                                                            ? 'No vendor with this name'
                                                            : `No vendor in ${cityLabelOf(vendorCity)} sells this product`}
                                                </p>
                                                {vendors.length > 0 && vendorCity !== 'all' && (
                                                    <button type="button" onClick={() => setVendorCity('all')} className="mt-3 h-8 px-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm">
                                                        Show all cities
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Success Overlay - High Impact Enterprise Style */}
            < AnimatePresence >
                {assignmentSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none bg-slate-900/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 text-white p-10 border border-slate-700 rounded-sm shadow-2xl flex flex-col items-center text-center max-w-xs"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                                className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-6"
                            >
                                <CheckCircle2 size={32} className="text-slate-900" />
                            </motion.div>
                            <h3 className="text-lg font-black tracking-tight leading-none mb-2">Assignment Done</h3>
                            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">Vendor linked successfully</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence >

            {/* Status Footer */}
            < div className="px-4 py-1.5 bg-slate-900 text-white/40 flex items-center justify-between border-t border-slate-800" >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
                        <div className="w-1 h-1 rounded-full bg-emerald-400" />
                        System Status: Active
                    </div>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest tabular-nums">Kisaankart</div>
            </div >
        </div >
    );
}
