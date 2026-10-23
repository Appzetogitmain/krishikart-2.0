import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingBasket,
    Search,
    ChevronRight,
    Plus,
    Minus,
    Truck,
    CheckCircle2,
    Loader2,
    Package,
    IndianRupee,
    Home,
    Download,
    RefreshCw,
    ShieldCheck,
    Settings2,
    Filter,
    ArrowRight,
    Search as SearchIcon,
    ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useProcurement } from '../contexts/ProcurementContext';

import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { toast } from 'sonner';

const STATUS_LABEL = {
    pending_assignment: 'Waiting for vendor',
    assigned: 'Vendor assigned',
    quoted: 'Vendor assigned',
    negotiating: 'Vendor assigned',
    approved: 'Vendor packing soon',
    preparing: 'Vendor packing',
    ready_for_pickup: 'Ready for pickup',
    picked_up: 'On the way',
    completed: 'Received',
    rejected: 'Rejected',
};
const OPEN_STATUSES = ['pending_assignment', 'assigned', 'quoted', 'negotiating', 'approved', 'preparing', 'ready_for_pickup', 'picked_up'];

/** All open requests added up product-wise, with which vendor has how much (each request stays listed below). */
function OpenOrdersSummary({ requests }) {
    const rows = new Map();
    for (const r of requests) {
        if (!r || !OPEN_STATUSES.includes(r.status)) continue;
        for (const item of r.items || []) {
            const key = `${item.productId}|${String(item.unit || '').toLowerCase()}`;
            if (!rows.has(key)) rows.set(key, { key, name: item.name, unit: item.unit, qty: 0, orders: 0, by: new Map() });
            const row = rows.get(key);
            const qty = Number(item.quantity) || 0;
            row.qty += qty;
            row.orders += 1;
            const who = r.supplierFranchiseId?.franchiseName || r.vendorName || 'Not assigned yet';
            row.by.set(who, (row.by.get(who) || 0) + qty);
        }
    }
    const list = [...rows.values()].sort((a, b) => b.qty - a.qty);
    if (!list.length) return null;
    const fmt = (n) => Math.round(n * 100) / 100;
    return (
        <div className="bg-white border border-emerald-200 p-4 rounded-sm">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Open orders — product-wise total</h3>
            <p className="text-[10px] font-bold text-slate-400 mb-3">Same products from all your open requests added up. Each request is listed below.</p>
            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Item</div>
                <div className="col-span-3 text-right">Total</div>
                <div className="col-span-5">Vendor</div>
            </div>
            <div className="divide-y divide-slate-100">
                {list.map((row) => (
                    <div key={row.key} className="grid grid-cols-12 gap-2 py-1.5 text-[11px] font-bold text-slate-700">
                        <div className="col-span-4">{row.name}<span className="block text-[10px] text-slate-400 font-semibold">{row.orders} request{row.orders > 1 ? 's' : ''}</span></div>
                        <div className="col-span-3 text-right font-black tabular-nums text-slate-900">{fmt(row.qty)} <span className="uppercase">{row.unit}</span></div>
                        <div className="col-span-5 text-[10px] text-slate-500">
                            {[...row.by.entries()].map(([who, q]) => <div key={who}>{who}: {fmt(q)}</div>)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ProcurementScreen() {
    const navigate = useNavigate();
    const { franchise } = useFranchiseAuth();
    const { addRequest, cart, setCart, clearCart, procurementRequests, fetchRequests, isLoadingRequests, requestsError } = useProcurement();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('catalog');
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');

    const [isSubmitting, setIsSubmitting] = useState(false);
    // Where the stock should come from: a vendor, or a mother franchise (another franchise's stock)
    const [source, setSource] = useState('vendor');
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [lastRequestId, setLastRequestId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isQtyModalOpen, setIsQtyModalOpen] = useState(false);
    const [modalProduct, setModalProduct] = useState(null);
    const [modalQty, setModalQty] = useState(1);
    const [modalUnit, setModalUnit] = useState('kg');

    const units = [
        'kg',
        'gm',
        'pcs',
        'ltr',
        'ml',
        'box',
        'dz'
    ];

    // Always pull the latest requests when the History tab is opened
    useEffect(() => {
        if (activeTab === 'history') {
            fetchRequests();
        }
    }, [activeTab, fetchRequests]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, catRes] = await Promise.all([
                    api.get('/products'),
                    api.get('/catalog/categories')
                ]);

                if (prodRes.data.success) {
                    let fetchedProducts = prodRes.data.results;
                    if (franchise?.servedCategories?.length > 0) {
                        const allowedCategoryIds = franchise.servedCategories.map(c => typeof c === 'object' ? (c._id || c.id)?.toString() : c?.toString());
                        fetchedProducts = fetchedProducts.filter(p => {
                            const pCatId = (p.category?._id || p.category?.id || p.category)?.toString();
                            return allowedCategoryIds.includes(pCatId);
                        });
                    }
                    setProducts(fetchedProducts);
                }
                if (catRes.data.success) {
                    let fetchedCategories = catRes.data.results;
                    if (franchise?.servedCategories?.length > 0) {
                        const allowedCategoryIds = franchise.servedCategories.map(c => typeof c === 'object' ? (c._id || c.id)?.toString() : c?.toString());
                        fetchedCategories = fetchedCategories.filter(c => allowedCategoryIds.includes((c._id || c.id)?.toString()));
                    }
                    setCategories(['All', ...fetchedCategories.map(c => c.name)]);
                }
            } catch (error) {
                console.error("Failed to fetch procurement data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [franchise]);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const categoryName = p.category?.name || (typeof p.category === 'string' ? p.category : '');
        const matchesCategory = selectedCategory === 'All' || categoryName === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const updateQty = (productId, delta) => {
        setCart(prev => {
            const currentItem = prev[productId];
            if (!currentItem) return prev;

            const nextQty = currentItem.qty + delta;
            if (nextQty <= 0) {
                const { [productId]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [productId]: { ...currentItem, qty: nextQty } };
        });
    };

    const handleOpenModal = (product) => {
        setModalProduct(product);
        setModalQty(1);
        setModalUnit(product.unit || 'kg');
        setIsQtyModalOpen(true);
    };

    const handleConfirmQty = () => {
        if (modalProduct && modalQty > 0) {
            setCart(prev => ({
                ...prev,
                [modalProduct._id]: {
                    qty: (prev[modalProduct._id]?.qty || 0) + modalQty,
                    unit: modalUnit // Store selected unit
                }
            }));
            setIsQtyModalOpen(false);
            setModalProduct(null);
        }
    };

    const setManualQty = (productId, value) => {
        const qty = parseInt(value);
        if (isNaN(qty) || qty <= 0) {
            setCart(prev => {
                const { [productId]: removed, ...rest } = prev;
                return rest;
            });
        } else {
            setCart(prev => ({
                ...prev,
                [productId]: { ...prev[productId], qty }
            }));
        }
    };

    const cartItems = Object.entries(cart).map(([id, item]) => {
        const product = products.find(p => p._id === id);
        if (!product) return { _id: id, name: 'Unknown Product', price: 0, qty: item.qty, unit: item.unit, primaryImage: '' };
        return { ...product, qty: item.qty, unit: item.unit };
    });

    // Price calculation removed as per new requirement
    const totalAmount = 0;

    const handlePlaceOrder = async () => {
        setIsSubmitting(true);

        const requestData = {
            items: cartItems.map(item => ({
                productId: item._id,
                name: item.name,
                quantity: item.qty,
                unit: item.unit,
                price: item.price,
                quotedPrice: 0
            })),
            totalEstimatedAmount: totalAmount,
            source
        };

        try {
            const created = await addRequest(requestData);
            setLastRequestId(created?._id || null);
            setOrderSuccess(true);
            clearCart();
        } catch (error) {
            console.error("Order placement failed", error);
            toast.error(error.response?.data?.message || 'Could not submit the procurement request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (orderSuccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 min-h-screen">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 bg-slate-900 border-4 border-white text-white rounded-sm flex items-center justify-center mb-8 shadow-2xl"
                >
                    <CheckCircle2 size={40} />
                </motion.div>
                <h2 className="text-xl font-black text-slate-900 tracking-[0.2em] uppercase">REQUEST SUBMITTED</h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4 max-w-sm leading-relaxed">
                    Your stock request{lastRequestId ? <> <b>#{String(lastRequestId).slice(-6).toUpperCase()}</b></> : null} has been sent to the admin. You can track it under Request History.
                </p>
                <div className="mt-12 flex flex-col gap-3 w-full max-w-xs">
                    <button
                        onClick={() => {
                            setOrderSuccess(false);
                            setActiveTab('history');
                        }}
                        className="w-full bg-slate-900 text-white h-12 rounded-sm font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                    >
                        View Request History
                    </button>
                    <button
                        onClick={() => setOrderSuccess(false)}
                        className="w-full border border-slate-200 text-slate-400 h-10 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all"
                    >
                        Create Another Request
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row h-full overflow-hidden font-sans">
            {/* Left: Product Catalog Interface */}
            <div className="flex-1 flex flex-col h-full bg-slate-50 relative border-r border-slate-200 min-w-0">
                {/* Enterprise Header */}
                <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 overflow-hidden">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4 shrink-0">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Franchise</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest truncate max-w-[80px]">Procurement</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900 truncate">Request Stock</h1>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200">
                            <button
                                onClick={() => setActiveTab('catalog')}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-sm transition-all",
                                    activeTab === 'catalog' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Catalog
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-sm transition-all",
                                    activeTab === 'history' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                History
                            </button>
                        </div>
                        {activeTab === 'catalog' && (
                            <div className="relative group w-32 xl:w-64 hidden sm:block">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value.trim())}
                                    className="w-full bg-slate-100 border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 transition-all font-sans"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Sub-header Categories Strip (Only in Catalog) */}
                {activeTab === 'catalog' && (
                    <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                    "h-8 px-4 border rounded-sm text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    selectedCategory === cat
                                        ? "bg-slate-900 border-slate-900 text-white shadow-md"
                                        : "bg-white border-slate-200 text-slate-400 hover:border-slate-400"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar bg-slate-50">
                    {activeTab === 'catalog' ? (
                        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                            <AnimatePresence>
                                {filteredProducts.map((p, idx) => (
                                    <motion.div
                                        key={p._id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white border border-slate-200 p-3 transition-all group hover:border-slate-900 rounded-sm hover:shadow-xl hover:shadow-slate-200/50 flex flex-col"
                                    >
                                        <div className="aspect-[4/3] bg-slate-50 border border-slate-100 rounded-sm overflow-hidden mb-3 relative shrink-0">
                                            <img
                                                src={p.primaryImage}
                                                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                                                alt={p.name}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=40';
                                                }}
                                            />
                                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-sm shadow-sm">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{p.category?.name}</p>
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between">
                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight mb-2 min-h-[2.5em]">{p.name}</h4>
                                            <div className="flex items-end justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-black text-slate-900 tabular-nums leading-none mb-1">Add to Request</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Per {p.unit}</span>
                                                </div>

                                                {cart[p._id] ? (
                                                    <div className="flex items-center bg-slate-900 text-white rounded-sm p-0.5 shadow-lg shadow-slate-200">
                                                        <button onClick={() => updateQty(p._id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 transition-colors">
                                                            <Minus size={10} />
                                                        </button>
                                                        <span className="w-7 text-center font-black text-[10px] tabular-nums">{cart[p._id]?.qty}</span>
                                                        <button onClick={() => updateQty(p._id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 transition-colors">
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenModal(p)}
                                                        className="w-8 h-8 rounded-sm border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-lg hover:shadow-slate-200 active:scale-90"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {requestsError && (
                                <div className="p-3 bg-rose-50 border border-rose-100 rounded-sm text-[11px] font-bold text-rose-600 flex items-center justify-between gap-3">
                                    <span>{requestsError}</span>
                                    <button onClick={fetchRequests} className="underline shrink-0">Retry</button>
                                </div>
                            )}
                            {isLoadingRequests && (!procurementRequests || procurementRequests.length === 0) ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                                </div>
                            ) : procurementRequests && procurementRequests.length > 0 ? (
                                <>
                                <OpenOrdersSummary requests={procurementRequests} />
                                {procurementRequests.map((request, reqIdx) => {
                                    if (!request) return null;
                                    const reqId = request._id || request.id || '';
                                    return (
                                    <div key={reqId || reqIdx} className="bg-white border border-slate-200 p-4 rounded-sm hover:shadow-lg transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">Request #{reqId ? reqId.toString().slice(-6) : 'PENDING'}</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{request.createdAt && !isNaN(new Date(request.createdAt).getTime()) ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}</p>
                                                <p className="text-[10px] font-bold text-slate-500 mt-1">
                                                    {request.supplierFranchiseId?.franchiseName
                                                        ? `From mother franchise: ${request.supplierFranchiseId.franchiseName}`
                                                        : request.source === 'mother_franchise' ? 'From a mother franchise (admin is choosing)'
                                                            : request.vendorName ? `Vendor: ${request.vendorName}` : 'From a vendor (admin is choosing)'}
                                                </p>
                                                {request.customerName && (
                                                    <p className="text-[10px] font-bold text-slate-500">For: {request.customerName}</p>
                                                )}
                                                {request.status === 'pending_assignment' && request.lastDecline?.reason && (
                                                    <p className="text-[10px] font-bold text-amber-600 mt-0.5">Previous supplier: {request.lastDecline.reason}</p>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-sm border",
                                                request.status === 'pending_assignment' ? "bg-amber-50 text-amber-600 border-amber-200" :
                                                    request.status === 'assigned' ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                        request.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                                            "bg-slate-50 text-slate-400 border-slate-200"
                                            )}>
                                                {STATUS_LABEL[request.status] || (request.status || 'unknown').replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-sm p-3">
                                            <div className="grid grid-cols-4 gap-4 mb-2 pb-2 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                <div className="col-span-2">Item</div>
                                                <div className="text-right">Qty</div>
                                                <div className="text-right">Unit</div>
                                            </div>
                                            <div className="space-y-2">
                                                {request.items && request.items.map((item, i) => (
                                                    <div key={i} className="grid grid-cols-4 gap-4 text-[10px] font-bold text-slate-700">
                                                        <div className="col-span-2">{item.name}</div>
                                                        <div className="text-right font-black tabular-nums">{item.quantity}</div>
                                                        <div className="text-right uppercase">{item.unit}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )})}
                                </>
                            ) : (
                                <div className="text-center py-20">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                        <ShoppingBasket size={24} />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Request History</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Procurement Manifest Interface */}
            <div className="hidden lg:flex lg:w-[320px] xl:w-[380px] bg-white border-l border-slate-200 flex-col h-full shadow-2xl relative z-20 shrink-0">
                <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-slate-900 flex items-center justify-center text-white">
                            <ShoppingBasket size={14} />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-wider leading-none">Procurement</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Request List</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[11px] font-black text-slate-900 tabular-nums leading-none">{cartItems.length}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">SKUs</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
                    {cartItems.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {cartItems.map(item => (
                                <div key={item._id} className="p-4 flex gap-4 group hover:bg-slate-50 transition-colors">
                                    <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-sm bg-slate-50 border border-slate-100 overflow-hidden shrink-0 relative">
                                        <img
                                            src={item.primaryImage}
                                            className="w-full h-full object-cover transition-all"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&q=20';
                                            }}
                                            alt=""
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-[10px] xl:text-[11px] font-black text-slate-900 uppercase truncate leading-none">{item.name}</h4>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qty: {item.qty} {item.unit}</p>

                                        <div className="flex items-center justify-end mt-2">
                                            <div className="flex items-center border border-slate-200 rounded-sm p-0.5 bg-white shadow-sm">
                                                <button onClick={() => updateQty(item._id, -1)} className="w-5 h-5 xl:w-6 xl:h-6 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                                                    <Minus size={10} strokeWidth={3} />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="bg-transparent border-none w-8 xl:w-10 text-center font-black text-[10px] text-slate-900 outline-none tabular-nums"
                                                    value={item.qty}
                                                    onChange={(e) => setManualQty(item._id, e.target.value)}
                                                />
                                                <button onClick={() => updateQty(item._id, 1)} className="w-5 h-5 xl:w-6 xl:h-6 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                                                    <Plus size={10} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center px-10 pt-32">
                            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-sm flex items-center justify-center text-slate-200 mb-6 relative">
                                <ShoppingBasket size={32} strokeWidth={1} />
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-slate-200/50" />
                            </div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Your request list is empty</h3>
                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider max-w-[160px] leading-relaxed">Add products from the catalog to request stock.</p>
                        </div>
                    )}
                </div>

                <div className="p-5 xl:p-6 bg-slate-900 text-white shadow-[0_-10px_40px_rgba(15,23,42,0.15)] relative z-10">
                    <div className="mb-6 xl:mb-8">
                        <div className="flex justify-between items-center px-1 mb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Products</span>
                            <span className="text-[11px] font-black tabular-nums tracking-tight text-white">{cartItems.length}</span>
                        </div>
                        <div className="h-px bg-slate-800" />
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 px-1">Get this stock from</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'vendor', label: 'Vendor' },
                                { key: 'mother_franchise', label: 'Mother Franchise' },
                            ].map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setSource(opt.key)}
                                    className={cn(
                                        "h-10 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all",
                                        source === opt.key ? "bg-white text-slate-900 border-white" : "bg-transparent text-slate-400 border-slate-700 hover:border-slate-500"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handlePlaceOrder}
                        disabled={isSubmitting || cartItems.length === 0}
                        className={cn(
                            "w-full h-12 xl:h-14 rounded-sm font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn",
                            cartItems.length > 0
                                ? "bg-white text-slate-900 hover:bg-slate-100 shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-[0.98]"
                                : "bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800"
                        )}
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <>
                                <span className="relative z-10 transition-transform group-hover/btn:-translate-x-1">Submit Request</span>
                                <ArrowRight size={14} className="relative z-10 group-hover/btn:translate-x-1 transition-transform" />
                            </>
                        )}
                        {cartItems.length > 0 && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover/btn:opacity-100 transition-all -translate-x-full group-hover/btn:translate-x-full duration-1000" />}
                    </button>

                    <div className="mt-4 flex items-center justify-center gap-2">
                        <ShieldCheck size={10} className="text-emerald-500/50" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            {source === 'mother_franchise' ? 'Admin will ask a mother franchise to send it' : 'Sent to admin for approval'}
                        </span>
                    </div>
                </div>
            </div>
            {/* Quantity Selection Modal */}
            <AnimatePresence>
                {isQtyModalOpen && modalProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsQtyModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-sm shadow-2xl w-full max-w-xs relative z-10 overflow-hidden"
                        >
                            <div className="p-6">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{modalProduct.name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6">How much do you need?</p>

                                <div className="flex items-center justify-center gap-4 mb-8">
                                    <button
                                        onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                                        className="w-12 h-12 rounded-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                                    >
                                        <Minus size={18} className="text-slate-600" />
                                    </button>
                                    <div className="flex flex-col items-center gap-2">
                                        <input
                                            type="number"
                                            value={modalQty}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val) && val > 0) setModalQty(val);
                                                else if (e.target.value === '') setModalQty('');
                                            }}
                                            onBlur={() => {
                                                if (modalQty === '' || modalQty < 1) setModalQty(1);
                                            }}
                                            className="w-20 text-center text-3xl font-black text-slate-900 tabular-nums bg-transparent border-b border-slate-200 focus:border-slate-900 outline-none p-1"
                                        />
                                        <select
                                            value={modalUnit}
                                            onChange={(e) => setModalUnit(e.target.value)}
                                            className="bg-slate-100 border border-slate-200 rounded-sm px-2 py-1 text-[10px] font-black text-slate-900 uppercase tracking-wider outline-none focus:border-slate-400 cursor-pointer"
                                        >
                                            {units.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => setModalQty(modalQty + 1)}
                                        className="w-12 h-12 rounded-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                                    >
                                        <Plus size={18} className="text-slate-600" />
                                    </button>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsQtyModalOpen(false)}
                                        className="flex-1 h-10 border border-slate-200 rounded-sm font-black text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-colors text-slate-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmQty}
                                        className="flex-1 h-10 bg-slate-900 text-white rounded-sm font-black text-[10px] uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-lg active:scale-95"
                                    >
                                        Confirm Quantity
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
