import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '@/lib/axios'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Trash2,
  Minus,
  Plus,
  ChevronRight,
  ShoppingBag,
  ShieldCheck,
  Info,
  Truck,
  ArrowRight,
  Star,
  Sparkles
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { useCart } from '../contexts/CartContext'

function CartItemImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300" aria-hidden>
        <ShoppingBag size={28} strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}

export default function CartScreen() {
  const { cartItems, updateQuantity, setQuantity, removeFromCart, cartTotal, getActivePrice, deliveryConstraints, addToCart } = useCart()
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
  const [isRecLoading, setIsRecLoading] = useState(false)

  // Fetch recommendations whenever cart items change
  useEffect(() => {
    const fetchRecs = async () => {
      if (cartItems.length === 0) return;
      
      setIsRecLoading(true);
      try {
        const productIds = cartItems.map(item => item.id || item._id).join(',');
        const response = await api.get(`/user/cart/recommendations?productIds=${productIds}`);
        if (response.data.success) {
          setRecommendations(response.data.results || []);
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      } finally {
        setIsRecLoading(false);
      }
    };

    fetchRecs();
  }, [cartItems.length]); // Refetch only if item count changes to avoid spamming on quantity updates

  const deliveryFee = cartTotal >= parseFloat(deliveryConstraints.freeMov) ? 0 : parseFloat(deliveryConstraints.baseFee)

  // Dynamic Tax calculation matching backend logic (Entire Order)
  const taxRateString = deliveryConstraints.tax || '0'
  const taxRate = parseFloat(taxRateString) / 100
  const tax = parseFloat(((cartTotal + deliveryFee) * taxRate).toFixed(2))

  const total = parseFloat((cartTotal + deliveryFee + tax).toFixed(2))

  if (cartItems.length === 0) {
    return (
      <PageTransition>
        <div className="bg-[#f8fafd] min-h-screen flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 bg-white rounded-3xl md:rounded-xl flex items-center justify-center text-slate-200 mb-8 shadow-sm border border-slate-50">
            <ShoppingBag size={48} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight md:font-bold md:normal-case">Your cart is empty</h1>
          <p className="mt-2 text-slate-400 font-bold uppercase tracking-widest text-xs md:normal-case md:font-medium md:text-sm">Time to stock up on some fresh farm produce!</p>
          <Button
            onClick={() => navigate('/home')}
            className="mt-10 h-14 px-10 rounded-2xl md:rounded-lg bg-primary text-white font-black md:font-bold shadow-lg shadow-green-100 active:scale-95 transition-all"
          >
            Browse Products
          </Button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="bg-[#f8fafd] min-h-screen overflow-x-hidden pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-20">
        {/* Mobile Header */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-slate-100/80 shadow-[0_1px_10px_rgba(0,0,0,0.04)] flex items-center gap-3 md:hidden">
          <button onClick={() => navigate(-1)} className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-transform shrink-0">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black text-slate-900 tracking-tight truncate">Your Cart</h1>
        </div>

        {/* Content Wrapper */}
        <div className="max-w-7xl mx-auto md:px-8">
          <div className="md:flex md:gap-10 md:py-10">
            {/* Cart Items List */}
            <div className="flex-1 space-y-3 px-4 md:px-0 min-w-0">
              <h2 className="hidden md:block text-3xl font-bold text-slate-900 mb-8 tracking-tight">My Shopping Cart</h2>

              <AnimatePresence mode="popLayout">
                {cartItems.map((item, index) => (
                  <motion.div
                    key={item.id || index}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl md:rounded-xl p-3 md:p-4 flex gap-3 md:gap-4 border border-slate-100 shadow-sm relative group overflow-hidden"
                  >
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl md:rounded-lg overflow-hidden bg-slate-50 shrink-0 border border-slate-50">
                      <CartItemImage src={item.primaryImage || item.image} alt={item.name} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 gap-2">
                      <div className="relative pr-9 min-w-0">
                        <h3 className="text-sm md:text-base font-black text-slate-900 leading-snug uppercase md:normal-case md:font-bold line-clamp-2 pr-1">
                          {item.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="absolute top-0 right-0 min-h-[36px] min-w-[36px] -mr-1 -mt-0.5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded-lg active:bg-slate-50"
                          aria-label="Remove item"
                        >
                          <Trash2 size={17} />
                        </button>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 md:normal-case md:font-medium truncate">
                          ₹{item.price} / {item.unit}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="text-base font-black text-primary tabular-nums shrink-0 md:text-lg md:font-bold">
                          ₹{getActivePrice(item) * item.quantity}
                        </span>
                        <div className="flex items-center justify-end sm:justify-start gap-0.5 bg-slate-50 rounded-xl md:rounded-lg p-0.5 border border-slate-100 shrink-0 self-end sm:self-auto max-w-full">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="min-h-[36px] min-w-[36px] md:min-h-[32px] md:min-w-[32px] flex items-center justify-center rounded-lg bg-white shadow-sm text-slate-600 hover:text-primary transition-colors active:scale-90"
                          >
                            <Minus size={14} strokeWidth={2.5} />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => setQuantity(item.id, e.target.value)}
                            className="w-8 md:w-10 text-center text-sm font-black text-slate-900 md:font-bold bg-transparent border-none focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="min-h-[36px] min-w-[36px] md:min-h-[32px] md:min-w-[32px] flex items-center justify-center rounded-lg bg-white shadow-sm text-slate-600 hover:text-primary transition-colors active:scale-90"
                          >
                            <Plus size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* 💡 Cart Recommendations Engine */}
              {recommendations.length > 0 && (
                <div className="mt-12 mb-8">
                  <div className="flex items-center gap-2 mb-5 px-1">
                    <Sparkles size={18} className="text-amber-500 fill-amber-500" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">You Might Also Need</h3>
                  </div>

                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                    <AnimatePresence>
                      {recommendations.map((product, idx) => (
                        <motion.div
                          key={product._id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="w-48 shrink-0 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col gap-3 group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-50">
                            <CartItemImage src={product.primaryImage} alt={product.name} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight h-7">
                              {product.name}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                              ₹{product.price} <span className="text-[10px]">/ {product.unit}</span>
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              addToCart(product);
                              setRecommendations(prev => prev.filter(p => p._id !== product._id));
                              toast.success(`${product.name} added to cart`);
                            }}
                            className="h-9 w-full rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-md group-active:scale-95"
                          >
                            <Plus size={14} className="mr-1" /> Add
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

            </div>

            {/* Order Summary - Sticky on Desktop */}
            <div className="w-full md:w-[400px] shrink-0 mt-6 md:mt-0 px-4 md:px-0 pb-4 md:pb-0">
              <div className="bg-white rounded-2xl md:rounded-xl p-5 md:p-8 space-y-5 md:space-y-6 border border-slate-100 shadow-sm md:sticky md:top-24">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 md:normal-case md:tracking-normal md:text-slate-900 md:text-base">Order Summary</h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                    <span>Subtotal</span>
                    <span>₹{cartTotal}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                    <span>Delivery Fee</span>
                    <span className={deliveryFee === 0 ? "text-green-600 font-bold" : ""}>
                      {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                    <span>Taxes & Charges ({taxRateString}%)</span>
                    <span title={`GST applied to total order amount`}>₹{tax}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  {/* Hide total payable on mobile inside summary card because we have the sticky bar */}
                  <div className="hidden md:flex justify-between items-center mb-8">
                    <span className="text-xl font-bold text-slate-900">Total Payable</span>
                    <span className="text-3xl font-black text-primary tracking-tight md:font-bold">₹{total}</span>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4 flex gap-3 mb-4 md:mb-8 border border-green-100">
                    <ShieldCheck className="text-primary shrink-0" size={20} />
                    <p className="text-[11px] font-medium text-green-800 leading-relaxed">Payments are 100% secure. <br className="hidden md:block" /> Freshness guaranteed on every item.</p>
                  </div>

                  <Button
                    onClick={() => navigate('/checkout')}
                    className="hidden md:flex w-full h-14 rounded-lg bg-primary hover:bg-primary/90 text-lg font-bold shadow-lg shadow-green-100 transition-all active:scale-[0.98] items-center justify-center gap-3"
                  >
                    Proceed to Checkout <ArrowRight size={20} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integrated Sticky Checkout Bar - Mobile Only */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-100/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] max-w-md mx-auto md:hidden">
          <div className="flex items-center gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] px-5">
            <div className="shrink-0 flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Payable</span>
              <span className="text-[22px] font-black text-slate-900 leading-none tracking-tighter">₹{total}</span>
            </div>

            <Button
              onClick={() => navigate('/checkout')}
              className="flex-1 min-h-[52px] h-12 rounded-2xl bg-primary hover:bg-primary/90 text-[15px] font-black shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Checkout <ArrowRight size={18} strokeWidth={3} />
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}