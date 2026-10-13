import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Search, Package, CheckCircle2, Circle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function VendorProductDrawer({ isOpen, onClose, vendor }) {
    const { fetchProducts, assignProductsToVendor } = useAdmin();
    const [products, setProducts] = useState([]);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && vendor) {
            loadProducts();
            // Initialize selected products from vendor
            // Ensure vendor.products exists and is an array of IDs
            const initialSelection = (vendor.products || []).map(p =>
                typeof p === 'object' ? p._id : p
            );
            setSelectedProductIds(initialSelection);
        }
    }, [isOpen, vendor]);

    const loadProducts = async () => {
        setIsLoading(true);
        try {
            const data = await fetchProducts();
            if (Array.isArray(data)) {
                setProducts(data);
            } else {
                console.error("Fetched products is not an array:", data);
                setProducts([]);
            }
        } catch (e) {
            console.error(e);
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleProduct = (productId) => {
        setSelectedProductIds(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        );
    };

    const toggleAll = () => {
        const allFilteredIds = filteredProducts.map(p => p._id);
        const allSelected = allFilteredIds.every(id => selectedProductIds.includes(id));

        if (allSelected) {
            setSelectedProductIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
        } else {
            const newIds = [...selectedProductIds];
            allFilteredIds.forEach(id => {
                if (!newIds.includes(id)) newIds.push(id);
            });
            setSelectedProductIds(newIds);
        }
    };

    const handleSave = async () => {
        if (!vendor) return;
        setIsSaving(true);
        const success = await assignProductsToVendor(vendor._id, selectedProductIds);
        setIsSaving(false);
        if (success) {
            onClose();
            // Ideally trigger a refresh of vendors list in parent
        }
    };

    const filteredProducts = products.filter(p => {
        const pName = p.name || '';
        const pCat = p.category?.name || '';
        const search = searchTerm.toLowerCase();

        const matchesCategory = selectedCategory === 'All' || pCat === selectedCategory;
        const matchesSearch = pName.toLowerCase().includes(search) || pCat.toLowerCase().includes(search);

        return matchesCategory && matchesSearch;
    });

    const categories = ['All', ...new Set(products.map(p => p.category?.name).filter(Boolean))];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex justify-end">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Assign Products</h3>
                                <p className="text-slate-500 font-bold text-[10px] mt-1 uppercase tracking-wider">
                                    Manage products for <span className="text-primary">{vendor?.fullName}</span>
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Search & Filter */}
                    <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10 flex flex-col gap-3">
                        <div className="flex gap-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-xs font-bold uppercase tracking-wide cursor-pointer text-slate-700"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value.trim())}
                                    placeholder="Search products..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none text-xs font-bold placeholder:text-slate-400 focus:border-slate-400 transition-all uppercase tracking-wide"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <button
                                onClick={toggleAll}
                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-2"
                            >
                                <div className={cn("w-4 h-4 border-2 rounded-sm flex items-center justify-center",
                                    filteredProducts.every(p => selectedProductIds.includes(p._id)) ? "bg-primary border-primary text-white" : "border-slate-300 bg-white"
                                )}>
                                    {filteredProducts.every(p => selectedProductIds.includes(p._id)) && <CheckCircle2 size={10} />}
                                </div>
                                Select All Visible
                            </button>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                {filteredProducts.length} Items Found
                            </span>
                        </div>
                    </div>

                    {/* Product List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-2">
                                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Catalog...</span>
                            </div>
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map(product => {
                                const isSelected = selectedProductIds.includes(product._id);
                                return (
                                    <div
                                        key={product._id}
                                        onClick={() => toggleProduct(product._id)}
                                        className={cn(
                                            "bg-white p-3 rounded-lg border flex items-center gap-4 cursor-pointer transition-all group hover:border-slate-300",
                                            isSelected ? "border-primary/50 bg-primary/5" : "border-slate-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0",
                                            isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-300 group-hover:text-slate-400"
                                        )}>
                                            {isSelected ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                                        </div>

                                        <div className="w-10 h-10 bg-slate-50 rounded-md border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {product.primaryImage ? (
                                                <img src={product.primaryImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Package size={16} className="text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{product.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.category?.name || 'Uncategorized'}</span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-[10px] font-bold text-slate-500 tabular-nums">₹{product.price}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-center">
                                <Package size={24} className="text-slate-300 mb-2" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No products found</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-white border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected</span>
                            <span className="text-sm font-black text-slate-900 tabular-nums">{selectedProductIds.length} Items</span>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : (<>Save Assignment <Save size={16} /></>)}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
