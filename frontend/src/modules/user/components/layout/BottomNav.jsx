import { ShoppingBasket, Heart, ShoppingBag, UserCircle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '../../../../lib/utils'
import { useWishlist } from '../../contexts/WishlistContext'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { useEffect, useState } from 'react'

const navItems = [
    { icon: ShoppingBasket, label: 'Shop', path: '/home', secure: false },
    { icon: Heart, label: 'My list', path: '/wishlist', key: 'wishlist', secure: true },
    { icon: ShoppingBag, label: 'Orders', path: '/orders', secure: true },
    { icon: UserCircle, label: 'Account', path: '/profile', secure: true }
]

export default function BottomNav() {
    const navigate = useNavigate()
    const location = useLocation()
    const { wishlistCount } = useWishlist()
    const { requireAuth } = useRequireAuth()
    const [keyboardOpen, setKeyboardOpen] = useState(false)

    // Hide bottom nav when soft keyboard is open (visual viewport shrinks)
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return

        const handleResize = () => {
            // If visual viewport height is significantly less than window height, keyboard is open
            const threshold = window.innerHeight * 0.75
            setKeyboardOpen(vv.height < threshold)
        }

        vv.addEventListener('resize', handleResize)
        return () => vv.removeEventListener('resize', handleResize)
    }, [])

    if (keyboardOpen) return null

    return (
        <nav id="kk-bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t-2 border-[var(--color-brand-primary)]/20 flex items-center justify-around min-h-[52px] py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-2px_16px_rgba(22,163,74,0.08)]">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path
                const Icon = item.icon

                return (
                    <button
                        key={item.label}
                        onClick={() => {
                            if (item.secure) {
                                requireAuth(() => navigate(item.path))()
                            } else {
                                navigate(item.path)
                            }
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 min-h-[44px] min-w-[44px] transition-all duration-150 active:scale-95"
                    >
                        <div className={cn(
                            "relative flex items-center justify-center rounded-full p-1.5 transition-colors duration-200",
                            isActive && "bg-[var(--color-brand-primary)]/15 bottom-nav-icon-active"
                        )}>
                            <Icon
                                size={isActive ? 20 : 18}
                                className={cn(
                                    "transition-colors duration-200",
                                    isActive ? "text-primary" : "text-slate-400"
                                )}
                                strokeWidth={1.5}
                            />
                            {item.key === 'wishlist' && wishlistCount > 0 && (
                                <span key={wishlistCount} className="kk-pop absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] leading-none font-black rounded-full flex items-center justify-center border border-white">
                                    {wishlistCount > 99 ? '99+' : wishlistCount}
                                </span>
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] font-medium transition-colors duration-200 leading-tight",
                            isActive ? "text-primary" : "text-slate-400"
                        )}>
                            {item.label}
                        </span>
                    </button>
                )
            })}
        </nav>
    )
}
