import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import {
    Package,
    ArrowRight,
    CheckCircle2,
    Truck,
    ChevronRight,
    IndianRupee,
    Scale,
    ShieldCheck,
    AlertCircle,
    Loader2,
    FileText,
    Target,
    Activity
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOrders } from '@/modules/user/contexts/OrderContext';
import DocumentViewer from '../components/documents/DocumentViewer';
import VendorBackBar from '../components/navigation/VendorBackBar';
import { toast } from 'sonner';

export default function PackingScreen() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('order');
    const [isDispatching, setIsDispatching] = useState(false);
    const [checkedItems, setCheckedItems] = useState({});
    const [step, setStep] = useState(1); // 1: Packing, 2: Weight, 3: Dispatch, 4: Success
    const [isDocOpen, setIsDocOpen] = useState(false);
    const { orders: contextOrders, updateOrderStatus } = useOrders();

    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                // Fetch active dispatch orders to find current one
                const response = await api.get('/procurement/vendor/active-dispatch');
                if (response.data.success) {
                    setOrders(response.data.results);
                }
            } catch (error) {
                console.error("Failed to fetch order", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    const order = useMemo(() => {
        // 1. Try to find the specific order by ID from URL
        if (orderId) {
            const foundOrder = orders.find(o => o._id === orderId);
            if (foundOrder) return formatOrder(foundOrder);
        }

        // 2. If no ID or ID not found, take the first order from active dispatches list
        if (orders.length > 0) {
            return formatOrder(orders[0]);
        }

        // 3. No fallback to mock data to avoid confusion
        return null;
    }, [orderId, orders]);

    function formatOrder(foundOrder) {
        return {
            id: foundOrder._id,
            franchiseName: foundOrder.franchiseId?.franchiseName || foundOrder.franchiseId?.shopName || foundOrder.franchiseId?.ownerName || 'Franchise',
            franchiseLocation: [foundOrder.franchiseId?.area, foundOrder.franchiseId?.city].filter(Boolean).join(', ') || foundOrder.franchiseId?.address || '',
            items: foundOrder.items.map(i => ({
                productId: i.productId,
                name: i.name,
                quantity: i.quantity || i.qty || 0,
                unit: i.unit || 'units',
                price: i.price || 0,
                quotedPrice: i.quotedPrice || 0,
                image: i.image
            })),
            status: foundOrder.status
        };
    }

    const [itemQuantities, setItemQuantities] = useState({});

    useEffect(() => {
        if (order && order.items) {
            const initChecked = {};
            const initQtys = {};
            order.items.forEach(item => {
                const id = item.productId || item.name; // Use productId as primary key
                initChecked[id] = false;
                initQtys[id] = item.quantity;
            });
            setCheckedItems(initChecked);
            setItemQuantities(initQtys);
        }
    }, [order]);

    const handleToggleCheck = (id) => {
        setCheckedItems(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Enable calibration as soon as at least one item is checked
    const isPackingComplete = order?.items && Object.values(checkedItems).some(v => v === true);

    const [actualWeight, setActualWeight] = useState(0);
    const [isWeightEdited, setIsWeightEdited] = useState(false);

    // What is being sent. Items sold by weight (kg, g, ...) add up to a total weight in KG. Items
    // sold by count (pcs, bundle, dozen, ...) can't be turned into weight, so they are totalled
    // in their own unit and shown as a quantity instead of KG.
    const weightSummary = useMemo(() => {
        const KG_FACTORS = { kg: 1, kgs: 1, g: 0.001, gm: 0.001, gms: 0.001, gram: 0.001, grams: 0.001, quintal: 100, q: 100, ton: 1000, tonne: 1000 };
        let kg = 0;
        let hasWeighed = false;
        const countLines = [];
        const counts = {};
        (order?.items || []).forEach(item => {
            const id = item.productId || item.name;
            if (!checkedItems[id]) return;
            const qty = Number(itemQuantities[id]) || 0;
            const unit = String(item.unit || 'pcs').trim();
            const factor = KG_FACTORS[unit.toLowerCase()];
            if (factor) {
                hasWeighed = true;
                kg += qty * factor;
            } else {
                countLines.push({ name: item.name, qty, unit });
                const key = unit.toLowerCase();
                counts[key] = { unit, qty: (counts[key]?.qty || 0) + qty };
            }
        });
        const countTotals = Object.values(counts);
        const countText = countTotals.map(c => `${c.qty} ${c.unit}`).join(' + ');
        return { kg: +kg.toFixed(2), hasWeighed, hasCounted: countTotals.length > 0, countLines, countTotals, countText };
    }, [order, checkedItems, itemQuantities]);

    // Text for "how much is being sent": 12 KG, 200 pcs, or 12 KG + 200 pcs
    const dispatchTotalText = [
        weightSummary.hasWeighed ? `${actualWeight} KG` : null,
        weightSummary.hasCounted ? weightSummary.countText : null,
    ].filter(Boolean).join(' + ') || '0';

    // Keep the weight in sync with the packed quantities until the vendor types their own value
    useEffect(() => {
        if (!isWeightEdited) setActualWeight(weightSummary.kg);
    }, [weightSummary.kg, isWeightEdited]);

    // Weight is needed only when something sold by weight is being sent; it must be above zero
    const isWeightValid = !weightSummary.hasWeighed || (Number.isFinite(actualWeight) && actualWeight > 0);

    // Every ticked item needs a quantity to send: more than 0 and not more than was requested
    const quantityProblem = (order?.items || []).map((item) => {
        const id = item.productId || item.name;
        if (!checkedItems[id]) return null;
        const qty = Number(itemQuantities[id]);
        if (!Number.isFinite(qty) || qty <= 0) return `Enter how many ${item.unit} of ${item.name} you are sending`;
        if (qty > Number(item.quantity)) return `${item.name}: you can send at most ${item.quantity} ${item.unit} (what was requested)`;
        return null;
    }).find(Boolean) || null;

    const goToStep = (target) => {
        if (target === step || step === 4) return;
        if (target < step) {
            setStep(target);
            return;
        }
        if (!isPackingComplete) {
            toast.error('Tick at least one item you are sending to continue');
            return;
        }
        if (quantityProblem) {
            toast.error(quantityProblem);
            setStep(1);
            return;
        }
        if (target === 3 && !isWeightValid) {
            toast.error('Please enter the total weight (more than 0 KG) to continue');
            setStep(2);
            return;
        }
        setStep(target);
    };

    const handleFinalDispatch = async () => {
        if (!order || !order.id) {
            toast.error("No active order selected for dispatch");
            return;
        }
        if (quantityProblem) {
            toast.error(quantityProblem);
            setStep(1);
            return;
        }
        if (!isWeightValid) {
            toast.error("Please enter the total weight (more than 0 KG) to continue");
            setStep(2);
            return;
        }

        setIsDispatching(true);
        try {
            // Prepare item updates for partial fulfilment
            // ONLY items that are "checked" in the UI will have their quantities sent.
            const itemUpdates = order.items.map(item => {
                const id = item.productId || item.name;
                return {
                    productId: item.productId,
                    dispatchedQuantity: checkedItems[id] ? (itemQuantities[id] || 0) : 0
                };
            });

            // Update status on backend
            // Status: 'ready_for_pickup' implies vendor has finished and goods are ready
            const response = await api.put(`/procurement/vendor/${order.id}/status`, {
                status: 'ready_for_pickup',
                weight: weightSummary.hasWeighed ? actualWeight : 0,
                itemUpdates
            });

            if (response.data.success) {
                setStep(4);
            } else {
                toast.error(response.data.message || "Could not confirm the dispatch. Please try again.");
            }
        } catch (error) {
            console.error("Finalization error", error);
            toast.error(error.response?.data?.message || "Could not confirm the dispatch. Please try again.");
        } finally {
            setIsDispatching(false);
        }
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="animate-spin text-primary" size={40} />
        </div>
    );

    if (!order && !isLoading) return (
        <div className="text-center py-20">
            <h2 className="text-xl font-black text-slate-900">No orders waiting for dispatch</h2>
            <p className="text-sm text-slate-500 mt-2">Orders appear here after the admin approves your quotation.</p>
            <button onClick={() => navigate('/vendor/orders')} className="text-primary font-bold mt-4">Back to Orders</button>
        </div>
    );

    return (
        <div className="space-y-6 pb-20 max-w-2xl mx-auto">
            {step < 4 && (
                <header className="space-y-4 px-1">
                    <div className="flex items-center gap-4">
                        <VendorBackBar fallbackPath="/vendor/orders" className="shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <span className="opacity-60">Order #{order.id?.slice(-8).toUpperCase()}</span>
                                <ChevronRight size={10} className="shrink-0 opacity-40" />
                                <span className="text-primary">Packing</span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mt-1">Pack & Dispatch</h1>
                        </div>
                    </div>
                </header>
            )}

            {/* Stepper info */}
            {step < 4 && (
                <div className="flex gap-3 px-1">
                    {[1, 2, 3].map(i => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goToStep(i)}
                            className="flex-1 text-left cursor-pointer group"
                        >
                            <div className={cn(
                                "h-1.5 rounded-full transition-all duration-500",
                                step >= i ? "bg-slate-900 shadow-[0_2px_10px_rgba(0,0,0,0.1)]" : "bg-slate-100 group-hover:bg-slate-200"
                            )} />
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest text-center mt-3",
                                step === i ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
                            )}>
                                {i === 1 ? '1. Check Items' : i === 2 ? (weightSummary.hasWeighed ? '2. Weight' : '2. Quantity') : '3. Confirm Dispatch'}
                            </p>
                        </button>
                    ))}
                </div>
            )}

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="bg-white p-6 md:p-8 rounded-[40px] border border-slate-100 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.05)] space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
                            
                            <div className="flex items-center justify-between relative">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                                        <Target size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Check Items</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Tick each item you are sending</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[11px] font-black text-slate-900 tabular-nums">{Object.values(checkedItems).filter(Boolean).length}/{order.items.length}</span>
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Checked</span>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                {order.items.map((item, idx) => {
                                    const id = item.productId || item.name;
                                    const isChecked = checkedItems[id];
                                    return (
                                        <motion.div
                                            key={idx}
                                            layout
                                            className={cn(
                                                "relative flex flex-col p-4 rounded-[28px] border-2 transition-all duration-300",
                                                isChecked
                                                    ? "bg-emerald-50/50 border-emerald-100 shadow-lg shadow-emerald-500/5"
                                                    : "bg-white border-slate-50 hover:border-slate-100 hover:bg-slate-50/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    onClick={() => handleToggleCheck(id)}
                                                    className={cn(
                                                        "w-12 h-12 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer shadow-sm shrink-0",
                                                        isChecked ? "border-emerald-200" : "border-slate-100"
                                                    )}
                                                >
                                                    <img src={item.image} className={cn("w-full h-full object-cover transition-all duration-500", !isChecked && "grayscale scale-110 opacity-60")} alt="" />
                                                </div>
                                                
                                                <div className="flex-1 min-w-0" onClick={() => handleToggleCheck(id)}>
                                                    <span className={cn(
                                                        "font-black text-[15px] tracking-tight block truncate transition-colors",
                                                        isChecked ? "text-emerald-950" : "text-slate-700"
                                                    )}>
                                                        {item.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} {item.unit} Req.</span>
                                                    </div>
                                                </div>

                                                <div
                                                    onClick={() => handleToggleCheck(id)}
                                                    className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer",
                                                        isChecked 
                                                            ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200 scale-110" 
                                                            : "bg-white border-slate-100 text-transparent"
                                                    )}
                                                >
                                                    <CheckCircle2 size={16} strokeWidth={3} />
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {isChecked && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pt-4 mt-4 border-t border-emerald-100/50 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em]">Quantity to send</span>
                                                            </div>
                                                            <div className="flex items-center bg-white border-2 border-emerald-100 rounded-2xl px-3 py-1.5 shadow-sm">
                                                                <span className="text-[10px] font-black text-emerald-400 mr-2 uppercase">Send</span>
                                                                <input
                                                                    type="number"
                                                                    value={itemQuantities[id] || ''}
                                                                    onChange={(e) => setItemQuantities(prev => ({ ...prev, [id]: Number(e.target.value) }))}
                                                                    className="w-14 bg-transparent text-sm font-black text-emerald-700 outline-none tabular-nums text-right"
                                                                />
                                                                <span className="text-[10px] font-black text-emerald-300 ml-1 uppercase">{item.unit}</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={() => goToStep(2)}
                            className={cn(
                                "w-full bg-slate-900 text-white py-5 rounded-[28px] font-black text-[13px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-all group",
                                !isPackingComplete && "opacity-40"
                            )}
                        >
                            {weightSummary.hasWeighed || !weightSummary.hasCounted ? 'Next: Enter Weight' : 'Next: Check Quantity'}
                            <ChevronRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
                        </button>
                        {!isPackingComplete && (
                            <p className="text-center text-[11px] font-semibold text-slate-400">Tick the items you are sending to continue.</p>
                        )}
                        {isPackingComplete && quantityProblem && (
                            <p className="text-center text-[11px] font-semibold text-rose-600">{quantityProblem}</p>
                        )}
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.05)] space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -ml-16 -mt-16 opacity-50" />
                            
                            <div className="flex items-center gap-4 relative">
                                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <Scale size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">{weightSummary.hasWeighed ? 'Total Weight' : 'Total Quantity'}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{weightSummary.hasWeighed ? 'Weight of the goods you are sending' : 'Number of items you are sending'}</p>
                                </div>
                            </div>

                            <div className="space-y-8 relative">
                                {weightSummary.hasWeighed && (
                                    <div className="p-10 bg-slate-50 rounded-[40px] border border-slate-100 text-center transition-all hover:bg-white hover:shadow-2xl hover:shadow-slate-100/50">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Total weight (edit if your scale shows a different value)</label>
                                        <div className="flex items-center justify-center gap-3 mt-6">
                                            <input
                                                type="number"
                                                min="0"
                                                value={Number.isFinite(actualWeight) ? actualWeight : ''}
                                                onChange={(e) => {
                                                    setIsWeightEdited(true);
                                                    setActualWeight(e.target.value === '' ? NaN : parseFloat(e.target.value));
                                                }}
                                                step="0.01"
                                                className="bg-transparent border-none p-0 outline-none text-6xl font-black text-slate-900 w-48 text-right tabular-nums focus:text-blue-600 transition-colors"
                                            />
                                            <span className="text-2xl font-black text-slate-300 uppercase mt-5">KG</span>
                                        </div>
                                        <div className="mt-8 flex flex-col items-center gap-3">
                                            <p className="text-[11px] font-semibold text-slate-500">
                                                Calculated from packed quantities: <span className="font-black text-slate-900">{weightSummary.kg} KG</span>
                                            </p>
                                            {isWeightEdited && actualWeight !== weightSummary.kg && (
                                                <button
                                                    onClick={() => { setIsWeightEdited(false); setActualWeight(weightSummary.kg); }}
                                                    className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
                                                >
                                                    <Activity size={14} />
                                                    Use calculated weight
                                                </button>
                                            )}
                                            {!isWeightValid && (
                                                <p className="text-[11px] font-bold text-rose-600">Enter the total weight (more than 0 KG) to continue.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {weightSummary.hasCounted && (
                                    <div className="p-8 bg-slate-50 rounded-[40px] border border-slate-100 text-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                            {weightSummary.hasWeighed ? 'Items counted by number (no weight)' : 'Total quantity you are sending'}
                                        </label>
                                        <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2">
                                            {weightSummary.countTotals.map((c) => (
                                                <div key={c.unit} className="flex items-baseline gap-2">
                                                    <span className="text-6xl font-black text-slate-900 tabular-nums">{c.qty}</span>
                                                    <span className="text-2xl font-black text-slate-300 uppercase">{c.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <ul className="mt-6 space-y-1.5 max-w-sm mx-auto text-left">
                                            {weightSummary.countLines.map((l, i) => (
                                                <li key={i} className="flex items-center justify-between gap-3 text-[12px] font-semibold text-slate-600">
                                                    <span className="truncate">{l.name}</span>
                                                    <span className="font-black text-slate-900 tabular-nums shrink-0">{l.qty} {l.unit}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="mt-4 text-[11px] font-semibold text-slate-400">Taken from the quantities you set in step 1. Go back to change them.</p>
                                    </div>
                                )}

                                <div className="flex items-start gap-4 p-6 bg-slate-900 text-white rounded-[32px] shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl -mr-12 -mt-12 transition-all group-hover:bg-emerald-500/30" />
                                    <ShieldCheck size={24} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <div className="relative">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-1">Good to know</p>
                                        <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">This is printed on the dispatch invoice and stays fixed once you confirm.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(1)} className="flex-1 bg-white border border-slate-100 py-5 rounded-[28px] font-black text-[12px] uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all active:scale-95">Back</button>
                            <button onClick={() => goToStep(3)} className="flex-[2] bg-slate-900 text-white py-5 rounded-[28px] font-black text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-all group">
                                Next: Review
                                <Truck size={18} className="group-hover:translate-x-2 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div
                        key="step3"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-10 rounded-[60px] border border-slate-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] text-center space-y-10 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
                        
                        <div className="w-28 h-28 bg-slate-900 text-white rounded-[40px] flex items-center justify-center mx-auto rotate-12 shadow-[0_20px_40px_rgba(0,0,0,0.2)] group hover:rotate-0 transition-transform relative">
                            <Truck size={56} className="animate-pulse" />
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary rounded-2xl flex items-center justify-center border-4 border-white">
                                <ShieldCheck size={18} />
                            </div>
                        </div>
 
                        <div className="relative">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight">Confirm Dispatch?</h3>
                            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-4 px-6 leading-relaxed">These goods will be marked as ready for pickup for <span className="text-slate-900">{order.franchiseName}</span>. You can't change the items after confirming.</p>
                        </div>
 
                        <div className="bg-slate-50/80 backdrop-blur-sm p-8 rounded-[40px] space-y-5 border border-slate-100 relative">
                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">{weightSummary.hasWeighed ? (weightSummary.hasCounted ? 'Weight & Quantity' : 'Total Weight') : 'Total Quantity'}</span>
                                <span className="text-slate-950 tabular-nums font-black text-sm">{dispatchTotalText}</span>
                            </div>
                            <div className="w-full h-px bg-slate-200/50" />
                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Invoice</span>
                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                    <ShieldCheck size={14} />
                                    <span>AUTO-GENERATED</span>
                                </div>
                            </div>
                        </div>
 
                        <div className="space-y-4 pt-4">
                            <button
                                onClick={handleFinalDispatch}
                                disabled={isDispatching}
                                className="w-full bg-primary text-white py-6 rounded-[32px] font-black text-[13px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-[0_25px_60px_-15px_rgba(22,163,74,0.4)] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {isDispatching ? <Loader2 size={24} className="animate-spin" /> : <>Confirm Dispatch <ArrowRight size={22} /></>}
                            </button>
                            <button onClick={() => setStep(2)} className="w-full text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] hover:text-slate-900 transition-colors py-2">Back to Weight</button>
                        </div>
                    </motion.div>
                )}

                {step === 4 && (
                    <motion.div
                        key="step4"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6 max-w-xl mx-auto"
                    >
                        <div className="flex justify-start px-2">
                            <VendorBackBar fallbackPath="/vendor/orders" />
                        </div>
                        <div className="bg-white p-10 md:p-12 rounded-[60px] border border-slate-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] text-center space-y-12 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60" />
                            
                            <div className="relative">
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1, rotate: 360 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                    className="w-28 h-28 bg-emerald-600 text-white rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200"
                                >
                                    <CheckCircle2 size={56} strokeWidth={2.5} />
                                </motion.div>
                            </div>
 
                            <div className="space-y-4 relative">
                                <div className="space-y-3">
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase leading-tight">Dispatch Confirmed</h3>
                                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.4em] px-4">Reference: <span className="text-slate-900">KK-IX-{order.id?.slice(-8).toUpperCase()}</span></p>
                                </div>
                                {orders.find(o => o._id === order.id)?.invoice && (
                                    <div className="bg-emerald-50/50 py-2.5 px-6 rounded-2xl inline-flex items-center gap-3 border border-emerald-100/50">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Invoice Generated: {orders.find(o => o._id === order.id).invoice.invoiceNumber}</p>
                                    </div>
                                )}
                            </div>
 
                            <div className="bg-slate-50/80 backdrop-blur-sm p-8 rounded-[48px] border border-slate-100 text-left space-y-8 relative shadow-sm">
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items Sent</p>
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{order.items.filter(item => checkedItems[item.productId || item.name]).length} items</p>
                                    </div>
                                    <div className="space-y-3">
                                        {order.items.filter(item => checkedItems[item.productId || item.name]).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center group">
                                                <span className="text-[12px] font-black text-slate-600 uppercase tracking-tight group-hover:text-slate-900 transition-colors">{item.name}</span>
                                                <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                                    <span className="text-slate-400 text-[10px] font-black">SENT</span>
                                                    <span className="text-slate-900 tabular-nums font-black text-[11px]">{itemQuantities[item.productId || item.name] || 0} {item.unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
 
                                <div className="space-y-4 pt-2">
                                    <div className="flex justify-between items-center border-t border-slate-200/50 pt-5">
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{weightSummary.hasWeighed ? (weightSummary.hasCounted ? 'Weight & Quantity' : 'Total Weight') : 'Total Quantity'}</span>
                                        <span className="text-2xl font-black text-slate-950 tabular-nums">{dispatchTotalText}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Franchise</span>
                                        <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{order.franchiseName}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</span>
                                        <div className="flex items-center gap-2.5 px-4 py-1.5 bg-emerald-100/50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200/50 shadow-sm shadow-emerald-100/20">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                                            In Transit
                                        </div>
                                    </div>
                                </div>
                            </div>
 
                            <div className="space-y-5 pt-4">
                                <button
                                    onClick={() => setIsDocOpen(true)}
                                    className="w-full bg-slate-50 text-slate-700 py-6 rounded-[32px] font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center gap-4 border border-slate-100 hover:bg-white hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all active:scale-[0.98] group"
                                >
                                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    View Digital Invoice
                                </button>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => navigate('/vendor/dashboard')}
                                        className="flex-1 bg-slate-900 text-white py-6 rounded-[32px] font-black text-[12px] uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all hover:bg-slate-800"
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        onClick={() => navigate('/vendor/dispatch-history')}
                                        className="flex-1 bg-white border-2 border-slate-100 text-slate-900 py-6 rounded-[32px] font-black text-[12px] uppercase tracking-[0.2em] active:scale-[0.98] transition-all hover:border-slate-200"
                                    >
                                        History
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <DocumentViewer
                isOpen={isDocOpen}
                onClose={() => setIsDocOpen(false)}
                type="INVOICE"
                data={{
                    invoiceNumber: orders.find(o => o._id === order.id)?.invoice?.invoiceNumber || `KK-INV-${order.id?.slice(-6).toUpperCase()}`,
                    invoiceDate: orders.find(o => o._id === order.id)?.invoice?.invoiceDate || new Date(),
                    items: order.items
                        .filter(i => checkedItems[i.productId || i.name])
                        .map(i => ({
                            ...i,
                            quantity: itemQuantities[i.productId || i.name] || i.quantity
                        })),
                    totalWeight: weightSummary.hasWeighed ? actualWeight : 0,
                    franchise: order.franchiseName,
                    destNode: order.franchiseLocation,
                    vendor: JSON.parse(localStorage.getItem('vendorData'))?.shopName || 'Kisaankart Partner'
                }}
            />
        </div>
    );
}
