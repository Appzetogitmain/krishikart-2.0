import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Monitor,
    Search,
    ShoppingBasket,
    Scale,
    Trash2,
    Plus,
    Minus,
    QrCode,
    Banknote,
    Printer,
    CheckCircle2,
    X,
    ShoppingCart,
    Package,
    ArrowRight,
    Home,
    ChevronRight,
    RefreshCw,
    ShieldCheck,
    IndianRupee,
    ChevronLeft,
    Monitor as MonitorIcon
} from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function POSScreen() {
    const { inventory, refreshInventory, loading: inventoryLoading } = useInventory();
    const { franchise } = useFranchiseAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState(() => {
        const savedCart = localStorage.getItem('pos_cart');
        return savedCart ? JSON.parse(savedCart) : [];
    });
    const [lastSale, setLastSale] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showQRCodeModal, setShowQRCodeModal] = useState(false);
    const [isReceiptShown, setIsReceiptShown] = useState(false);
    const [weight, setWeight] = useState(0);
    const [selectedItemForScale, setSelectedItemForScale] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Loading state handled by context

    // Persist cart
    useEffect(() => {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
    }, [cart]);

    const filteredItems = inventory.filter(item =>
        item.showOnPOS !== false && (
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    const addToCart = (item, qty = 1) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i);
            }
            return [...prev, { ...item, qty }];
        });
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(i => i.id !== id));
    };

    const updateQty = (id, delta) => {
        setCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQty = Math.max(1, i.qty + delta);
                return { ...i, qty: newQty };
            }
            return i;
        }));
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const handleCheckout = async (paymentMode) => {
        setIsSubmitting(true);
        try {
            const saleData = {
                items: cart.map(item => ({
                    productId: item.productId,
                    name: item.name,
                    quantity: item.qty,
                    price: item.price,
                    subtotal: item.price * item.qty,
                    unit: item.unit
                })),
                totalAmount: total,
                paymentMethod: paymentMode
            };

            const response = await api.post('/franchise/pos/sale', saleData);

            if (response.data.success) {
                // Store for receipt before clearing
                setLastSale({
                    items: [...cart],
                    total: total,
                    saleId: response.data.result.saleId,
                    date: new Date().toLocaleString(),
                    paymentMethod: paymentMode
                });

                // Clear cart immediately on success
                localStorage.removeItem('pos_cart');
                setCart([]);

                refreshInventory();
                setShowCheckout(false);
                setIsReceiptShown(true);
                toast.success('Sale recorded successfully');
            }
        } catch (error) {
            console.error("Sale recording failed:", error);
            const errorMsg = error.response?.data?.message || 'Sale recording failed';
            toast.error(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleScaleComplete = () => {
        if (weight > 0 && selectedItemForScale) {
            addToCart(selectedItemForScale, weight);
            setSelectedItemForScale(null);
            setWeight(0);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('printable-receipt');
        const originalContent = document.body.innerHTML;
        const receiptHtml = printContent.innerHTML;

        // Custom print style
        const style = `
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; }
                .receipt-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .receipt-item { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
                .receipt-total { border-top: 1px dashed #000; margin-top: 10px; pt: 5px; font-weight: bold; }
                .receipt-footer { text-align: center; margin-top: 20px; font-size: 10px; }
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Print Receipt</title>' + style + '</head><body>');
        printWindow.document.write(receiptHtml);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row h-screen overflow-hidden font-sans">
            {/* Left: Terminal Items */}
            <div className="flex-1 flex flex-col h-full bg-slate-50 relative border-r border-slate-200">
                {/* Enterprise Terminal Header */}
                <div className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Counter</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest leading-none">New Sale</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-sm">
                            <ShieldCheck size={10} className="text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">System Online</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.trim())}
                                className="w-full bg-slate-100 border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 transition-all font-sans"
                            />
                        </div>
                        <button className="p-1.5 border border-slate-200 rounded-sm hover:bg-slate-50 text-slate-400 transition-colors">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-slate-200 no-scrollbar content-start">
                    {inventoryLoading && inventory.length === 0 ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                            <RefreshCw className="animate-spin mb-4" size={32} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Loading products...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                            <Package size={48} strokeWidth={1} className="mb-4 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No items found</p>
                        </div>
                    ) :
                        filteredItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => (item.unit === 'Kg' || item.unit === 'kg') ? setSelectedItemForScale(item) : addToCart(item)}
                                className="bg-white p-4 pb-6 border border-transparent hover:border-slate-900 transition-all cursor-pointer flex flex-col group relative overflow-hidden h-full min-h-[360px]"
                            >
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <Plus size={20} className="text-slate-900 bg-white rounded-full shadow-lg p-1" />
                                </div>

                                {/* Category Badge */}
                                <div className="absolute top-3 left-3 z-10">
                                    <span className="bg-slate-900/5 backdrop-blur-md text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-tighter">
                                        {item.category}
                                    </span>
                                </div>

                                <div className="w-full pt-[100%] bg-slate-50 mb-4 rounded-sm relative overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center p-4 text-slate-300 transition-colors group-hover:bg-slate-100/50">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
                                                alt={item.name}
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600';
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Package size={40} strokeWidth={1} />
                                                <span className="text-[10px] uppercase tracking-widest font-black">No Preview</span>
                                            </div>
                                        )}

                                        {/* Promo Badges (Unit moved to price section) */}
                                        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
                                            {item.bestPrice > 0 && (
                                                <div className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-sm shadow-sm uppercase tracking-tighter">
                                                    Best Rate
                                                </div>
                                            )}
                                        </div>

                                        {/* Dietary Type Indicator */}
                                        {item.dietaryType && item.dietaryType !== 'none' && (
                                            <div className="absolute bottom-3 left-3">
                                                <div className={cn(
                                                    "w-5 h-5 border-[1.5px] flex items-center justify-center rounded-[2px] bg-white shadow-sm",
                                                    item.dietaryType === 'veg' ? "border-emerald-600" : "border-red-600"
                                                )}>
                                                    <div className={cn(
                                                        "w-[7px] h-[7px] rounded-full",
                                                        item.dietaryType === 'veg' ? "bg-emerald-600" : "bg-red-600"
                                                    )} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 flex-1">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight mb-2">{item.name}</h4>

                                    <div className="mt-auto flex flex-col gap-1">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-lg font-black text-slate-900 tabular-nums">₹{(item.price || 0).toLocaleString()}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                / {item.unitValue} {item.unit}
                                            </span>
                                            {item.comparePrice > item.price && (
                                                <span className="text-xs text-slate-400 line-through font-bold ml-1">₹{item.comparePrice}</span>
                                            )}
                                        </div>

                                        <div className={cn(
                                            "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1",
                                            item.currentStock <= 0 ? "text-rose-500" :
                                                item.currentStock <= 5 ? "text-amber-500" : "text-emerald-600/70"
                                        )}>
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                                item.currentStock <= 0 ? "bg-rose-500" :
                                                    item.currentStock <= 5 ? "bg-amber-500" : "bg-emerald-500"
                                            )} />
                                            Stock: {item.currentStock} {item.unit}
                                        </div>
                                    </div>
                                </div>
                                {(item.unit === 'Kg' || item.unit === 'kg') && (
                                    <div className="mt-2 pt-1 border-t border-slate-50 flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 tracking-widest">
                                        <Scale size={10} />
                                        Sold by weight
                                    </div>
                                )}
                            </div>
                        ))
                    }
                </div>
            </div>

            {/* Right: Cart & Summary */}
            <div className="w-full lg:w-[440px] bg-white flex flex-col h-full shadow-2xl relative z-20">
                <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <ShoppingBasket className="text-slate-900" size={16} />
                        <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Cart</h2>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest tabular-nums">{cart.length} ITEMS</span>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div className="divide-y divide-slate-100">
                        {cart.map((item) => (
                            <div key={item.id} className="p-4 flex items-center gap-4 group hover:bg-slate-50 transition-colors">
                                <div className="w-10 h-10 rounded-sm bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            className="w-full h-full object-cover"
                                            alt=""
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200';
                                            }}
                                        />
                                    ) : (
                                        <Package size={16} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase truncate leading-none mb-1">{item.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                                        {item.qty} {item.unit} × ₹{(item.price || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center bg-white border border-slate-200 rounded-sm p-0.5">
                                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-900">
                                            <Minus size={10} strokeWidth={3} />
                                        </button>
                                        <span className="w-8 text-center text-[11px] font-black tabular-nums">{item.qty}</span>
                                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-900">
                                            <Plus size={10} strokeWidth={3} />
                                        </button>
                                    </div>
                                    <span className="text-[11px] font-black text-slate-900 tabular-nums">₹{((item.price || 0) * item.qty).toLocaleString()}</span>
                                </div>
                                <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {cart.length === 0 && (
                        <div className="py-32 flex flex-col items-center justify-center text-center px-10">
                            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-sm flex items-center justify-center text-slate-200 mb-6">
                                <ShoppingBasket size={32} strokeWidth={1} />
                            </div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Cart is empty</h3>
                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2">Add items to start a sale</p>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-900 text-white">
                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center opacity-60">
                            <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
                            <span className="text-[11px] font-black tabular-nums">₹{(total || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center opacity-60">
                            <span className="text-[10px] font-black uppercase tracking-widest">Tax</span>
                            <span className="text-[11px] font-black tabular-nums">₹0.00</span>
                        </div>
                        <div className="h-px bg-slate-800" />
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">Total Amount</span>
                                <span className="text-3xl font-black tracking-tighter tabular-nums leading-none">₹{(total || 0).toLocaleString()}</span>
                            </div>
                            <IndianRupee size={32} className="text-slate-800" />
                        </div>
                    </div>

                    <button
                        disabled={cart.length === 0}
                        onClick={() => setShowCheckout(true)}
                        className={cn(
                            "w-full h-14 rounded-sm font-black uppercase text-[11px] tracking-[0.3em] transition-all flex items-center justify-center gap-3",
                            cart.length > 0 ? "bg-white text-slate-900 hover:bg-slate-100 shadow-xl" : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                        )}
                    >
                        Pay Now <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Weighing Interface */}
            <AnimatePresence>
                {selectedItemForScale && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setSelectedItemForScale(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-md rounded-sm p-8 shadow-2xl relative z-10"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-sm flex items-center justify-center">
                                    <Scale size={24} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weighing Scale</p>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedItemForScale.name}</h3>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-sm p-8 text-center mb-8">
                                <div className="text-5xl font-black text-slate-900 tracking-tighter mb-2 tabular-nums">
                                    {weight.toFixed(3)} <span className="text-lg text-slate-400">KG</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Weight ready</span>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="relative group">
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        autoFocus
                                        value={weight === 0 ? '' : weight}
                                        onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                                        placeholder="Enter weight in KG..."
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-sm py-4 px-6 text-2xl font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white transition-all tabular-nums"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm uppercase tracking-widest pointer-events-none">
                                        KG
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    {[0.25, 0.5, 1, 2, 5].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setWeight(val)}
                                            className="py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                                        >
                                            {val}kg
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setWeight(0)}
                                        className="py-2.5 bg-rose-50 border border-rose-100 rounded-sm text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSelectedItemForScale(null)}
                                        className="flex-1 h-12 rounded-sm border border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleScaleComplete}
                                        className="flex-[2] h-12 rounded-sm bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all"
                                    >
                                        Add Weight
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Checkout Interface */}
            <AnimatePresence>
                {showCheckout && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowCheckout(false)}
                        />
                        <motion.div
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                            className="bg-white w-full max-w-lg rounded-sm p-10 shadow-2xl relative z-10"
                        >
                            <h3 className="text-xs font-black text-slate-900 tracking-[0.3em] uppercase mb-12 text-center">Choose Payment Method</h3>

                            <div className="grid grid-cols-2 gap-4 mb-12">
                                <button
                                    onClick={() => handleCheckout('Cash')}
                                    disabled={isSubmitting}
                                    className="p-8 border border-slate-200 rounded-sm flex flex-col items-center gap-4 hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <RefreshCw size={40} className="text-slate-900 animate-spin" />
                                    ) : (
                                        <>
                                            <Banknote size={40} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                                            <span className="font-black uppercase text-[10px] tracking-widest text-slate-400 group-hover:text-slate-900">Cash</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowQRCodeModal(true)}
                                    disabled={isSubmitting}
                                    className="p-8 border border-slate-200 rounded-sm flex flex-col items-center gap-4 hover:border-slate-900 hover:bg-slate-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <RefreshCw size={40} className="text-slate-900 animate-spin" />
                                    ) : (
                                        <>
                                            <QrCode size={40} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                                            <span className="font-black uppercase text-[10px] tracking-widest text-slate-400 group-hover:text-slate-900">Online Payment</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <button onClick={() => setShowCheckout(false)} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Cancel</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* QR Code Scan Modal */}
            <AnimatePresence>
                {showQRCodeModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-sm p-8 shadow-2xl flex flex-col items-center"
                        >
                            <h3 className="text-xs font-black text-slate-900 tracking-[0.3em] uppercase mb-8">Scan to Pay</h3>

                            <div className="w-full aspect-square border-2 border-slate-100 rounded-sm mb-8 flex items-center justify-center bg-slate-50 relative overflow-hidden p-4">
                                {franchise?.storeQRCode ? (
                                    <img src={franchise.storeQRCode} className="w-full h-full object-contain" alt="Payment QR" />
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-slate-300">
                                        <QrCode size={64} strokeWidth={1} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">No QR Set</span>
                                    </div>
                                )}
                            </div>

                            <div className="text-center mb-10">
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight mb-1">Total Amount</p>
                                <p className="text-2xl font-black text-slate-900 tabular-nums">₹{(total || 0).toLocaleString()}</p>
                            </div>

                            <div className="w-full flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        handleCheckout('QR Scan');
                                        setShowQRCodeModal(false);
                                    }}
                                    disabled={isSubmitting || !franchise?.storeQRCode}
                                    className="w-full h-12 bg-slate-900 text-white rounded-sm font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all disabled:bg-slate-200"
                                >
                                    {isSubmitting ? <RefreshCw size={16} className="animate-spin mx-auto" /> : 'Confirm Payment'}
                                </button>
                                <button
                                    onClick={() => setShowQRCodeModal(false)}
                                    className="w-full h-12 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] hover:text-slate-900 transition-colors"
                                >
                                    Go Back
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Receipt Modal */}
            <AnimatePresence>
                {isReceiptShown && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/90 backdrop-blur-md cursor-pointer"
                            onClick={() => {
                                localStorage.removeItem('pos_cart');
                                setCart([]);
                                setIsReceiptShown(false);
                            }}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-[380px] rounded-sm p-0 shadow-2xl relative z-10 overflow-hidden"
                        >
                            {/* Hidden printable receipt structure */}
                            <div id="printable-receipt" className="hidden">
                                <div className="receipt-header">
                                    <h2 style={{ margin: '0', fontSize: '18px' }}>KISAANKART</h2>
                                    <p style={{ margin: '5px 0', fontSize: '10px' }}>Counter Sale Receipt</p>
                                    <p style={{ margin: '0', fontSize: '10px' }}>Date: {lastSale?.date}</p>
                                    <p style={{ margin: '0', fontSize: '10px' }}>Receipt #: {lastSale?.saleId}</p>
                                </div>
                                <div style={{ margin: '15px 0' }}>
                                    {lastSale?.items.map((item, idx) => (
                                        <div key={idx} className="receipt-item">
                                            <span>{item.name} x {item.qty} {item.unit}</span>
                                            <span>₹{((item.price || 0) * item.qty).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="receipt-total">
                                    <div className="receipt-item" style={{ fontSize: '14px' }}>
                                        <span>TOTAL</span>
                                        <span>₹{(lastSale?.total || 0).toLocaleString()}</span>
                                    </div>
                                    <p style={{ fontSize: '10px', marginTop: '5px' }}>Payment Mode: {lastSale?.paymentMethod}</p>
                                </div>
                                <div className="receipt-footer">
                                    <p>Thank you for shopping!</p>
                                    <p>Visit again</p>
                                </div>
                            </div>

                            <div className="p-8 flex flex-col items-center border-b border-dashed border-slate-200">
                                <div className="w-14 h-14 bg-slate-900 rounded-sm flex items-center justify-center text-white mb-6">
                                    <CheckCircle2 size={28} />
                                </div>
                                <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em] mb-1">Payment Successful</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt ready</p>
                            </div>

                            <div className="p-8 space-y-4">
                                <div className="flex justify-between text-[11px] font-black uppercase text-slate-900 tracking-widest">
                                    <span>Total Received</span>
                                    <span className="tabular-nums">₹{(lastSale?.total || 0).toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-slate-100" />
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                                    <span>Payment Method</span>
                                    <span>Counter Sale (POS)</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                                    <span>Time</span>
                                    <span>{new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>

                            <div className="p-8 pt-0 space-y-3">
                                <button
                                    onClick={handlePrint}
                                    className="w-full h-12 bg-slate-900 text-white rounded-sm font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                >
                                    <Printer size={16} /> Print Receipt
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('pos_cart');
                                        setCart([]);
                                        setIsReceiptShown(false);
                                    }}
                                    className="w-full h-12 border border-slate-200 text-slate-600 rounded-sm font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                                >
                                    Done & New Sale
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
