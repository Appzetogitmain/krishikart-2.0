import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import BottomNav from '../components/layout/BottomNav'
import FloatingCartBar from '../components/layout/FloatingCartBar'
import DesktopNavbar from '../components/layout/DesktopNavbar'
import Breadcrumbs from '../components/layout/Breadcrumbs'
import DesktopFooter from '../components/layout/DesktopFooter'
import { useUserAuth } from '../contexts/UserAuthContext'
import { useCart } from '../contexts/CartContext'
import CreditOverdueModal from '../components/modals/CreditOverdueModal'

export default function AppLayout() {
    const location = useLocation()
    const { user } = useUserAuth()
    const { cartItems } = useCart()

    const isCreditOverdue = useMemo(() => {
        if (!user || !user.usedCredit || user.usedCredit <= 0 || !user.creditOverdueDate) return false;
        return new Date() > new Date(user.creditOverdueDate);
    }, [user])

    // Scroll to top on route change
    useEffect(() => {
        // Scroll the app shell, not the window
        const root = document.querySelector('.user-app-theme')
        if (root) {
            root.scrollTo(0, 0)
        } else if (typeof window !== 'undefined') {
            window.scrollTo(0, 0)
        }
    }, [location.pathname])


    const isHomeScreen = location.pathname === '/home'

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

            <main className="w-full max-w-md mx-auto min-h-screen bg-background md:bg-white shadow-[0_0_20px_rgba(0,0,0,0.03)] md:shadow-none md:max-w-none md:mx-0 relative md:pt-24">
                {/* Breadcrumbs for Desktop - Hidden on Home */}
                {!isHomeScreen && (
                    <div className="max-w-7xl mx-auto px-8 hidden md:block">
                        <Breadcrumbs />
                    </div>
                )}

                <AnimatePresence mode="wait">
                    <Outlet key={location.pathname} />
                </AnimatePresence>
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
