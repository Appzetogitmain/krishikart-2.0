import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Home, ChevronRight, Plus, X, Pencil, Trash2, Info, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function FAQManagementScreen() {
    const [faqs, setFaqs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'General', displayOrder: 0, audience: 'all' });
    const [editFaq, setEditFaq] = useState({ id: '', question: '', answer: '', category: 'General', displayOrder: 0, status: 'active', audience: 'all' });

    const audiences = [
        { value: 'all', label: 'Everyone' },
        { value: 'user', label: 'Customers' },
        { value: 'vendor', label: 'Vendors' },
        { value: 'franchise', label: 'Franchise/Admin' },
        { value: 'delivery', label: 'Delivery Partners' }
    ];

    const fetchFaqs = async () => {
        try {
            const { data } = await api.get('/masteradmin/faqs');
            if (data.success) {
                setFaqs(data.results || data.result || []);
            }
        } catch (error) {
            console.error("Failed to fetch FAQs", error);
            toast.error("Failed to load FAQs");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFaqs();
    }, []);

    const handleAdd = async () => {
        if (!newFaq.question.trim() || !newFaq.answer.trim()) {
            toast.error("Question and Answer are required");
            return;
        }
        setIsSubmitting(true);
        try {
            const { data } = await api.post('/masteradmin/faqs', newFaq);
            if (data.success) {
                toast.success("FAQ created successfully");
                setNewFaq({ question: '', answer: '', category: 'General', displayOrder: 0 });
                setShowAddModal(false);
                fetchFaqs();
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to create FAQ");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editFaq.question.trim() || !editFaq.answer.trim()) {
            toast.error("Question and Answer are required");
            return;
        }
        setIsSubmitting(true);
        try {
            const { data } = await api.put(`/masteradmin/faqs/${editFaq.id}`, editFaq);
            if (data.success) {
                toast.success("FAQ updated successfully");
                setShowEditModal(false);
                fetchFaqs();
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to update FAQ");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
        try {
            const { data } = await api.delete(`/masteradmin/faqs/${id}`);
            if (data.success) {
                toast.success("FAQ deleted successfully");
                fetchFaqs();
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete FAQ");
        }
    };

    if (isLoading) {
        return <div className="p-8 animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest text-center py-20">Loading FAQs...</div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20 relative">
            {/* Add FAQ Modal */}
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
                            className="bg-white rounded-sm shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">New FAQ Entry</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Question</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newFaq.question}
                                        onChange={(e) => setNewFaq(prev => ({ ...prev, question: e.target.value }))}
                                        placeholder="Enter the question..."
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Answer</label>
                                    <textarea
                                        rows={4}
                                        value={newFaq.answer}
                                        onChange={(e) => setNewFaq(prev => ({ ...prev, answer: e.target.value }))}
                                        placeholder="Enter the answer..."
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-medium focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 resize-none"
                                    ></textarea>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Category</label>
                                        <input
                                            type="text"
                                            value={newFaq.category}
                                            onChange={(e) => setNewFaq(prev => ({ ...prev, category: e.target.value }))}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Order</label>
                                        <input
                                            type="number"
                                            value={newFaq.displayOrder}
                                            onChange={(e) => setNewFaq(prev => ({ ...prev, displayOrder: e.target.value }))}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Target Audience</label>
                                    <select
                                        value={newFaq.audience}
                                        onChange={(e) => setNewFaq(prev => ({ ...prev, audience: e.target.value }))}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                    >
                                        {audiences.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                    </select>
                                </div>
                                <button
                                    onClick={handleAdd}
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-emerald-600 transition-all shadow-lg"
                                >
                                    {isSubmitting ? 'Processing...' : 'Save FAQ'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit FAQ Modal */}
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
                            className="bg-white rounded-sm shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Modify FAQ</h3>
                                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Question</label>
                                    <input
                                        type="text"
                                        value={editFaq.question}
                                        onChange={(e) => setEditFaq(prev => ({ ...prev, question: e.target.value }))}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Answer</label>
                                    <textarea
                                        rows={4}
                                        value={editFaq.answer}
                                        onChange={(e) => setEditFaq(prev => ({ ...prev, answer: e.target.value }))}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-medium outline-none resize-none"
                                    ></textarea>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Category</label>
                                        <input
                                            type="text"
                                            value={editFaq.category}
                                            onChange={(e) => setEditFaq(prev => ({ ...prev, category: e.target.value }))}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Status</label>
                                        <select
                                            value={editFaq.status}
                                            onChange={(e) => setEditFaq(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Target Audience</label>
                                    <select
                                        value={editFaq.audience}
                                        onChange={(e) => setEditFaq(prev => ({ ...prev, audience: e.target.value }))}
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold outline-none"
                                    >
                                        {audiences.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                    </select>
                                </div>
                                <button
                                    onClick={handleUpdate}
                                    disabled={isSubmitting}
                                    className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-emerald-600 transition-all shadow-lg"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header Sticky */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>System</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">FAQs</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Help Center FAQs</h1>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-6 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 shadow-sm transition-all"
                    >
                        <Plus size={12} />
                        Add FAQ Entry
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* List Section */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Entries ({faqs.length})</h3>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {faqs.length > 0 ? faqs.map((faq, idx) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={faq._id}
                                        className="group p-6 flex flex-col gap-4 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-black uppercase text-slate-500 rounded-sm">
                                                        {faq.category || 'General'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-blue-50 text-[10px] font-black uppercase text-blue-500 rounded-sm">
                                                        Target: {faq.audience || 'All'}
                                                    </span>
                                                    <h4 className="text-xs font-black text-slate-900">{faq.question}</h4>
                                                </div>
                                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-2">{faq.answer}</p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                                                <button
                                                    onClick={() => {
                                                        setEditFaq({
                                                            id: faq._id,
                                                            question: faq.question,
                                                            answer: faq.answer,
                                                            category: faq.category,
                                                            displayOrder: faq.displayOrder,
                                                            status: faq.status,
                                                            audience: faq.audience || 'all'
                                                        });
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all border border-transparent hover:border-slate-100 shadow-sm"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(faq._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-all border border-transparent hover:border-rose-100 shadow-sm"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Order: {faq.displayOrder}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-tighter",
                                                faq.status === 'active' ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {faq.status === 'active' ? 'Live on App' : 'Offline'}
                                            </span>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <div className="p-20 text-center space-y-4">
                                        <MessageSquare size={40} className="text-slate-200 mx-auto" strokeWidth={1} />
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">No FAQs yet</h3>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Start building your help center.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Meta Section */}
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
                                    { label: 'Display Order', detail: 'Determines the sequence in user app' },
                                    { label: 'Active Status', detail: 'Only active FAQs are visible to users' },
                                    { label: 'Category', detail: 'Group FAQs for better organization' }
                                ].map((item, i) => (
                                    <li key={i} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 bg-slate-950 rounded-full" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{item.label}</span>
                                        </div>
                                        <p className="pl-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">{item.detail}</p>
                                    </li>
                                ))}
                            </ul>

                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-sm">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                                    "Good FAQs answer common questions quickly. Keep answers short and simple."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
