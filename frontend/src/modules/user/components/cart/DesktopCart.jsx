import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ChevronRight, Info, Leaf, Minus, PackageCheck, Plus, ShieldCheck, ShoppingBag, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { optimizedImage } from '../../utils/optimizedImage'

/*
 * Desktop cart (client mockup, Oct 2026): item table, "you may also like" and a sticky order summary.
 * Phones keep the layout in CartScreen. Totals are worked out in CartScreen and passed in, so both
 * layouts always show the same numbers.
 */

const money = (v) => `₹${(Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-IN')}`

// "100 g" for a pack of 100 gm; the unit as typed otherwise
const packLabel = (item) => {
    const size = Number(item.unitValue)
    return size > 0 ? `${size} ${item.unit || ''}`.trim() : (item.unit || '')
}

// 22 packs of 100 gm -> "2.2 kg"
const totalAmount = (item) => {
    const size = Number(item.unitValue)
    const unit = String(item.unit || '').toLowerCase()
    if (!(size > 0)) return null
    const total = size * item.quantity
    if (['g', 'gm', 'gms', 'gram', 'grams'].includes(unit) && total >= 1000) return `${+(total / 1000).toFixed(2)} kg`
    if (['ml'].includes(unit) && total >= 1000) return `${+(total / 1000).toFixed(2)} litre`
    return `${+total.toFixed(2)} ${item.unit}`
}

function Thumb({ src, alt, className }) {
    return src
        ? <img src={optimizedImage(src, 240)} alt={alt} loading="lazy" className={`${className} object-cover`} onError={(e) => { e.target.style.visibility = 'hidden' }} />
        : <span className={`${className} flex items-center justify-center text-slate-300`}><ShoppingBag size={28} /></span>
}

export default function DesktopCart({ deliveryFee, tax, taxRateString, total, recommendations, onRecommendationAdded }) {
    const navigate = useNavigate()
    const { cartItems, updateQuantity, setQuantity, removeFromCart, cartTotal, getActivePrice, deliveryConstraints, addToCart } = useCart()
    const freeAbove = Number(deliveryConstraints?.freeMov) || 0
    const baseFee = Number(deliveryConstraints?.baseFee) || 0
    const shortBy = Math.max(0, Math.ceil(freeAbove - cartTotal))
    const itemCount = cartItems.length

    const clearCart = () => {
        if (!window.confirm('Remove all items from your cart?')) return
        cartItems.forEach((item) => removeFromCart(item.id))
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-16">
            <div className="max-w-[1440px] mx-auto px-8 pt-1">
                <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-4">
                            <h1 className="text-[42px] font-bold text-slate-900 tracking-tight">Your Cart</h1>
                            <span className="h-10 px-4 rounded-full bg-green-100 text-green-800 text-[18px] font-semibold flex items-center">
                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </span>
                        </div>
                        <p className="text-[18px] text-slate-600 mt-1">Review your items and proceed to checkout</p>
                    </div>
                    {freeAbove > 0 && (
                        <button type="button" onClick={() => shortBy > 0 && navigate('/products/all')}
                            className="flex items-center gap-4 h-[68px] pl-5 pr-4 rounded-2xl bg-green-50 border border-green-100 min-w-[460px] text-left hover:bg-green-100/70 transition-colors">
                            <Truck size={34} className="text-green-700 shrink-0" />
                            <span className="flex-1 text-[18px] font-bold text-slate-900">
                                {shortBy > 0 ? <>Add {money(shortBy)} more for <span className="text-green-700">FREE</span> delivery!</> : <>Yay! Your order gets <span className="text-green-700">FREE</span> delivery</>}
                            </span>
                            {shortBy > 0 && <ChevronRight size={22} className="text-slate-500" />}
                        </button>
                    )}
                </div>

                <div className="mt-7 grid grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_470px] gap-8 items-start">
                    <div className="space-y-8 min-w-0">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="grid grid-cols-[minmax(0,1fr)_110px_180px_110px_48px] items-center gap-4 px-6 h-16 bg-slate-50 border-b border-slate-200 text-[16px] font-medium text-slate-600">
                                <span>Product</span><span>Unit Price</span><span className="text-center">Quantity</span><span>Total</span><span />
                            </div>
                            {cartItems.map((item) => {
                                const unitPrice = getActivePrice(item)
                                const amount = totalAmount(item)
                                return (
                                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_110px_180px_110px_48px] items-center gap-4 px-6 py-5 border-b border-slate-100 last:border-b-0">
                                        <div className="flex items-center gap-5 min-w-0">
                                            <button type="button" onClick={() => navigate(`/product/${item.id}`)} className="shrink-0">
                                                <Thumb src={item.primaryImage || item.image} alt={item.name} className="w-24 h-24 rounded-xl border border-slate-200 bg-slate-50" />
                                            </button>
                                            <div className="min-w-0">
                                                <button type="button" onClick={() => navigate(`/product/${item.id}`)} className="text-left text-[22px] font-bold text-slate-900 leading-tight hover:text-green-700 line-clamp-2">{item.name}</button>
                                                {(item.shortDescription || item.category?.name) && (
                                                    <p className="text-[16px] text-slate-600 mt-1 line-clamp-1">{item.shortDescription || item.category?.name}</p>
                                                )}
                                                <span className="inline-flex items-center gap-1.5 mt-2 h-8 px-3 rounded-lg bg-green-50 text-green-800 text-[14px] font-semibold">
                                                    <Leaf size={15} className="fill-green-600 text-green-600" /> Farm Fresh
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[22px] font-bold text-slate-900 tabular-nums">{money(unitPrice)}</p>
                                            <p className="text-[15px] text-slate-500">/ {packLabel(item)}</p>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                <button type="button" aria-label="Remove one" onClick={() => updateQuantity(item.id, -1)} className="w-12 h-12 flex items-center justify-center text-slate-700 hover:bg-slate-50">
                                                    <Minus size={20} />
                                                </button>
                                                <input type="number" value={item.quantity} aria-label="Quantity" onChange={(e) => setQuantity(item.id, e.target.value)}
                                                    className="w-16 h-12 text-center text-[20px] font-semibold text-slate-900 border-x border-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tabular-nums" />
                                                <button type="button" aria-label="Add one" onClick={() => updateQuantity(item.id, 1)} className="w-12 h-12 flex items-center justify-center bg-green-700 text-white hover:bg-green-800">
                                                    <Plus size={20} />
                                                </button>
                                            </div>
                                            {amount && item.quantity > 1 && (
                                                <p className="text-[14px] text-slate-600 tabular-nums">{item.quantity} × {packLabel(item)} ({amount})</p>
                                            )}
                                        </div>
                                        <p className="text-[22px] font-bold text-slate-900 tabular-nums">{money(unitPrice * item.quantity)}</p>
                                        <button type="button" aria-label="Remove item" onClick={() => removeFromCart(item.id)}
                                            className="w-12 h-12 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                )
                            })}
                            <div className="flex items-center justify-between px-6 py-5 border-t border-slate-200">
                                <button type="button" onClick={() => navigate('/home')}
                                    className="inline-flex items-center gap-3 h-[52px] px-6 rounded-xl border border-slate-300 text-[17px] font-semibold text-slate-900 hover:bg-slate-50">
                                    <ArrowLeft size={20} /> Continue Shopping
                                </button>
                                <button type="button" onClick={clearCart}
                                    className="inline-flex items-center gap-3 h-[52px] px-6 rounded-xl border border-red-200 bg-red-50 text-[17px] font-semibold text-red-600 hover:bg-red-100">
                                    <Trash2 size={20} /> Clear Cart
                                </button>
                            </div>
                        </div>

                        {recommendations.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-[24px] font-bold text-slate-900">You may also like</h2>
                                    <button type="button" onClick={() => navigate('/products/all')} className="inline-flex items-center gap-2 text-[17px] font-semibold text-green-700 hover:underline">
                                        View All <ArrowRight size={18} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    {recommendations.slice(0, 4).map((p) => (
                                        <div key={p._id} className="rounded-2xl border border-slate-200 p-3 flex flex-col">
                                            <button type="button" onClick={() => navigate(`/product/${p._id}`)}>
                                                <Thumb src={p.primaryImage} alt={p.name} className="w-full aspect-[4/3] rounded-xl bg-slate-50" />
                                            </button>
                                            <p className="mt-3 text-[18px] font-bold text-slate-900 line-clamp-1">{p.name}</p>
                                            <p className="text-[16px] text-slate-600"><span className="text-[19px] font-bold text-slate-900">{money(p.effectiveStorefrontPrice ?? p.price)}</span> / {packLabel(p)}</p>
                                            <button type="button"
                                                onClick={() => { addToCart(p); onRecommendationAdded(p._id); toast.success(`${p.name} added to cart`) }}
                                                className="mt-3 h-12 rounded-xl border-2 border-green-700 text-green-700 text-[17px] font-bold inline-flex items-center justify-center gap-2 hover:bg-green-700 hover:text-white transition-colors">
                                                <ShoppingCart size={19} /> Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-28">
                        <div className="p-7">
                            <h2 className="text-[26px] font-bold text-slate-900">Order Summary</h2>
                            <div className="mt-6 space-y-5 text-[18px]">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                                    <span className="font-semibold text-slate-900 tabular-nums">{money(cartTotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span className="inline-flex items-center gap-2">Delivery Fee <Info size={17} className="text-slate-400" aria-label={freeAbove ? `Free on orders above ${money(freeAbove)}` : undefined} /></span>
                                    {deliveryFee === 0
                                        ? <span className="flex items-center gap-3"><span className="font-bold text-green-700">FREE</span>{baseFee > 0 && <span className="text-slate-400 line-through">{money(baseFee)}</span>}</span>
                                        : <span className="font-semibold text-slate-900 tabular-nums">{money(deliveryFee)}</span>}
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span className="inline-flex items-center gap-2">Taxes &amp; Charges ({taxRateString}%) <Info size={17} className="text-slate-400" /></span>
                                    <span className="font-semibold text-slate-900 tabular-nums">{money(tax)}</span>
                                </div>
                            </div>
                            <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-[24px] font-bold text-slate-900">Total Payable</span>
                                <span className="text-[34px] font-bold text-green-700 tabular-nums">{money(total)}</span>
                            </div>
                            {freeAbove > 0 && (
                                <div className="mt-5 rounded-2xl bg-green-50 border border-green-100 px-5 py-4 flex items-center gap-4">
                                    <Truck size={36} className="text-green-700 shrink-0" />
                                    {deliveryFee === 0
                                        ? <p className="leading-snug"><span className="block text-[17px] font-bold text-slate-900">You are eligible for FREE delivery</span><span className="text-[15px] text-slate-600">on orders above {money(freeAbove)}</span></p>
                                        : <p className="leading-snug"><span className="block text-[17px] font-bold text-slate-900">Add {money(shortBy)} more for FREE delivery</span><span className="text-[15px] text-slate-600">on orders above {money(freeAbove)}</span></p>}
                                </div>
                            )}
                            <button type="button" onClick={() => navigate('/checkout')}
                                className="mt-6 w-full h-16 rounded-2xl bg-green-700 hover:bg-green-800 text-white text-[21px] font-bold inline-flex items-center justify-center gap-3 shadow-lg shadow-green-700/20 transition-colors">
                                Proceed to Checkout <ArrowRight size={22} />
                            </button>
                        </div>
                        <div className="border-t border-slate-200 px-5 py-5 grid grid-cols-3 gap-3">
                            {[[ShieldCheck, '100% Secure', 'Payments'], [Leaf, 'Freshness', 'Guaranteed'], [PackageCheck, 'Easy', 'Returns']].map(([Icon, a, b]) => (
                                <div key={a} className="flex items-center gap-2">
                                    <Icon size={28} className="text-green-700 shrink-0" />
                                    <span className="text-[14px] leading-tight text-slate-700"><span className="block font-semibold text-slate-900">{a}</span>{b}</span>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
