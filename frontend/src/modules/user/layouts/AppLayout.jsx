import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { useEffect, useMemo, useRef } from 'react'
import BottomNav from '../components/layout/BottomNav'
import FloatingCartBar from '../components/layout/FloatingCartBar'
import DesktopNavbar from '../components/layout/DesktopNavbar'
import Breadcrumbs from '../components/layout/Breadcrumbs'
import DesktopFooter from '../components/layout/DesktopFooter'
import { useUserAuth } from '../contexts/UserAuthContext'
import { useCart } from '../contexts/CartContext'
import CreditOverdueModal from '../components/modals/CreditOverdueModal'

// Where the customer had scrolled to on Home, so "back" returns them there
let homeScrollTop = 0

export default function AppLayout() {
    const location = useLocation()
    const navigationType = useNavigationType()
    const pathRef = useRef(location.pathname)
    pathRef.current = location.pathname
    const { user } = useUserAuth()
    const { cartItems } = useCart()

    const isCreditOverdue = useMemo(() => {
        if (!user || !user.usedCredit || user.usedCredit <= 0 || !user.creditOverdueDate) return false;
        return new Date() > new Date(user.creditOverdueDate);
    }, [user])

    // Scroll to top on route change. Coming BACK to Home (e.g. from a product page) returns to
    // where the customer was instead of jumping to the top.
    useEffect(() => {
        // Scroll the app shell, not the window
        const root = document.querySelector('.user-app-theme')
        if (!root) {
            if (typeof window !== 'undefined') window.scrollTo(0, 0)
            return
        }
        const isHome = location.pathname === '/home'
        const savedTop = isHome && navigationType === 'POP' ? homeScrollTop : 0
        root.scrollTo(0, savedTop)
        if (!isHome) return
        // Only remember positions while Home is really the page on screen: when Home is being
        // replaced, the shrinking page fires a scroll event that must not overwrite the value.
        const remember = () => { if (pathRef.current === '/home') homeScrollTop = root.scrollTop }
        const frame = requestAnimationFrame(() => {
            if (savedTop > 0) root.scrollTo(0, savedTop)
            root.addEventListener('scroll', remember, { passive: true })
        })
        return () => {
            cancelAnimationFrame(frame)
            root.removeEventListener('scroll', remember)
        }
    }, [location.pathname])


    const isHomeScreen = location.pathname === '/home'
    // Desktop pages redesigned on a light grey background (client mockups, Oct 2026): the
    // breadcrumb strip matches them and lines up with their wider content
    const isGreyPage = ['/cart', '/notifications', '/checkout', '/orders', '/order-detail/', '/track-order/'].some(path => location.pathname.startsWith(path))

    const hideBottomNav = [
        '/product/',
        '/cart',
        '/checkout',
        '/wallet',
        '/notifications',
        '/favorites',
        '/wishlist',
        '/verification',
        '/help-support',
        '/about',
        '/edit-profile',
        '/address-book',
        '/track-order/',
        '/order-summary/'
    ].some(path => location.pathname.startsWith(path))

    return (
        <div className="user-app-theme h-screen bg-background md:bg-white relative overflow-x-hidden overflow-y-auto overscroll-y-none no-scrollbar">
            {/* Desktop Navigation */}
            <div className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-white">
                <DesktopNavbar />
            </div>

            <main className={`w-full max-w-md mx-auto min-h-screen bg-background ${isGreyPage ? 'md:bg-slate-50' : 'md:bg-white'} shadow-[0_0_20px_rgba(0,0,0,0.03)] md:shadow-none md:max-w-none md:mx-0 relative md:pt-24`}>
                {/* Breadcrumbs for Desktop - Hidden on Home */}
                {!isHomeScreen && (
                    <div className={`${isGreyPage ? 'max-w-[1440px] [&_*]:text-[15px]' : 'max-w-7xl'} mx-auto px-8 hidden md:block`}>
                        <Breadcrumbs />
                    </div>
                )}

                    <Outlet key={location.pathname} />
            </main>

            {/* Extra scroll room on mobile so the floating cart bar never covers the last row */}
            {!hideBottomNav && cartItems.length > 0 && <div className="md:hidden h-20" aria-hidden="true" />}

            {/* Desktop Footer */}
            {!hideBottomNav && <DesktopFooter />}

            {/* Mobile Navigation - Restored to Global Fixed */}
            {!hideBottomNav && (
                <div className="md:hidden">
                    <FloatingCartBar />
                    <BottomNav />
                </div>
            )}

            {/* Strict Credit Overdue Modal */}
            <CreditOverdueModal
                isOpen={isCreditOverdue}
                usedCredit={user?.usedCredit || 0}
                dueDate={user?.creditOverdueDate}
            />
        </div>
    )
}
