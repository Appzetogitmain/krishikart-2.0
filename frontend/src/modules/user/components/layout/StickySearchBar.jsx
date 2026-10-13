import { Search, MapPin, ShoppingCart, Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation as useRouteLocation } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useLocation } from '../../contexts/LocationContext'
import { useUserNotifications } from '../../contexts/UserNotificationsContext'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { getReadableLocationError } from '@/lib/geo'
import LocationActionPopup from '../common/LocationActionPopup'
import api from '@/lib/axios'

const PLACEHOLDERS = [
    "Fresh Apples",
    "Organic Spinach",
    "Alphonso Mango",
    "Red Bell Peppers",
    "Fresh Cilantro",
    "Broccoli"
]

export default function StickySearchBar() {
    const navigate = useNavigate()
    const { address, updateFranchiseLocation, setPinnedFranchiseLocation, loading } = useLocation()
    const { cartCount } = useCart()
    const { unreadCount } = useUserNotifications()

    const [index, setIndex] = useState(0)
    const routeLocation = useRouteLocation()
    const searchParams = new URLSearchParams(routeLocation.search)
    const [searchValue, setSearchValue] = useState(searchParams.get('search') || "")
    const [isMobile, setIsMobile] = useState(false)
    const [showLocationPopup, setShowLocationPopup] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showOverlay, setShowOverlay] = useState(false)

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [])
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const debouncedSearch = useDebounce(searchValue, 300)
    // useDebounce is imported at the top

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
                        limit: 6
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

    const topSection = (
        <div className="relative flex items-center justify-between gap-2 min-w-0 w-full">
            {/* Left: logo + location */}
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2 -mt-3">
                <img
                    src="/logo.png"
                    alt="kisaankart"
                    className="h-14 w-auto shrink-0 object-contain"
                />
                <button
                    onClick={() => setShowLocationPopup(true)}
                    className={`flex items-center gap-1.5 min-w-0 max-w-full cursor-pointer active:scale-95 transition-all min-h-[38px] ${loading ? 'opacity-50' : ''} text-slate-900`}
                >
                    <MapPin size={16} strokeWidth={2.5} className={`shrink-0 ${loading ? 'animate-pulse' : ''}`} />
                    <div className="flex flex-col min-w-0 max-w-full text-left">
                        <span className="text-[11px] font-bold text-slate-900 leading-tight">Delivery tomorrow</span>
                        <span className="text-[10px] font-medium text-slate-400 leading-tight truncate">
                            {loading ? "Locating..." : (address || "Set Location")}
                        </span>
                    </div>
                </button>
            </div>
            {/* Right: notifications + cart */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => navigate('/notifications')}
                    className="relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-white/30 border border-white/50 shadow-md text-slate-900 active:scale-95 transition-all"
                    aria-label="Notifications"
                >
                    <Bell size={16} className="w-[16px] h-[16px]" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] leading-none font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => navigate('/cart')}
                    className="relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-white/30 border border-white/50 shadow-md text-slate-900 active:scale-95 transition-all"
                >
                    <ShoppingCart size={16} className="w-[16px] h-[16px]" />
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] leading-none font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            {cartCount > 99 ? '99+' : cartCount}
                        </span>
                    )}
                </button>
            </div>
        </div>
    )

    return (
        <div className="bg-[var(--color-brand-subtle)] md:bg-transparent">
            {/* Fixed header + search overlay – always stays at top of viewport */}
            <motion.div className="fixed top-0 left-0 right-0 z-40 overflow-visible bg-[var(--color-brand-subtle)] md:bg-transparent md:overflow-hidden">
                <motion.div className="overflow-hidden bg-[var(--color-brand-subtle)] md:bg-white px-3 pt-2.5 pb-2.5 md:px-4 md:py-3.5 md:space-y-3 border-b-0 md:border-b md:border-slate-100/80 md:shadow-none">
                    {/* Shimmer – mobile only (search bar); desktop has full header */}
                    <div
                        aria-hidden
                        className="absolute inset-0 w-full min-w-full pointer-events-none md:hidden header-shimmer"
                        style={{
                            background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)',
                            left: 0,
                            right: 0,
                        }}
                    />
                    <div className="mb-2 md:mb-3">
                        {topSection}
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!searchValue.trim()) return;

                            const currentPath = routeLocation.pathname
                            // Use /search for searches from home/other pages, or stay on current products/search page
                            const targetBase = (currentPath.startsWith('/products/') || currentPath.startsWith('/search'))
                                ? currentPath
                                : '/search'

                            navigate(`${targetBase}?search=${encodeURIComponent(searchValue.trim())}`);
                            setShowOverlay(false);
                        }}
                        className="relative group overflow-hidden"
                    >
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 md:left-4 md:text-primary">
                            <Search size={16} strokeWidth={2.5} className="md:w-[18px] md:h-[18px]" />
                        </div>
                        <div className="relative w-full">
                            <input
                                type="text"
                                value={searchValue}
                                onChange={handleSearchChange}
                                className="w-full h-11 pl-9 pr-3 md:h-14 md:pl-12 md:pr-4 bg-white md:bg-slate-50 border border-white/30 md:border-none rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none shadow-sm"
                            />
                            {!searchValue && (
                                <div className="absolute left-9 top-1/2 -translate-y-1/2 pointer-events-none w-full h-full flex items-center md:left-12">
                                    <span className="text-slate-400 text-xs font-medium md:text-sm flex items-center">
                                        <span>Search&nbsp;‘</span>
                                        <AnimatePresence mode="wait">
                                            <motion.span
                                                key={index}
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -20, opacity: 0 }}
                                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                            >
                                                {PLACEHOLDERS[index]}
                                            </motion.span>
                                        </AnimatePresence>
                                        <span>’</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </form>

                    {/* Search Results Overlay */}
                    <AnimatePresence>
                        {showOverlay && searchValue.trim() && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-2 mx-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 max-h-[70vh] flex flex-col"
                            >
                                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        {isSearching ? 'Searching...' : `Found ${searchResults.length} results`}
                                    </span>
                                    {isSearching && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />}
                                </div>

                                <div className="overflow-y-auto no-scrollbar py-2">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((product) => (
                                            <div
                                                key={product._id}
                                                onClick={() => {
                                                    navigate(`/product/${product._id}`)
                                                    setShowOverlay(false)
                                                    setSearchValue('')
                                                }}
                                                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                                            >
                                                <div className="w-12 h-12 rounded-lg bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                                                    <img src={product.primaryImage || product.image} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                                                    <p className="text-[10px] font-medium text-slate-400">₹{product.effectiveStorefrontPrice || product.price} • {product.unitValue} {product.unit}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : !isSearching && (
                                        <div className="py-8 text-center">
                                            <p className="text-sm font-medium text-slate-400">No products found</p>
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
                                        className="w-full py-3.5 bg-slate-50 text-primary text-[13px] font-bold border-t border-slate-100 hover:bg-slate-100 transition-colors"
                                    >
                                        See all results
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Overlay Backdrop */}
                    {showOverlay && (
                        <div
                            className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-30"
                            onClick={() => setShowOverlay(false)}
                        />
                    )}
                </motion.div>
            </motion.div>
            <LocationActionPopup
                isOpen={showLocationPopup}
                loading={loading}
                onClose={() => setShowLocationPopup(false)}
                onUseCurrentLocation={handleUseCurrentLocation}
                onManualLocationSelect={async (locationData) => {
                    await setPinnedFranchiseLocation(locationData)
                }}
            />
        </div>
    )
}
