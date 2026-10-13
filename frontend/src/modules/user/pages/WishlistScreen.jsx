import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Trash2, ShoppingCart, HeartOff, LayoutGrid, Star, ChevronDown, Search } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import ProductCard from '../components/common/ProductCard'
import { useWishlist } from '../contexts/WishlistContext'
import { useCart } from '../contexts/CartContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import categoriesData from '../data/categories.json'
import { useLocation } from '../contexts/LocationContext'
import { getBrowseLocationParams } from '../utils/storefrontParams'

export default function WishlistScreen() {
    const navigate = useNavigate()
    const { wishlistItems } = useWishlist()
    const { cartCount } = useCart()
    const locationCtx = useLocation()
    const [activeCategory, setActiveCategory] = useState('all')
    const [categories, setCategories] = useState([])

    // Fetch categories to ensure we have names for IDs
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
                console.error('Fetch categories error:', error)
            }
        }
        fetchCategories()
    }, [
        locationCtx?.deliveryLocation,
        locationCtx?.hasDeliveryPinned,
        locationCtx?.franchiseLocation,
        locationCtx?.hasFranchisePinned,
    ])

    // Generate dynamic categories based on products in wishlist
    const dynamicCategories = useMemo(() => {
        const uniqueCatIds = [...new Set(wishlistItems.map(item =>
            typeof item.category === 'object' ? item.category?._id : item.category
        ))].filter(Boolean)

        const cats = uniqueCatIds.map(id => {
            const itemWithCat = wishlistItems.find(i =>
                (typeof i.category === 'object' ? i.category?._id : i.category) === id
            )
            const catObj = typeof itemWithCat?.category === 'object' ? itemWithCat.category : null
            const apiCat = categories.find(c => c._id === id || c.id === id)
            const staticData = categoriesData.find(c => c.id === id || c._id === id)

            return {
                id: id,
                name: catObj?.name || apiCat?.name || staticData?.name || 'Category',
                image: catObj?.image || apiCat?.image || staticData?.image,
                icon: staticData?.icon
            }
        })

        return [
            { id: 'all', name: 'All', icon: LayoutGrid, color: 'bg-emerald-50 text-emerald-500' },
            ...cats
        ]
    }, [wishlistItems, categories])

    const filteredItems = useMemo(() => {
        if (activeCategory === 'all') return wishlistItems
        return wishlistItems.filter(item => {
            const catId = typeof item.category === 'object' ? item.category?._id : item.category
            return catId === activeCategory
        })
    }, [wishlistItems, activeCategory])

    return (
        <PageTransition>
            <div className="bg-[#f8fafc] min-h-screen pb-32 flex flex-col">
                {/* Mobile Header */}
                <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100 md:hidden">
                    <div className="flex items-center justify-between px-4 pt-6 pb-2.5">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm text-slate-900 active:scale-95 transition-all">
                                <ArrowLeft size={20} strokeWidth={2.5} />
                            </button>
                            <div>
                                <h1 className="text-[18px] font-black text-slate-900 tracking-tight leading-none uppercase">Favourites</h1>
                                <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-1.5 uppercase">{wishlistItems.length} Products</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/cart')}
                                className="relative w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 active:scale-95 transition-all"
                            >
                                <ShoppingCart size={18} strokeWidth={2.5} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                                        {cartCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Mobile Sidebar - Vertical List of Categories */}
                    {wishlistItems.length > 0 && (
                        <aside className="w-[74px] border-r border-slate-100 h-[calc(100vh-140px)] overflow-y-auto no-scrollbar md:hidden bg-white shrink-0">
                            <div className="flex flex-col py-4">
                                {dynamicCategories.map((cat) => {
                                    const isActive = activeCategory === cat.id
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveCategory(cat.id)}
                                            className={cn(
                                                "relative flex flex-col items-center gap-2 py-4 px-1 group",
                                                isActive ? "bg-slate-50/50" : ""
                                            )}
                                        >
                                            <div className={cn(
                                                "w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center border transition-all duration-300",
                                                isActive ? "bg-white border-emerald-500 shadow-lg shadow-emerald-50 scale-110" : "bg-slate-50 border-slate-100 grayscale-[0.3]"
                                            )}>
                                                {cat.image ? (
                                                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <LayoutGrid size={20} className={isActive ? "text-emerald-500" : "text-slate-400"} />
                                                )}
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-black uppercase text-center leading-tight tracking-wider transition-colors px-1",
                                                isActive ? "text-slate-900" : "text-slate-400"
                                            )}>
                                                {cat.name}
                                            </span>
                                            {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </aside>
                    )}

                    {/* Main List Area */}
                    <main className="flex-1 overflow-y-auto no-scrollbar">


                        <div className="p-3.5 flex flex-col gap-3.5 md:hidden">
                            {filteredItems.length === 0 ? (
                                <div className="py-24 text-center">
                                    <div className="w-20 h-20 bg-white rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-center mx-auto mb-6 text-slate-200">
                                        <HeartOff size={40} />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-2">List is Empty</h3>
                                    <p className="text-slate-400 text-sm font-medium">Add products you love to see them here.</p>
                                    <button onClick={() => navigate('/home')} className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200">Explore Store</button>
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {filteredItems.map((product) => (
                                        <motion.div
                                            key={product._id || product.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <ProductCard product={product} layout="list" />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>

                        {/* DESKTOP VIEW */}
                        <div className="hidden md:block max-w-[1400px] mx-auto px-8 w-full mt-10">
                            <div className="flex flex-col gap-8">
                                <h1 className="text-[32px] font-bold text-slate-900">My list</h1>
                                <div className="flex gap-10">
                                    <aside className="w-72 shrink-0">
                                        <div className="bg-white border border-slate-100 rounded-[32px] p-4 shadow-sm sticky top-32">
                                            {dynamicCategories.map((cat) => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setActiveCategory(cat.id)}
                                                    className={cn(
                                                        "w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all",
                                                        activeCategory === cat.id ? "bg-slate-50" : "hover:bg-slate-50/50"
                                                    )}
                                                >
                                                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center border border-slate-50 shadow-sm", cat.color || "bg-slate-50")}>
                                                        {cat.icon && typeof cat.icon === 'function' ? <cat.icon size={20} /> : <img src={cat.image} className="w-full h-full object-cover rounded-full" />}
                                                    </div>
                                                    <span className="font-bold text-slate-900">{cat.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </aside>
                                    <div className="flex-1 grid grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                                        {filteredItems.map(item => <ProductCard key={item.id} product={item} />)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </PageTransition>
    )
}
