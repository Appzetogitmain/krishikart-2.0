import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'

/**
 * Mobile-only bar that floats above the bottom navigation as soon as the cart has
 * something in it: item count, running total and a one-tap "View Cart".
 */
export default function FloatingCartBar() {
    const navigate = useNavigate()
    const { cartItems, cartTotal } = useCart()
    const [keyboardOpen, setKeyboardOpen] = useState(false)

    // Hide while the on-screen keyboard is open (same rule as the bottom navigation)
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return
        const handleResize = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75)
        vv.addEventListener('resize', handleResize)
        return () => vv.removeEventListener('resize', handleResize)
    }, [])

    const itemCount = cartItems.length
    const visible = itemCount > 0 && !keyboardOpen

    // Sit just above the bottom navigation, whatever height it actually renders at
    const [navHeight, setNavHeight] = useState(76)
    useEffect(() => {
        if (!visible) return
        const nav = document.getElementById('kk-bottom-nav')
        if (!nav) return
        const measure = () => setNavHeight(Math.ceil(nav.getBoundingClientRect().height))
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(nav)
        return () => observer.disconnect()
    }, [visible])

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="md:hidden fixed left-0 right-0 z-40 px-3 pointer-events-none"
                    style={{ bottom: navHeight + 8 }}
                >
                    <button
                        type="button"
                        onClick={() => navigate('/cart')}
                        className="pointer-events-auto w-full max-w-md mx-auto flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white pl-3 pr-4 py-2.5 shadow-[0_14px_30px_-10px_rgba(5,150,105,0.75)] active:scale-[0.98] transition-transform"
                        aria-label={`View cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                    >
                        <span className="flex items-center gap-3 min-w-0">
                            <span className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 shrink-0">
                                <ShoppingBag size={18} strokeWidth={2.2} />
                                <span key={itemCount} className="kk-pop absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-emerald-700 text-[10px] font-black leading-none flex items-center justify-center shadow-sm">
                                    {itemCount > 99 ? '99+' : itemCount}
                                </span>
                            </span>
                            <span className="flex flex-col items-start min-w-0">
                                <span className="text-[11px] font-semibold text-emerald-50 leading-tight">
                                    {itemCount} {itemCount === 1 ? 'item' : 'items'} in cart
                                </span>
                                <span className="text-base font-black leading-tight tabular-nums">
                                    ₹{Number(cartTotal || 0).toLocaleString('en-IN')}
                                </span>
                            </span>
                        </span>
                        <span className="flex items-center gap-1 text-sm font-black shrink-0">
                            View Cart <ChevronRight size={16} strokeWidth={3} />
                        </span>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
