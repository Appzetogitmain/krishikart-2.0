import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tags, Home, ChevronRight, Layers, Plus, X, Pencil, Trash2, Info, Upload, Image as ImageIcon } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CategoryManagementScreen() {
    const { categories, addCategory, deleteCategory, updateCategory, isLoading: contextLoading } = useCatalog();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newCat, setNewCat] = useState({ name: '', description: '', adminCommission: 0, image: null, file: null });
    const [editCat, setEditCat] = useState({ id: '', name: '', description: '', adminCommission: 0, image: null, file: null, isVisible: true });

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const handleAdd = async () => {
        if (!newCat.name.trim()) return;
        const duplicate = categories.some(cat => cat.name.trim().toLowerCase() === newCat.name.trim().toLowerCase());
        if (duplicate) {
            toast.error("A category with this name already exists. Please choose a unique name.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addCategory(newCat);
            setNewCat({ name: '', description: '', adminCommission: 0, image: null, file: null });
            setShowAddModal(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editCat.name.trim()) return;
        const duplicate = categories.some(cat => cat._id !== editCat.id && cat.name.trim().toLowerCase() === editCat.name.trim().toLowerCase());
        if (duplicate) {
            toast.error("A category with this name already exists. Please choose a unique name.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updateCategory(editCat.id, editCat);
            setShowEditModal(false);
            setEditCat({ id: '', name: '', description: '', adminCommission: 0, image: null, file: null, isVisible: true });
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || contextLoading) {
        return <div className="p-8 animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest">Loading...</div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20 relative">
            {/* Add Category Modal */}
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
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">New Category</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Category Name</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newCat.name}
                                        onChange={(e) => setNewCat(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Organic Dairy"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Description</label>
                                    <textarea
                                        rows={3}
                                        value={newCat.description}
                                        onChange={(e) => setNewCat(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Short description of this category..."
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 resize-none"
                                    ></textarea>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Admin Commission (%)</label>
                                    <input
                                        type="number"
                                        value={newCat.adminCommission}
                                        onChange={(e) => setNewCat(prev => ({ ...prev, adminCommission: e.target.value }))}
                                        placeholder="0"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Category Image</label>
                                    <div className="relative aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-sm flex flex-col items-center justify-center space-y-2 group/upload cursor-pointer hover:bg-white hover:border-emerald-500 transition-all overflow-hidden">
                                        {newCat.image ? (
                                            <>
                                                <img src={newCat.image} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setNewCat(prev => ({ ...prev, image: null })); }}
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
                                                            setNewCat(prev => ({ ...prev, image: url, file }));
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
                                    Create Category
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Category Modal */}
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
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Edit Category</h3>
                                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Category Name</label>
                                    <input
                                        type="text"
                                        value={editCat.name}
                                        onChange={(e) => setEditCat(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Organic Dairy"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Description</label>
                                    <textarea
                                        rows={3}
                                        value={editCat.description}
                                        onChange={(e) => setEditCat(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Short description..."
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                                    ></textarea>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Admin Commission (%)</label>
                                    <input
                                        type="number"
                                        value={editCat.adminCommission}
                                        onChange={(e) => setEditCat(prev => ({ ...prev, adminCommission: e.target.value }))}
                                        placeholder="0"
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="edit-visible"
                                        checked={editCat.isVisible}
                                        onChange={(e) => setEditCat(prev => ({ ...prev, isVisible: e.target.checked }))}
                                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                    />
                                    <label htmlFor="edit-visible" className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Visible on Storefront</label>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Category Image</label>
                                    <div className="relative aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-sm flex flex-col items-center justify-center space-y-2 group/upload cursor-pointer hover:bg-white hover:border-emerald-500 transition-all overflow-hidden">
                                        {(editCat.image || editCat.file) ? (
                                            <>
                                                <img src={editCat.image} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditCat(prev => ({ ...prev, image: null, file: null })); }}
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
                                                            setEditCat(prev => ({ ...prev, image: url, file }));
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
                            <span className="text-slate-900 uppercase tracking-widest">Categories</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">All product categories</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-6 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-600 shadow-sm"
                        >
                            <Plus size={12} />
                            Create Category
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* List Section */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Categories ({categories.length})</h3>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {categories.length > 0 ? categories.map((cat, idx) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={cat._id}
                                        className="group p-6 flex items-start justify-between hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-slate-100 text-slate-400 flex items-center justify-center rounded-sm group-hover:bg-slate-900 group-hover:text-white transition-all overflow-hidden border border-slate-200">
                                                {cat.image ? (
                                                    <img src={cat.image} className="w-full h-full object-cover" alt={cat.name} />
                                                ) : (
                                                    <Tags size={20} />
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">{cat.name}</h4>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight max-w-md">{cat.description || 'No description assigned.'}</p>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {cat._id}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Commission: {cat.adminCommission || 0}%</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">
                                                        {cat.isVisible ? 'Visible to Customers' : 'Hidden'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditCat({
                                                        id: cat._id,
                                                        name: cat.name,
                                                        description: cat.description,
                                                        adminCommission: cat.adminCommission || 0,
                                                        image: cat.image,
                                                        isVisible: cat.isVisible,
                                                        file: null
                                                    });
                                                    setShowEditModal(true);
                                                }}
                                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all border border-transparent hover:border-slate-100 shadow-sm"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Delete this category?')) {
                                                        deleteCategory(cat._id);
                                                    }
                                                }}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all border border-transparent hover:border-rose-100 shadow-sm"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <div className="p-20 text-center space-y-4">
                                        <Layers size={40} className="text-slate-200 mx-auto" />
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">No Categories Found</h3>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest transition-all">Loading categories...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Meta/Help Section */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-sm border border-slate-200 shadow-sm p-6 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 text-blue-600 flex items-center justify-center rounded-sm">
                                    <Info size={16} />
                                </div>
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Tips</h4>
                            </div>

                            <ul className="space-y-4">
                                {[
                                    { label: 'Category Name', detail: 'Public-facing label for the store' },
                                    { label: 'Visible to Customers', detail: 'Toggles visibility across all regions' },
                                    { label: 'Commission Rate', detail: 'Standardized rate for this branch' }
                                ].map((item, i) => (
                                    <li key={i} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-slate-900" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{item.label}</span>
                                        </div>
                                        <p className="pl-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.detail}</p>
                                    </li>
                                ))}
                            </ul>

                            <div className="p-4 bg-slate-900 rounded-sm">
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-relaxed">
                                    "Changing categories affects how customers find products. Please double-check before saving."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

