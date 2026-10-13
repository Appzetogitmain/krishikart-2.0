import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'
import PageTransition from '../components/layout/PageTransition'
import api from '@/lib/axios'
import { useLocation } from '../contexts/LocationContext'
import { getBrowseLocationParams } from '../utils/storefrontParams'
import ServiceUnavailable from '../components/common/ServiceUnavailable'

export default function CategoriesScreen() {
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const locationCtx = useLocation()

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
                if (response.data.success) {
                    setCategories(response.data.results)
                }
            } catch (error) {
                console.error('Error fetching categories:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchCategories()
    }, [
        locationCtx?.deliveryLocation,
        locationCtx?.hasDeliveryPinned,
        locationCtx?.franchiseLocation,
        locationCtx?.hasFranchisePinned,
    ])

    return (
        <PageTransition>
            <div className="bg-white min-h-screen pb-32">
                {/* Mobile Header */}
                <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl px-4 py-3 pt-3 border-b border-slate-100/80 shadow-[0_1px_10px_rgba(0,0,0,0.04)] flex items-center gap-4 md:hidden">
                    <button
                        onClick={() => navigate(-1)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-600 active:scale-95 transition-transform"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Select Category</h1>
                </div>

                <div className="max-w-7xl mx-auto md:px-10">
                    {/* Desktop Breadcrumbs and Title */}
                    <div className="hidden md:block pt-10 px-4">
                        <h1 className="text-3xl font-bold text-slate-900 mt-6">Shop by Category</h1>
                        <p className="text-slate-500 mt-2">Browse our wide selection of fresh harvests and quality products.</p>
                    </div>

                    <div className="p-4 md:p-4 md:py-10">
                        {categories.length === 0 && !loading && getBrowseLocationParams(locationCtx).hasPinned ? (
                            <ServiceUnavailable 
                                address={locationCtx.address} 
                                coords={getBrowseLocationParams(locationCtx).coords} 
                            />
                        ) : (
                            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-3 md:gap-x-8 gap-y-6 md:gap-y-12">
                                {categories.map((cat, idx) => {
                                    return (
                                        <motion.button
                                            key={cat._id}
                                            onClick={() => navigate(`/products/${cat._id}`)}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="flex flex-col items-center gap-3 group"
                                        >
                                            <div className="w-full aspect-square rounded-[28px] md:rounded-xl overflow-hidden shadow-sm transition-all duration-300 group-active:scale-95 group-hover:shadow-md relative border border-slate-100 bg-white">
                                                <img
                                                    src={cat.image}
                                                    alt={cat.name}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&q=80' }}
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                            </div>
                                            <span className="text-[11px] font-black text-slate-700 text-center leading-tight uppercase tracking-tight px-1 group-hover:text-primary transition-colors md:normal-case md:text-sm md:font-semibold md:tracking-normal">
                                                {cat.name}
                                            </span>
                                        </motion.button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
