import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingBag,
    Truck,
    CheckCircle2,
    Zap,
    History,
    ChevronRight,
    Search as SearchIcon,
    SlidersHorizontal,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Info,
    Package,
    Clock,
    Undo2,
    ClipboardList,
    MapPin,
    Phone,
    CalendarDays,
    ShoppingCart,
    Eye,
    Box,
    X,
    UserCircle2,
    Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { cn } from '@/lib/utils';
import { useInventory } from '../contexts/InventoryContext';
import { toast } from 'sonner';
import api from '@/lib/axios';
import OrderHistoryModal from '../components/modals/OrderHistoryModal';
import { FranchisePageHeader, StatTile, PillTabs } from '../components/layout/FranchisePageHeader';
import { estimateWeightKg, hasPackInfo, vehicleFor, vehicleLabel, isTwoWheeler, TWO_WHEELER_MAX_KG, MAX_ORDER_WEIGHT_KG } from '@/lib/deliveryVehicles';

/**
 * The same product across all orders in the list, added up (e.g. Potato 85 KG from 4 hotels), with the
 * stock in hand, so the franchise packs and procures on totals. Each order still opens on its own below.
 */
function ProductTotals({ orders, inventory }) {
    const [open, setOpen] = useState(true);
    const rows = new Map();
    for (const o of orders) {
        for (const i of o.items || []) {
            const pid = String(i.productId?._id || i.productId || i.name);
            const key = `${pid}|${String(i.unit || '').toLowerCase()}`;
            if (!rows.has(key)) rows.set(key, { key, pid, name: i.name, unit: i.unit, image: i.image, qty: 0, orders: 0 });
            const r = rows.get(key);
            r.qty = Math.round((r.qty + (Number(i.quantity) || 0)) * 100) / 100;
            r.orders += 1;
            if (!r.image && i.image) r.image = i.image;
        }
    }
    const list = [...rows.values()].sort((a, b) => b.qty - a.qty);
    if (!list.length) return null;
    const stockOf = (pid) => (inventory || []).find((s) => String(s.productId || s.id) === pid)?.currentStock;
    return (
        <div className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-green-50 text-green-700 flex items-center justify-center"><ShoppingCart size={22} /></span>
                <div className="flex-1 min-w-[200px]">
                    <h2 className="text-lg lg:text-xl font-bold text-slate-900">Total items needed</h2>
                    <p className="text-[14px] text-slate-500">{list.length} products from {orders.length} orders, added up</p>
                </div>
                <button type="button" onClick={() => setOpen((v) => !v)} className="h-10 px-4 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
                    {open ? 'Hide' : 'Show'}
                </button>
            </div>
            {open && (
                <div className="overflow-x-auto mt-4 rounded-2xl border border-slate-100">
                    <table className="w-full text-[15px]">
                        <thead>
                            <tr className="bg-slate-50 text-[13px] font-semibold text-slate-500">
                                <th className="text-left px-4 py-3">Product</th>
                                <th className="text-right px-4 py-3">Total needed</th>
                                <th className="text-right px-4 py-3">Orders</th>
                                <th className="text-right px-4 py-3">In stock</th>
                                <th className="text-right px-4 py-3">Need to buy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {list.map((r) => {
                                const stock = stockOf(r.pid);
                                const short = stock === undefined ? null : Math.max(0, Math.round((r.qty - stock) * 100) / 100);
                                const unit = String(r.unit || '').toUpperCase();
                                return (
                                    <tr key={r.key}>
                                        <td className="px-4 py-3">
                                            <span className="flex items-center gap-3">
                                                {r.image ? <img src={r.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-50" /> : <span className="w-10 h-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center"><Package size={18} /></span>}
                                                <span className="font-semibold text-slate-900">{r.name}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{r.qty} {unit}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{r.orders}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums whitespace-nowrap">{stock === undefined ? '—' : `${stock} ${unit}`}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {short === null ? <span className="text-slate-400">—</span> : short > 0
                                                ? <span className="inline-block px-3 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold tabular-nums">{short} {unit}</span>
                                                : <span className="inline-block px-3 py-1 rounded-lg bg-green-50 text-green-700 font-bold">Enough</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// One customer's orders for one day are shown together (client, Oct 2026): same customer + same delivery day
const dayKey = (o) => {
    const d = new Date(o.scheduledDate || o.createdAt || Date.now());
    return Number.isNaN(d.getTime()) ? '' : d.toDateString();
};
const customerKey = (o) => o.customerId || o.customerMobile || o.hotelName || o.id;

// Same place: same delivery address text, or delivery pins within ~60 m whose addresses mostly match
// (a pin alone is not enough: an address without a pin is geocoded and may land on the city centre)
const placeText = (o) => String(o.shippingAddress || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const addressWords = (o) => new Set(String(o.shippingAddress || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
const addressesAlike = (a, b) => {
    const wa = addressWords(a);
    const wb = addressWords(b);
    if (!wa.size || !wb.size) return false;
    let both = 0;
    wa.forEach((w) => { if (wb.has(w)) both += 1; });
    return both / (wa.size + wb.size - both) >= 0.5;
};
const pinOf = (o) => {
    const c = o.shippingCoords;
    return Array.isArray(c) && c.length === 2 && !(Number(c[0]) === 0 && Number(c[1]) === 0) ? [Number(c[0]), Number(c[1])] : null;
};
const metersBetween = ([lng1, lat1], [lng2, lat2]) => {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(a));
};
const samePlace = (a, b) => {
    const ta = placeText(a);
    if (ta.length >= 8 && ta === placeText(b)) return true;
    const pa = pinOf(a);
    const pb = pinOf(b);
    return !!(pa && pb && metersBetween(pa, pb) <= 60 && addressesAlike(a, b));
};
const belongTogether = (a, b) => dayKey(a) === dayKey(b) && (customerKey(a) === customerKey(b) || samePlace(a, b));

/** The items of several orders added up per product + unit (Potato 2 kg + 3 kg -> 5 kg) */
function mergeItems(orders) {
    const rows = new Map();
    for (const o of orders) {
        for (const i of o.items || []) {
            const key = `${String(i.productId?._id || i.productId || i.name)}|${String(i.unit || '').toLowerCase()}`;
            if (!rows.has(key)) rows.set(key, { key, name: i.name, unit: i.unit, quantity: 0, short: false });
            const r = rows.get(key);
            r.quantity = Math.round((r.quantity + (Number(i.quantity) || 0)) * 100) / 100;
            if (i.isShortage && !o.allowPartialFulfillment) r.short = true;
        }
    }
    return [...rows.values()];
}

// Weight typed in the pack popups: up to 2 decimals, within the allowed range
const cleanKg = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    const n = Math.round(Number(v) * 100) / 100;
    return Number.isFinite(n) && n >= 0 ? Math.min(MAX_ORDER_WEIGHT_KG, n) : '';
};
const weightOf = (o) => (Number(o?.packedWeightKg) > 0 ? Number(o.packedWeightKg) : estimateWeightKg(o?.items));
const VehicleHint = ({ kg }) => (Number(kg) > 0 ? (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold', Number(kg) > TWO_WHEELER_MAX_KG ? 'bg-violet-50 text-violet-700' : 'bg-green-50 text-green-700')}>
        <Truck size={14} /> Goes on: {vehicleFor(kg)}
    </span>
) : null);

const paymentLabel = (val) => {
    const m = String(val || 'COD').toUpperCase();
    if (m === 'COD') return { text: 'Cash on Delivery', cls: 'bg-amber-50 text-amber-700' };
    if (m.includes('WALLET')) return { text: 'Wallet', cls: 'bg-violet-50 text-violet-700' };
    if (m.includes('CREDIT')) return { text: 'KK Credit', cls: 'bg-rose-50 text-rose-600' };
    if (m === 'UPI' || m === 'ONLINE' || m === 'PREPAID') return { text: 'Paid online', cls: 'bg-blue-50 text-blue-700' };
    return { text: m, cls: 'bg-slate-100 text-slate-600' };
};

const STATUS_PILL = {
    placed: ['New order', 'bg-orange-50 text-orange-600'],
    pending: ['New order', 'bg-orange-50 text-orange-600'],
    new: ['New order', 'bg-orange-50 text-orange-600'],
    assigned: ['New order', 'bg-orange-50 text-orange-600'],
    accepted: ['To prepare', 'bg-amber-50 text-amber-700'],
    procuring: ['Waiting for stock', 'bg-amber-50 text-amber-700'],
    packed: ['Ready to send', 'bg-yellow-50 text-yellow-700'],
    ready: ['Ready to send', 'bg-yellow-50 text-yellow-700'],
    dispatched: ['On the way', 'bg-violet-50 text-violet-700'],
    'out for delivery': ['On the way', 'bg-violet-50 text-violet-700'],
    delivered: ['Delivered', 'bg-green-50 text-green-700'],
    received: ['Delivered', 'bg-green-50 text-green-700'],
    completed: ['Delivered', 'bg-green-50 text-green-700'],
    cancelled: ['Cancelled', 'bg-rose-50 text-rose-600'],
};

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
    // 'pack' = mark the order packed with this count; 'count' = the order is already packed (e.g. by the
    // system after vendor stock arrived) and only the count is missing
    const [packageModalMode, setPackageModalMode] = useState('pack');
    const [packageCount, setPackageCount] = useState(0);
    // Goods that came back after the customer refused the order: { id, name }
    const [returnedGoodsOrder, setReturnedGoodsOrder] = useState(null);
    const [savingGoods, setSavingGoods] = useState(false);

    const settleReturnedGoods = async (action) => {
        if (!returnedGoodsOrder || savingGoods) return;
        setSavingGoods(true);
        try {
            await api.put(`/orders/franchise/${returnedGoodsOrder.id}/refused-goods`, { action });
            toast.success(action === 'restock' ? 'Goods added back to your stock' : 'Goods written off');
            setReturnedGoodsOrder(null);
            if (refreshOrders) await refreshOrders();
            if (refreshInventory) refreshInventory();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update the returned goods');
        } finally {
            setSavingGoods(false);
        }
    };
    const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState(null);
    const [selectedOrderForPacking, setSelectedOrderForPacking] = useState(null);
    const packingOrder = allOrders.find(o => o.id === selectedOrderForPacking) || null;
    const [isAssigning, setIsAssigning] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [rejectingOrderId, setRejectingOrderId] = useState(null);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [quickFilter, setQuickFilter] = useState('all');
    const filterMenuRef = useRef(null);
    // Combined customer cards: which are expanded, which one is running a bulk action, and the
    // "mark all ready" / "enter weights" popup: { key, ids, mode: 'pack' | 'count', counts: { [orderId]: kg } }
    const [openGroups, setOpenGroups] = useState({});
    const [bulkBusy, setBulkBusy] = useState(null);
    const [groupPack, setGroupPack] = useState(null);

    /** Runs one action on several orders, one after another, then shows a single summary */
    const runBulk = async (key, ids, fn, doneMsg) => {
        setBulkBusy(key);
        let ok = 0;
        for (const id of ids) {
            if (await fn(id)) ok += 1;
        }
        setBulkBusy(null);
        if (refreshOrders) await refreshOrders();
        if (ok === ids.length) toast.success(doneMsg(ok));
        else toast.warning(`${ok} of ${ids.length} orders done - please check the others`);
        return ok;
    };

    const confirmGroupPack = async () => {
        if (!groupPack) return;
        const { key, ids, mode, counts } = groupPack;
        const fn = mode === 'count'
            ? (id) => api.put(`/orders/franchise/${id}/packages`, { packedWeightKg: Number(counts[id]) })
                .then(() => true)
                .catch((error) => { toast.error(error.response?.data?.message || 'Could not save the weight'); return false; })
            : (id) => updateOrderStatus(id, 'Packed', { packedWeightKg: Number(counts[id]) }, { quiet: true });
        await runBulk(key, ids, fn, (n) => (mode === 'count' ? `Weight saved for ${n} orders` : `${n} orders marked ready`));
        setGroupPack(null);
        if (mode !== 'count') refreshInventory();
    };

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

        if (newStatus === 'Packed' && !extraData.packedWeightKg) {
            setSelectedOrderForPacking(orderId);
            setPackageCount(estimateWeightKg(order.items) || '');
            setPackageModalMode('pack');
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
        if (packageModalMode === 'count') {
            setProcessingOrderId(selectedOrderForPacking);
            try {
                const { data } = await api.put(`/orders/franchise/${selectedOrderForPacking}/packages`, { packedWeightKg: Number(packageCount) });
                toast.success(data?.message || 'Weight saved');
                if (refreshOrders) await refreshOrders();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Could not save the weight');
                setProcessingOrderId(null);
                return;
            }
            setProcessingOrderId(null);
        } else {
            await handleAction(selectedOrderForPacking, 'Packed', { packedWeightKg: Number(packageCount) });
        }
        setIsPackageModalOpen(false);
        setSelectedOrderForPacking(null);
        setPackageCount(0);
        setPackageModalMode('pack');
    };

    const handleAssignDelivery = async (partnerId) => {
        if (!selectedOrderForDispatch || !partnerId) return;
        setIsAssigning(true);
        if (Array.isArray(selectedOrderForDispatch)) {
            // A customer's combined orders go with one delivery partner
            await runBulk('dispatch', selectedOrderForDispatch, (id) => assignDeliveryPartner(id, partnerId, { quiet: true }), (n) => `${n} orders sent with one delivery partner`);
            setIsAssignModalOpen(false);
            setSelectedOrderForDispatch(null);
            refreshInventory();
            setIsAssigning(false);
            return;
        }
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
        { id: 'ready', label: 'Ready to Send', icon: Zap },
        { id: 'completed', label: 'Completed', icon: History },
        { id: 'refused', label: 'Returned', icon: Undo2 }
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
        } else if (activeTab === 'refused') {
            // Whole order refused, or some items given back at a partial delivery
            matchesTab = (status === 'cancelled' && !!order.deliveryRefusal) || !!order.partialReturn;
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

    const tabStatuses = {
        new: ['placed', 'pending', 'new', 'procuring', 'assigned', 'accepted'],
        ready: ['packed', 'dispatched', 'ready'],
        completed: ['delivered', 'received', 'completed'],
    };
    const tabCount = (id) => allOrders.filter((o) => {
        const s = (o.status || '').toLowerCase();
        return id === 'refused' ? ((s === 'cancelled' && !!o.deliveryRefusal) || !!o.partialReturn) : tabStatuses[id].includes(s);
    }).length;
    const switchTab = (id) => { setIsLoading(true); setActiveTab(id); };

    const btn = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap';

    const renderActions = (row) => (
        <>
            {activeTab === 'new' && (
                (row.status === 'placed' || row.status === 'assigned' || row.status === 'new') ? (
                    <button
                        onClick={() => handleAction(row.id, 'accept')}
                        disabled={processingOrderId === row.id}
                        className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}
                    >
                        <Check size={18} /> Accept Order
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
                                className={cn(btn, 'border border-rose-300 text-rose-600 bg-white hover:bg-rose-50')}
                            >
                                <X size={18} /> {rejectingOrderId === row.id ? '…' : 'Reject'}
                            </button>
                        )}
                        {row.items.some(i => i.isShortage) && !row.allowPartialFulfillment ? (
                            <button
                                onClick={() => handleAction(row.id, 'procure')}
                                className={cn(btn, 'bg-amber-500 text-white hover:bg-amber-600')}
                            >
                                <Info size={18} /> Request Stock
                            </button>
                        ) : (
                            <button
                                onClick={() => handleAction(row.id, 'Packed')}
                                disabled={processingOrderId === row.id}
                                className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}
                            >
                                <CheckCircle2 size={18} /> {row.allowPartialFulfillment ? 'Pack Available Stock' : 'Mark Ready'}
                            </button>
                        )}
                    </>
                )
            )}
            {activeTab === 'ready' && row.status === 'packed' && !hasPackInfo(row) && (
                <button
                    onClick={() => {
                        setSelectedOrderForPacking(row.id);
                        setPackageModalMode('count');
                        setPackageCount(estimateWeightKg(row.items) || '');
                        setIsPackageModalOpen(true);
                    }}
                    className={cn(btn, 'border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100')}
                    title="Enter the packed weight (kg). A bike / scooter (up to 20 kg) or auto / 4-wheeler is then assigned automatically."
                >
                    <Package size={18} /> Enter weight
                </button>
            )}
            {activeTab === 'ready' && row.status === 'packed' && hasPackInfo(row) && (
                <button
                    onClick={() => {
                        setSelectedOrderForDispatch(row.id);
                        setIsAssignModalOpen(true);
                    }}
                    className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}
                >
                    <Truck size={18} /> Assign & Send
                </button>
            )}
            {activeTab === 'ready' && row.status === 'dispatched' && (
                <button
                    onClick={() => {
                        setSelectedOrderForDispatch(row.id);
                        setIsAssignModalOpen(true);
                    }}
                    className={cn(btn, 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50')}
                    title="Give this order to a different delivery partner (only before it is picked up)"
                >
                    <Truck size={18} /> Change partner
                </button>
            )}
            <button
                onClick={() => navigate(`/franchise/orders/${row.id}`)}
                className={cn(btn, 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50')}
            >
                <Eye size={18} /> View Details
            </button>
        </>
    );

    // What came back at the door, and what to do with it (Returned tab)
    const renderReturn = (row) => {
        const back = row.deliveryRefusal || row.partialReturn;
        if (activeTab !== 'refused' || !back) return null;
        return (
            <div className="rounded-2xl bg-rose-50/60 border border-rose-100 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                    <p className="text-[14px] font-semibold text-rose-700">
                        {row.deliveryRefusal
                            ? <>{row.deliveryRefusal.reasonLabel || 'Not accepted'}{row.deliveryRefusal.note ? ` - ${row.deliveryRefusal.note}` : ''}</>
                            : <>Partly delivered{row.partialReturn.reason ? ` - ${row.partialReturn.reason}` : ''}</>}
                    </p>
                    {row.partialReturn && !row.deliveryRefusal && (
                        <p className="text-[13px] text-slate-600">
                            Given back: {(row.partialReturn.items || []).map((i) => `${i.name} ${i.quantity} ${i.unit || ''}`.trim()).join(', ')}
                        </p>
                    )}
                </div>
                {back.goodsStatus === 'with_delivery' && row.returnOtpCode ? (
                    <div className="text-right">
                        <p className="text-[12px] text-slate-500">Return code - tell the delivery partner when they bring the goods back</p>
                        <p className="text-xl font-bold tracking-[0.3em] text-slate-900 tabular-nums">{row.returnOtpCode}</p>
                    </div>
                ) : back.goodsStatus === 'with_delivery' ? (
                    <button
                        onClick={() => setReturnedGoodsOrder({ id: row.id, name: row.hotelName || row.userId?.fullName || 'this order' })}
                        className={cn(btn, 'border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100')}
                    >
                        <Package size={18} /> Goods received back
                    </button>
                ) : (
                    <span className="px-3 py-1.5 rounded-lg bg-white text-[13px] font-semibold text-slate-600">
                        {back.goodsStatus === 'restocked' ? 'Added back to stock' : 'Written off'}
                    </span>
                )}
            </div>
        );
    };

    const orderCard = (row) => {
        const [label, cls] = STATUS_PILL[(row.status || '').toLowerCase()] || [row.status, 'bg-slate-100 text-slate-600'];
        const pay = paymentLabel(row.paymentMode);
        const items = row.items || [];
        const day = row.scheduledDate || row.createdAt;
        return (
            <div key={row.id} className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5 space-y-4 hover:shadow-sm transition-shadow">
                <div className="flex flex-wrap items-start gap-4">
                    {items[0]?.image
                        ? <img src={items[0].image} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-50 shrink-0" loading="lazy" />
                        : <span className="w-16 h-16 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0"><Package size={26} /></span>}
                    <div className="flex-1 min-w-[180px]">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[16px] font-bold text-slate-900">Order #{String(row.id).slice(-6).toUpperCase()}</p>
                            <span className={cn('px-3 py-1 rounded-lg text-[13px] font-semibold', cls)}>{label}</span>
                            {row.status === 'procuring' && <RefreshCw size={14} className="text-amber-600 animate-spin" />}
                        </div>
                        <p translate="no" className="text-[16px] font-semibold text-slate-800 mt-0.5">{row.hotelName}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[13px] text-slate-500">
                            {row.customerMobile && <span className="flex items-center gap-1"><Phone size={13} /> {row.customerMobile}</span>}
                            {row.city && <span className="flex items-center gap-1"><MapPin size={13} /> {row.city}</span>}
                        </div>
                    </div>
                    <div className="min-w-[130px]">
                        <p className="text-[12px] text-slate-500">Delivery</p>
                        <p className="text-[15px] font-bold text-slate-900">{row.deliverySlot}</p>
                        {day && <p className="text-[13px] text-slate-500 flex items-center gap-1"><CalendarDays size={13} /> {new Date(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
                        {(row.scheduledDateFormatted || row.scheduledDate) && <p className="text-[12px] font-semibold text-amber-700 flex items-center gap-1"><Clock size={12} /> Advance booking</p>}
                    </div>
                    <div className="min-w-[110px] text-right">
                        <p className="text-[12px] text-slate-500">Order value</p>
                        <p className="text-[18px] font-bold text-slate-900 tabular-nums">₹{Number(row.total || 0).toLocaleString('en-IN')}</p>
                        <span className={cn('inline-block mt-1 px-2.5 py-0.5 rounded-md text-[12px] font-semibold', pay.cls)}>{pay.text}</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {items.slice(0, 6).map((i, idx) => (
                        <span key={idx} className="px-3 py-1.5 rounded-lg bg-slate-50 text-[13px] text-slate-700">
                            {i.name} <b className="text-slate-900 tabular-nums">{i.quantity} {i.unit}</b>
                            {i.isShortage && !row.allowPartialFulfillment && <span className="ml-1 text-rose-600 font-semibold">(short)</span>}
                        </span>
                    ))}
                    {items.length > 6 && <span className="px-3 py-1.5 rounded-lg bg-slate-50 text-[13px] text-slate-500">+{items.length - 6} more</span>}
                </div>
                {renderReturn(row)}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-50">
                    {activeTab === 'ready' && row.status === 'dispatched' && row.deliveryPartner && (
                        <span className="mr-auto inline-flex items-center gap-2 text-[14px] font-semibold text-violet-700">
                            <UserCircle2 size={18} /> {row.deliveryPartner?.fullName}
                            {row.autoDispatched && <span className="px-2 py-0.5 rounded-md bg-violet-50 text-[12px] font-semibold">Auto-assigned</span>}
                        </span>
                    )}
                    {renderActions(row)}
                </div>
            </div>
        );
    };

    // New / Ready tabs: orders for the same day from the same customer OR going to the same place become one
    // combined card (each order keeps its own bill, payment and delivery code)
    const groupable = ['new', 'ready'].includes(activeTab);
    let entries = [];
    for (const o of filteredOrders) {
        if (!groupable) { entries.push({ key: o.id, orders: [o] }); continue; }
        const hits = entries.filter((g) => g.orders.some((m) => belongTogether(m, o)));
        if (!hits.length) {
            entries.push({ key: `${customerKey(o)}|${dayKey(o)}`, orders: [o] });
            continue;
        }
        // One order can link two groups (same customer as one, same address as the other): join them
        const [keep, ...rest] = hits;
        keep.orders.push(o);
        for (const g of rest) keep.orders.push(...g.orders);
        entries = entries.filter((g) => !rest.includes(g));
    }

    const groupCard = (g) => {
        const orders = g.orders;
        const first = orders[0];
        const open = !!openGroups[g.key];
        const items = mergeItems(orders);
        const total = Math.round(orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) * 100) / 100;
        const slots = [...new Set(orders.map((o) => o.deliverySlot).filter(Boolean))];
        const pays = [...new Map(orders.map((o) => { const p = paymentLabel(o.paymentMode); return [p.text, p]; })).values()];
        const day = first.scheduledDate || first.createdAt;
        const advance = orders.some((o) => o.scheduledDateFormatted || o.scheduledDate);
        const image = orders.flatMap((o) => o.items || []).find((i) => i.image)?.image;
        const idsWhere = (test) => orders.filter(test).map((o) => o.id);
        const toAccept = idsWhere((o) => ['placed', 'assigned', 'new'].includes(o.status));
        const toPack = idsWhere((o) => o.status === 'accepted' && !((o.items || []).some((i) => i.isShortage) && !o.allowPartialFulfillment));
        const toCount = idsWhere((o) => o.status === 'packed' && !hasPackInfo(o));
        const toSend = idsWhere((o) => o.status === 'packed' && hasPackInfo(o));
        const busy = bulkBusy === g.key;
        const people = [...new Set(orders.map((o) => o.hotelName).filter(Boolean))];
        const manyPeople = people.length > 1;
        // Who is taking these orders (set automatically, or changed by hand)
        const riders = [...new Set(orders.filter((o) => o.status === 'dispatched' && o.deliveryPartner?.fullName).map((o) => o.deliveryPartner.fullName))];
        const openPack = (ids, mode) => setGroupPack({ key: g.key, ids, mode, counts: Object.fromEntries(ids.map((id) => [id, estimateWeightKg(orders.find((o) => o.id === id)?.items) || ''])) });
        return (
            <div key={g.key} data-group-card className="bg-white rounded-3xl border-2 border-green-200 p-4 lg:p-5 space-y-4 hover:shadow-sm transition-shadow">
                <div className="flex flex-wrap items-start gap-4">
                    <span className="relative shrink-0">
                        {image
                            ? <img src={image} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-50" loading="lazy" />
                            : <span className="w-16 h-16 rounded-xl bg-green-50 text-green-700 flex items-center justify-center"><Package size={26} /></span>}
                        <span className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-green-700 text-white text-[13px] font-bold flex items-center justify-center border-2 border-white">{orders.length}</span>
                    </span>
                    <div className="flex-1 min-w-[180px]">
                        <div className="flex flex-wrap items-center gap-2">
                            <p translate="no" className="text-[17px] font-bold text-slate-900">{people.join(' + ') || first.hotelName}</p>
                            <span className="px-3 py-1 rounded-lg text-[13px] font-semibold bg-green-50 text-green-700">{orders.length} orders combined</span>
                        </div>
                        <p className="text-[13px] text-slate-500 mt-0.5">{manyPeople ? 'Same place, same day' : 'Same customer, same day'} - pack and send together</p>
                        {manyPeople && first.shippingAddress && (
                            <p translate="no" className="text-[13px] text-slate-600 flex items-center gap-1 mt-0.5"><MapPin size={13} /> {first.shippingAddress}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[13px] text-slate-500">
                            {first.customerMobile && <span className="flex items-center gap-1"><Phone size={13} /> {first.customerMobile}</span>}
                            {first.city && <span className="flex items-center gap-1"><MapPin size={13} /> {first.city}</span>}
                        </div>
                    </div>
                    <div className="min-w-[130px]">
                        <p className="text-[12px] text-slate-500">Delivery</p>
                        <p className="text-[15px] font-bold text-slate-900">{slots.join(', ') || 'Standard'}</p>
                        {day && <p className="text-[13px] text-slate-500 flex items-center gap-1"><CalendarDays size={13} /> {new Date(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
                        {advance && <p className="text-[12px] font-semibold text-amber-700 flex items-center gap-1"><Clock size={12} /> Advance booking</p>}
                    </div>
                    <div className="min-w-[110px] text-right">
                        <p className="text-[12px] text-slate-500">Total value</p>
                        <p className="text-[18px] font-bold text-slate-900 tabular-nums">₹{total.toLocaleString('en-IN')}</p>
                        <span className="flex flex-wrap justify-end gap-1 mt-1">
                            {pays.map((p) => <span key={p.text} className={cn('inline-block px-2.5 py-0.5 rounded-md text-[12px] font-semibold', p.cls)}>{p.text}</span>)}
                        </span>
                    </div>
                </div>
                <div>
                    <p className="text-[12px] font-semibold text-slate-500 mb-1.5">Total to pack</p>
                    <div className="flex flex-wrap gap-2">
                        {items.slice(0, 8).map((i) => (
                            <span key={i.key} className="px-3 py-1.5 rounded-lg bg-green-50 text-[13px] text-slate-700">
                                {i.name} <b className="text-slate-900 tabular-nums">{i.quantity} {i.unit}</b>
                                {i.short && <span className="ml-1 text-rose-600 font-semibold">(short)</span>}
                            </span>
                        ))}
                        {items.length > 8 && <span className="px-3 py-1.5 rounded-lg bg-slate-50 text-[13px] text-slate-500">+{items.length - 8} more</span>}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-50">
                    <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                        className="mr-auto inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-[14px] font-semibold text-green-800 hover:bg-green-50"
                    >
                        <ChevronRight size={18} className={cn('transition-transform', open && 'rotate-90')} />
                        {open ? 'Hide orders' : `See ${orders.length} orders`}
                    </button>
                    {riders.length > 0 && (
                        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-violet-700">
                            <Truck size={18} /> On the way with <span translate="no">{riders.join(', ')}</span>
                        </span>
                    )}
                    {toAccept.length > 0 && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => runBulk(g.key, toAccept, (id) => acceptOrder(id, { quiet: true }), (n) => `${n} orders accepted`)}
                            className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}
                        >
                            <Check size={18} /> {busy ? 'Please wait…' : `Accept all (${toAccept.length})`}
                        </button>
                    )}
                    {toPack.length > 0 && (
                        <button type="button" disabled={busy} onClick={() => openPack(toPack, 'pack')} className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}>
                            <CheckCircle2 size={18} /> {busy ? 'Please wait…' : `Mark all ready (${toPack.length})`}
                        </button>
                    )}
                    {toCount.length > 0 && (
                        <button type="button" disabled={busy} onClick={() => openPack(toCount, 'count')} className={cn(btn, 'border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100')}>
                            <Package size={18} /> {`Enter weights (${toCount.length})`}
                        </button>
                    )}
                    {toSend.length > 0 && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setSelectedOrderForDispatch(toSend); setIsAssignModalOpen(true); }}
                            className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}
                        >
                            <Truck size={18} /> {`Assign & Send all (${toSend.length})`}
                        </button>
                    )}
                </div>
                {open && (
                    <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
                        {orders.map((row) => {
                            const [label, cls] = STATUS_PILL[(row.status || '').toLowerCase()] || [row.status, 'bg-slate-100 text-slate-600'];
                            return (
                                <div key={row.id} className="p-3 lg:p-4 flex flex-wrap items-center gap-3">
                                    <div className="flex-1 min-w-[220px]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-[15px] font-bold text-slate-900 whitespace-nowrap">Order #{String(row.id).slice(-6).toUpperCase()}</p>
                                            <span className={cn('px-2.5 py-0.5 rounded-lg text-[12px] font-semibold', cls)}>{label}</span>
                                            {row.status === 'procuring' && <RefreshCw size={13} className="text-amber-600 animate-spin" />}
                                            {manyPeople && <span translate="no" className="text-[13px] font-semibold text-slate-600">· {row.hotelName}</span>}
                                        </div>
                                        <p className="text-[13px] text-slate-600 mt-0.5">
                                            {(row.items || []).map((i) => `${i.name} ${i.quantity} ${i.unit}${i.isShortage && !row.allowPartialFulfillment ? ' (short)' : ''}`).join(', ')}
                                        </p>
                                    </div>
                                    <span className="text-[13px] text-slate-500 whitespace-nowrap flex items-center gap-1"><Clock size={13} /> {row.deliverySlot}</span>
                                    <span className="text-[15px] font-bold text-slate-900 tabular-nums whitespace-nowrap">₹{Number(row.total || 0).toLocaleString('en-IN')}</span>
                                    <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                                        {row.status === 'dispatched' && row.deliveryPartner && (
                                            <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-violet-700"><UserCircle2 size={18} /> {row.deliveryPartner?.fullName}{row.autoDispatched && <span className="px-2 py-0.5 rounded-md bg-violet-50 text-[12px] font-semibold">Auto-assigned</span>}</span>
                                        )}
                                        {renderActions(row)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const groupPackOrders = groupPack ? allOrders.filter((o) => groupPack.ids.includes(o.id)) : [];
    const groupPackKg = Math.round(groupPackOrders.reduce((sum, o) => sum + (Number(groupPack?.counts[o.id]) || 0), 0) * 100) / 100;
    // Weight of what is being assigned by hand (one order, or a combined card's orders together)
    const dispatchKg = Math.round((Array.isArray(selectedOrderForDispatch) ? selectedOrderForDispatch : [selectedOrderForDispatch])
        .map((id) => allOrders.find((o) => o.id === id)).filter(Boolean)
        .reduce((sum, o) => sum + weightOf(o), 0) * 100) / 100;

    if (isLoading && !filteredOrders.length) {
        return (
            <div className="p-4 lg:p-6 space-y-4 animate-pulse bg-[#f6f8f7] min-h-screen">
                <div className="h-14 w-72 bg-slate-200 rounded-2xl" />
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-2xl" />)}</div>
                <div className="h-[400px] bg-white rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-24 lg:pb-8">
            <FranchisePageHeader
                icon={ClipboardList}
                title="Hotel Orders"
                subtitle="Check new orders, get them ready and send them for delivery"
                right={
                    <button
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="h-14 px-5 rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 flex items-center gap-2 hover:bg-slate-50"
                    >
                        <History size={20} /> Order History
                    </button>
                }
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4 px-4 lg:px-6">
                <StatTile tone="blue" icon={ShoppingBag} label="New Orders" value={stats.newOrders} note="To accept and prepare" onClick={() => switchTab('new')} active={activeTab === 'new'} />
                <StatTile tone="orange" icon={Zap} label="Ready to Send" value={stats.readyToDispatch} note="Packed, waiting for delivery" onClick={() => switchTab('ready')} active={activeTab === 'ready'} />
                <StatTile tone="green" icon={CheckCircle2} label="Completed" value={stats.completedCount} note="Delivered to hotels" onClick={() => switchTab('completed')} active={activeTab === 'completed'} />
                <StatTile tone="red" icon={Undo2} label="Returned" value={tabCount('refused')} note="Came back at the door" onClick={() => switchTab('refused')} active={activeTab === 'refused'} />
            </div>

            <div className="px-4 lg:px-6 mt-5 flex flex-wrap items-center gap-3">
                <PillTabs
                    tabs={tabs.map((t) => ({ ...t, count: tabCount(t.id) }))}
                    active={activeTab}
                    onChange={switchTab}
                />
                <div className="flex-1" />
                <div className="relative w-full sm:w-auto">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search order no. or hotel"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.trim())}
                        className="w-full sm:w-72 h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-4 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-green-600"
                    />
                </div>
                <div className="relative" ref={filterMenuRef}>
                    <button
                        type="button"
                        onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                        aria-label="Open order filters"
                        title={quickFilter === 'all' ? 'Filter orders' : `Filter active: ${activeFilterLabel}`}
                        className={cn(
                            'h-11 px-4 rounded-xl border flex items-center gap-2 text-[14px] font-semibold',
                            quickFilter === 'all' ? 'border-slate-200 bg-white text-slate-700' : 'border-green-600 bg-green-50 text-green-800'
                        )}
                    >
                        <SlidersHorizontal size={18} /> {quickFilter === 'all' ? 'Filter' : activeFilterLabel}
                    </button>
                    <AnimatePresence>
                        {isFilterMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden p-1"
                            >
                                {filterOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => {
                                            setQuickFilter(option.id);
                                            setIsFilterMenuOpen(false);
                                        }}
                                        className={cn(
                                            'w-full text-left px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-colors',
                                            quickFilter === option.id ? 'bg-green-700 text-white' : 'text-slate-700 hover:bg-slate-50'
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <button
                    onClick={() => {
                        refreshOrders();
                        refreshInventory();
                        toast.info("Loading orders...");
                    }}
                    className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50"
                    aria-label="Refresh"
                >
                    <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
                </button>
            </div>

            <div className="px-4 lg:px-6 mt-4 space-y-4">
                {isLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-3xl animate-pulse" />)}</div>
                ) : (
                    <>
                        {['new', 'ready'].includes(activeTab) && <ProductTotals orders={filteredOrders} inventory={inventory} />}
                        {!filteredOrders.length && (
                            <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-500">
                                <Box size={40} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-[15px]">No orders here right now</p>
                            </div>
                        )}
                        {entries.map((g) => (g.orders.length > 1 ? groupCard(g) : orderCard(g.orders[0])))}
                    </>
                )}
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
                            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="bg-green-700 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        <Truck size={16} className="text-green-200" />
                                        Assign Delivery Partner
                                    </h3>
                                    <p className="text-[10px] font-bold text-green-100 uppercase tracking-widest mt-1">
                                        {Array.isArray(selectedOrderForDispatch)
                                            ? `${selectedOrderForDispatch.length} orders together`
                                            : `Order #${String(selectedOrderForDispatch || '').slice(-6)}`}
                                    </p>
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
                                                className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-900 hover:bg-white transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-500 font-black text-xs uppercase">
                                                        {partner.fullName.slice(0, 2)}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{partner.fullName}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{partner.vehicleNumber} • {vehicleLabel(partner.vehicleType)}</p>
                                                        {dispatchKg > TWO_WHEELER_MAX_KG && isTwoWheeler(partner.vehicleType) && (
                                                            <p className="text-[11px] font-semibold text-rose-600 mt-0.5">Over {TWO_WHEELER_MAX_KG} kg - needs an auto / 4-wheeler</p>
                                                        )}
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
                {returnedGoodsOrder && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !savingGoods && setReturnedGoodsOrder(null)} />
                        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
                            <div className="bg-green-700 p-6 text-white">
                                <h3 className="text-sm font-black uppercase tracking-widest">Goods received back</h3>
                                <p className="text-[10px] font-bold text-green-100 uppercase tracking-widest mt-1">Customer did not accept the order</p>
                            </div>
                            <div className="p-6 space-y-3">
                                <p className="text-xs font-semibold text-slate-600">
                                    Are the goods from {returnedGoodsOrder.name} good enough to sell again, or are they damaged?
                                </p>
                                <button
                                    disabled={savingGoods}
                                    onClick={() => settleReturnedGoods('restock')}
                                    className="w-full h-12 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest disabled:opacity-50"
                                >
                                    Good - add back to stock
                                </button>
                                <button
                                    disabled={savingGoods}
                                    onClick={() => settleReturnedGoods('write_off')}
                                    className="w-full h-12 border border-rose-300 text-rose-600 rounded-2xl font-black uppercase text-[11px] tracking-widest disabled:opacity-50"
                                >
                                    Damaged - do not add to stock
                                </button>
                                <button
                                    disabled={savingGoods}
                                    onClick={() => setReturnedGoodsOrder(null)}
                                    className="w-full h-10 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                                >
                                    Not received yet
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {groupPack && (
                    <div key="group-pack" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !bulkBusy && setGroupPack(null)} />
                        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                            <div className="bg-green-700 p-5 text-white flex justify-between items-start gap-3">
                                <div>
                                    <h3 className="text-[17px] font-bold flex items-center gap-2">
                                        <Package size={18} className="text-green-200" />
                                        {groupPack.mode === 'count' ? 'Packed weight' : 'Mark all ready'}
                                    </h3>
                                    <p className="text-[13px] text-green-100 mt-0.5">
                                        {groupPackOrders.length} orders for <span translate="no">{groupPackOrders[0]?.hotelName}</span> - packed weight of each order (kg)
                                    </p>
                                </div>
                                <button type="button" onClick={() => !bulkBusy && setGroupPack(null)} className="p-2 hover:bg-white/10 rounded-full" aria-label="Close"><X size={20} /></button>
                            </div>
                            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                                {groupPackOrders.map((o) => {
                                    const val = groupPack.counts[o.id];
                                    return (
                                        <div key={o.id} className="rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[14px] font-bold text-slate-900">Order #{String(o.id).slice(-6).toUpperCase()}</p>
                                                <p className="text-[13px] text-slate-600 truncate">{(o.items || []).map((i) => `${i.name} ${i.quantity} ${i.unit}`).join(', ')}</p>
                                            </div>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                step="0.1"
                                                aria-label={`Weight in kg for order ${String(o.id).slice(-6).toUpperCase()}`}
                                                value={val === 0 || val === undefined ? '' : val}
                                                onChange={(e) => {
                                                    const n = cleanKg(e.target.value);
                                                    setGroupPack((prev) => ({ ...prev, counts: { ...prev.counts, [o.id]: n } }));
                                                }}
                                                className="w-24 h-11 rounded-xl border-2 border-slate-200 text-center text-lg font-bold text-slate-900 outline-none focus:border-green-600 tabular-nums"
                                            />
                                            <span className="text-[13px] font-semibold text-slate-500">kg</span>
                                        </div>
                                    );
                                })}
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
                                    <span className="text-[14px] font-semibold text-slate-700">Total trip: <b className="tabular-nums">{groupPackKg} kg</b></span>
                                    <VehicleHint kg={groupPackKg} />
                                </div>
                                {groupPack.mode !== 'count' && (
                                    <p className="text-[13px] text-slate-500">Exactly what the customer ordered is taken from your stock.</p>
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" disabled={!!bulkBusy} onClick={() => setGroupPack(null)} className={cn(btn, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>Cancel</button>
                                <button
                                    type="button"
                                    onClick={confirmGroupPack}
                                    disabled={!!bulkBusy || groupPackOrders.some((o) => !(Number(groupPack.counts[o.id]) > 0))}
                                    className={cn(btn, 'bg-green-700 text-white hover:bg-green-800')}
                                >
                                    <Check size={18} /> {bulkBusy ? 'Please wait…' : groupPack.mode === 'count' ? 'Save counts' : 'Confirm & mark ready'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="bg-green-700 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        <Package size={16} className="text-green-200" />
                                        {packageModalMode === 'count' ? 'Packed Weight' : 'Pack Order'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-green-100 uppercase tracking-widest mt-1">{packageModalMode === 'count' ? 'This order is already packed' : 'Enter packed weight'}</p>
                                </div>
                                <button onClick={() => setIsPackageModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    {packingOrder && (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {packageModalMode === 'count' ? 'Order contents' : 'You are packing exactly what the customer ordered'}
                                            </p>
                                            {packingOrder.items.map((i, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                    <span className="truncate pr-2">{i.name}</span>
                                                    <span className="tabular-nums shrink-0">{i.quantity} {i.unit}</span>
                                                </div>
                                            ))}
                                            {packageModalMode !== 'count' && (
                                                <p className="text-[10px] font-semibold text-slate-500 pt-1">This quantity is taken from your stock. It cannot be changed here.</p>
                                            )}
                                        </div>
                                    )}
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Packed weight (kg)</label>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            step="0.1"
                                            aria-label="Packed weight in kg"
                                            value={packageCount === 0 ? '' : packageCount}
                                            onChange={(e) => setPackageCount(e.target.value === '' ? '' : cleanKg(e.target.value))}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-6 text-3xl font-black text-slate-900 outline-none focus:border-slate-900 transition-all text-center tabular-nums"
                                            placeholder="0"
                                            autoFocus
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">kg</span>
                                    </div>
                                    <div className="flex justify-center"><VehicleHint kg={packageCount} /></div>
                                    <p className="text-[12px] font-semibold text-slate-500 text-center leading-relaxed">
                                        Weigh the packed order. Up to {TWO_WHEELER_MAX_KG} kg goes on a bike / scooter, more on an auto / 4-wheeler - the delivery partner is assigned automatically. Printed on the delivery slip (Bilty).
                                    </p>
                                </div>

                                <button
                                    onClick={handleConfirmPacking}
                                    disabled={!(Number(packageCount) > 0) || processingOrderId === selectedOrderForPacking}
                                    title={!(Number(packageCount) > 0) ? 'Enter the packed weight' : ''}
                                    className="w-full h-14 bg-green-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-lg hover:bg-green-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {packageModalMode === 'count' ? 'Save Weight' : 'Confirm & Mark Packed'}
                                    <Check size={16} className="text-green-200" />
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
