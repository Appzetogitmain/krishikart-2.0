import { useState, useEffect, useRef } from 'react';
import {
    ShoppingBasket,
    Search,
    Plus,
    Minus,
    Truck,
    CheckCircle2,
    Loader2,
    Package,
    ShoppingCart,
    LayoutGrid,
    Leaf,
    Apple,
    Milk,
    Croissant,
    Snowflake,
    Lightbulb,
    Trash2,
    X,
    Send,
    ClipboardList,
    Building2,
    ArrowLeft,
    ShoppingBag,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useProcurement } from '../contexts/ProcurementContext';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { toast } from 'sonner';
import { FranchisePageHeader } from '../components/layout/FranchisePageHeader';
import { hindiName, hindiCategory } from '../utils/hindiNames';

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

const CAT_STYLE = [
    [/veg/i, Leaf, 'bg-green-50 text-green-700'],
    [/fruit/i, Apple, 'bg-rose-50 text-rose-600'],
    [/dairy|milk/i, Milk, 'bg-blue-50 text-blue-600'],
    [/bake|bread/i, Croissant, 'bg-amber-50 text-amber-600'],
    [/frozen/i, Snowflake, 'bg-sky-50 text-sky-600'],
];
const catStyle = (name) => {
    const hit = CAT_STYLE.find(([re]) => re.test(name || ''));
    return hit ? { Icon: hit[1], cls: hit[2] } : { Icon: Package, cls: 'bg-slate-100 text-slate-600' };
};
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=40';
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
    return (
        <div className="bg-white rounded-3xl border border-green-100 p-4 lg:p-5">
            <h3 className="text-lg font-bold text-slate-900">Open requests — product-wise total</h3>
            <p className="text-[14px] text-slate-500 mb-3">Same products from all your open requests added up. Each request is listed below.</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-[15px]">
                    <thead>
                        <tr className="bg-slate-50 text-[13px] font-semibold text-slate-500 text-left">
                            <th className="px-4 py-2.5">Item</th>
                            <th className="px-4 py-2.5 text-right">Total</th>
                            <th className="px-4 py-2.5">Vendor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {list.map((row) => (
                            <tr key={row.key}>
                                <td className="px-4 py-2.5 font-semibold text-slate-900">{row.name}<span className="block text-[12px] text-slate-500 font-normal">{row.orders} request{row.orders > 1 ? 's' : ''}</span></td>
                                <td className="px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap">{round2(row.qty)} {row.unit}</td>
                                <td className="px-4 py-2.5 text-[13px] text-slate-600">{[...row.by.entries()].map(([who, q]) => <div key={who}>{who}: {round2(q)}</div>)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Stepper({ value, onMinus, onPlus, onType, onDone, size = 'md' }) {
    const h = size === 'lg' ? 'h-11' : 'h-10';
    return (
        <div className="flex items-center gap-1.5">
            <button type="button" onClick={onMinus} disabled={!value} className={cn(h, 'w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200 disabled:opacity-40')} aria-label="Less"><Minus size={16} /></button>
            <input
                type="number"
                inputMode="decimal"
                min="0"
                value={value || ''}
                placeholder="0"
                onChange={(e) => onType(e.target.value)}
                onBlur={onDone}
                className={cn(h, 'w-12 rounded-lg border border-slate-200 bg-white text-center text-[15px] font-bold tabular-nums outline-none focus:border-green-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none')}
                aria-label="Quantity"
            />
            <button type="button" onClick={onPlus} className={cn(h, 'w-9 rounded-lg bg-green-700 text-white flex items-center justify-center hover:bg-green-800')} aria-label="More"><Plus size={16} /></button>
        </div>
    );
}

export default function ProcurementScreen() {
    const navigate = useNavigate();
    const location = useLocation();
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
    const cartRef = useRef(null);

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

    // "Add stock" from the Stock page: put that product in the request
    useEffect(() => {
        const pid = location.state?.addProductId;
        if (!pid || !products.length) return;
        const p = products.find((x) => String(x._id) === pid);
        if (p) {
            setCart((prev) => (prev[pid] ? prev : { ...prev, [pid]: { qty: 1, unit: p.unit || 'kg' } }));
            toast.success(`${p.name} added to your request`);
        }
        navigate(location.pathname, { replace: true, state: null });
    }, [location.state, location.pathname, products, setCart, navigate]);

    const filteredProducts = products.filter(p => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || p.name.toLowerCase().includes(term) || hindiName(p.name).includes(term);
        const categoryName = p.category?.name || (typeof p.category === 'string' ? p.category : '');
        const matchesCategory = selectedCategory === 'All' || categoryName === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const setQty = (product, qty) => {
        const id = product._id;
        const n = round2(qty);
        setCart(prev => {
            if (!(n > 0)) {
                const { [id]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [id]: { qty: n, unit: prev[id]?.unit || product.unit || 'kg' } };
        });
    };
    const stepQty = (product, delta) => setQty(product, (Number(cart[product._id]?.qty) || 0) + delta);
    // While typing (e.g. "0.5") keep the text as it is; an empty or zero amount is removed on blur
    const typeQty = (product, value) => setCart(prev => ({ ...prev, [product._id]: { qty: value, unit: prev[product._id]?.unit || product.unit || 'kg' } }));
    const removeItem = (id) => setCart(prev => { const { [id]: removed, ...rest } = prev; return rest; });

    const cartItems = Object.entries(cart).map(([id, item]) => {
        const product = products.find(p => p._id === id);
        if (!product) return { _id: id, name: 'Unknown Product', price: 0, qty: item.qty, unit: item.unit, primaryImage: '' };
        return { ...product, qty: item.qty, unit: item.unit };
    });
    const totalQty = round2(cartItems.reduce((s, i) => s + (Number(i.qty) || 0), 0));
    const units = [...new Set(cartItems.map((i) => i.unit))];

    // The franchise does not pay a price here: the admin fixes the vendor rate
    const totalAmount = 0;

    const handlePlaceOrder = async () => {
        if (cartItems.some((i) => !(Number(i.qty) > 0))) { toast.error('Enter a quantity for every item'); return; }
        setIsSubmitting(true);

        const requestData = {
            items: cartItems.map(item => ({
                productId: item._id,
                name: item.name,
                quantity: Number(item.qty) || 0,
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
            <div className="min-h-screen bg-[#f6f8f7] flex flex-col items-center justify-center p-8 text-center">
                <span className="w-24 h-24 rounded-full bg-green-700 text-white flex items-center justify-center mb-6 shadow-lg"><CheckCircle2 size={48} /></span>
                <h2 className="text-2xl font-bold text-slate-900">Request sent / अनुरोध भेज दिया</h2>
                <p className="text-[15px] text-slate-600 mt-3 max-w-md">
                    Your stock request{lastRequestId ? <> <b>#{String(lastRequestId).slice(-6).toUpperCase()}</b></> : null} has been sent to the admin for approval. You can track it in Request History.
                </p>
                <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
                    <button onClick={() => { setOrderSuccess(false); setActiveTab('history'); }}
                        className="w-full h-14 rounded-2xl bg-green-700 text-white text-[16px] font-bold hover:bg-green-800">
                        Request History देखें
                    </button>
                    <button onClick={() => setOrderSuccess(false)}
                        className="w-full h-12 rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-700 hover:bg-slate-50">
                        नया अनुरोध बनाएं
                    </button>
                </div>
            </div>
        );
    }

    const historyButton = (
        <button onClick={() => setActiveTab(activeTab === 'history' ? 'catalog' : 'history')}
            className="h-14 px-4 rounded-2xl border border-slate-200 bg-white flex items-center gap-3 hover:bg-slate-50">
            {activeTab === 'history' ? <ArrowLeft size={22} className="text-slate-600" /> : <ClipboardList size={22} className="text-slate-600" />}
            <span className="leading-tight text-left">
                <span className="block text-[15px] font-semibold text-slate-900">{activeTab === 'history' ? 'Back to products' : 'Request History'}</span>
                <span className="block text-[12px] text-slate-500">{activeTab === 'history' ? 'सामान चुनें' : 'पुराने अनुरोध देखें'}</span>
            </span>
        </button>
    );

    if (activeTab === 'history') {
        return (
            <div className="bg-[#f6f8f7] min-h-screen pb-24 lg:pb-8">
                <FranchisePageHeader icon={ClipboardList} title="Request History" subtitle="पुराने अनुरोध और उनकी स्थिति" right={historyButton} />
                <div className="px-4 lg:px-6 space-y-4 max-w-5xl">
                    {requestsError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-[14px] font-semibold text-rose-600 flex items-center justify-between gap-3">
                            <span>{requestsError}</span>
                            <button onClick={fetchRequests} className="underline shrink-0">Retry</button>
                        </div>
                    )}
                    {isLoadingRequests && (!procurementRequests || procurementRequests.length === 0) ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
                    ) : procurementRequests && procurementRequests.length > 0 ? (
                        <>
                            <OpenOrdersSummary requests={procurementRequests} />
                            {procurementRequests.map((request, reqIdx) => {
                                if (!request) return null;
                                const reqId = request._id || request.id || '';
                                return (
                                    <div key={reqId || reqIdx} className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5">
                                        <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                                            <div>
                                                <h3 className="text-[16px] font-bold text-slate-900">Request #{reqId ? reqId.toString().slice(-6).toUpperCase() : 'PENDING'}</h3>
                                                <p className="text-[13px] text-slate-500">{request.createdAt && !isNaN(new Date(request.createdAt).getTime()) ? new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                                                <p className="text-[14px] text-slate-600 mt-1">
                                                    {request.supplierFranchiseId?.franchiseName
                                                        ? `From mother franchise: ${request.supplierFranchiseId.franchiseName}`
                                                        : request.source === 'mother_franchise' ? 'From a mother franchise (admin is choosing)'
                                                            : request.vendorName ? `Vendor: ${request.vendorName}` : 'From a vendor (admin is choosing)'}
                                                </p>
                                                {request.customerName && <p className="text-[13px] text-slate-500">For: {request.customerName}</p>}
                                                {request.status === 'pending_assignment' && request.lastDecline?.reason && (
                                                    <p className="text-[13px] font-semibold text-amber-600 mt-0.5">Previous supplier: {request.lastDecline.reason}</p>
                                                )}
                                            </div>
                                            <span className={cn('px-3 py-1.5 rounded-lg text-[13px] font-semibold',
                                                request.status === 'pending_assignment' ? 'bg-amber-50 text-amber-700' :
                                                    request.status === 'completed' ? 'bg-green-50 text-green-700' :
                                                        request.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700')}>
                                                {STATUS_LABEL[request.status] || (request.status || 'unknown').replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(request.items || []).map((item, i) => (
                                                <span key={i} className="px-3 py-1.5 rounded-lg bg-slate-50 text-[14px] text-slate-700">
                                                    {item.name} <b className="text-slate-900 tabular-nums">{item.quantity} {item.unit}</b>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center text-slate-500">
                            <ShoppingBasket size={40} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-[15px]">अभी कोई अनुरोध नहीं</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-28 lg:pb-8">
            <FranchisePageHeader icon={ShoppingCart} title="Request Stock" subtitle="Browse products and add to your request" showDate={false} right={historyButton} />

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-5 px-4 lg:px-6">
                <div className="min-w-0 space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl bg-green-50 border border-green-100 p-3">
                        <Lightbulb size={20} className="text-green-700 shrink-0 mt-0.5" />
                        <p className="text-[14px] text-slate-700">Select products and quantities, then choose the source (Vendor or Mother Franchise) and send for admin approval.</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search vegetables, fruits, dairy... (जैसे टमाटर, आलू, दूध...)"
                            className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-green-600" />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {categories.map((cat) => {
                            const { Icon, cls } = cat === 'All' ? { Icon: LayoutGrid } : catStyle(cat);
                            const active = selectedCategory === cat;
                            return (
                                <button key={cat} onClick={() => setSelectedCategory(cat)}
                                    className={cn('shrink-0 h-14 pl-2 pr-4 rounded-2xl border flex items-center gap-2.5 transition-colors',
                                        active ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50')}>
                                    <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', active ? 'bg-white/15' : cls)}><Icon size={20} /></span>
                                    <span className="leading-tight text-left">
                                        <span className="block text-[14px] font-semibold">{cat === 'All' ? 'All Items' : cat}</span>
                                        <span className={cn('block text-[12px]', active ? 'text-green-100' : 'text-slate-500')}>{cat === 'All' ? 'सभी सामान' : hindiCategory(cat)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
                            {filteredProducts.map((p) => {
                                const hi = hindiName(p.name);
                                const qty = Number(cart[p._id]?.qty) || 0;
                                return (
                                    <div key={p._id} className={cn('bg-white rounded-2xl border overflow-hidden flex flex-col transition-shadow hover:shadow-md', qty ? 'border-green-500' : 'border-slate-100')}>
                                        <div className="aspect-[4/3] bg-slate-50 overflow-hidden">
                                            <img src={p.primaryImage || FALLBACK_IMG} alt={p.name} className="w-full h-full object-cover" loading="lazy"
                                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMG; }} />
                                        </div>
                                        <div className="p-3 flex-1 flex flex-col gap-2">
                                            <div className="min-h-[40px]">
                                                <p className="text-[15px] font-bold text-slate-900 leading-tight line-clamp-2">{p.name}</p>
                                                {hi && <p className="text-[13px] text-slate-500">{hi}</p>}
                                            </div>
                                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-[14px] text-slate-700 tabular-nums">{Number(p.price) > 0 ? <><b className="text-slate-900">₹ {p.price}</b> / {p.unit}</> : <>per {p.unit}</>}</span>
                                                <Stepper value={cart[p._id]?.qty} onMinus={() => stepQty(p, -1)} onPlus={() => stepQty(p, 1)} onType={(v) => typeQty(p, v)} onDone={() => setQty(p, cart[p._id]?.qty)} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-500">
                                    <Package size={40} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-[15px]">कोई सामान नहीं मिला</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Your request */}
                <div ref={cartRef} className="xl:sticky xl:top-4 self-start bg-white rounded-3xl border border-slate-100 p-4 lg:p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="w-12 h-12 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center"><ShoppingCart size={24} /></span>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-900">Your Request</h2>
                            <p className="text-[13px] text-slate-500">आपका अनुरोध</p>
                        </div>
                        {cartItems.length > 0 && (
                            <button onClick={clearCart} className="h-10 px-3 rounded-xl bg-rose-50 text-rose-600 text-[14px] font-semibold flex items-center gap-1.5 hover:bg-rose-100">
                                <Trash2 size={16} /> Clear All
                            </button>
                        )}
                    </div>

                    {cartItems.length > 0 ? (
                        <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto -mx-1 px-1">
                            {cartItems.map((item) => {
                                const hi = hindiName(item.name);
                                const line = Number(item.price) > 0 ? round2(item.price * (Number(item.qty) || 0)) : null;
                                return (
                                    <div key={item._id} className="py-3 flex items-center gap-3">
                                        <img src={item.primaryImage || FALLBACK_IMG} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-50 shrink-0"
                                            onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMG; }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-bold text-slate-900 truncate">{item.name}</p>
                                            {hi && <p className="text-[12px] text-slate-500">{hi}</p>}
                                            {Number(item.price) > 0 && <p className="text-[12px] text-slate-500">₹ {item.price} / {item.unit}</p>}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <Stepper value={item.qty} onMinus={() => stepQty(item, -1)} onPlus={() => stepQty(item, 1)} onType={(v) => typeQty(item, v)} onDone={() => setQty(item, cart[item._id]?.qty)} />
                                                <button onClick={() => removeItem(item._id)} className="text-rose-500 hover:text-rose-700" aria-label={`Remove ${item.name}`}><X size={18} /></button>
                                            </div>
                                            {line != null && <span className="text-[14px] font-bold text-slate-900 tabular-nums">₹ {line.toLocaleString('en-IN')}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-500">
                            <ShoppingBasket size={40} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-[15px] font-semibold">Your request is empty</p>
                            <p className="text-[13px]">Add products with the + button</p>
                        </div>
                    )}

                    <div className="flex items-center gap-3 rounded-2xl bg-green-50/70 p-3">
                        <ShoppingBag size={26} className="text-green-700" />
                        <div className="flex-1"><p className="text-[13px] text-slate-600">Total Items</p><p className="text-[17px] font-bold text-slate-900">{cartItems.length} items</p></div>
                        <div className="text-right"><p className="text-[13px] text-slate-600">Total Quantity</p><p className="text-[17px] font-bold text-slate-900">{totalQty} {units.length === 1 ? units[0] : ''}</p></div>
                    </div>

                    <div>
                        <p className="text-[16px] font-bold text-slate-900 mb-2">Request From <span className="text-[14px] font-normal text-slate-500">(स्टॉक कहाँ से चाहिए)</span></p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'vendor', label: 'Vendor', hi: 'वेंडर से', Icon: Truck },
                                { key: 'mother_franchise', label: 'Mother Franchise', hi: 'मदर फ्रैंचाइज़ से', Icon: Building2 },
                            ].map((opt) => (
                                <button key={opt.key} type="button" onClick={() => setSource(opt.key)}
                                    className={cn('flex items-center gap-2 p-3 rounded-2xl border-2 text-left transition-colors',
                                        source === opt.key ? 'border-green-600 bg-green-50/60' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                                    <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', source === opt.key ? 'border-green-600' : 'border-slate-300')}>
                                        {source === opt.key && <span className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                                    </span>
                                    <opt.Icon size={22} className="text-green-700 shrink-0" />
                                    <span className="leading-tight min-w-0"><span className="block text-[14px] font-semibold text-slate-900">{opt.label}</span><span className="block text-[12px] text-slate-500">{opt.hi}</span></span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handlePlaceOrder} disabled={isSubmitting || cartItems.length === 0}
                        className="w-full h-16 rounded-2xl bg-green-700 text-white flex items-center justify-center gap-3 hover:bg-green-800 disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : <Send size={24} />}
                        <span className="leading-tight text-left">
                            <span className="block text-[17px] font-bold">Send Stock Request</span>
                            <span className="block text-[13px] text-green-100">स्टॉक मांगें (अनुमोदन के लिए भेजें)</span>
                        </span>
                    </button>
                    <p className="text-[12px] text-slate-500 text-center">
                        {source === 'mother_franchise' ? 'Admin will ask a mother franchise to send it.' : 'Sent to admin for approval. Rates are fixed by the admin.'}
                    </p>
                </div>
            </div>

            {/* Phone: jump to the request list */}
            {cartItems.length > 0 && (
                <button onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="xl:hidden fixed bottom-20 left-4 right-4 z-40 h-14 rounded-2xl bg-green-700 text-white text-[16px] font-bold shadow-lg flex items-center justify-center gap-2">
                    <ShoppingCart size={20} /> Your Request ({cartItems.length}) — {totalQty} {units.length === 1 ? units[0] : ''}
                </button>
            )}
        </div>
    );
}
