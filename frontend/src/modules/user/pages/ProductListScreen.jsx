import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, SlidersHorizontal, Search, X, Check, ChevronRight, LayoutGrid, Star, ChevronDown, ShoppingCart, Heart, Loader2 } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import ProductCard from '../components/common/ProductCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCart } from '../contexts/CartContext'
import { useWishlist } from '../contexts/WishlistContext'
import api from '@/lib/axios'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { useLocation } from '../contexts/LocationContext'
import { appendLocationToProductParams, getBrowseLocationParams } from '../utils/storefrontParams'
import { useFilter } from '../contexts/FilterContext'
import ServiceUnavailable from '../components/common/ServiceUnavailable'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet"

export default function ProductListScreen() {
    const { category } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { cartCount } = useCart()
    const locationCtx = useLocation()
    const queryFromUrl = searchParams.get('search') || ''
    const [searchQuery, setSearchQuery] = useState(queryFromUrl)
    const [categories, setCategories] = useState([])
    const [subcategories, setSubcategories] = useState([])
    const [products, setProducts] = useState([])
    const { vegMode, setVegMode } = useFilter()
    const [isLoading, setIsLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState(category || 'all')
    
    // Sync selectedCategory with URL param
    useEffect(() => {
        setSelectedCategory(category || 'all')
    }, [category])

    const [activeSubCategory, setActiveSubCategory] = useState('all')
    const [activeFilters, setActiveFilters] = useState({
        rating: false,
        veg: vegMode,
        inStock: false,
        sort: 'none' // 'price-low', 'price-high'
    })

    // Sync local veg filter with global context
    useEffect(() => {
        setActiveFilters(prev => ({ ...prev, veg: vegMode }))
    }, [vegMode])
    const [showSearch, setShowSearch] = useState(false)
    const debouncedSearch = useDebounce(searchQuery, 300)
    const activeSidebarRef = useRef(null)
    const sidebarListRef = useRef(null)
    const mainScrollRef = useRef(null)
    const [activeBarTop, setActiveBarTop] = useState(19)
    /** Per-item height (py-4 + icon 54 + gap-1.5 + label ~14 + py-4) so bar position can be set instantly on click */
    const SIDEBAR_ITEM_HEIGHT = 104

    // Sync selected category from URL (e.g. when navigating from home to /products/:category)
    useEffect(() => {
        setSelectedCategory(category || 'all')
    }, [category])

    // Only sync searchQuery from URL on initial mount or if user manually changes category
    useEffect(() => {
        if (queryFromUrl) {
            setSearchQuery(queryFromUrl)
        }
    }, [category]) // Only when category changes, not on queryFromUrl changes

    // Fetch Categories (area-filtered when location is pinned)
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const { coords, hasPinned } = getBrowseLocationParams(locationCtx)
                const catParams = {}
                if (hasPinned && coords) {
                    catParams.lat = coords.lat
                    catParams.lng = coords.lng
                }
                const response = await api.get('/catalog/categories', { params: catParams })
                if (response.data.success) setCategories(response.data.results)
            } catch (error) {
                console.error('Categories error:', error)
            }
        }
        fetchCategories()
    }, [
        locationCtx?.deliveryLocation,
        locationCtx?.hasDeliveryPinned,
        locationCtx?.franchiseLocation,
        locationCtx?.hasFranchisePinned,
    ])

    // Fetch Products and Subcategories when Category changes, or INITIAL search
    useEffect(() => {
        const fetchData = async () => {
            // Only show full loader if we don't have products yet (initial load or category change)
            const shouldShowFullLoader = !products.length || category !== selectedCategory;
            if (shouldShowFullLoader) setIsLoading(true);
            
            try {
                const { coords, hasPinned } = getBrowseLocationParams(locationCtx)
                const locArg = { franchiseLocation: coords, hasFranchisePinned: hasPinned }
                
                // Products - use queryFromUrl for backend search sync
                const params = appendLocationToProductParams(
                    {
                        ...(selectedCategory !== 'all' ? { category: selectedCategory } : {}),
                        ...(queryFromUrl ? { search: queryFromUrl } : {}),
                        showOnStorefront: true,
                    },
                    locArg
                )

                const prodRes = await api.get('/products', { params })
                if (prodRes.data.success) setProducts(prodRes.data.results)

                // Subcategories
                if (selectedCategory !== 'all') {
                    const subRes = await api.get('/catalog/subcategories', { params: { category: selectedCategory } })
                    if (subRes.data.success) setSubcategories(subRes.data.results)
                } else {
                    setSubcategories([])
                }
                setActiveSubCategory('all')
            } catch (error) {
                console.error('Fetch error:', error)
                toast.error('Failed to load products')
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [
        selectedCategory,
        // Remove queryFromUrl from here to handle search purely through debounced navigation and local filtering
        locationCtx?.deliveryLocation,
        locationCtx?.hasDeliveryPinned,
        locationCtx?.franchiseLocation,
        locationCtx?.hasFranchisePinned,
    ])

    // Filter by Subcategory
    useEffect(() => {
        if (activeSubCategory === 'all' && selectedCategory === 'all') return
        if (activeSubCategory === 'all') return // Already loaded in main effect

        const fetchBySub = async () => {
            setIsLoading(true)
            try {
                const { coords, hasPinned } = getBrowseLocationParams(locationCtx)
                const locArg = { franchiseLocation: coords, hasFranchisePinned: hasPinned }
                const response = await api.get('/products', {
                    params: appendLocationToProductParams(
                        {
                            category: selectedCategory,
                            subcategory: activeSubCategory,
                            showOnStorefront: true,
                        },
                        locArg
                    ),
                })
                if (response.data.success) setProducts(response.data.results)
            } catch (error) {
                console.error('Sub fetch error:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchBySub()
    }, [
        activeSubCategory,
        selectedCategory,
        locationCtx?.deliveryLocation,
        locationCtx?.hasDeliveryPinned,
        locationCtx?.franchiseLocation,
        locationCtx?.hasFranchisePinned,
    ])

    const currentCategoryData = useMemo(() => {
        if (selectedCategory === 'all') return { name: 'All Products' }
        return categories.find(c => c._id === selectedCategory) || { name: 'Products' }
    }, [selectedCategory, categories])

    // Scroll active sidebar category into view (e.g. after opening from home)
    useEffect(() => {
        if (!selectedCategory || categories.length === 0) return
        const id = setTimeout(() => {
            activeSidebarRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth', inline: 'nearest' })
        }, 100)
        return () => clearTimeout(id)
    }, [selectedCategory, categories.length])

    // Sync bar position when selection comes from URL or categories load (ref-based)
    useEffect(() => {
        if (!selectedCategory) return
        const updateBar = () => {
            const btn = activeSidebarRef.current
            if (btn && sidebarListRef.current) setActiveBarTop(btn.offsetTop + 19)
        }
        const raf = requestAnimationFrame(updateBar)
        const t = setTimeout(updateBar, 80)
        return () => { cancelAnimationFrame(raf); clearTimeout(t) }
    }, [selectedCategory, categories.length])

    // Scroll products to top when category/subcategory changes
    useEffect(() => {
        if (mainScrollRef.current) {
            mainScrollRef.current.scrollTo({ top: 0, behavior: 'auto' })
        }
    }, [selectedCategory, activeSubCategory])

    // Sidebar Categories
    const sidebarCategories = useMemo(() => {
        const cats = (categories || []).map(cat => ({
            id: cat._id,
            name: cat.name,
            image: cat.image,
            color: cat.color
        }))

        return [
            { id: 'all', name: 'All', icon: LayoutGrid, color: 'bg-emerald-50 text-emerald-500' },
            ...cats
        ]
    }, [categories])

    const filteredProducts = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase()
        const keywords = normalizedSearch.split(/\s+/).filter(k => k.length > 0)
        
        let result = (products || []).filter(p => {
            const tagsText = Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags || '')
            const searchableText = `${p.name} ${p.skuCode} ${p.description} ${p.shortDescription || ''} ${tagsText}`.toLowerCase()
            
            const matchesSearch = keywords.length === 0 || keywords.every(word => searchableText.includes(word))
            const matchesRating = !activeFilters.rating || (p.rating >= 4.0 || p.comparePrice > p.price)
            const matchesVeg = !activeFilters.veg || (p.dietaryType === 'veg' || p.dietaryType === 'none')
            const matchesInStock = !activeFilters.inStock || (p.stock > 0)
            return matchesSearch && matchesRating && matchesVeg && matchesInStock
        })

        if (activeFilters.sort === 'price-low') {
            return [...result].sort((a, b) => a.price - b.price)
        } else if (activeFilters.sort === 'price-high') {
            return [...result].sort((a, b) => b.price - a.price)
        }

        return result
    }, [products, searchQuery, activeFilters])

    // Sync URL with debounced search
    useEffect(() => {
        const currentSearch = searchParams.get('search') || '';
        if (debouncedSearch !== currentSearch) {
            const params = new URLSearchParams(searchParams);
            if (debouncedSearch) {
                params.set('search', debouncedSearch);
            } else {
                params.delete('search');
            }
            navigate(`?${params.toString()}`, { replace: true });
        }
    }, [debouncedSearch]);

    return (
        <PageTransition>
            <div className="bg-white h-screen flex flex-col overflow-hidden">
                {/* Unified Header - Mobile Redesign */}
                <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-100/80 shadow-[0_1px_10px_rgba(0,0,0,0.04)] md:hidden">
                    <div className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 h-16">
                        <AnimatePresence mode="wait">
                            {showSearch ? (
                                <motion.div
                                    key="search-bar"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex items-center gap-2 flex-1"
                                >
                                    <button
                                        onClick={() => {
                                            setShowSearch(false)
                                            setSearchQuery('')
                                        }}
                                        className="p-2 text-slate-400"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search products..."
                                            className="w-full h-10 bg-slate-50 border-none rounded-full pl-10 pr-10 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="header-default"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex items-center justify-between w-full"
                                >
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-900 active:scale-95 transition-transform">
                                            <ArrowLeft size={22} />
                                        </button>
                                        <div className="flex flex-col">
                                            <h1 className="text-[18px] font-black text-slate-900 leading-tight tracking-tight">
                                                 {queryFromUrl ? `Results for "${queryFromUrl}"` : currentCategoryData.name}
                                             </h1>
                                             <Sheet>
                                                 <SheetTrigger asChild>
                                                     <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-black text-emerald-600 uppercase tracking-wider mt-0.5 active:scale-95 transition-all">
                                                         Category <ChevronDown size={12} strokeWidth={3} />
                                                     </button>
                                                 </SheetTrigger>
                                                <SheetContent side="bottom" className="rounded-t-[32px] max-h-[80vh] overflow-y-auto p-5 gap-0">
                                                    <SheetHeader className="p-0 mb-4">
                                                        <SheetTitle className="text-xl font-black">All Categories</SheetTitle>
                                                    </SheetHeader>
                                                    <div className="grid grid-cols-4 gap-4 pb-4">
                                                        {sidebarCategories.map((cat) => (
                                                            <SheetClose asChild key={cat.id}>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedCategory(cat.id)
                                                                    }}
                                                                    className="flex flex-col items-center gap-2"
                                                                >
                                                                    <div className={cn(
                                                                        "w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm",
                                                                        cat.color || "bg-slate-50"
                                                                    )}>
                                                                        {cat.icon && typeof cat.icon === 'function' ? (
                                                                            <cat.icon size={24} />
                                                                        ) : (
                                                                            <img src={cat.image} className="w-full h-full object-cover rounded-2xl" />
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-center leading-tight">{cat.name}</span>
                                                                </button>
                                                            </SheetClose>
                                                        ))}
                                                    </div>
                                                </SheetContent>
                                            </Sheet>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowSearch(true)}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 border border-slate-100"
                                        >
                                            <Search size={20} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => navigate('/cart')}
                                            className="relative w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-100"
                                        >
                                            <ShoppingCart size={18} strokeWidth={2.5} />
                                            {cartCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                                                    {cartCount}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Main Content Area - Split View on Mobile */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Mobile Sidebar - LEFT COL (fixed, independent of products scroll) */}
                    <aside className="w-[85px] border-r border-slate-100/50 md:hidden bg-white shrink-0 fixed left-0 top-[80px] h-[calc(100vh-96px)] overflow-y-auto no-scrollbar z-20">
                        <div ref={sidebarListRef} className="flex flex-col py-3 pb-24 relative">
                            {sidebarCategories.map((cat) => {
                                const isActive = selectedCategory === cat.id
                                return (
                                    <button
                                        key={cat.id}
                                        ref={isActive ? activeSidebarRef : null}
                                        onClick={() => {
                                            setSelectedCategory(cat.id)
                                        }}
                                        className={cn(
                                            "relative flex flex-col items-center gap-1.5 py-4 px-1 transition-all duration-300",
                                            isActive ? "bg-white" : "hover:bg-slate-50/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-[54px] h-[54px] rounded-full flex items-center justify-center shrink-0 transition-all duration-500 shadow-sm overflow-hidden",
                                            isActive 
                                                ? "ring-2 ring-emerald-500 ring-offset-2 scale-110 shadow-lg shadow-emerald-100 bg-emerald-50 text-emerald-600" 
                                                : "bg-slate-50 text-slate-400 border border-slate-100/50"
                                        )}>
                                            {cat.icon && typeof cat.icon === 'function' ? (
                                                <cat.icon size={24} strokeWidth={2.5} />
                                            ) : (
                                                <img
                                                    src={cat.image}
                                                    alt={cat.name}
                                                    className={cn(
                                                        "w-full h-full object-cover transition-transform duration-700",
                                                        isActive ? "scale-110" : "scale-100"
                                                    )}
                                                    onError={(e) => {
                                                        e.target.src = 'https://images.unsplash.com/photo-1603297638322-c9fdb12905c9?w=400&q=80'
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-black text-center leading-tight transition-colors duration-300 px-1 max-w-[70px] truncate uppercase tracking-tighter",
                                            isActive ? "text-emerald-700" : "text-slate-400"
                                        )}>
                                            {cat.name}
                                        </span>
                                    </button>
                                )
                            })}
                            {/* Single sliding bar – CSS transition only */}
                            <div
                                className="absolute right-0 w-1 h-14 bg-emerald-500 rounded-l-full pointer-events-none z-10 transition-[top] duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                style={{ top: activeBarTop }}
                                aria-hidden
                            />
                        </div>
                    </aside>

                    {/* Right Side - Products Area */}
                    <main ref={mainScrollRef} className="flex-1 bg-white ml-[85px] md:ml-0 overflow-y-auto no-scrollbar pb-32">
                        {/* Horizontal Filters & Subcategories Row */}
                        <div className="flex flex-col gap-3 px-4 py-4 border-b border-slate-50/50 sticky top-0 bg-white/95 backdrop-blur-sm z-30 md:hidden">
                             <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 pr-2">
                                 <div
                                     onClick={() => setActiveFilters(prev => ({ ...prev, rating: !prev.rating }))}
                                     className={cn(
                                         "flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all shrink-0 font-black text-[11px] uppercase tracking-wider",
                                         activeFilters.rating 
                                             ? "bg-orange-500 border-orange-600 text-white shadow-lg shadow-orange-100" 
                                             : "bg-white border-slate-100 text-slate-500 shadow-sm"
                                     )}
                                 >
                                     <Star size={14} className={cn(activeFilters.rating ? "fill-white" : "text-orange-400")} />
                                     <span>Top Deals</span>
                                 </div>
                                 <div
                                     onClick={() => setVegMode(!vegMode)}
                                     className={cn(
                                         "flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all shrink-0 font-black text-[11px] uppercase tracking-wider",
                                         vegMode 
                                             ? "bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-100" 
                                             : "bg-white border-slate-100 text-slate-500 shadow-sm"
                                     )}
                                 >
                                     <div className={cn("w-3.5 h-3.5 border-2 flex items-center justify-center rounded-[3px]", vegMode ? "border-white" : "border-emerald-600")}>
                                         <div className={cn("w-1.5 h-1.5 rounded-full", vegMode ? "bg-white" : "bg-emerald-600")} />
                                     </div>
                                     <span>Veg Only</span>
                                 </div>
                                 <div
                                     onClick={() => setActiveFilters(prev => ({ ...prev, inStock: !prev.inStock }))}
                                     className={cn(
                                         "flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all shrink-0 font-black text-[11px] uppercase tracking-wider",
                                         activeFilters.inStock 
                                             ? "bg-slate-900 border-slate-950 text-white shadow-lg shadow-slate-100" 
                                             : "bg-white border-slate-100 text-slate-500 shadow-sm"
                                     )}
                                 >
                                     <div className={cn("w-2 h-2 rounded-full animate-pulse", activeFilters.inStock ? "bg-emerald-400" : "bg-slate-300")} />
                                     <span>In Stock</span>
                                 </div>
                                 <div
                                     onClick={() => setActiveFilters(prev => ({
                                         ...prev,
                                         sort: prev.sort === 'price-low' ? 'price-high' : prev.sort === 'price-high' ? 'none' : 'price-low'
                                     }))}
                                     className={cn(
                                         "flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all shrink-0 font-black text-[11px] uppercase tracking-wider",
                                         activeFilters.sort !== 'none' 
                                             ? "bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-100" 
                                             : "bg-white border-slate-100 text-slate-500 shadow-sm"
                                     )}
                                 >
                                     <SlidersHorizontal size={14} strokeWidth={3} />
                                     <span>
                                         {activeFilters.sort === 'price-low' ? 'Low' : activeFilters.sort === 'price-high' ? 'High' : 'Sort'}
                                     </span>
                                 </div>
                                 <div className="shrink-0 w-10" />
                             </div>

                            {/* Subcategories */}
                            {subcategories.length > 0 && (
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                    <button
                                        onClick={() => setActiveSubCategory('all')}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all whitespace-nowrap",
                                            activeSubCategory === 'all' ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-slate-100 text-slate-500"
                                        )}
                                    >
                                        All
                                    </button>
                                    {subcategories.map(sub => (
                                        <button
                                            key={sub._id}
                                            onClick={() => setActiveSubCategory(sub._id)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all whitespace-nowrap",
                                                activeSubCategory === sub._id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-slate-100 text-slate-500"
                                            )}
                                        >
                                            {sub.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Product Grid - Mobile */}
                        <div className="p-3 grid grid-cols-2 gap-3 md:hidden min-h-[400px]">
                            {isLoading ? (
                                <div className="col-span-2 flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary opacity-40" />
                                </div>
                            ) : (
                                <>
                                    <AnimatePresence mode="popLayout">
                                        {searchQuery !== debouncedSearch && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="col-span-2 flex items-center justify-center py-4 text-slate-400 text-xs font-bold uppercase tracking-widest gap-2"
                                            >
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Searching...
                                            </motion.div>
                                        )}
                                        {filteredProducts.map((product, index) => (
                                            <motion.div
                                                key={product._id || product.id || index}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="w-full"
                                            >
                                                <ProductCard product={product} highlight={searchQuery} />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {filteredProducts.length === 0 && (
                                        <div className="col-span-2 py-20 text-center">
                                            {(!isLoading && products.length === 0 && getBrowseLocationParams(locationCtx).hasPinned) ? (
                                                <ServiceUnavailable 
                                                   address={locationCtx.address} 
                                                   coords={getBrowseLocationParams(locationCtx).coords} 
                                                />
                                            ) : (
                                                <>
                                                    <Search className="mx-auto text-slate-200 mb-4" size={48} />
                                                    <p className="text-slate-400 font-bold">No products found</p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* TABLET + DESKTOP VIEW */}
                        <div className="hidden md:block max-w-3xl lg:max-w-[1400px] mx-auto px-4 lg:px-8 w-full mt-6 lg:mt-10">
                            <div className="flex gap-6 lg:gap-8">
                                <aside className="w-60 lg:w-72 shrink-0">
                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden py-2 sticky top-32">
                                        <button onClick={() => setSelectedCategory('all')} className={cn("w-full px-6 py-4 text-[15px] font-bold text-left flex items-center gap-4 transition-all", selectedCategory === 'all' ? "bg-slate-50 text-slate-900" : "text-slate-500 hover:text-slate-900")}>
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><LayoutGrid size={20} /></div>
                                            All Products
                                        </button>
                                        {categories.map(cat => (
                                            <button key={cat._id} onClick={() => setSelectedCategory(cat._id)} className={cn("w-full px-6 py-4 text-[15px] font-bold text-left flex items-center gap-4 transition-all", selectedCategory === cat._id ? "bg-emerald-50 text-emerald-900" : "text-slate-500 hover:text-slate-900")}>
                                                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden text-center">
                                                    <img
                                                        src={cat.image}
                                                        alt={cat.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.src = 'https://images.unsplash.com/photo-1603297638322-c9fdb12905c9?w=400&q=80'
                                                        }}
                                                    />
                                                </div>
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </aside>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col gap-6 mb-8">
                                        <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                                {queryFromUrl ? `Search Results: "${queryFromUrl}"` : currentCategoryData.name}
                                            </h2>
                                            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                                <span>{filteredProducts.length} Products Found</span>
                                                {queryFromUrl && (
                                                    <button 
                                                        onClick={() => {
                                                            setSearchQuery('')
                                                            const params = new URLSearchParams(searchParams)
                                                            params.delete('search')
                                                            navigate(`?${params.toString()}`, { replace: true })
                                                        }}
                                                        className="text-emerald-600 font-bold hover:underline ml-2"
                                                    >
                                                        Clear Search
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                            {/* Filters Row for Desktop */}
                                            <div className="flex items-center gap-3">
                                                <div
                                                    onClick={() => setActiveFilters(prev => ({ ...prev, rating: !prev.rating }))}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all",
                                                        activeFilters.rating ? "bg-orange-50 border-orange-200 text-orange-600 font-bold" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                                    )}
                                                >
                                                    <Star size={16} className={cn("text-orange-400", activeFilters.rating && "fill-orange-400")} />
                                                    <span className="text-sm">Top Deals</span>
                                                </div>
                                                <div
                                                    onClick={() => setActiveFilters(prev => ({ ...prev, veg: !prev.veg }))}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all",
                                                        activeFilters.veg ? "bg-green-50 border-green-200 text-green-600 font-bold" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                                    )}
                                                >
                                                    <div className={cn("w-3.5 h-3.5 border flex items-center justify-center rounded-[3px]", activeFilters.veg ? "border-green-600" : "border-slate-300")}>
                                                        <div className={cn("w-2 h-2 rounded-full", activeFilters.veg ? "bg-green-600" : "bg-transparent")} />
                                                    </div>
                                                    <span className="text-sm">Veg Only</span>
                                                </div>
                                                <div
                                                    onClick={() => setActiveFilters(prev => ({ ...prev, inStock: !prev.inStock }))}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all",
                                                        activeFilters.inStock ? "bg-emerald-50 border-emerald-200 text-emerald-600 font-bold" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                                    )}
                                                >
                                                    <div className={cn("w-3.5 h-3.5 rounded-full", activeFilters.inStock ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-200")} />
                                                    <span className="text-sm">In Stock</span>
                                                </div>
                                                <div
                                                    onClick={() => setActiveFilters(prev => ({
                                                        ...prev,
                                                        sort: prev.sort === 'price-low' ? 'price-high' : prev.sort === 'price-high' ? 'none' : 'price-low'
                                                    }))}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all min-w-[140px] justify-center",
                                                        activeFilters.sort !== 'none' ? "bg-blue-50 border-blue-200 text-blue-600 font-bold" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                                                    )}
                                                >
                                                    <SlidersHorizontal size={16} />
                                                    <span className="text-sm">
                                                        {activeFilters.sort === 'price-low' ? 'Price: Low to High' : activeFilters.sort === 'price-high' ? 'Price: High to Low' : 'Sort by Price'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {subcategories.length > 0 && selectedCategory !== 'all' && (
                                            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
                                                <button
                                                    onClick={() => setActiveSubCategory('all')}
                                                    className={cn("px-6 py-2.5 rounded-xl text-sm font-bold transition-all border", activeSubCategory === 'all' ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200" : "bg-white border-slate-100 text-slate-400")}
                                                >
                                                    All
                                                </button>
                                                {subcategories.map(sub => (
                                                    <button
                                                        key={sub._id}
                                                        onClick={() => setActiveSubCategory(sub._id)}
                                                        className={cn("px-6 py-2.5 rounded-xl text-sm font-bold transition-all border", activeSubCategory === sub._id ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-100" : "bg-white border-slate-100 text-slate-400")}
                                                    >
                                                        {sub.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-40">
                                            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {searchQuery !== debouncedSearch && (
                                                <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-widest bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-pulse">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Searching products...
                                                </div>
                                            )}
                                            {filteredProducts.length === 0 ? (
                                                <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                                    {(!isLoading && products.length === 0 && getBrowseLocationParams(locationCtx).hasPinned) ? (
                                                        <ServiceUnavailable 
                                                            address={locationCtx.address} 
                                                            coords={getBrowseLocationParams(locationCtx).coords} 
                                                        />
                                                    ) : (
                                                        <>
                                                            <Search className="mx-auto text-slate-200 mb-4" size={48} />
                                                            <p className="text-slate-400 font-bold">No products found</p>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                                                    {filteredProducts.map((product, index) => <ProductCard key={product._id || product.id || index} product={product} highlight={searchQuery} />)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </PageTransition>
    )
}
