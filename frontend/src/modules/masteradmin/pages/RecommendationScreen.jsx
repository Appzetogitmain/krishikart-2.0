import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home,
    ChevronRight,
    Search,
    Plus,
    Pencil,
    Trash2,
    ArrowRight,
    Package,
    X,
    CheckCircle2,
    AlertCircle,
    Star,
    ToggleLeft,
    ToggleRight,
    Info
} from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function RecommendationScreen() {
    const {
        products,
        recommendations,
        isLoading,
        fetchRecommendations,
        createRecommendationMapping,
        updateRecommendationMapping,
        deleteRecommendationMapping,
        toggleRecommendationStatus
    } = useCatalog();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRec, setEditingRec] = useState(null);

    useEffect(() => {
        fetchRecommendations();
    }, []);

    const filteredRecommendations = recommendations.filter(rec => {
        const sourceName = rec.sourceProduct?.name?.toLowerCase() || '';
        return sourceName.includes(searchTerm.toLowerCase());
    });

    const handleOpenCreateModal = () => {
        setEditingRec(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (rec) => {
        setEditingRec(rec);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Remove this recommendation? The products themselves will not be deleted.')) {
            await deleteRecommendationMapping(id);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Header Sticky */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Catalog</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Recommendations</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Product Recommendations</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleOpenCreateModal}
                            className="px-6 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-indigo-600 shadow-sm"
                        >
                            <Plus size={12} />
                            Add Recommendation
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-8 max-w-[1400px] mx-auto">
                {/* Search & Stats Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
                    <div className="lg:col-span-3">
                        <div className="flex items-center gap-3 px-4 bg-white border border-slate-200 rounded-sm group focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-900/5 transition-all shadow-sm">
                            <Search className="text-slate-400 group-focus-within:text-slate-900 transition-colors" size={16} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="SEARCH BY SOURCE PRODUCT NAME..."
                                className="w-full bg-transparent py-3 text-[10px] font-bold uppercase tracking-widest focus:outline-none outline-none border-none text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-sm p-3 flex flex-col justify-center shadow-lg">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Recommendations</p>
                        <p className="text-lg font-black text-white leading-none">{recommendations.length}</p>
                    </div>
                </div>

                {/* Info Alert */}
                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-sm p-4 flex items-start gap-3">
                    <Info className="text-indigo-600 shrink-0 mt-0.5" size={16} />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Works both ways</p>
                        <p className="text-[10px] font-medium text-indigo-600 leading-relaxed uppercase tracking-tight">
                            When you link <span className="font-black text-indigo-900">Product A → Product B</span>, the app also adds <span className="font-black text-indigo-900">Product B → Product A</span>. You can manage them independently later.
                        </p>
                    </div>
                </div>

                {/* Recommendations Table */}
                <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">When customer buys</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Shown as</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Add-ons</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <div className="animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest">Loading recommendations...</div>
                                        </td>
                                    </tr>
                                ) : filteredRecommendations.length > 0 ? filteredRecommendations.map((rec) => (
                                    <tr key={rec._id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-sm border border-slate-200 overflow-hidden shrink-0">
                                                    {rec.sourceProduct?.primaryImage ? (
                                                        <img src={rec.sourceProduct.primaryImage} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                            <Package size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight line-clamp-1">{rec.sourceProduct?.name || 'Unknown Product'}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">₹{rec.sourceProduct?.price} / {rec.sourceProduct?.unit}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <ArrowRight className="text-slate-300 mx-auto" size={16} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                {rec.recommendedProducts?.slice(0, 3).map((p) => (
                                                    <div key={p._id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm border border-slate-200 flex items-center gap-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{p.name}</span>
                                                    </div>
                                                ))}
                                                {rec.recommendedProducts?.length > 3 && (
                                                    <div className="bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest">
                                                        +{rec.recommendedProducts.length - 3} MORE
                                                    </div>
                                                )}
                                                {(!rec.recommendedProducts || rec.recommendedProducts.length === 0) && (
                                                    <span className="text-[10px] font-bold text-rose-400 uppercase italic">No products linked</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 italic">"{rec.label}"</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleRecommendationStatus(rec._id)}
                                                className={cn(
                                                    "flex items-center gap-2 px-2 py-1 rounded-sm border transition-all duration-200",
                                                    rec.isActive 
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" 
                                                        : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                                                )}
                                            >
                                                {rec.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                                <span className="text-[10px] font-black uppercase tracking-widest">{rec.isActive ? 'Active' : 'Paused'}</span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenEditModal(rec)}
                                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all border border-transparent hover:border-slate-100"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rec._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all border border-transparent hover:border-rose-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                                    <Star className="text-slate-200" size={32} />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">No Recommendations Configured</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">No recommendations yet. Add one to suggest products to customers.</p>
                                                </div>
                                                <button
                                                    onClick={handleOpenCreateModal}
                                                    className="mt-4 px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-100"
                                                >
                                                    Add Recommendation
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <RecommendationFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingRec={editingRec}
                products={products}
                onSubmit={editingRec ? updateRecommendationMapping : createRecommendationMapping}
            />
        </div>
    );
}

function RecommendationFormModal({ isOpen, onClose, editingRec, products, onSubmit }) {
    const [formData, setFormData] = useState({
        sourceProductId: '',
        recommendedProductIds: [],
        label: 'Frequently Bought Together'
    });
    const [searchSource, setSearchSource] = useState('');
    const [searchRec, setSearchRec] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (editingRec) {
            setFormData({
                sourceProductId: editingRec.sourceProduct?._id || '',
                recommendedProductIds: editingRec.recommendedProducts?.map(p => p._id) || [],
                label: editingRec.label || 'Frequently Bought Together'
            });
        } else {
            setFormData({
                sourceProductId: '',
                recommendedProductIds: [],
                label: 'Frequently Bought Together'
            });
        }
    }, [editingRec, isOpen]);

    if (!isOpen) return null;

    const filteredSource = products.filter(p => 
        p.name.toLowerCase().includes(searchSource.toLowerCase()) ||
        p._id.toLowerCase().includes(searchSource.toLowerCase())
    ).slice(0, 5);

    const filteredRec = products.filter(p => 
        (p.name.toLowerCase().includes(searchRec.toLowerCase()) ||
        p._id.toLowerCase().includes(searchRec.toLowerCase())) &&
        p._id !== formData.sourceProductId
    ).slice(0, 5);

    const toggleProductSelection = (productId) => {
        setFormData(prev => {
            const current = prev.recommendedProductIds;
            if (current.includes(productId)) {
                return { ...prev, recommendedProductIds: current.filter(id => id !== productId) };
            } else {
                return { ...prev, recommendedProductIds: [...current, productId] };
            }
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.sourceProductId || formData.recommendedProductIds.length === 0) {
            toast.error('Please select both a source product and at least one recommendation');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingRec) {
                await onSubmit(editingRec._id, formData);
            } else {
                await onSubmit(formData);
            }
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedSourceProduct = products.find(p => p._id === formData.sourceProductId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white rounded-sm shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden"
            >
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                        {editingRec ? 'Edit Recommendation' : 'New Recommendation'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
                    {/* Source Product Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-4 h-4 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                            When customer buys
                        </label>
                        
                        {selectedSourceProduct ? (
                            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-sm overflow-hidden">
                                        <img src={selectedSourceProduct.primaryImage} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{selectedSourceProduct.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {selectedSourceProduct._id}</p>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setFormData({ ...formData, sourceProductId: '' })}
                                    className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        value={searchSource}
                                        onChange={(e) => setSearchSource(e.target.value)}
                                        placeholder="SEARCH FOR A PRODUCT..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-slate-400 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {searchSource && filteredSource.map(p => (
                                        <button
                                            key={p._id}
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, sourceProductId: p._id });
                                                setSearchSource('');
                                            }}
                                            className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-sm border border-transparent hover:border-slate-100 transition-all text-left"
                                        >
                                            <div className="w-8 h-8 bg-slate-100 rounded-sm overflow-hidden">
                                                <img src={p.primaryImage} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{p.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recommended Products Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-4 h-4 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                            Suggested Add-ons
                        </label>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                value={searchRec}
                                onChange={(e) => setSearchRec(e.target.value)}
                                placeholder="SEARCH PRODUCTS TO SUGGEST..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-slate-400 transition-all"
                            />
                        </div>

                        {/* Dropdown for search results */}
                        {searchRec && (
                            <div className="bg-white border border-slate-200 rounded-sm shadow-xl max-h-48 overflow-y-auto">
                                {filteredRec.map(p => {
                                    const isSelected = formData.recommendedProductIds.includes(p._id);
                                    return (
                                        <button
                                            key={p._id}
                                            type="button"
                                            onClick={() => toggleProductSelection(p._id)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 transition-all text-left border-b border-slate-50 last:border-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-sm overflow-hidden">
                                                    <img src={p.primaryImage} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{p.name}</span>
                                            </div>
                                            {isSelected && <CheckCircle2 className="text-emerald-500" size={14} />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selected chips */}
                        <div className="flex flex-wrap gap-2 pt-2">
                            {formData.recommendedProductIds.map(id => {
                                const p = products.find(prod => prod._id === id);
                                if (!p) return null;
                                return (
                                    <div key={id} className="bg-slate-900 text-white pl-2 pr-1 py-1 rounded-sm flex items-center gap-2 group">
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em]">{p.name}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => toggleProductSelection(id)}
                                            className="p-1 hover:bg-white/20 rounded-sm transition-colors"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Display Label */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-4 h-4 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                            Suggestion Label
                        </label>
                        <select
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-slate-400 transition-all appearance-none"
                        >
                            <option value="Frequently Bought Together">Frequently Bought Together</option>
                            <option value="Goes Well With">Goes Well With</option>
                            <option value="Recommended for You">Recommended for You</option>
                            <option value="Don't Forget to Add">Don't Forget to Add</option>
                            <option value="Premium Pairing">Premium Pairing</option>
                        </select>
                    </div>

                    {!editingRec && (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm flex items-start gap-3">
                            <Star className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                            <div>
                                <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Works both ways</p>
                                <p className="text-[10px] font-medium text-emerald-600 leading-relaxed uppercase tracking-tight mt-1">
                                    Saving this also suggests the first product when customers buy the suggested ones.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-slate-100 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={cn(
                                "flex-1 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm transition-all shadow-xl shadow-slate-100",
                                isSubmitting ? "opacity-50 cursor-wait" : "hover:bg-emerald-600"
                            )}
                        >
                            {isSubmitting ? 'Processing...' : editingRec ? 'Save Changes' : 'Save Recommendation'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
