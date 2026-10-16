import React, { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { usefulBulkTiers } from '../../utils/pricing'
import { motion } from 'framer-motion'
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from "@/components/ui/sheet"

export default function MobileQuantitySheet({ isOpen, onClose, product, onAdd }) {
    const [qty, setQty] = useState(1)

    if (!product) return null

    const unitBase = Number(product.effectiveStorefrontPrice ?? product.price ?? 0)
    const comparePrice = Number(product.comparePrice || product.mrp || 0)
    const listAnchor = Number(product.storefrontListPrice ?? product.price ?? 0)
    const strikePrice = Math.max(
        comparePrice > unitBase ? comparePrice : 0,
        product.effectiveStorefrontPrice != null && listAnchor > unitBase ? listAnchor : 0,
    )
    const hasComparePrice = strikePrice > unitBase

    const handleAdd = () => {
        onAdd(product, qty)
        onClose()
    }

    // First bulk rate that is actually cheaper than the normal rate (none = no bulk offer shown)
    const activeBulkDeal = usefulBulkTiers(unitBase, product.bulkPricing)[0] || null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent
                side="bottom"
                className="p-0 border-none bg-transparent overflow-visible"
            >
                <motion.div
                    initial={{ y: 32, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 32, opacity: 0 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                    className="w-full rounded-t-[32px] bg-slate-50 shadow-lg border border-slate-100/80 overflow-hidden will-change-transform"
                >
                    <div className="px-6 py-5 flex items-center justify-between bg-white border-b border-slate-100">
                        <SheetTitle className="text-[18px] font-black text-slate-900 tracking-tight">
                            Select quantity
                        </SheetTitle>
                    </div>

                    <div className="p-4">
                        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100">
                            {/* Product Info */}
                            <div className="flex gap-4 mb-6">
                                <div className="relative w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                                    <img
                                        src={product.primaryImage || product.image || product.image}
                                        className="absolute inset-0 h-full w-full object-cover object-center select-none"
                                        draggable={false}
                                        alt={product.name}
                                    />
                                </div>
                                <div className="flex-1 py-1">
                                    <h3 className="text-[17px] font-bold text-slate-900 leading-tight mb-1">
                                        {product.name}
                                    </h3>
                                    <p className="text-[13px] font-bold text-slate-400">
                                        {product.unitValue} {product.unit}
                                    </p>
                                </div>
                            </div>

                            {/* Price and Add button */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-[24px] font-black text-slate-900">
                                        ₹{unitBase}
                                    </span>
                                    {hasComparePrice && (
                                        <span className="text-sm text-slate-400 line-through font-bold">
                                            ₹{strikePrice}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center bg-white border border-emerald-200 rounded-xl overflow-hidden h-11">
                                    <button
                                        onClick={() => setQty(Math.max(1, qty - 1))}
                                        className="w-10 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors border-r border-emerald-100"
                                    >
                                        <Minus size={16} strokeWidth={3} />
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={qty}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? '' : parseInt(e.target.value);
                                            setQty(val === '' ? '' : (isNaN(val) ? 1 : Math.max(1, val)));
                                        }}
                                        onBlur={(e) => {
                                            if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                                                setQty(1);
                                            }
                                        }}
                                        className="w-12 h-full flex items-center justify-center font-black text-slate-900 bg-slate-50/50 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setQty(qty + 1)}
                                        className="w-10 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors border-l border-emerald-100"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleAdd}
                                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 mb-4"
                            >
                                Add to cart · ₹{unitBase * (Number(qty) || 1)}
                            </button>

                            {activeBulkDeal && (
                                <button
                                    onClick={() => {
                                        setQty(activeBulkDeal.minQty)
                                        onAdd(product, activeBulkDeal.minQty)
                                        onClose()
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 group active:scale-[0.98] transition-all"
                                >
                                    <span className="text-[13px] font-bold text-blue-600">
                                        ₹{activeBulkDeal.price}/{product.unit === 'pcs' ? 'pc' : product.unit} for {activeBulkDeal.minQty} {product.unit}+
                                    </span>
                                    <span className="text-[13px] font-black text-emerald-600">
                                        Add {activeBulkDeal.minQty}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </SheetContent>
        </Sheet>
    )
}
