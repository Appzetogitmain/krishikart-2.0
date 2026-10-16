import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus } from 'lucide-react'
import { unitPriceForQuantity, usefulBulkTiers } from '../../utils/pricing'
import { Button } from '@/components/ui/button'

export default function QuantityModal({ isOpen, onClose, product, onAdd }) {
    const [modalQty, setModalQty] = useState(1);

    if (!isOpen) return null;

    const unitBase = Number(product.effectiveStorefrontPrice ?? product.price ?? 0);
    const originalPrice = Number(product.comparePrice || product.mrp || 0);
    const listAnchor = Number(product.storefrontListPrice ?? product.price ?? 0);
    const strikeMrp = Math.max(
        originalPrice > unitBase ? originalPrice : 0,
        product.effectiveStorefrontPrice != null && listAnchor > unitBase ? listAnchor : 0,
    );
    const hasOriginalPrice = strikeMrp > unitBase;

    const unitPriceForQty = (qty) => {
        const q = Math.max(1, Number(qty) || 1);
        return unitPriceForQuantity(unitBase, product.bulkPricing, q);
    };
    const lineTotal = (qty) => unitPriceForQty(qty) * Math.max(1, Number(qty) || 1);

    const handleFinalAdd = () => {
        const finalQty = Math.max(1, Number(modalQty) || 1);
        onAdd(product, finalQty);
        onClose();
    };

    return createPortal(
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 isolate"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-[440px] bg-white rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-6">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Select quantity</h2>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors text-slate-400"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Product Info Card */}
                    <div className="px-8 pb-8">
                        <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
                            <div className="flex gap-6 items-start">
                                <div className="relative w-28 h-28 rounded-2xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                                    <img
                                        src={product.primaryImage || product.image}
                                        alt={product.name}
                                        className="absolute inset-0 h-full w-full object-cover object-center select-none"
                                        draggable={false}
                                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80' }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <h3 className="text-lg font-bold text-slate-900 leading-snug line-clamp-2 mb-1">{product.name}</h3>
                                    <p className="text-xs font-semibold text-slate-400 capitalize">{product.unitValue} {product.unit}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-8">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">₹{unitPriceForQty(modalQty)}</span>
                                    {hasOriginalPrice && (
                                        <span className="text-base text-slate-400 line-through font-medium">₹{strikeMrp}</span>
                                    )}
                                </div>

                                <div className="flex items-center bg-white border border-emerald-200 rounded-xl overflow-hidden h-11">
                                    <button
                                        onClick={() => setModalQty(Math.max(1, (Number(modalQty) || 1) - 1))}
                                        className="w-10 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors border-r border-emerald-100"
                                    >
                                        <Minus size={16} strokeWidth={3} />
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={modalQty}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? '' : parseInt(e.target.value);
                                            setModalQty(val === '' ? '' : (isNaN(val) ? 1 : Math.max(1, val)));
                                        }}
                                        onBlur={(e) => {
                                            if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                                                setModalQty(1);
                                            }
                                        }}
                                        className="w-12 h-full flex items-center justify-center font-black text-slate-900 bg-slate-50/50 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setModalQty((Number(modalQty) || 1) + 1)}
                                        className="w-10 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors border-l border-emerald-100"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            {/* Bulk Tiers */}
                            <div className="mt-8 space-y-3">
                                {usefulBulkTiers(unitBase, product.bulkPricing).map((tier, idx) => (
                                    <div key={idx} className="bg-[#f4f7ff] rounded-2xl px-6 py-4 flex items-center justify-between">
                                        <div className="text-[#3b5998] font-bold text-sm">
                                            ₹{tier.price}/{product.unit === 'pcs' ? 'pc' : product.unit} for {tier.minQty} {product.unit}+
                                        </div>
                                        <button
                                            onClick={() => setModalQty(tier.minQty)}
                                            className="text-emerald-600 font-bold text-sm hover:underline"
                                        >
                                            Select {tier.minQty}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={handleFinalAdd}
                                className="w-full h-14 mt-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100"
                            >
                                Add items to cart · ₹{lineTotal(modalQty)}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    )
}
