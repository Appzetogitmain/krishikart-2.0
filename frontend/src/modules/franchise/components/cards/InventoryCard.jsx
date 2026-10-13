import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Minus, AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { cn } from '@/lib/utils';
import { useInventory } from '../../contexts/InventoryContext';

export default function InventoryCard({ item }) {
    const { updateStock } = useInventory();
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(item.currentStock);

    const stockLevel = (item.currentStock / item.mbq) * 100;
    const isLow = item.currentStock <= item.mbq;
    const isCritical = item.currentStock <= item.mbq * 0.3;

    const handleUpdate = (newVal) => {
        const value = Math.max(0, newVal);
        setInputValue(value);
        updateStock(item.id, value);
    };

    const getStockStatus = () => {
        if (item.currentStock === 0) return 'out';
        if (isCritical) return 'critical';
        if (isLow) return 'low';
        return 'good';
    };

    return (
        <div
            className={cn(
                "bg-white rounded-[32px] p-5 border border-slate-100 shadow-sm transition-all group relative overflow-hidden",
                isLow && "border-yellow-100 bg-yellow-50/10",
                isCritical && "border-red-100 bg-red-50/10"
            )}
        >
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                        isCritical ? "bg-red-50 text-red-500" : isLow ? "bg-yellow-50 text-yellow-600" : "bg-slate-50 text-slate-400"
                    )}>
                        <Package size={24} />
                    </div>
                    <div>
                        <h4 className="text-base font-black text-slate-900 tracking-tight leading-tight">{item.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.category}</p>
                    </div>
                </div>
                <StatusBadge status={getStockStatus()} />
            </div>

            {/* Stock Level Display */}
            <div className="space-y-3 mb-6 relative z-10">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">Current Stock</p>
                        <p className="text-xl font-black text-slate-900 tracking-tight">
                            {item.currentStock} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.unit}</span>
                        </p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">Minimum Stock</p>
                        <span className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black tracking-tight">
                            {item.mbq} {item.unit}
                        </span>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-50">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(stockLevel, 100)}%` }}
                        className={cn(
                            "h-full rounded-full transition-colors",
                            stockLevel > 100 ? "bg-emerald-500" : stockLevel > 50 ? "bg-blue-500" : isCritical ? "bg-red-500" : "bg-yellow-500"
                        )}
                    />
                </div>
            </div>

            {/* Quick Edit Controls */}
            <div className="flex items-center gap-2 relative z-10">
                <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100 flex-1">
                    <button
                        onClick={() => handleUpdate(item.currentStock - 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all active:scale-90"
                    >
                        <Minus size={18} strokeWidth={3} />
                    </button>
                    <input
                        type="number"
                        value={inputValue}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setInputValue(isNaN(v) ? 0 : Math.max(0, v));
                        }}
                        onBlur={() => handleUpdate(Math.max(0, Number(inputValue) || 0))}
                        className="bg-transparent border-none w-full text-center font-black text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                        onClick={() => handleUpdate(item.currentStock + 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary/20 transition-all active:scale-90"
                    >
                        <Plus size={18} strokeWidth={3} />
                    </button>
                </div>
                <button
                    className="w-13 h-13 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-primary hover:shadow-md transition-all group-hover:rotate-180 duration-500"
                    onClick={() => setInputValue(item.currentStock)}
                >
                    <RefreshCcw size={18} strokeWidth={2.5} />
                </button>
            </div>

            {/* Background Hint */}
            {(isLow || isCritical) && (
                <div className="absolute -right-4 -bottom-4 opacity-[0.05] pointer-events-none">
                    <AlertTriangle size={120} className={isCritical ? "text-red-500" : "text-yellow-500"} />
                </div>
            )}
        </div>
    );
}
