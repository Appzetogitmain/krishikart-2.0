import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, ShoppingCart, Plus, Minus, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '../../contexts/CartContext'
import { useWishlist } from '../../contexts/WishlistContext'
import { cn } from '@/lib/utils'
import QuantityModal from './QuantityModal'
import MobileQuantitySheet from './MobileQuantitySheet'
import { useRequireAuth } from '../../hooks/useRequireAuth'

export default function ProductCard({ product, layout = 'grid' }) {
    const navigate = useNavigate()
    const { cartItems, addToCart, updateQuantity, removeFromCart, setQuantity } = useCart()
    const { toggleWishlist, isWishlisted } = useWishlist()
    const { requireAuth } = useRequireAuth()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [addAreaActive, setAddAreaActive] = useState(false)
    const [localQuantity, setLocalQuantity] = useState('')

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
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
    const isLoved = isWishlisted(productId)
    const productImage = product.primaryImage || product.image

    const handleAddToCart = requireAuth((e) => {
        e.stopPropagation()
        setIsModalOpen(true)
    })

    const handleWishlist = requireAuth((e) => {
        e.stopPropagation()
        toggleWishlist(product)
    })

    const handleIncrement = requireAuth((e) => {
        e.stopPropagation()
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
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => navigate(`/product/${productId}`)}
                    className="bg-white rounded-2xl p-1.5 border border-slate-100 flex gap-2 h-[94px] items-center group cursor-pointer shadow-sm hover:shadow-md transition-all duration-150 active:scale-[0.98] overflow-hidden md:rounded-xl md:border-slate-200 md:shadow-none md:hover:shadow-sm md:active:scale-100"
                >
                    <div className="relative w-[76px] h-[76px] rounded-[16px] overflow-hidden shrink-0 bg-slate-50 md:rounded-lg">
                        <img
                            src={productImage}
                            alt={product.name}
                            className="absolute inset-0 h-full w-full object-cover object-center"
                            draggable={false}
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }}
                        />
                        <button
                            onClick={handleWishlist}
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-400 shadow-sm"
                        >
                            <Heart size={12} fill={isLoved ? "currentColor" : "none"} className={isLoved ? "text-red-500" : ""} />
                        </button>
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight line-clamp-1 md:text-sm md:font-bold md:normal-case md:tracking-normal">{product.name}</h3>
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
                </motion.div>
                {/* Desktop Quantity Modal */}
                {!isMobile && (
                    <QuantityModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        product={product}
                        onAdd={(prod, qty) => addToCart(prod, qty)}
                    />
                )}
                {/* Mobile Quantity Sheet */}
                {isMobile && (
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
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="relative bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 transition-all duration-300 overflow-hidden flex flex-col h-full group hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
            >
                {/* Image Area */}
                <div 
                    className="relative w-full aspect-square bg-slate-50/50 overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/product/${productId}`)}
                >
                    <img
                        src={productImage}
                        alt={product.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }}
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
                            className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-90 transition-all pointer-events-auto"
                        >
                            <Heart size={14} className={isLoved ? "fill-red-500 text-red-500" : "text-slate-300"} />
                        </button>
                    </div>

                    {/* Best Price Overlay (Optional, if we want it on image) */}
                    {(product.bestPrice || displayPrice) && (
                        <div className="absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase tracking-tighter">
                            Best Rate
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-2.5 flex flex-col flex-1 gap-1.5">
                    <div className="flex-1 cursor-pointer" onClick={() => navigate(`/product/${productId}`)}>
                        <h3 className="text-[13px] font-bold text-slate-800 leading-tight line-clamp-2 tracking-tight group-hover:text-emerald-700 transition-colors">
                            {product.name}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {product.unitValue} {product.unit}
                        </p>
                    </div>

                    {/* Bottom Row: Price & Add */}
                    <div className="mt-auto pt-1 flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                            <span className="text-[15px] font-black text-slate-900 leading-none">₹{displayPrice}</span>
                            {hasComparePrice && (
                                <span className="text-[10px] text-slate-400 line-through font-bold mt-0.5">₹{strikePrice}</span>
                            )}
                        </div>

                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <AnimatePresence mode="wait">
                                {quantity === 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleAddToCart}
                                        className="size-8 rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center p-0"
                                        aria-label="Add to cart"
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                    </button>
                                ) : (
                                    <div className="inline-flex items-center bg-emerald-600 rounded-lg text-white shadow-sm overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={handleDecrement}
                                            className="size-8 flex items-center justify-center p-0 hover:bg-black/10 transition-colors"
                                        >
                                            <Minus size={12} strokeWidth={3} />
                                        </button>
                                        <input
                                            type="number"
                                            value={localQuantity}
                                            onChange={handleQuantityInput}
                                            onBlur={handleBlur}
                                            className="text-[11px] font-black w-5 text-center bg-transparent border-none text-white focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleIncrement}
                                            className="size-8 flex items-center justify-center p-0 hover:bg-black/10 transition-colors"
                                        >
                                            <Plus size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Desktop Quantity Modal */}
            {!isMobile && (
                <QuantityModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    product={product}
                    onAdd={(prod, qty) => addToCart(prod, qty)}
                />
            )}

            {/* Mobile Quantity Sheet */}
            {isMobile && (
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
