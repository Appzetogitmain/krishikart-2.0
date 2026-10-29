import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Clock, Leaf, PackageCheck, ShieldCheck, Sprout, Truck } from 'lucide-react'
import ProductCard from '../common/ProductCard'
import { useCart } from '../../contexts/CartContext'
import { optimizedImage } from '../../utils/optimizedImage'

/*
 * Desktop home (client mockup, Oct 2026): hero, category tiles, today's deals with a countdown and a
 * trust strip. Phones keep the existing home screen; these sections only render from md up.
 */

const money = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`

// Free-delivery amount as set by the admin (delivery_constraints.freeMov)
function useFreeDeliveryAbove() {
    const { deliveryConstraints } = useCart()
    const v = Number(deliveryConstraints?.freeMov)
    return v > 0 ? v : null
}

export function DesktopHero() {
    const navigate = useNavigate()
    const freeAbove = useFreeDeliveryAbove()
    const points = [
        { icon: Leaf, text: <>Farm Fresh<br />Produce</> },
        { icon: BadgeCheck, text: <>Best Quality<br />Guaranteed</> },
        { icon: Truck, text: freeAbove ? <>Free Home Delivery<br />above {money(freeAbove)}</> : <>Home<br />Delivery</> },
    ]
    return (
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-green-50 via-green-50 to-lime-50 border border-green-100 min-h-[340px] flex">
            <img src="/home-hero.jpg" alt="" className="absolute right-0 top-0 h-full w-[58%] object-cover" />
            <div className="absolute inset-y-0 right-[30%] w-[30%] bg-gradient-to-r from-green-50 via-green-50/80 to-transparent" />
            <div className="relative z-10 px-12 py-10 flex flex-col justify-center max-w-[780px]">
                <h1 className="text-[52px] font-extrabold leading-[1.05] tracking-tight text-slate-900">
                    Fresh from Farms<br /><span className="text-green-700">to Your Home</span>
                </h1>
                <div className="mt-7 flex items-center gap-5">
                    {points.map(({ icon: Icon, text }, i) => (
                        <div key={i} className="flex items-center gap-2.5 pr-5 border-r last:border-r-0 border-green-200 whitespace-nowrap">
                            <Icon size={30} className="text-green-700 shrink-0" strokeWidth={2} />
                            <span className="text-[16px] font-semibold text-slate-800 leading-snug">{text}</span>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => navigate('/products/all')}
                    className="mt-8 self-start inline-flex items-center gap-3 h-14 px-10 rounded-full bg-green-700 hover:bg-green-800 text-white text-[20px] font-bold shadow-lg shadow-green-700/25 transition-colors">
                    Shop Fresh <ArrowRight size={22} strokeWidth={2.5} />
                </button>
            </div>
            <div className="absolute right-8 top-8 z-10 w-32 h-32 rounded-full bg-green-800 ring-4 ring-white/80 text-white flex flex-col items-center justify-center text-center shadow-xl">
                <span className="text-[26px] font-extrabold leading-none">100%</span>
                <span className="text-[17px] font-extrabold leading-tight">FRESH</span>
                <span className="text-[11px] font-semibold tracking-wide">&amp; NATURAL</span>
                <Sprout size={18} className="mt-0.5" />
            </div>
        </section>
    )
}

const TILE_COLORS = ['bg-green-50', 'bg-rose-50', 'bg-sky-50', 'bg-orange-50', 'bg-slate-100', 'bg-lime-50', 'bg-emerald-50', 'bg-red-50', 'bg-fuchsia-50', 'bg-amber-50']

export function DesktopCategories({ categories }) {
    const navigate = useNavigate()
    if (!categories.length) return null
    return (
        <section>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[30px] font-bold text-slate-900 tracking-tight">Shop by Category</h2>
                <button type="button" onClick={() => navigate('/categories')}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-green-50 text-green-700 text-[16px] font-bold hover:bg-green-100 transition-colors">
                    View All <ArrowRight size={18} />
                </button>
            </div>
            <div className="grid grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-4">
                {categories.map((cat, i) => (
                    <button key={cat._id} type="button" onClick={() => navigate(`/products/${cat._id}`)} className="group flex flex-col items-center gap-2.5">
                        <span className={`w-full aspect-[7/5] rounded-2xl ${TILE_COLORS[i % TILE_COLORS.length]} flex items-center justify-center p-3 overflow-hidden transition-transform group-hover:-translate-y-1 group-hover:shadow-md`}>
                            <img src={optimizedImage(cat.image, 240)} alt={cat.name} loading="lazy" className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&q=80' }} />
                        </span>
                        <span className="text-[16px] font-semibold text-slate-900 text-center leading-tight line-clamp-2 group-hover:text-green-700">{cat.name}</span>
                    </button>
                ))}
            </div>
        </section>
    )
}

const discountOf = (p) => {
    const price = Number(p.effectiveStorefrontPrice ?? p.price ?? 0)
    const strike = Math.max(Number(p.comparePrice || p.mrp || 0), p.effectiveStorefrontPrice != null ? Number(p.storefrontListPrice ?? p.price ?? 0) : 0)
    return strike > price && price > 0 ? (strike - price) / strike : 0
}

/** Today's deals: the admin's flash deals first, then the biggest real discounts. */
export function pickDeals(products, count = 6) {
    const flash = products.filter((p) => p.homeSections?.includes('flash_deals'))
    const discounted = products.filter((p) => discountOf(p) > 0 && !flash.includes(p)).sort((a, b) => discountOf(b) - discountOf(a))
    return [...flash, ...discounted].slice(0, count)
}

// Today's prices run until midnight
function useUntilMidnight() {
    const left = () => {
        const end = new Date(); end.setHours(24, 0, 0, 0)
        const s = Math.max(0, Math.floor((end - Date.now()) / 1000))
        return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(' : ')
    }
    const [text, setText] = useState(left)
    useEffect(() => { const id = setInterval(() => setText(left()), 1000); return () => clearInterval(id) }, [])
    return text
}

export function DesktopDeals({ products }) {
    const navigate = useNavigate()
    const countdown = useUntilMidnight()
    if (!products.length) return null
    return (
        <section>
            <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-5">
                    <h2 className="text-[30px] font-bold text-slate-900 tracking-tight">Today&apos;s Fresh Deals</h2>
                    <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-red-50 text-red-600 text-[16px] font-semibold">
                        <Clock size={20} /> Offer ends in <span className="font-bold tabular-nums">{countdown}</span>
                    </span>
                </div>
                <button type="button" onClick={() => navigate('/products/all')} className="inline-flex items-center gap-2 text-green-700 text-[17px] font-bold hover:underline">
                    View All Deals <ArrowRight size={18} />
                </button>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {products.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
        </section>
    )
}

export function DesktopTrustStrip() {
    const freeAbove = useFreeDeliveryAbove()
    const items = [
        { icon: Truck, title: 'Free Home Delivery', sub: freeAbove ? `on orders above ${money(freeAbove)}` : 'right to your door' },
        { icon: ShieldCheck, title: 'Farm Fresh Produce', sub: 'Sourced directly from farmers' },
        { icon: Leaf, title: 'Best Quality Guaranteed', sub: 'Fresh & healthy products' },
        { icon: PackageCheck, title: 'Easy Returns', sub: 'Hassle free returns' },
    ]
    return (
        <section className="rounded-2xl bg-green-50 border border-green-100 px-8 py-6 grid grid-cols-2 xl:grid-cols-4 gap-y-5">
            {items.map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-center justify-center gap-4 xl:border-r last:border-r-0 border-green-200 px-4">
                    <Icon size={40} className="text-green-700 shrink-0" strokeWidth={1.8} />
                    <div className="leading-snug">
                        <p className="text-[17px] font-bold text-slate-900">{title}</p>
                        <p className="text-[15px] text-slate-600">{sub}</p>
                    </div>
                </div>
            ))}
        </section>
    )
}
