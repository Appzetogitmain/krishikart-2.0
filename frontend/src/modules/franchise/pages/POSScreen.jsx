import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    ShoppingBasket,
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
    ChevronRight,
    RefreshCw,
    Store,
    LayoutGrid,
    Leaf,
    Apple,
    Milk,
    MoreHorizontal,
    Smartphone,
} from 'lucide-react';
import { useInventory } from '../contexts/InventoryContext';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { FranchisePageHeader } from '../components/layout/FranchisePageHeader';
import { hindiName } from '../utils/hindiNames';
import { useFranchiseLanguage } from '../contexts/FranchiseLanguageContext';

/* Counter sale (POS), built to the client's mockup: Hindi-first product cards, cart with totals, Cash / UPI. */

const GROUPS = [
    { id: 'all', label: 'सभी', Icon: LayoutGrid },
    { id: 'veg', label: 'सब्जियां', Icon: Leaf, re: /veg/i, cls: 'text-green-600' },
    { id: 'fruit', label: 'फल', Icon: Apple, re: /fruit/i, cls: 'text-rose-500' },
    { id: 'dairy', label: 'डेयरी', Icon: Milk, re: /dairy|milk/i, cls: 'text-blue-500' },
    { id: 'other', label: 'अन्य', Icon: MoreHorizontal },
];
const groupOf = (category) => GROUPS.find((g) => g.re?.test(category || ''))?.id || 'other';
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const rupees = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN')}`;
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=40';

export default function POSScreen() {
    const { lang } = useFranchiseLanguage();
    const showHindi = lang === 'hi'; // Hindi product names only in Hindi; other languages translate the English name
    const { inventory, refreshInventory, loading: inventoryLoading } = useInventory();
    const { franchise } = useFranchiseAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [group, setGroup] = useState('all');
    const [cart, setCart] = useState(() => {
        try {
            const savedCart = localStorage.getItem('pos_cart');
            return savedCart ? JSON.parse(savedCart) : [];
        } catch {
            return [];
        }
    });
    const [payMode, setPayMode] = useState('Cash');
    const [lastSale, setLastSale] = useState(null);
    const [showQRCodeModal, setShowQRCodeModal] = useState(false);
    const [isReceiptShown, setIsReceiptShown] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Persist cart
    useEffect(() => {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
    }, [cart]);

    const filteredItems = inventory.filter((item) => {
        if (item.showOnPOS === false) return false;
        if (group !== 'all' && groupOf(item.category) !== group) return false;
        const term = searchQuery.trim().toLowerCase();
        return !term
            || item.name.toLowerCase().includes(term)
            || item.category.toLowerCase().includes(term)
            || hindiName(item.name).includes(term);
    });

    const addToCart = (item, qty = 1) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: round3((Number(i.qty) || 0) + qty) } : i);
            }
            return [...prev, { ...item, qty }];
        });
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(i => i.id !== id));
    };

    const setQty = (id, qty) => {
        const n = round3(qty);
        setCart(prev => (n > 0 ? prev.map(i => (i.id === id ? { ...i, qty: n } : i)) : prev.filter(i => i.id !== id)));
    };
    const updateQty = (id, delta) => {
        const item = cart.find(i => i.id === id);
        if (item) setQty(id, (Number(item.qty) || 0) + delta);
    };
    // While typing (e.g. "0.5") keep the text as it is; an empty or zero amount is removed on blur
    const typeQty = (id, value) => setCart(prev => prev.map(i => (i.id === id ? { ...i, qty: value } : i)));

    const total = cart.reduce((sum, item) => sum + (item.price * (Number(item.qty) || 0)), 0);
    const totalQty = round3(cart.reduce((s, i) => s + (Number(i.qty) || 0), 0));
    const units = [...new Set(cart.map((i) => i.unit))];

    const handleCheckout = async (paymentMode) => {
        setIsSubmitting(true);
        try {
            const saleData = {
                items: cart.map(item => ({
                    productId: item.productId,
                    name: item.name,
                    quantity: Number(item.qty) || 0,
                    price: item.price,
                    subtotal: item.price * (Number(item.qty) || 0),
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

    const checkout = () => {
        if (!cart.length || isSubmitting) return;
        if (cart.some((i) => !(Number(i.qty) > 0))) { toast.error("Enter a quantity for every item"); return; }
        if (payMode === 'UPI') setShowQRCodeModal(true);
        else handleCheckout('Cash');
    };

    const handlePrint = () => {
        const printContent = document.getElementById('printable-receipt');
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

    const closeReceipt = () => {
        localStorage.removeItem('pos_cart');
        setCart([]);
        setIsReceiptShown(false);
    };

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-28 lg:pb-8">
            <FranchisePageHeader
                icon={Store}
                title="Counter Sale / काउंटर बिक्री"
                subtitle="ग्राहकों को सीधे यहां से सामान बेचें"
                showDate={false}
                right={
                    <button onClick={() => refreshInventory()} className="h-14 w-14 rounded-2xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50" aria-label="Refresh stock">
                        <RefreshCw size={20} className={cn(inventoryLoading && 'animate-spin')} />
                    </button>
                }
            />

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 px-4 lg:px-6">
                <div className="min-w-0 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="सब्जी या सामान खोजें..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-14 bg-white border border-slate-200 rounded-2xl pl-12 pr-4 outline-none text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-green-600"
                        />
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {GROUPS.map((g) => (
                            <button key={g.id} onClick={() => setGroup(g.id)}
                                className={cn('h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors',
                                    group === g.id ? 'bg-green-700 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50')}>
                                <g.Icon size={20} className={group === g.id ? '' : g.cls} /> {g.label}
                            </button>
                        ))}
                    </div>

                    {inventoryLoading && inventory.length === 0 ? (
                        <div className="py-20 flex flex-col items-center text-slate-400">
                            <RefreshCw className="animate-spin mb-3" size={30} />
                            <p className="text-[15px]">सामान लोड हो रहा है...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-100 py-16 text-center text-slate-500">
                            <Package size={40} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-[15px]">कोई सामान नहीं मिला</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
                            {filteredItems.map((item) => {
                                const hi = showHindi ? hindiName(item.name) : '';
                                const inCart = cart.find((c) => c.id === item.id)?.qty || 0;
                                const out = item.currentStock <= 0;
                                const low = !out && item.currentStock <= 5;
                                return (
                                    <div key={item.id} className={cn('bg-white rounded-2xl border overflow-hidden flex flex-col', inCart ? 'border-green-500' : 'border-slate-100')}>
                                        <div className="aspect-[4/3] bg-slate-50 overflow-hidden relative">
                                            <img src={item.image || FALLBACK_IMG} alt={item.name} className="w-full h-full object-cover" loading="lazy"
                                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMG; }} />
                                            {inCart > 0 && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-green-700 text-white text-[12px] font-bold">{inCart} {item.unit}</span>}
                                        </div>
                                        <div className="p-3 flex-1 flex flex-col gap-1">
                                            <p className="text-[17px] font-bold text-slate-900 leading-tight">{hi || item.name}</p>
                                            {hi && <p translate="no" className="text-[13px] text-slate-500 -mt-0.5">{item.name}</p>}
                                            <p className="text-[15px] text-slate-700 tabular-nums mt-1">
                                                <b className="text-[18px] text-slate-900">₹ {(item.price || 0).toLocaleString('en-IN')}</b> / {item.unitValue > 1 ? `${item.unitValue} ` : ''}{item.unit}
                                                {item.comparePrice > item.price && <span className="ml-1.5 text-[13px] text-slate-400 line-through">₹{item.comparePrice}</span>}
                                            </p>
                                            <p className={cn('text-[13px] font-semibold flex items-center gap-1.5', out || low ? 'text-rose-600' : 'text-green-700')}>
                                                <Package size={14} /> स्टॉक: {item.currentStock} {item.unit}
                                            </p>
                                            <button onClick={() => addToCart(item)} disabled={out}
                                                className="mt-2 h-11 rounded-xl bg-green-700 text-white text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-green-800 disabled:bg-slate-200 disabled:text-slate-500">
                                                <ShoppingCart size={18} /> {out ? 'स्टॉक खत्म' : '+ जोड़ें'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Cart */}
                <div id="pos-cart" className="xl:sticky xl:top-4 self-start bg-white rounded-3xl border border-slate-100 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 lg:px-5 py-4 bg-green-50/60">
                        <ShoppingCart size={26} className="text-green-700" />
                        <h2 className="flex-1 text-xl font-bold text-slate-900">बिक्री की सूची / Cart</h2>
                        {cart.length > 0 && (
                            <button onClick={() => setCart([])} className="text-[14px] font-semibold text-rose-600 flex items-center gap-1.5 hover:text-rose-700">
                                <Trash2 size={16} /> सभी हटाएं
                            </button>
                        )}
                    </div>

                    <div className="px-4 lg:px-5">
                        {cart.length > 0 ? (
                            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                                {cart.map((item) => {
                                    const hi = showHindi ? hindiName(item.name) : '';
                                    return (
                                        <div key={item.id} className="py-3 flex items-center gap-3">
                                            <img src={item.image || FALLBACK_IMG} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-50 shrink-0"
                                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMG; }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[16px] font-bold text-slate-900 truncate">{hi || item.name}</p>
                                                <p className="text-[13px] text-slate-500">₹ {(item.price || 0).toLocaleString('en-IN')} / {item.unit}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => updateQty(item.id, -1)} className="w-9 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200" aria-label="Less"><Minus size={16} /></button>
                                                    <input type="number" inputMode="decimal" min="0" step="any" value={item.qty}
                                                        onChange={(e) => typeQty(item.id, e.target.value)}
                                                        onBlur={() => setQty(item.id, item.qty)}
                                                        className="w-14 h-10 rounded-lg border border-slate-200 text-center text-[15px] font-bold tabular-nums outline-none focus:border-green-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                                                        aria-label={`${item.name} quantity`} />
                                                    <button onClick={() => updateQty(item.id, 1)} className="w-9 h-10 rounded-lg bg-green-700 text-white flex items-center justify-center hover:bg-green-800" aria-label="More"><Plus size={16} /></button>
                                                    <button onClick={() => removeFromCart(item.id)} className="w-8 h-10 text-slate-400 hover:text-rose-600 flex items-center justify-center" aria-label={`Remove ${item.name}`}><X size={18} /></button>
                                                </div>
                                                <span className="text-[17px] font-bold text-green-700 tabular-nums">{rupees(item.price * (Number(item.qty) || 0))}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-500">
                                <ShoppingBasket size={40} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-[15px] font-semibold">सूची खाली है</p>
                                <p className="text-[13px]">सामान पर "+ जोड़ें" दबाएं</p>
                            </div>
                        )}
                    </div>

                    <div className="px-4 lg:px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                        <div className="space-y-1.5 text-[15px] text-slate-600">
                            <div className="flex justify-between"><span>कुल आइटम</span><b className="text-slate-900">{cart.length}</b></div>
                            <div className="flex justify-between"><span>कुल मात्रा</span><b className="text-slate-900">{totalQty} {units.length === 1 ? units[0] : ''}</b></div>
                        </div>
                        <div className="rounded-2xl bg-green-50 p-4">
                            <p className="text-[15px] text-green-800">कुल राशि (Total Amount)</p>
                            <p className="text-4xl font-bold text-green-800 tabular-nums">{rupees(total)}</p>
                        </div>
                        <div>
                            <p className="text-[16px] font-bold text-slate-900 mb-2">भुगतान का तरीका (Payment Method)</p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'Cash', label: 'कैश (Cash)', Icon: Banknote },
                                    { id: 'UPI', label: 'UPI', Icon: Smartphone },
                                ].map((m) => (
                                    <button key={m.id} type="button" onClick={() => setPayMode(m.id)}
                                        className={cn('h-14 rounded-2xl border-2 flex items-center gap-2 px-3 text-[15px] font-semibold transition-colors',
                                            payMode === m.id ? 'border-green-600 bg-green-50/60 text-green-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                                        <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', payMode === m.id ? 'border-green-600 bg-green-600' : 'border-slate-300')}>
                                            {payMode === m.id && <CheckCircle2 size={14} className="text-white" />}
                                        </span>
                                        <m.Icon size={20} /> {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button onClick={checkout} disabled={cart.length === 0 || isSubmitting}
                            className="w-full h-16 rounded-2xl bg-green-700 text-white text-[18px] font-bold flex items-center justify-center gap-3 hover:bg-green-800 disabled:opacity-50">
                            {isSubmitting ? <RefreshCw size={22} className="animate-spin" /> : <Printer size={22} />}
                            बिल बनाएं / Checkout <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Phone: jump to the cart */}
            {cart.length > 0 && (
                <button onClick={() => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth' })}
                    className="xl:hidden fixed bottom-20 left-4 right-4 z-40 h-14 rounded-2xl bg-green-700 text-white text-[16px] font-bold shadow-lg flex items-center justify-center gap-2">
                    <ShoppingCart size={20} /> Cart ({cart.length}) — {rupees(total)}
                </button>
            )}

            {/* QR Code Scan Modal */}
            <AnimatePresence>
                {showQRCodeModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center"
                        >
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Scan to Pay / स्कैन करके भुगतान</h3>

                            <div className="w-full aspect-square border border-slate-100 rounded-2xl mb-5 flex items-center justify-center bg-slate-50 overflow-hidden p-4">
                                {franchise?.storeQRCode ? (
                                    <img src={franchise.storeQRCode} className="w-full h-full object-contain" alt="Payment QR" />
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-slate-400">
                                        <QrCode size={64} strokeWidth={1} />
                                        <span className="text-[14px] font-semibold">No QR set — add it in Payment Settings</span>
                                    </div>
                                )}
                            </div>

                            <div className="text-center mb-6">
                                <p className="text-[14px] text-slate-500">Total Amount</p>
                                <p className="text-3xl font-bold text-slate-900 tabular-nums">{rupees(total)}</p>
                            </div>

                            <div className="w-full flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        handleCheckout('QR Scan');
                                        setShowQRCodeModal(false);
                                    }}
                                    disabled={isSubmitting || !franchise?.storeQRCode}
                                    className="w-full h-14 bg-green-700 text-white rounded-2xl text-[16px] font-bold hover:bg-green-800 disabled:bg-slate-200 disabled:text-slate-500"
                                >
                                    {isSubmitting ? <RefreshCw size={18} className="animate-spin mx-auto" /> : 'पैसा मिल गया / Confirm Payment'}
                                </button>
                                <button onClick={() => setShowQRCodeModal(false)} className="w-full h-12 text-[15px] font-semibold text-slate-500 hover:text-slate-900">
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
                            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm cursor-pointer"
                            onClick={closeReceipt}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-[380px] rounded-3xl shadow-2xl relative z-10 overflow-hidden"
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

                            <div className="p-6 flex flex-col items-center border-b border-dashed border-slate-200">
                                <span className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center text-white mb-4"><CheckCircle2 size={32} /></span>
                                <h2 className="text-xl font-bold text-slate-900">बिक्री पूरी हुई</h2>
                                <p className="text-[14px] text-slate-500">Payment received · receipt ready</p>
                            </div>

                            <div className="p-6 space-y-3 text-[15px]">
                                <div className="flex justify-between font-bold text-slate-900">
                                    <span>Total Received</span>
                                    <span className="tabular-nums">{rupees(lastSale?.total)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Payment Method</span>
                                    <span>{lastSale?.paymentMethod === 'QR Scan' ? 'UPI' : lastSale?.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Time</span>
                                    <span>{new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                                </div>
                            </div>

                            <div className="p-6 pt-0 space-y-2">
                                <button onClick={handlePrint}
                                    className="w-full h-14 bg-green-700 text-white rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 hover:bg-green-800">
                                    <Printer size={20} /> Print Receipt
                                </button>
                                <button onClick={closeReceipt}
                                    className="w-full h-12 border border-slate-200 text-slate-700 rounded-2xl text-[15px] font-semibold hover:bg-slate-50">
                                    नई बिक्री / New Sale
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
