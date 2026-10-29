import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, ShoppingCart, Plus, Minus, Heart, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '../../contexts/CartContext'
import { useWishlist } from '../../contexts/WishlistContext'
import { cn } from '@/lib/utils'
import QuantityModal from './QuantityModal'
import MobileQuantitySheet from './MobileQuantitySheet'
import HighlightText from './HighlightText'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { optimizedImage } from '../../utils/optimizedImage'

/** Light haptic tap on phones that support it (ignored elsewhere). */
const tapFeedback = () => {
    try { navigator.vibrate?.(10) } catch { /* not supported */ }
}

/**
 * @param {string} highlight  optional search text; matching letters in the name are highlighted
 */
export default function ProductCard({ product, layout = 'grid', highlight = '' }) {
    const navigate = useNavigate()
    const { cartItems, addToCart, updateQuantity, removeFromCart, setQuantity } = useCart()
    const { toggleWishlist, isWishlisted } = useWishlist()
    const { requireAuth } = useRequireAuth()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
    // The quantity picker is only mounted once it has been opened, to keep long lists light
    const [pickerMounted, setPickerMounted] = useState(false)
    const [addAreaActive, setAddAreaActive] = useState(false)
    const [localQuantity, setLocalQuantity] = useState('')
    const [imgLoaded, setImgLoaded] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const productId = product._id || product.id
    const cartItem = cartItems.find(item => item.id === productId)
    const quantity = cartItem ? cartItem.quantity : 0

    useEffect(() => {
        setLocalQuantity(quantity > 0 ? quantity.toString() : '')
    }, [quantity])
    const displayPrice = Number(product.effectiveStorefrontPrice ?? product.price ?? 0)
    const comparePriceMrp = Number(product.comparePrice || product.mrp || 0)
    const catalogList = Number(product.storefrontListPrice ?? product.price ?? 0)
    const strikePrice = Math.max(
        comparePriceMrp > displayPrice ? comparePriceMrp : 0,
        product.effectiveStorefrontPrice != null && catalogList > displayPrice ? catalogList : 0,
    )
    const hasComparePrice = strikePrice > displayPrice
    const discountPercent = hasComparePrice ? Math.round((1 - displayPrice / strikePrice) * 100) : 0
    const isLoved = isWishlisted(productId)
    const productImage = optimizedImage(product.primaryImage || product.image, 400)

    const handleAddToCart = requireAuth((e) => {
        e.stopPropagation()
        tapFeedback()
        setPickerMounted(true)
        setIsModalOpen(true)
    })

    const handleWishlist = requireAuth((e) => {
        e.stopPropagation()
        tapFeedback()
        toggleWishlist(product)
    })

    const handleIncrement = requireAuth((e) => {
        e.stopPropagation()
        tapFeedback()
        updateQuantity(productId, 1)
    })

    const handleDecrement = requireAuth((e) => {
        e.stopPropagation()
        if (quantity > 1) {
            updateQuantity(productId, -1)
        } else {
            removeFromCart(productId)
        }
    })

    const handleQuantityInput = requireAuth((e) => {
        e.stopPropagation()
        const value = e.target.value
        if (value === '') {
            setLocalQuantity('')
            return
        }
        setLocalQuantity(value)
        const newQty = parseInt(value)
        if (!isNaN(newQty)) {
            if (newQty <= 0) {
                removeFromCart(productId)
            } else {
                setQuantity(productId, newQty)
            }
        }
    })

    const handleBlur = () => {
        if (localQuantity === '' || isNaN(parseInt(localQuantity))) {
            setLocalQuantity(quantity.toString())
        }
    }

    if (layout === 'list') {
        return (
            <>
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '0px 0px -30px 0px' }}
                    transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                >
                {/* Entrance animation lives on the wrapper; press feedback on the card itself */}
                <div
                    onClick={() => navigate(`/product/${productId}`)}
                    className={cn(
                        "kk-press bg-white rounded-2xl p-1.5 border border-slate-100 flex gap-2 h-[94px] items-center group cursor-pointer shadow-sm overflow-hidden md:rounded-xl md:border-slate-200",
                        quantity > 0 && "kk-in-cart"
                    )}
                >
                    <div className={cn("relative w-[76px] h-[76px] rounded-[16px] overflow-hidden shrink-0 md:rounded-lg", imgLoaded ? "bg-slate-50" : "kk-shimmer")}>
                        <img
                            src={productImage}
                            alt={product.name}
                            loading="lazy" decoding="async"
                            onLoad={() => setImgLoaded(true)}
                            className={cn("kk-press-img absolute inset-0 h-full w-full object-cover object-center", imgLoaded ? "opacity-100" : "opacity-0")}
                            draggable={false}
                            onError={(e) => { setImgLoaded(true); e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }}
                        />
                        <button
                            onClick={handleWishlist}
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center text-slate-400 shadow-sm"
                        >
                            <Heart size={12} fill={isLoved ? "currentColor" : "none"} className={isLoved ? "text-red-500" : ""} />
                        </button>
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight line-clamp-1 md:text-sm md:font-bold md:normal-case md:tracking-normal"><HighlightText text={product.name} query={highlight} /></h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:text-[10px] md:normal-case md:tracking-normal">{product.supplier}</p>

                        <div className="flex items-center justify-between mt-3">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-black text-slate-900 leading-none md:text-base md:font-bold">₹{displayPrice}</p>
                                    {hasComparePrice && (
                                        <span className="text-[11px] font-bold text-slate-400 line-through">₹{strikePrice}</span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 md:text-[10px] md:normal-case md:tracking-normal">{product.unit}</p>
                            </div>

                            <div className="shrink-0 ml-auto min-h-8 flex items-center" onClick={(e) => e.stopPropagation()}>
                                <AnimatePresence mode="wait">
                                    {quantity === 0 ? (
                                        <button
                                            type="button"
                                            onClick={handleAddToCart}
                                            className="size-8 rounded-lg bg-slate-900 border border-slate-800 text-white active:scale-95 transition-all flex items-center justify-center p-0 md:bg-white md:text-primary md:border-primary md:hover:bg-primary/5"
                                            aria-label="Add to cart"
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                        </button>
                                    ) : (
                                        <div className="inline-flex items-center bg-slate-50 rounded-lg text-slate-900 border border-slate-100 md:bg-white md:border-primary overflow-hidden">
                                            <button type="button" onClick={handleDecrement} className="size-8 flex items-center justify-center p-0 hover:text-red-500 transition-colors md:text-primary"><Minus size={12} strokeWidth={3} /></button>
                                            <input
                                                type="number"
                                                value={localQuantity}
                                                onChange={handleQuantityInput}
                                                onBlur={handleBlur}
                                                className="text-[10px] font-black w-5 text-center bg-transparent border-none focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none md:font-bold md:w-6"
                                            />
                                            <button type="button" onClick={handleIncrement} className="size-8 flex items-center justify-center p-0 hover:text-primary transition-colors md:text-primary"><Plus size={12} strokeWidth={3} /></button>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
                </motion.div>
                {/* Desktop Quantity Modal */}
                {pickerMounted && !isMobile && (
                    <QuantityModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        product={product}
                        onAdd={(prod, qty) => addToCart(prod, qty)}
                    />
                )}
                {/* Mobile Quantity Sheet */}
                {pickerMounted && isMobile && (
                    <MobileQuantitySheet
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        product={product}
                        onAdd={(prod, qty) => addToCart(prod, qty)}
                    />
                )}
            </>
        )
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="h-full"
            >
            {/* Entrance animation lives on the wrapper; press feedback on the card itself */}
            <div
                className={cn(
                    "kk-press relative bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col h-full group md:border-slate-200 md:shadow-[0_2px_10px_rgba(15,23,42,0.06)] md:hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] md:transition-shadow",
                    quantity > 0 && "kk-in-cart"
                )}
            >
                {/* Image Area */}
                <div
                    className={cn("relative w-full aspect-square md:aspect-[4/3] overflow-hidden cursor-pointer", imgLoaded ? "bg-slate-50/50" : "kk-shimmer")}
                    onClick={() => navigate(`/product/${productId}`)}
                >
                    <img
                        src={productImage}
                        alt={product.name}
                        loading="lazy" decoding="async"
                        onLoad={() => setImgLoaded(true)}
                        className={cn("kk-press-img absolute inset-0 h-full w-full object-cover", imgLoaded ? "opacity-100" : "opacity-0")}
                        onError={(e) => { setImgLoaded(true); e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }}
                    />
                    
                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
                        {product.dietaryType && (
                            <div className={cn(
                                "w-3.5 h-3.5 border flex items-center justify-center rounded-[2px] bg-white shadow-sm pointer-events-auto",
                                (product.dietaryType === 'veg' || product.dietaryType === 'none') ? "border-emerald-500" : "border-red-500"
                            )}>
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    (product.dietaryType === 'veg' || product.dietaryType === 'none') ? "bg-emerald-500" : "bg-red-500"
                                )} />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleWishlist(e); }}
                            aria-label={isLoved ? "Remove from my list" : "Save to my list"}
                            className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-sm active:scale-90 transition-all pointer-events-auto"
                        >
                            <Heart key={isLoved ? 'loved' : 'not'} size={15} className={cn(isLoved ? "kk-pop fill-red-500 text-red-500" : "text-slate-300")} />
                        </button>
                    </div>

                    {/* Bottom badges: real discount, admin-set best rate, and in-cart tick */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1 pointer-events-none">
                        <div className="flex flex-col items-start gap-1">
                            {discountPercent > 0 && (
                                <div className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm tracking-tight whitespace-nowrap md:bg-red-600 md:text-[13px] md:font-bold md:px-2.5 md:py-1 md:rounded-full">
                                    {discountPercent}% OFF
                                </div>
                            )}
                            {/* One badge at a time so the photo stays visible: a real discount wins */}
                            {discountPercent <= 0 && Number(product.bestPrice) > 0 && (
                                <div className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase tracking-tighter whitespace-nowrap">
                                    Best Rate
                                </div>
                            )}
                        </div>
                        {quantity > 0 && (
                            <div className="kk-pop shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white shadow-md ring-2 ring-white" aria-label="In your cart">
                                <Check size={13} strokeWidth={3.5} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-2.5 flex flex-col flex-1 gap-1.5 md:p-4 md:gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => navigate(`/product/${productId}`)}>
                        <h3 className="text-[13px] font-bold text-slate-800 leading-tight line-clamp-2 tracking-tight group-hover:text-emerald-700 group-active:text-emerald-700 transition-colors md:text-[17px] md:font-semibold md:text-slate-900 md:tracking-normal">
                            <HighlightText text={product.name} query={highlight} />
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 md:text-[14px] md:font-medium md:text-slate-500 md:mt-1">
                            {product.unitValue} {product.unit}
                        </p>
                    </div>

                    {/* Bottom Row: Price & Add */}
                    {/* Once in the cart, the quantity control gets its own full-width row so it never
                        overflows narrow cards */}
                    <div className={cn("mt-auto pt-1 flex gap-2", quantity > 0 ? "flex-col" : "items-center justify-between")}>
                        <div className={cn("flex min-w-0", quantity > 0 ? "items-baseline gap-1.5" : "flex-col")}>
                            <span className={cn("text-[15px] font-black text-slate-900 leading-none md:text-[22px] md:font-bold", hasComparePrice && "md:text-red-600")}>₹{displayPrice}</span>
                            {hasComparePrice && (
                                <span className={cn("text-[10px] text-slate-400 line-through font-bold md:text-[14px] md:font-medium md:text-slate-500", quantity > 0 ? "" : "mt-0.5")}>₹{strikePrice}</span>
                            )}
                        </div>

                        <div className={cn(quantity > 0 ? "w-full" : "shrink-0")} onClick={(e) => e.stopPropagation()}>
                            <AnimatePresence mode="wait">
                                {quantity === 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleAddToCart}
                                        className="size-9 rounded-xl bg-emerald-600 text-white shadow-[0_6px_14px_-6px_rgba(5,150,105,0.7)] hover:bg-emerald-700 active:scale-90 transition-all flex items-center justify-center p-0 md:size-auto md:h-11 md:px-4 md:gap-2 md:bg-white md:text-green-700 md:border-2 md:border-green-700 md:shadow-none md:hover:bg-green-700 md:hover:text-white md:text-[16px] md:font-bold"
                                        aria-label="Add to cart"
                                    >
                                        <Plus size={16} strokeWidth={3} className="md:hidden" />
                                        <ShoppingCart size={18} strokeWidth={2.5} className="hidden md:block" />
                                        <span className="hidden md:inline">Add</span>
                                    </button>
                                ) : (
                                    <div className="kk-pop flex w-full items-center justify-between bg-emerald-600 rounded-xl text-white shadow-[0_6px_14px_-6px_rgba(5,150,105,0.7)] overflow-hidden md:bg-green-700">
                                        <button
                                            type="button"
                                            onClick={handleDecrement}
                                            aria-label="Remove one"
                                            className="h-9 w-10 shrink-0 flex items-center justify-center p-0 hover:bg-black/10 active:bg-black/20 transition-colors"
                                        >
                                            <Minus size={14} strokeWidth={3} />
                                        </button>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={localQuantity}
                                            onChange={handleQuantityInput}
                                            onBlur={handleBlur}
                                            aria-label="Quantity"
                                            className="text-[13px] font-black min-w-0 flex-1 text-center bg-transparent border-none text-white focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleIncrement}
                                            aria-label="Add one"
                                            className="h-9 w-10 shrink-0 flex items-center justify-center p-0 hover:bg-black/10 active:bg-black/20 transition-colors"
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
            </motion.div>

            {/* Desktop Quantity Modal */}
            {pickerMounted && !isMobile && (
                <QuantityModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    product={product}
                    onAdd={(prod, qty) => addToCart(prod, qty)}
                />
            )}

            {/* Mobile Quantity Sheet */}
            {pickerMounted && isMobile && (
                <MobileQuantitySheet
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    product={product}
                    onAdd={(prod, qty) => addToCart(prod, qty)}
                />
            )}
        </>
    )
}
