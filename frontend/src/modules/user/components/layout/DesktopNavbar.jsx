import { useState, useEffect } from 'react'
import { useNavigate, useLocation as useRouteLocation, Link } from 'react-router-dom'
import { Search, Heart, ShoppingCart, MapPin, Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../../contexts/CartContext'
import { useWishlist } from '../../contexts/WishlistContext'
import { useLocation } from '../../contexts/LocationContext'
import { useUserNotifications } from '../../contexts/UserNotificationsContext'
import { cn } from '@/lib/utils'
import MobileProfileDrawer from './MobileProfileDrawer'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { getReadableLocationError } from '@/lib/geo'
import LocationActionPopup from '../common/LocationActionPopup'
import api from '@/lib/axios'

const PLACEHOLDERS = [
    "Search 'Spring Caps'",
    "Search 'Fresh Apples'",
    "Search 'Organic Spinach'",
    "Search 'Alphonso Mango'",
    "Search 'Red Bell Peppers'"
]

export default function DesktopNavbar() {
    const navigate = useNavigate()
    const { cartCount } = useCart()
    const { wishlistCount } = useWishlist()
    const { address, updateFranchiseLocation, setPinnedFranchiseLocation, loading } = useLocation()
    const { unreadCount } = useUserNotifications()

    const [index, setIndex] = useState(0)
    const routeLocation = useRouteLocation()
    const urlParams = new URLSearchParams(routeLocation.search)
    const [searchValue, setSearchValue] = useState(urlParams.get('search') || "")
    const [isScrolled, setIsScrolled] = useState(false)
    const [showLocationPopup, setShowLocationPopup] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showOverlay, setShowOverlay] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        }, 3000)

        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10)
        }
        window.addEventListener('scroll', handleScroll)

        return () => {
            clearInterval(interval)
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    const debouncedSearch = useDebounce(searchValue, 300)
    // routeLocation already declared above

    useEffect(() => {
        const fetchResults = async () => {
            if (!debouncedSearch.trim()) {
                setSearchResults([])
                setShowOverlay(false)
                return
            }

            setIsSearching(true)
            try {
                const response = await api.get('/products', {
                    params: { 
                        search: debouncedSearch.trim(),
                        showOnStorefront: true,
                        limit: 8
                    }
                })
                if (response.data.success) {
                    setSearchResults(response.data.results)
                    setShowOverlay(true)
                }
            } catch (error) {
                console.error('Search overlay error:', error)
            } finally {
                setIsSearching(false)
            }
        }

        const currentPath = routeLocation.pathname
        if (debouncedSearch.trim()) {
            if (currentPath.startsWith('/products/') || currentPath.startsWith('/search')) {
                // If already on product list or search page, keep live URL sync
                const targetPath = currentPath
                const currentSearch = new URLSearchParams(routeLocation.search).get('search') || ""
                if (debouncedSearch.trim() !== currentSearch) {
                    navigate(`${targetPath}${targetPath.includes('?') ? '&' : '?'}search=${encodeURIComponent(debouncedSearch.trim())}`)
                }
            } else {
                // On Home or other pages, fetch for overlay instead of redirecting
                fetchResults()
            }
        } else {
            setSearchResults([])
            setShowOverlay(false)
            if (currentPath.startsWith('/products/') || currentPath.startsWith('/search')) {
                const targetPath = currentPath
                navigate(targetPath)
            }
        }
    }, [debouncedSearch, navigate, routeLocation.pathname, routeLocation.search])

    const handleSearchChange = (e) => {
        setSearchValue(e.target.value)
    }

    const handleUseCurrentLocation = async () => {
        toast.info("Finding your location...")
        try {
            if (typeof updateFranchiseLocation !== 'function') {
                toast.error("Location service is unavailable right now.")
                return
            }
            await updateFranchiseLocation(true)
            setShowLocationPopup(false)
            toast.success("Location updated successfully!")
        } catch (error) {
            toast.error(getReadableLocationError(error))
        }
    }

    return (
        <nav className={cn(
            "w-full bg-white transition-all duration-300 border-b border-slate-100 z-50 sticky top-0",
            isScrolled ? "shadow-sm" : ""
        )}>
            {/* Main Navbar */}
            <div className="max-w-[1440px] mx-auto px-6 h-[72px] flex items-center justify-between gap-4">
                {/* Logo Section */}
                <div className="flex items-center gap-6 shrink-0">
                    <div
                        onClick={() => navigate('/home')}
                        className="cursor-pointer group"
                    >
                        <div className="flex flex-col leading-none">
                            <img src="/logo.png" alt="Kisaan Kart" className="h-[64px] scale-[1.4] w-auto object-contain origin-left" />

                        </div>
                    </div>

                    {/* Delivery Info */}
                    <div
                        onClick={() => setShowLocationPopup(true)}
                        className="hidden lg:flex items-center gap-2.5 cursor-pointer group hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-all"
                    >
                        <div className={cn(
                            "w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-teal-600 transition-colors group-hover:bg-teal-100",
                            loading && "animate-pulse"
                        )}>
                            <MapPin size={18} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col max-w-[150px]">
                            <span className="text-[14px] font-bold text-slate-900 leading-tight">Delivery tomorrow</span>
                            <span className="text-[12px] font-medium text-slate-400 leading-tight truncate">
                                {loading ? "Fetching..." : (address || "Set Location")}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 max-w-2xl px-4">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!searchValue.trim()) return;
                            
                            const currentPath = routeLocation.pathname
                            const targetBase = (currentPath.startsWith('/products/') || currentPath.startsWith('/search')) 
                                ? currentPath 
                                : '/search'
                            
                            navigate(`${targetBase}?search=${encodeURIComponent(searchValue.trim())}`);
                            setShowOverlay(false);
                        }}
                        className="relative group"
                    >
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 z-10">
                            <Search size={18} strokeWidth={2.5} />
                        </div>
                        <input
                            type="text"
                            value={searchValue}
                            onChange={handleSearchChange}
                            placeholder=""
                            className="w-full h-[44px] pl-12 pr-4 bg-slate-50/50 border border-slate-100 rounded-full text-[14px] font-medium placeholder:text-slate-400 focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-100 transition-all outline-none"
                        />
                        {!searchValue && (
                            <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[14px] font-medium">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={index}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {PLACEHOLDERS[index]}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                        )}
                    </form>

                    {/* Desktop Search Results Overlay */}
                    <AnimatePresence>
                        {showOverlay && searchValue.trim() && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-4 right-4 mt-2 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] max-h-[480px] flex flex-col"
                            >
                                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                    <span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                                        {isSearching ? 'Searching...' : `Found ${searchResults.length} matches`}
                                    </span>
                                    {isSearching && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />}
                                </div>

                                <div className="overflow-y-auto no-scrollbar py-2">
                                    {searchResults.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-1 p-2">
                                            {searchResults.map((product) => (
                                                <div
                                                    key={product._id}
                                                    onClick={() => {
                                                        navigate(`/product/${product._id}`)
                                                        setShowOverlay(false)
                                                        setSearchValue('')
                                                    }}
                                                    className="p-3 flex items-center gap-3 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer group"
                                                >
                                                    <div className="w-14 h-14 rounded-lg bg-slate-50 overflow-hidden shrink-0 border border-slate-100 group-hover:border-emerald-200">
                                                        <img src={product.primaryImage || product.image} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700">{product.name}</p>
                                                        <p className="text-[11px] font-medium text-slate-400">₹{product.effectiveStorefrontPrice || product.price} / {product.unitValue} {product.unit}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : !isSearching && (
                                        <div className="py-12 text-center">
                                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                                                <Search size={20} className="text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-400">No products found for "{searchValue}"</p>
                                        </div>
                                    )}
                                </div>

                                {searchResults.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const targetPath = routeLocation.pathname.startsWith('/products/') ? routeLocation.pathname : '/products/all'
                                            navigate(`${targetPath}?search=${encodeURIComponent(searchValue.trim())}`)
                                            setShowOverlay(false)
                                        }}
                                        className="w-full py-4 bg-emerald-500 text-white text-[14px] font-bold hover:bg-emerald-600 transition-colors shadow-inner"
                                    >
                                        View all results
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Wishlist */}
                    <button
                        onClick={() => navigate('/wishlist')}
                        className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-rose-500 transition-all group relative active:scale-95"
                    >
                        <Heart size={20} className={cn(wishlistCount > 0 && "fill-rose-500 text-rose-500")} strokeWidth={2.5} />
                        {wishlistCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                                {wishlistCount}
                            </span>
                        )}
                    </button>

                    {/* Notifications */}
                    <button
                        onClick={() => navigate('/notifications')}
                        aria-label="Notifications"
                        className="relative w-11 h-11 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
                    >
                        <Bell size={20} strokeWidth={2.5} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Cart */}
                    <button
                        onClick={() => navigate('/cart')}
                        className="relative w-11 h-11 flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:translate-y-[-1px] transition-all group active:scale-95"
                    >
                        <ShoppingCart size={20} strokeWidth={2.5} />
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[23px] h-[23px] px-1.5 bg-black text-white text-[11px] leading-none font-black rounded-full flex items-center justify-center border-2 border-white">
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                    </button>

                    {/* Profile Drawer */}
                    <MobileProfileDrawer />
                </div>
            </div>
            <LocationActionPopup
                isOpen={showLocationPopup}
                loading={loading}
                onClose={() => setShowLocationPopup(false)}
                onUseCurrentLocation={handleUseCurrentLocation}
                onManualLocationSelect={async (locationData) => {
                    await setPinnedFranchiseLocation(locationData)
                }}
            />
        </nav>
    )
}
