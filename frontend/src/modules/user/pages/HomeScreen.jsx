import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles,
    ArrowRight,
    ChevronRight,
    Zap,
    Apple,
    Carrot,
    Leaf,
    Grape,
    Citrus,
    Flower2,
    Sun,
    ShoppingCart,
    Clock,
    ShieldCheck,
    Truck,
    RotateCcw,
    ChevronRight as ChevronRightIcon,
    Timer,
    Flame,
    Gem,
    History,
    Sprout,
    TrendingDown,
    Star,
    Heart,
} from 'lucide-react'
import StickySearchBar from '../components/layout/StickySearchBar'
import PageTransition from '../components/layout/PageTransition'
import ProductCard from '../components/common/ProductCard'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { useLocation } from '../contexts/LocationContext'
import LocationPermissionPopup from '../components/common/LocationPermissionPopup'
import { useFilter } from '../contexts/FilterContext'
import { appendLocationToProductParams, getBrowseLocationParams } from '../utils/storefrontParams'
import ServiceUnavailable from '../components/common/ServiceUnavailable'
import { optimizedImage } from '../utils/optimizedImage'

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches

function CategoryCard({ cat, idx, navigate }) {
    const flipEl = useRef(null)
    const guard = useRef(false)

    const runFlipThenNavigate = () => {
        if (!flipEl.current || guard.current) return
        guard.current = true
        const el = flipEl.current
        const onEnd = () => {
            el.removeEventListener('animationend', onEnd)
            el.classList.remove('category-card-flip')
            guard.current = false
            navigate(`/products/${cat._id}`)
        }
        el.addEventListener('animationend', onEnd, { once: true })
        el.classList.add('category-card-flip')
    }

    const handleTouchStart = () => {
        if (!isMobile()) return
        runFlipThenNavigate()
    }

    const handleClick = () => {
        if (isMobile()) {
            if (!guard.current) runFlipThenNavigate()
        } else {
            navigate(`/products/${cat._id}`)
        }
    }

    return (
        <motion.div
            key={cat._id}
            onClick={handleClick}
            onTouchStart={handleTouchStart}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03, duration: 0.25 }}
            style={{ touchAction: 'manipulation' }}
            className="flex flex-col items-center group cursor-pointer select-none"
        >
            <div
                ref={flipEl}
                className="category-card-flip-target w-full aspect-square rounded-full md:rounded-[24px] bg-[var(--color-brand-subtle)] border-2 border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-2.5 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 relative overflow-hidden group-active:scale-95 p-2 md:bg-[var(--color-brand-subtle)] md:border md:border-slate-50 md:shadow-sm"
                style={{ transformStyle: 'preserve-3d' }}
            >
                <div className="w-full h-full relative z-10 transition-transform duration-500 group-hover:scale-110">
                    <img
                        src={optimizedImage(cat.image, 200)}
                        loading="lazy"
                        decoding="async"
                        alt={cat.name}
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&q=80' }}
                    />
                </div>
            </div>
            <span className="text-[11px] md:text-[13px] font-bold text-slate-800 text-center leading-tight transition-colors group-hover:text-primary line-clamp-2 w-full px-0.5">
                {cat.name}
            </span>
        </motion.div>
    )
}

// Last loaded home data, kept while the app is open so coming back to Home (e.g. from a
// product page) shows instantly; it is still refreshed quietly in the background.
let homeCache = null

export default function HomeScreen() {
    const [categories, setCategories] = useState(() => homeCache?.categories || [])
    const [products, setProducts] = useState(() => homeCache?.products || [])
    const locationCtx = useLocation()
    const { location: userLocation, updateFranchiseLocation, address } = locationCtx
    const [loading, setLoading] = useState(() => !homeCache)
    const [showLocationPopup, setShowLocationPopup] = useState(false)
    const navigate = useNavigate()
    const { vegMode } = useFilter()
    const flashDealsScrollRef = useRef(null)
    const { coords: browseCoords, hasPinned: hasBrowseLocation } = getBrowseLocationParams(locationCtx)
    const isUnsupportedLocation = hasBrowseLocation && !loading && categories.length === 0 && products.length === 0

    const filteredProducts = products.filter(p => {
        if (!vegMode) return true
        return p.dietaryType === 'veg' || p.dietaryType === 'none'
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { coords, hasPinned } = getBrowseLocationParams(locationCtx)
                const prodParams = appendLocationToProductParams(
                    { showOnStorefront: true },
                    { franchiseLocation: coords, hasFranchisePinned: hasPinned }
                )
                const catParams = {}
                if (hasPinned && coords) {
                    catParams.lat = coords.lat
                    catParams.lng = coords.lng
                }
                const [catRes, prodRes] = await Promise.all([
                    api.get('/catalog/categories', { params: catParams }),
                    api.get('/products', { params: prodParams }),
                ])
                if (catRes.data.success) setCategories(catRes.data.results)
                if (prodRes.data.success) setProducts(prodRes.data.results)
                if (catRes.data.success && prodRes.data.success) {
                    homeCache = { categories: catRes.data.results, products: prodRes.data.results }
                }
            } catch (error) {
                console.error('Error in home data initialization:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [
        locationCtx?.deliveryLocation,
        locationCtx?.hasDeliveryPinned,
        locationCtx?.franchiseLocation,
        locationCtx?.hasFranchisePinned,
    ])

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const hasDeclinedLoc = localStorage.getItem('kk_location_declined');
        const isOnboarded = userData.onboardingCompleted || localStorage.getItem('kk_onboarding_completed');
        if (isOnboarded) return;
        if (!userLocation && !hasDeclinedLoc) {
            setShowLocationPopup(true);
        }
    }, [userLocation]);

    const handleAllowLocation = async () => {
        try {
            await updateFranchiseLocation()
            setShowLocationPopup(false)
        } catch (err) {
            console.error('Failed to get location:', err)
        }
    }

    const handleManualLocation = () => {
        setShowLocationPopup(false);
        localStorage.setItem('kk_location_declined', 'true');
    };

    useEffect(() => {
        if (!isMobile()) return;
        const container = flashDealsScrollRef.current;
        if (!container) return;
        const step = 180;
        const intervalMs = 2500;
        const id = setInterval(() => {
            if (!container) return;
            const { scrollLeft, scrollWidth, clientWidth } = container;
            const maxScroll = scrollWidth - clientWidth;
            if (maxScroll <= 0) return;
            const next = scrollLeft + step;
            if (next >= maxScroll - 4) {
                container.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                container.scrollTo({ left: next, behavior: 'smooth' });
            }
        }, intervalMs);
        return () => clearInterval(id);
    }, []);

    return (
        <>
            <div className="md:hidden">
                <StickySearchBar />
            </div>
            <PageTransition>
                {isUnsupportedLocation ? (
                    <div className="min-h-screen bg-white pt-24 md:pt-10 pb-24">
                        <ServiceUnavailable 
                            address={address} 
                            coords={browseCoords} 
                        />
                    </div>
                ) : (
                    <div className="bg-[var(--color-brand-subtle)] md:bg-white pb-32 min-h-screen pt-24 md:pt-0">
                        <div className="bg-[var(--color-brand-subtle)]/75 md:bg-white shadow-sm md:shadow-none">
                            <div className="max-w-7xl mx-auto px-5 md:px-8 pt-5 md:pt-4 pb-10 md:pb-16">
                                <div className="flex items-center justify-between mb-6 md:mb-8">
                                    <h2 className="text-xl md:text-3xl font-black text-slate-900 whitespace-nowrap">Shop by Category</h2>
                                    <button onClick={() => navigate('/categories')} className="text-primary text-[10px] md:text-sm font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-tight bg-primary/10 px-4 py-2 rounded-full hover:bg-primary/20 transition-all active:scale-95">View All</button>
                                </div>
                                <div className="grid grid-cols-4 gap-x-3 gap-y-6 md:hidden">
                                    {(categories.slice(0, 4)).map((cat, idx) => (
                                        <CategoryCard key={cat._id} cat={cat} idx={idx} navigate={navigate} />
                                    ))}
                                </div>
                                <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-8">
                                    {categories.map((cat, idx) => (
                                        <CategoryCard key={cat._id} cat={cat} idx={idx} navigate={navigate} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="max-w-7xl mx-auto md:px-8">
                            <div className="px-5 mt-6 md:px-0 md:mt-4">
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full rounded-[32px] md:rounded-2xl px-6 py-4 md:px-10 md:py-6 relative overflow-hidden shadow-xl bg-gradient-to-br from-[var(--color-brand-dark)] via-[var(--color-brand-primary)] to-[var(--color-brand-yellow)]/20">
                                    <div className="relative z-10 max-w-lg">
                                        <h2 className="text-[24px] md:text-4xl font-black text-white leading-tight tracking-tight md:normal-case md:font-bold">Wholesale <span className="text-[var(--color-brand-yellow)] md:text-primary">B2B</span> <br />Direct from Farms</h2>
                                        <p className="text-slate-300 mt-1 text-[11px] md:text-sm font-bold uppercase tracking-widest md:normal-case md:font-medium">Pricing starts from 10kg+</p>
                                    </div>
                                    <div className="absolute right-[-20px] bottom-[-30px] opacity-15 md:opacity-25 text-[var(--color-brand-primary)]"><Sprout size={140} className="md:w-[240px] md:h-[240px]" /></div>
                                </motion.div>
                            </div>

                            {/* Section 1: Flash Deals */}
                            {filteredProducts.filter(p => p.homeSections?.includes('flash_deals')).length > 0 && (
                                <div className="mt-8 md:mt-12">
                                    <div className="px-5 md:px-0 flex items-end justify-between mb-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1.5 bg-red-100 rounded-lg md:rounded-md"><Flame size={16} className="text-red-500 fill-red-500 md:w-5 md:h-5" /></div>
                                                <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap">Flash Deals</h2>
                                            </div>

                                        </div>
                                        <button onClick={() => navigate('/products/all')} className="text-primary text-[10px] md:text-sm font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-tight bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-all active:scale-95">See All</button>
                                    </div>
                                    <div ref={flashDealsScrollRef} className="relative overflow-x-auto no-scrollbar md:overflow-visible px-5 md:px-0">
                                        <div className="flex gap-4 w-max md:w-full md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pt-2 pb-3 md:pb-0 pr-4 md:pr-0">
                                            {filteredProducts.filter(p => p.homeSections?.includes('flash_deals')).slice(0, 5).map((product) => (
                                                <div key={product._id} className="w-[164px] md:w-full cursor-pointer"><ProductCard product={product} /></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 2: Bulk Savings */}
                            {filteredProducts.filter(p => p.homeSections?.includes('bulk_saving') || p.bulkPricing?.length > 0).length > 0 && (
                                <div className="mt-6 md:mt-4 py-8 md:py-10 bg-[var(--color-brand-yellow-subtle)]/70 md:bg-slate-50/50 border-y border-[var(--color-brand-yellow)]/10 md:border-slate-100/50">
                                    <div className="max-w-7xl mx-auto md:px-8">
                                        <div className="px-5 md:px-0 flex items-center justify-between mb-6">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="p-1.5 bg-orange-100 rounded-lg md:rounded-md"><TrendingDown size={16} className="text-orange-500 md:w-5 md:h-5" /></div>
                                                    <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap">Bulk Savings</h2>
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest md:normal-case md:font-medium md:text-sm">Best prices for businesses</p>
                                            </div>
                                            <button onClick={() => navigate('/products/all')} className="text-primary text-[10px] md:text-sm font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-tight bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-all active:scale-95 whitespace-nowrap">See All</button>
                                        </div>
                                        <div className="relative overflow-x-auto no-scrollbar md:overflow-visible px-5 md:px-0">
                                            <div className="flex gap-4 w-max md:w-full md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pt-2 pb-4 pr-4 md:pr-0">
                                                {filteredProducts.filter(p => p.homeSections?.includes('bulk_saving') || p.bulkPricing?.length > 0).slice(0, 5).map((product) => (
                                                    <div key={product._id} className="w-[155px] md:w-full cursor-pointer"><ProductCard product={product} /></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="max-w-7xl mx-auto md:px-8">
                                {/* Section 3: Seasonal Picks */}
                                {filteredProducts.filter(p => p.homeSections?.includes('seasonal_picks')).length > 0 && (
                                    <div className="mt-8 px-5 md:px-0 md:mt-8">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2"><div className="p-1.5 bg-primary/10 rounded-lg md:rounded-md"><Sparkles size={16} className="text-primary fill-primary md:w-5 md:h-5" /></div><h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap">Seasonal Picks</h2></div>
                                            <button onClick={() => navigate('/products/all')} className="text-primary text-[10px] md:text-sm font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-tight bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-all active:scale-95 whitespace-nowrap">See All</button>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-5 gap-4">
                                            {filteredProducts.filter(p => p.homeSections?.includes('seasonal_picks')).slice(0, 5).map((product) => (
                                                <ProductCard key={product._id} product={product} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Section 4: Exotic Finds */}
                                {filteredProducts.filter(p => p.homeSections?.includes('exotic_finds') || p.category?.name?.toLowerCase() === 'exotic').length > 0 && (
                                    <div className="mt-8 md:mt-10">
                                        <div className="px-5 md:px-0 flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2"><div className="p-1.5 bg-purple-100 rounded-lg md:rounded-md"><Gem size={16} className="text-purple-500 fill-purple-500 md:w-5 md:h-5" /></div><h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap">Exotic Finds</h2></div>
                                            <button onClick={() => navigate('/products/all')} className="text-primary text-[10px] md:text-sm font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-tight bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-all active:scale-95 whitespace-nowrap">See All</button>
                                        </div>
                                        <div className="relative overflow-x-auto no-scrollbar md:overflow-visible px-5 md:px-0">
                                            <div className="flex gap-4 w-max md:w-full md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 pt-2 pb-6 pr-4 md:pr-0">
                                                {filteredProducts.filter(p => p.homeSections?.includes('exotic_finds') || p.category?.name?.toLowerCase() === 'exotic').slice(0, 5).map((product) => (
                                                    <div key={product._id} className="w-[164px] md:w-full cursor-pointer"><ProductCard product={product} /></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section 5: Daily Essentials */}
                                {filteredProducts.filter(p => p.homeSections?.includes('daily_essentials')).length > 0 && (
                                    <div className="mt-8 px-5 md:px-0 md:mt-10">
                                        <div className="flex items-center gap-2 mb-6"><div className="p-1.5 bg-blue-100 rounded-lg md:rounded-md"><History size={16} className="text-blue-500 md:w-5 md:h-5" /></div><h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap">Daily Essentials</h2></div>
                                        <div className="space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
                                            {filteredProducts.filter(p => p.homeSections?.includes('daily_essentials')).slice(0, 3).map((product, idx) => (
                                                <div key={product._id} onClick={() => navigate(`/product/${product._id}`)} className="cursor-pointer"><ProductCard product={product} layout="list" index={idx} /></div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Section 6: Best Sellers */}
                                {filteredProducts.filter(p => p.homeSections?.includes('best_sellers')).length > 0 && (
                                    <div className="mt-10 px-5 md:px-0 md:mt-16 md:pb-20">
                                        <div className="flex flex-col mb-10"><h2 className="text-xl md:text-4xl font-black text-slate-900 tracking-tight text-center">Best Sellers near you</h2><div className="w-16 h-1 bg-primary rounded-full mx-auto mt-4" /></div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                            {filteredProducts.filter(p => p.homeSections?.includes('best_sellers')).map((product, idx) => (
                                                <div key={product._id} onClick={() => navigate(`/product/${product._id}`)} className="cursor-pointer"><ProductCard product={product} index={idx} /></div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <LocationPermissionPopup isOpen={showLocationPopup} onAllow={handleAllowLocation} onManual={handleManualLocation} onClose={() => { setShowLocationPopup(false); localStorage.setItem('kk_location_declined', 'true'); }} />
            </PageTransition>
        </>
    )
}
