import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    Save, 
    Loader2, 
    Layers, 
    Check,
    Search,
    Info,
    LayoutGrid
} from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function FranchiseCategoryDrawer({ isOpen, onClose, franchise }) {
    const { updateFranchiseCategories } = useAdmin();
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Sync selected categories when franchise changes or drawer opens
    useEffect(() => {
        if (isOpen && franchise) {
            const currentIds = (franchise.servedCategories || []).map(c => c._id || c);
            setSelectedCategoryIds(currentIds);
        }
    }, [isOpen, franchise]);

    // Fetch all available categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.get('/catalog/categories');
                if (response.data.success) {
                    setCategories(response.data.results || []);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
                toast.error("Could not load categories");
            }
        };
        if (isOpen) fetchCategories();
    }, [isOpen]);

    const handleToggleCategory = (categoryId) => {
        setSelectedCategoryIds(prev => {
            if (prev.includes(categoryId)) {
                return prev.filter(id => id !== categoryId);
            }
            return [...prev, categoryId];
        });
    };

    const handleSave = async () => {
        if (!franchise?._id) return;
        setIsSubmitting(true);
        try {
            const success = await updateFranchiseCategories(franchise._id, selectedCategoryIds);
            if (success) {
                onClose();
            }
        } catch (error) {
            console.error("Save error:", error);
            toast.error("Could not save categories. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredCategories = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex justify-end">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-900 text-white rounded-sm shadow-xl shadow-slate-200">
                                    <LayoutGrid size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Category Assignment</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">
                                        {franchise?.franchiseName} · Categories this franchise serves
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2.5 rounded-sm border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                                <input 
                                    type="text" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Filter categories..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-sm text-[11px] font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                                />
                            </div>
                        </div>

                        {/* Selection Grid */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 gap-3">
                                {filteredCategories.map((cat) => (
                                    <button
                                        key={cat._id}
                                        onClick={() => handleToggleCategory(cat._id)}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-sm border-2 transition-all group relative overflow-hidden",
                                            selectedCategoryIds.includes(cat._id)
                                                ? "border-slate-900 bg-white shadow-lg shadow-slate-100"
                                                : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className={cn(
                                                "w-10 h-10 rounded-sm flex items-center justify-center border",
                                                selectedCategoryIds.includes(cat._id) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-300 border-slate-200"
                                            )}>
                                                {cat.image ? (
                                                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Layers size={18} />
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <h5 className={cn(
                                                    "font-black text-[11px] uppercase tracking-widest transition-colors",
                                                    selectedCategoryIds.includes(cat._id) ? "text-slate-900" : "text-slate-500"
                                                )}>
                                                    {cat.name}
                                                </h5>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status: Active</p>
                                            </div>
                                        </div>
                                        {selectedCategoryIds.includes(cat._id) ? (
                                            <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-100 relative z-10">
                                                <Check size={14} strokeWidth={3} />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 border-2 border-slate-200 rounded-full group-hover:border-slate-300 transition-colors" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {filteredCategories.length === 0 && (
                                <div className="py-20 text-center space-y-3">
                                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-sm flex items-center justify-center mx-auto text-slate-300">
                                        <Layers size={24} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">No categories match your search</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 bg-white space-y-4">
                            <div className="bg-slate-50 border border-slate-100 p-3 rounded-sm flex items-center gap-3">
                                <Info size={14} className="text-slate-400" />
                                <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed tracking-wide">
                                    Assigning a category allows the franchise to manage corresponding inventory and territory coverage.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:bg-slate-50 rounded-sm transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSubmitting}
                                    className="flex-[2] py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all disabled:bg-slate-200 flex items-center justify-center gap-3"
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    Save
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
