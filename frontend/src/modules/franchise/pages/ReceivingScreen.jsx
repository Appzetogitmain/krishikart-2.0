import React, { useState, useEffect } from 'react';
import {
    Package,
    Search,
    RefreshCw,
    Truck,
    ChevronRight,
    Home,
    ArrowRight,
    ShieldCheck,
    ClipboardCheck,
    AlertTriangle,
    Minus,
    Plus,
    Loader2,
    X,
    ChevronLeft,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';
import DocumentViewer from '../../vendor/components/documents/DocumentViewer';
import { useInventory } from '../contexts/InventoryContext';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { getSocket } from '@/lib/socket';

const ReceivingScreen = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPO, setSelectedPO] = useState(null);
    const [receivingData, setReceivingData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rejectedItems, setRejectedItems] = useState(new Set());

    // Document Viewer state
    const [isDocOpen, setIsDocOpen] = useState(false);
    const [docType, setDocType] = useState('GRN');

    const { refreshInventory } = useInventory();
    const { refreshOrders } = useFranchiseOrders();

    useEffect(() => {
        fetchOrders();
        
        const socket = getSocket();
        
        socket.on('order_locked_due_to_rejection', (data) => {
            console.log("Order locked due to rejection:", data);
            toast.error(data.message || "Order locked due to rejected items");
            fetchOrders();
            if (refreshOrders) refreshOrders();
        });

        socket.on('procurement_cycle_update', () => {
            fetchOrders();
        });

        return () => {
            socket.off('order_locked_due_to_rejection');
            socket.off('procurement_cycle_update');
        };
    }, []);

    const inboundStatuses = new Set([
        'assigned',
        'quoted',
        'approved',
        'preparing',
        'ready_for_pickup',
        'picked_up',
        'dispatched',
        'in_transit'
    ]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/procurement/franchise/my-requests');
            const requests = response.data?.results || response.data?.result || [];
            // Show the full inbound procurement lifecycle until final franchise receipt.
            const inbound = requests.filter(o => inboundStatuses.has(o.status));
            setOrders(inbound);
        } catch (error) {
            console.error("Fetch failed", error);
            toast.error("Could not load incoming stock");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPO = (po) => {
        setSelectedPO(po);
        // Initialize receiving data with vendor's dispatched quantities (as default)
        const initialData = {};
        po.items.forEach(item => {
            const itemId = item._id || item.productId;
            const defaultQty = item.dispatchedQuantity !== undefined ? item.dispatchedQuantity : item.quantity;
            initialData[itemId] = {
                received: defaultQty,
                damage: 0,
                productId: item.productId,
                name: item.name
            };
        });
        setReceivingData(initialData);
        setRejectedItems(new Set());
    };

    const toggleRejectItem = (itemId) => {
        setRejectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const updateItem = (id, field, value) => {
        setReceivingData(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const handleSubmit = async () => {
        if (!selectedPO) return;
        setIsSubmitting(true);

        const auditItems = Object.entries(receivingData).map(([id, data]) => {
            const isRejected = rejectedItems.has(id);
            return {
                productId: id,
                receivedQuantity: isRejected ? 0 : data.received,
                damagedQuantity: isRejected ? (data.damage || 0) : data.damage,
                rejected: isRejected
            };
        });

        try {
            const response = await api.put(`/procurement/franchise/${selectedPO._id}/receive`, {
                items: auditItems
            });

            if (response.data.success) {
                // Say exactly what happened to the stock (added, and whether a waiting customer order used it)
                toast.success("Stock received and added to your inventory", {
                    description: response.data.message && !/updated successfully/i.test(response.data.message) ? response.data.message : undefined,
                    duration: 12000,
                });

                // Refresh live inventory and orders from server
                refreshInventory();
                if (refreshOrders) refreshOrders();

                // Refresh list and close panel
                fetchOrders();
                setSelectedPO(null);
                setRejectedItems(new Set());
            }
        } catch (error) {
            console.error("Reception failed", error);
            toast.error(error.response?.data?.message || "Could not save. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredPOs = orders.filter(po =>
        po._id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (po.vendor || po.vendorName || po.assignedVendorName || po.assignedVendorId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.invoice?.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const poColumns = [
        {
            key: 'po',
            label: 'PO / INVOICE',
            render: (_, row) => (
                <div className="flex flex-col">
                    <span className="font-black text-slate-900 uppercase text-[10px] tracking-tight">{row.invoice?.invoiceNumber || row._id.slice(-8)}</span>
                    <span className="text-[10px] font-bold text-slate-400">ID: {row._id}</span>
                </div>
            )
        },
        {
            key: 'vendor',
            label: 'SOURCE VENDOR',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {(row.vendor || row.vendorName || row.assignedVendorName || row.assignedVendorId || 'V')?.[0] || 'V'}
                    </div>
                    <span className="text-[10px] font-black text-slate-700 uppercase">{row.vendor || row.vendorName || row.assignedVendorName || row.assignedVendorId || 'Kisaankart Franchise'}</span>
                </div>
            )
        },
        {
            key: 'items',
            label: 'ITEMS',
            render: (_, row) => (
                <span className="text-[10px] font-black text-slate-900 tabular-nums">
                    {row.items?.filter(item => (item.dispatchedQuantity ?? item.quantity) > 0).length || 0} SKUs
                </span>
            )
        },
        {
            key: 'status',
            label: 'STATUS',
            render: (status) => (
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{status?.replace(/_/g, ' ') || 'PENDING'}</span>
                </div>
            )
        },
        {
            key: 'actions',
            label: '',
            render: (_, row) => (
                <div className="flex items-center gap-2">

                    <button
                        onClick={() => handleSelectPO(row)}
                        className="p-1 px-4 bg-slate-900 text-white rounded-sm text-[10px] font-black hover:bg-slate-800 transition-all uppercase tracking-widest"
                    >
                        Check & Receive
                    </button>
                </div>
            )
        }
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Incoming Stock</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Vendor Receiving</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">
                            {selectedPO ? `Checking delivery: ${selectedPO.invoice?.invoiceNumber || selectedPO._id}` : 'Stock arriving from vendors'}
                        </h1>
                    </div>
                </div>
            </div>

            <div className="p-px bg-slate-200 overflow-hidden">
                <FilterBar
                    actions={
                        <div className="flex items-center gap-2">
                            <div className="relative group w-full max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search by request ID or vendor..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.trim())}
                                    className="bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:border-slate-400 transition-all font-sans min-w-[240px]"
                                />
                            </div>
                            <button className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-100 transition-colors text-slate-400 bg-white" onClick={fetchOrders}>
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    }
                />
                <div className="bg-white border-t border-slate-200">
                    <DataGrid
                        columns={poColumns}
                        data={filteredPOs}
                        density="compact"
                        showSearch={false}
                    />
                </div>

                {/* Audit Modal Overlay */}
                <AnimatePresence>
                    {selectedPO && (
                        <motion.div
                            initial={{ opacity: 0, x: '100%' }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-0 z-50 bg-white flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setSelectedPO(null)}
                                        className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-900"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div>
                                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Checking: {selectedPO.invoice?.invoiceNumber || selectedPO._id}</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{selectedPO.vendor || selectedPO.vendorName || selectedPO.assignedVendorName || selectedPO.assignedVendorId || 'Kisaankart Franchise'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex flex-col items-end mr-4">
                                        <span className="text-[11px] font-black text-slate-900 tabular-nums leading-none">{selectedPO.items.length}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Products</span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedPO(null)}
                                        className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                {/* Audit Details */}
                                <div className="flex-1 overflow-y-auto no-scrollbar border-r border-slate-200 bg-slate-50/30 p-4 md:p-8">
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Check each item</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-rose-500 uppercase px-2 py-0.5 bg-rose-50 rounded-full border border-rose-100">Report damaged or missing items</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {selectedPO.items.filter(item => (item.dispatchedQuantity ?? item.quantity) > 0).map((item) => {
                                                const itemId = item._id || item.productId;
                                                const data = receivingData[itemId] || { received: item.quantity, damage: 0 };
                                                return (
                                                    <motion.div
                                                        layout
                                                        key={itemId}
                                                        className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-6"
                                                    >
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-300 shrink-0">
                                                                {item.image ? (
                                                                    <img src={item.image} className="w-full h-full object-cover" alt="" />
                                                                ) : (
                                                                    <Package size={20} />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="text-xs font-black text-slate-900 uppercase truncate leading-none mb-1.5">{item.name}</h4>
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Order:</span>
                                                                        <span className="text-[10px] font-black text-slate-500 tabular-nums">{item.quantity} {item.unit}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white rounded-[4px]">
                                                                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Vendor Sent:</span>
                                                                        <span className="text-[10px] font-black tabular-nums">{item.dispatchedQuantity || item.quantity} {item.unit}</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded-sm">₹{item.quotedPrice || 0}/{item.unit}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4 sm:gap-8 grow justify-between sm:justify-end">
                                                            {/* Reject Button */}
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className={`text-[10px] font-black uppercase tracking-[0.2em] px-1 text-center ${rejectedItems.has(itemId) ? 'text-rose-500' : 'text-slate-400'}`}>
                                                                    {rejectedItems.has(itemId) ? 'Rejected' : 'Reject Item'}
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleRejectItem(itemId)}
                                                                    className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                                                                        rejectedItems.has(itemId)
                                                                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                                                                            : 'bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 border border-slate-200'
                                                                    }`}
                                                                >
                                                                    {rejectedItems.has(itemId) ? 'Rejected' : 'Reject'}
                                                                </button>
                                                            </div>

                                                            {/* Received Control - Disabled if rejected */}
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className={`text-[10px] font-black uppercase tracking-[0.2em] px-1 ${rejectedItems.has(itemId) ? 'text-slate-300' : 'text-slate-400'}`}>Received</label>
                                                                <div className={`flex items-center border rounded-lg p-1 w-32 ${rejectedItems.has(itemId) ? 'bg-slate-50 border-slate-100' : 'bg-slate-50 border-slate-200'}`}>
                                                                    <input
                                                                        type="number"
                                                                        value={data.received}
                                                                        disabled={rejectedItems.has(itemId)}
                                                                        onChange={(e) => updateItem(itemId, 'received', parseInt(e.target.value) || 0)}
                                                                        className={`bg-transparent w-full text-center font-black text-sm outline-none tabular-nums py-1 ${rejectedItems.has(itemId) ? 'text-slate-300' : ''}`}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Damage Control - Disabled if rejected */}
                                                            <div className="flex flex-col gap-1.5">
                                                                <label className={`text-[10px] font-black uppercase tracking-[0.2em] px-1 text-right ${rejectedItems.has(itemId) ? 'text-slate-300' : 'text-rose-400'}`}>Damaged/Spoilt</label>
                                                                <div className={`flex items-center border rounded-lg p-1 w-24 ${rejectedItems.has(itemId) ? 'bg-slate-50 border-slate-100' : 'bg-rose-50 border-rose-100'}`}>
                                                                    <input
                                                                        type="number"
                                                                        value={data.damage}
                                                                        disabled={rejectedItems.has(itemId)}
                                                                        placeholder="0"
                                                                        onChange={(e) => updateItem(itemId, 'damage', parseInt(e.target.value) || 0)}
                                                                        className={`bg-transparent w-full text-center font-black text-sm outline-none tabular-nums placeholder:text-rose-300 ${rejectedItems.has(itemId) ? 'text-slate-300' : 'text-rose-600'}`}
                                                                    />
                                                                    <AlertTriangle size={14} className={`mr-2 shrink-0 ${rejectedItems.has(itemId) ? 'text-slate-200' : 'text-rose-300'}`} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Summary Panel */}
                                <div className="w-full lg:w-[400px] bg-slate-50 p-8 flex flex-col justify-between border-l border-slate-200 relative">
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl">
                                                <ClipboardCheck size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Summary</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Review and confirm</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quality Summary</p>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Items Received</span>
                                                        <span className="text-xs font-black text-slate-900 tabular-nums">
                                                            {Object.values(receivingData).reduce((acc, d) => acc + (d.received || 0), 0)} Units
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-rose-600">
                                                        <span className="text-[10px] font-bold uppercase">Damaged/Missing</span>
                                                        <span className="text-xs font-black tabular-nums">
                                                            {Object.values(receivingData).reduce((acc, d) => acc + (d.damage || 0), 0)} Units
                                                        </span>
                                                    </div>
                                                    {rejectedItems.size > 0 && (
                                                        <div className="flex justify-between items-center bg-rose-50 p-2 rounded-lg border border-rose-100">
                                                            <span className="text-[10px] font-bold text-rose-600 uppercase">Rejected Items</span>
                                                            <span className="text-xs font-black text-rose-600 tabular-nums">
                                                                {rejectedItems.size} item(s)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl">
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <ShieldCheck size={12} /> Ready to confirm
                                                </p>
                                                <p className="text-[10px] font-bold text-emerald-800/70 leading-relaxed uppercase tracking-widest italic">
                                                    By confirming, you agree that the quantities above are what you received. The admin pays the vendor based on these numbers.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mt-12 sm:mt-0">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isSubmitting}
                                            className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-4 group disabled:opacity-50"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="animate-spin" />
                                            ) : (
                                                <>
                                                    <span>Confirm & Add to Stock</span>
                                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setSelectedPO(null)}
                                            className="w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    {/* Abstract background elements */}
                                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -mb-16 -mr-16 opacity-50" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <DocumentViewer
                isOpen={isDocOpen}
                onClose={() => setIsDocOpen(false)}
                type={docType}
                data={selectedPO ? {
                    invoiceNumber: selectedPO.invoice?.invoiceNumber,
                    invoiceDate: selectedPO.invoice?.invoiceDate,
                    items: selectedPO.items
                        .filter(i => (i.dispatchedQuantity ?? i.quantity) > 0)
                        .map(i => ({
                            name: i.name,
                            quantity: i.dispatchedQuantity || i.quantity,
                            unit: i.unit,
                            price: i.price,
                            quotedPrice: i.quotedPrice
                        })),
                    vendor: selectedPO.vendor || selectedPO.vendorName || selectedPO.assignedVendorName || selectedPO.assignedVendorId || 'Kisaankart Franchise',
                    franchise: 'My Franchise', // Ideally from context
                    handlingFee: 40
                } : null}
            />
        </div>
    );
};

export default ReceivingScreen;
