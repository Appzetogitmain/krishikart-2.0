import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Home, ChevronRight, ListTree, Plus, X, Pencil, Trash2, LayoutGrid, Upload, Image as ImageIcon } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { cn } from '@/lib/utils';

export default function SubcategoryManagementScreen() {
    const { categories, subcategories, addSubcategory, updateSubcategory, deleteSubcategory } = useCatalog();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newSub, setNewSub] = useState({ name: '', categoryId: '', image: null });
    const [editSub, setEditSub] = useState({ id: '', name: '', categoryId: '', image: null, file: null, isVisible: true });

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const handleAdd = async () => {
        if (!newSub.name.trim() || !newSub.categoryId) return;
        setIsSubmitting(true);
        try {
            await addSubcategory(newSub);
            setNewSub({ name: '', categoryId: '', image: null, file: null });
            setShowAddModal(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editSub.name.trim() || !editSub.categoryId) return;
        setIsSubmitting(true);
        try {
            await updateSubcategory(editSub.id, editSub);
            setShowEditModal(false);
            setEditSub({ id: '', name: '', categoryId: '', image: null, file: null, isVisible: true });
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest">Loading...</div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20 relative">
            {/* Add Subcategory Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-sm shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">New Subcategory</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Parent Category</label>
                                    <select
                                        value={newSub.categoryId}
                                        onChange={(e) => setNewSub(prev => ({ ...prev, categoryId: e.target.value }))}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Parent Category...</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Subcategory Name</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newSub.name}
                                        onChange={(e) => setNewSub(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Exotic Fruits"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Subcategory Image</label>
                                    <div className="relative aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-sm flex flex-col items-center justify-center space-y-2 group/upload cursor-pointer hover:bg-white hover:border-emerald-500 transition-all overflow-hidden">
                                        {newSub.image ? (
                                            <>
                                                <img src={newSub.image} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setNewSub(prev => ({ ...prev, image: null })); }}
                                                    className="absolute top-2 right-2 p-1.5 bg-white text-rose-500 rounded-full shadow-lg z-10"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={20} className="text-slate-400 group-hover/upload:text-emerald-500 transition-colors" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Icon/Image</span>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const url = URL.createObjectURL(file);
                                                            setNewSub(prev => ({ ...prev, image: url, file }));
                                                        }
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleAdd}
                                    className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-emerald-600 transition-all shadow-lg"
                                >
                                    Create Subcategory
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Subcategory Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditModal(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-sm shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Edit Subcategory</h3>
                                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Parent Category</label>
                                    <select
                                        value={editSub.categoryId}
                                        onChange={(e) => setEditSub(prev => ({ ...prev, categoryId: e.target.value }))}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Parent Category...</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Subcategory Name</label>
                                    <input
                                        type="text"
                                        value={editSub.name}
                                        onChange={(e) => setEditSub(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Exotic Fruits"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="edit-sub-visible"
                                        checked={editSub.isVisible}
                                        onChange={(e) => setEditSub(prev => ({ ...prev, isVisible: e.target.checked }))}
                                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                    />
                                    <label htmlFor="edit-sub-visible" className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Visible to Customers</label>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Subcategory Image</label>
                                    <div className="relative aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-sm flex flex-col items-center justify-center space-y-2 group/upload cursor-pointer hover:bg-white hover:border-emerald-500 transition-all overflow-hidden">
                                        {(editSub.image || editSub.file) ? (
                                            <>
                                                <img src={editSub.image} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditSub(prev => ({ ...prev, image: null, file: null })); }}
                                                    className="absolute top-2 right-2 p-1.5 bg-white text-rose-500 rounded-full shadow-lg z-10"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={20} className="text-slate-400 group-hover/upload:text-emerald-500 transition-colors" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Change Image</span>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const url = URL.createObjectURL(file);
                                                            setEditSub(prev => ({ ...prev, image: url, file }));
                                                        }
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdate}
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header Sticky */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 transition-all duration-300">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Catalog</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Subcategories</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Subcategories</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-600 shadow-sm"
                        >
                            <Plus size={12} />
                            Create Subcategory
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto p-8">
                <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Subcategories ({subcategories.length})</h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {subcategories.length > 0 ? subcategories.map((sub, idx) => {
                            const categoryId = typeof sub.category === 'object' ? sub.category._id : sub.category;
                            const parent = categories.find(c => c._id === categoryId);
                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    key={sub._id}
                                    className="group p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-slate-100 text-slate-400 flex items-center justify-center rounded-sm group-hover:bg-slate-900 group-hover:text-white transition-all overflow-hidden border border-slate-200">
                                            {sub.image ? (
                                                <img src={sub.image} className="w-full h-full object-cover" alt={sub.name} />
                                            ) : (
                                                <GitBranch size={18} />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">{sub.name}</h4>
                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-sm border border-slate-200">
                                                    ID: {sub._id}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                                    <LayoutGrid size={10} />
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">Mapped to: {parent?.name || 'Unknown'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setEditSub({
                                                    id: sub._id,
                                                    name: sub.name,
                                                    categoryId: typeof sub.category === 'object' ? sub.category._id : sub.category,
                                                    image: sub.image,
                                                    isVisible: sub.isVisible,
                                                    file: null
                                                });
                                                setShowEditModal(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all border border-transparent hover:border-slate-100 shadow-sm text-xs font-black uppercase tracking-widest flex items-center gap-2"
                                        >
                                            <Pencil size={14} />
                                            Modify
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Delete this subcategory?')) {
                                                    deleteSubcategory(sub._id);
                                                }
                                            }}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all border border-transparent hover:border-rose-100 shadow-sm text-xs font-black uppercase tracking-widest flex items-center gap-2"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        }) : (
                            <div className="p-24 text-center space-y-4">
                                <GitBranch size={48} className="text-slate-200 mx-auto" />
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">No subcategories yet</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto">
                                    Subcategories help customers find products faster.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

