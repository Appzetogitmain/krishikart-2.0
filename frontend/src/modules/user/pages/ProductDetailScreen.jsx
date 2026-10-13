import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Heart,
  Share2,
  ShoppingCart,
  Star,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  RotateCcw,
  ChevronRight,
  TrendingDown,
  Info,
  Store
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import ShareModal from '../components/common/ShareModal'
import { Button } from '@/components/ui/button'
import api from '@/lib/axios'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useCart } from '../contexts/CartContext'
import { useWishlist } from '../contexts/WishlistContext'
import { useLocation } from '../contexts/LocationContext'
import { getBrowseLocationParams } from '../utils/storefrontParams'
import { optimizedImage } from '../utils/optimizedImage'
import { useRequireAuth } from '../hooks/useRequireAuth'

export default function ProductDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart, cartItems, updateQuantity } = useCart()
  const { toggleWishlist, isWishlisted } = useWishlist()
  const { requireAuth } = useRequireAuth()
  const locationCtx = useLocation()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)

  // Get existing cart item if any
  const cartItem = useMemo(() => cartItems.find(item => item.id === id || item._id === id), [cartItems, id])

  // Initialize quantity from cart or default to 1
  const [quantity, setQuantity] = useState(1)

  // Sync quantity with cart when product loads or cart changes
  useEffect(() => {
    if (cartItem) {
      setQuantity(cartItem.quantity)
    }
  }, [cartItem])
  const isFavorite = isWishlisted(id)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const { coords, hasPinned } = getBrowseLocationParams(locationCtx)
        const params = {}
        if (hasPinned && coords) {
          params.lat = coords.lat
          params.lng = coords.lng
        }
        const response = await api.get(`/products/${id}`, { params })
        if (response.data.success) {
          setProduct(response.data.result)
        }
      } catch (error) {
        console.error('Fetch Product Detail Error:', error)
        toast.error('Failed to load product details')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchProduct()
  }, [
    id,
    locationCtx?.deliveryLocation,
    locationCtx?.hasDeliveryPinned,
    locationCtx?.franchiseLocation,
    locationCtx?.hasFranchisePinned,
  ])

  // Update document title and sync breadcrumbs
  useEffect(() => {
    if (product?.name) {
      document.title = `${product.name} | KrishiKart`;
      localStorage.setItem('kk_last_viewed_product_name', product.name);
      window.dispatchEvent(new Event('kk_product_name_updated'));
    }
    return () => {
      document.title = "KrishiKart - Fresh Products Delivered";
    };
  }, [product?.name]);

  // Unit price: area-specific when API returned effectiveStorefrontPrice; bulk tiers override when applicable
  const currentPrice = useMemo(() => {
    if (!product) return 0
    const baseUnit = Number(
      product.effectiveStorefrontPrice ?? product.price ?? 0
    )
    if (!product.bulkPricing || product.bulkPricing.length === 0) return baseUnit
    const applicableBulk = [...product.bulkPricing]
      .reverse()
      .find(b => quantity >= b.minQty)
    return applicableBulk ? applicableBulk.price : baseUnit
  }, [product, quantity])

  const handleShare = async () => {
    const shareData = {
      title: product?.name || 'kisaankart Product',
      text: `Check out ${product?.name} on kisaankart - Fresh products delivered to your doorstep!`,
      url: window.location.href,
    }

    try {
      // Try native share first (works on mobile)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
        toast.success('Shared successfully!')
      } else if (navigator.share) {
        await navigator.share(shareData)
        toast.success('Shared successfully!')
      } else {
        // Show custom share modal for desktop
        setShowShareModal(true)
      }
    } catch (err) {
      // User cancelled or error occurred
      if (err.name === 'AbortError') {
        console.log('Share cancelled by user')
      } else {
        console.error('Error sharing:', err)
        // Fallback to custom modal
        setShowShareModal(true)
      }
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Product Not Found</h2>
        <p className="text-slate-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/home')}>Go Back Home</Button>
      </div>
    )
  }

  const productImage = optimizedImage(product.primaryImage || product.image, 900)
  const productCategory = product.category?.name || product.category || 'General'
  const comparePrice = Number(product.comparePrice || product.mrp || 0)
  const standardUnit = Number(product.effectiveStorefrontPrice ?? product.price ?? 0)
  const hasComparePrice = comparePrice > Number(currentPrice || 0)

  return (
    <>
      <PageTransition>
        <div className="bg-white pb-32 md:pb-20 min-h-screen">
          {/* Mobile Header Actions */}
          <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pb-3 flex justify-between pointer-events-none max-w-md mx-auto md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-100/80 shadow-[0_1px_10px_rgba(0,0,0,0.04)]">
            <button
            onClick={() => navigate(-1)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/90 shadow-sm border border-slate-100 text-slate-900 active:scale-90 transition-transform pointer-events-auto shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex-1 px-4 truncate flex items-center justify-center">
            <span className="text-[14px] font-black text-slate-900 truncate uppercase tracking-tight">
                {product?.name}
            </span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={handleShare} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/90 shadow-sm border border-slate-100 text-slate-900 active:scale-90 transition-transform">
              <Share2 size={18} />
            </button>
            <button
              onClick={requireAuth(() => toggleWishlist(product))}
              className={cn(
                "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/90 shadow-sm border border-slate-100 transition-all active:scale-90",
                isFavorite ? "text-red-500" : "text-slate-900"
              )}
            >
              <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/90 shadow-sm border border-slate-100 text-slate-900 active:scale-90 transition-transform"
              aria-label="Go to cart"
            >
              <ShoppingCart size={18} />
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div className="max-w-7xl mx-auto md:px-8">
          <div className="md:flex md:gap-12 md:items-start">
            {/* Hero Image */}
            <div className="relative mt-[69px] md:mt-0 aspect-square md:w-[450px] lg:w-[500px] shrink-0 bg-slate-50 overflow-hidden md:rounded-xl md:border md:border-slate-100">
              {/* Soft blurred copy fills the frame so the full photo can be shown uncropped */}
              <img
                src={productImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60 select-none"
                draggable={false}
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <img
                src={productImage}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-contain object-center select-none"
                draggable={false}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80' }}
              />
            </div>

            {/* Content */}
            <div className="px-5 -mt-6 relative z-10 bg-white rounded-t-[28px] pt-6 md:mt-0 md:bg-transparent md:px-0 md:pt-0 md:flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-100 px-3 font-bold uppercase text-[10px] md:normal-case md:font-semibold">
                  {productCategory}
                </Badge>
                {product.stock > 0 && (
                  <span className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1 md:normal-case md:font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    In Stock
                  </span>
                )}
                {product.dietaryType && (
                  <div className={cn(
                    "w-4 h-4 border-[1.2px] flex items-center justify-center rounded-[2px] bg-white",
                    (product.dietaryType === 'veg' || product.dietaryType === 'none') ? "border-emerald-600" : "border-red-600"
                  )}>
                    <div className={cn(
                      "w-[5px] h-[5px] rounded-full",
                      (product.dietaryType === 'veg' || product.dietaryType === 'none') ? "bg-emerald-600" : "bg-red-600"
                    )} />
                  </div>
                )}
              </div>

              <h1 className="text-xl md:text-4xl font-black text-slate-900 leading-tight mb-1.5 uppercase md:normal-case md:font-bold">{product.name}</h1>

              {/* Rating is shown only when the product really has one (no ratings system yet) */}
              {Number(product.rating) > 0 ? (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5 bg-yellow-400/10 px-2 py-1 rounded-lg">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-black text-yellow-700 md:font-bold">{product.rating}</span>
                  </div>
                  {Number(product.reviews) > 0 && (
                    <span className="text-xs text-slate-400 font-bold md:font-medium">({product.reviews} Reviews)</span>
                  )}
                </div>
              </div>
              ) : <div className="mb-3" />}

              {/* Pricing Section */}
              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentPrice}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight md:font-bold"
                    >
                      ₹{currentPrice}
                    </motion.span>
                  </AnimatePresence>
                  {hasComparePrice && (
                    <span className="text-lg text-slate-400 line-through font-bold">₹{comparePrice}</span>
                  )}
                  <span className="text-sm text-slate-400 font-bold md:font-medium">/ {product.unit}</span>
                  {product.bulkPricing?.length > 0 && currentPrice < standardUnit && (
                    <div className="flex items-center gap-1 ml-2 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-lg text-[10px] font-black md:normal-case md:font-bold">
                      <TrendingDown size={12} />
                      Bulk Pricing Applied
                    </div>
                  )}
                </div>
              </div>

              {/* Bulk Pricing Grid */}
              {product.bulkPricing && (
                <div className="mb-8 p-6 rounded-[28px] md:rounded-xl bg-white border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown size={18} className="text-orange-500" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest md:normal-case md:tracking-normal">Bulk savings for businesses</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {product.bulkPricing.map((tier, idx) => {
                      const isUnlocked = quantity >= tier.minQty;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-2xl md:rounded-lg transition-all border",
                            isUnlocked
                              ? "bg-white border-primary/20 shadow-sm"
                              : "bg-transparent border-transparent grayscale opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-fit px-3 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold",
                              isUnlocked ? "bg-primary text-white" : "bg-slate-200 text-slate-500"
                            )}>
                              {tier.minQty}+ {product.unit}
                            </div>
                            <span className="text-xs font-medium text-slate-600">Buy {tier.minQty} or more</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-900">₹{tier.price}</span>
                            <span className="text-[10px] text-slate-400 font-medium"> / {product.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Product Details */}
              <div className="space-y-4 mb-4">
                <h3 className="text-lg font-black text-slate-900 tracking-tight md:font-bold">About this product</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {product.description}
                </p>
              </div>

              {/* Desktop Add to Cart */}
              <div className="hidden md:flex flex-col gap-6 p-8 rounded-xl bg-white border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">Order Total</span>
                  <span className="text-3xl font-bold text-slate-900">₹{currentPrice * (Number(quantity) || 1)}</span>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 h-12 w-32">
                  <button
                    onClick={() => setQuantity(prev => Math.max(1, (Number(prev) || 1) - 1))}
                    className="w-8 h-full flex items-center justify-center rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuantity('');
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num) && num > 0) setQuantity(num);
                      }
                    }}
                    onBlur={() => {
                      if (!quantity || Number(quantity) < 1) setQuantity(1);
                    }}
                    className="flex-1 w-full text-center text-lg font-bold border-none focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQuantity(prev => (Number(prev) || 0) + 1)}
                    className="w-8 h-full flex items-center justify-center rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <Button
                  onClick={requireAuth(() => {
                    const finalQty = Number(quantity) || 1;
                    if (cartItem) {
                      const delta = finalQty - cartItem.quantity;
                      if (delta !== 0) {
                        updateQuantity(id, delta);
                      }
                    } else {
                      addToCart({ ...product, price: currentPrice }, finalQty);
                    }
                    navigate('/cart')
                  })}
                  className="flex-1 h-12 rounded-lg bg-primary hover:bg-primary/90 text-md font-bold transition-all active:scale-[0.98]"
                >
                  {cartItem ? 'Update Cart' : 'Add to Cart'}
                </Button>
              </div>
            </div>
          </div>
        </div>


        {/* Sticky Bottom Actions - Mobile Only */}
        <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-slate-100/80 shadow-[0_-4px_16px_rgba(15,23,42,0.12)] max-w-md mx-auto md:hidden">
          <div className="flex items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg p-1 min-h-[40px] w-28 shrink-0">
              <button
                onClick={() => setQuantity(prev => Math.max(1, (Number(prev) || 1) - 1))}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md bg-white shadow-sm text-slate-900 active:scale-95 transition-transform font-bold"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setQuantity('');
                  } else {
                    const num = parseInt(val);
                    if (!isNaN(num) && num > 0) setQuantity(num);
                  }
                }}
                onBlur={() => {
                  if (!quantity || Number(quantity) < 1) setQuantity(1);
                }}
                className="flex-1 w-full text-center text-xs font-black text-slate-900 tracking-tighter border-none focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setQuantity(prev => (Number(prev) || 0) + 1)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md bg-white shadow-sm text-slate-900 active:scale-95 transition-transform font-bold"
              >
                <Plus size={16} />
              </button>
            </div>

            <Button
              onClick={requireAuth(() => {
                const finalQty = Number(quantity) || 1;
                if (cartItem) {
                  const delta = finalQty - cartItem.quantity;
                  if (delta !== 0) {
                    updateQuantity(id, delta);
                  }
                } else {
                  addToCart({ ...product, price: currentPrice }, finalQty);
                }
                navigate('/cart')
              })}
              className="flex-1 min-h-[46px] h-11 rounded-xl bg-primary hover:bg-primary/90 text-sm font-black shadow-md shadow-primary/20 transition-all active:scale-[0.98] flex flex-col justify-center items-center gap-0"
            >
              <span className="text-white/80 text-[10px] font-bold uppercase tracking-[0.18em] leading-none mb-0.5">
                {cartItem ? 'Update Cart' : 'Add to Cart'}
              </span>
              <span className="leading-none text-[13px]">₹{currentPrice * (Number(quantity) || 1)}</span>
            </Button>
          </div>
        </div>
        </div>
      </PageTransition>

      {/* Share Modal */}
      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        product={product} 
      />
    </>
  )
}
