import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Ticket,
    Home,
    ChevronRight,
    Plus,
    X,
    Pencil,
    Trash2,
    Info,
    Search,
    RefreshCw,
    Filter,
    Calendar,
    LayoutGrid,
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff,
    Trophy
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CouponManagementScreen() {
    const [coupons, setCoupons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [form, setForm] = useState({
        code: '',
        title: '',
        description: '',
        type: 'percentage',
        value: '',
        minOrderValue: '',
        maxDiscount: '',
        buyQty: '',
        buyUnit: 'unit',
        getQty: '',
        getUnit: 'unit',
        isFirstTimeUserOnly: false,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        usageLimit: '',
        usageLimitPerUser: 1,
        isVisible: true,
        status: 'active',
        monthlyVolumeRequirement: 0
    });

    const couponTypes = [
        { id: 'percentage', label: 'Percentage' },
        { id: 'fixed', label: 'Fixed Amount' },
        { id: 'free_delivery', label: 'Free Delivery' },
        { id: 'buyXgetY', label: 'Buy X Get Y' },
        { id: 'bulk_discount', label: 'Bulk Discount' },
        { id: 'min_order_value', label: 'Min Order Value' },
        { id: 'new_partner', label: 'New Partner (HORECA)' },
        { id: 'category_based', label: 'Category Based' },
        { id: 'monthly_volume', label: 'Monthly Volume' }
    ];

    const commonUnits = ['kg', 'gm', 'unit', 'pkt', 'box', 'pcs', 'ltr', 'ml', 'nos', 'bottle', 'can', 'bag', 'g', 'mg', 'lb', 'oz', 'doz', 'roll', 'sheet', 'bundle', 'pack', 'carton', 'pallet', 'drum', 'barrel', 'tube', 'jar', 'pouch', 'sachet', 'tray', 'case', 'crate', 'gallon', 'quart', 'pint', 'cup', 'fl_oz', 'tbsp', 'tsp'];

    const fetchCoupons = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/coupons/admin');
            if (response.data.success) {
                // If the backend returns results (for arrays) or result (for objects)
                setCoupons(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch coupons");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    const resetForm = () => {
        setForm({
            code: '',
            title: '',
            description: '',
            type: 'percentage',
            value: '',
            minOrderValue: '',
            maxDiscount: '',
            buyQty: '',
            buyUnit: 'unit',
            getQty: '',
            getUnit: 'unit',
            isFirstTimeUserOnly: false,
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            usageLimit: '',
            usageLimitPerUser: 1,
            isVisible: true,
            status: 'active',
            monthlyVolumeRequirement: 0
        });
        setIsEditing(false);
    };

    const handleEdit = (coupon) => {
        setForm({
            ...coupon,
            id: coupon._id,
            startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().split('T')[0] : '',
            endDate: coupon.endDate ? new Date(coupon.endDate).toISOString().split('T')[0] : '',
            usageLimit: coupon.usageLimit || ''
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!form.code || !form.title || !form.startDate || !form.endDate) {
            toast.error("Code, Title, Start Date and End Date are required");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = { ...form };
            if (!payload.usageLimit) payload.usageLimit = null;

            if (isEditing) {
                await api.put(`/coupons/admin/${form.id}`, payload);
                toast.success("Coupon updated successfully");
            } else {
                await api.post('/coupons/admin', payload);
                toast.success("Coupon created successfully");
            }
            setShowModal(false);
            resetForm();
            fetchCoupons();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Operation failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this coupon?")) return;
        try {
            await api.delete(`/coupons/admin/${id}`);
            toast.success("Coupon deleted");
            fetchCoupons();
        } catch (error) {
            toast.error("Delete failed");
        }
    };

    const filteredCoupons = coupons.filter(c =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.createdBy?.adminName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading && coupons.length === 0) {
        return <div className="p-8 animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest">Loading Coupons...</div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20 relative">
            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setShowModal(false); resetForm(); }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-sm shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Ticket size={14} className="text-slate-900" />
                                    {isEditing ? 'Edit Coupon' : 'New Coupon'}
                                </h3>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-900">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[80vh]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Coupon Code</label>
                                            <input
                                                type="text"
                                                value={form.code}
                                                onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.replace(/\s/g, '') }))}
                                                placeholder="e.g. MEGA50"
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all uppercase"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Title / Display Name</label>
                                            <input
                                                type="text"
                                                value={form.title}
                                                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                                placeholder="e.g. Mega Sale Discount"
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Type</label>
                                            <select
                                                value={form.type}
                                                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                                                className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                            >
                                                {couponTypes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {['percentage', 'fixed', 'bulk_discount', 'min_order_value', 'new_partner', 'category_based', 'monthly_volume'].includes(form.type) && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">
                                                    {form.type === 'fixed' ? 'Discount Amount' : 'Percentage Value (%)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={form.value}
                                                    onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                />
                                            </div>
                                        )}
                                        {form.type === 'buyXgetY' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Buy Quantity</label>
                                                        <input
                                                            type="number"
                                                            value={form.buyQty}
                                                            onChange={(e) => setForm(prev => ({ ...prev, buyQty: e.target.value }))}
                                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Buy Unit</label>
                                                        <select
                                                            value={form.buyUnit}
                                                            onChange={(e) => setForm(prev => ({ ...prev, buyUnit: e.target.value }))}
                                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                        >
                                                            {commonUnits.map(u => (
                                                                <option key={u} value={u}>{u.toUpperCase()}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Get Quantity (Free)</label>
                                                        <input
                                                            type="number"
                                                            value={form.getQty}
                                                            onChange={(e) => setForm(prev => ({ ...prev, getQty: e.target.value }))}
                                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Get Unit</label>
                                                        <select
                                                            value={form.getUnit}
                                                            onChange={(e) => setForm(prev => ({ ...prev, getUnit: e.target.value }))}
                                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                        >
                                                            {commonUnits.map(u => (
                                                                <option key={u} value={u}>{u.toUpperCase()}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Start Date *</label>
                                                <input
                                                    type="date"
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={form.startDate}
                                                    onChange={(e) => {
                                                        const newStartDate = e.target.value;
                                                        setForm(prev => {
                                                            const updates = { startDate: newStartDate };
                                                            if (prev.endDate && newStartDate > prev.endDate) {
                                                                updates.endDate = '';
                                                            }
                                                            return { ...prev, ...updates };
                                                        });
                                                    }}
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">End Date *</label>
                                                <input
                                                    type="date"
                                                    min={form.startDate || new Date().toISOString().split('T')[0]}
                                                    value={form.endDate}
                                                    onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Min Order (₹)</label>
                                                <input
                                                    type="number"
                                                    value={form.minOrderValue}
                                                    onChange={(e) => setForm(prev => ({ ...prev, minOrderValue: e.target.value }))}
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Usage Limit</label>
                                                <input
                                                    type="number"
                                                    value={form.usageLimit}
                                                    onChange={(e) => setForm(prev => ({ ...prev, usageLimit: e.target.value }))}
                                                    placeholder="Unlimited"
                                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="isVisible"
                                                    checked={form.isVisible}
                                                    onChange={(e) => setForm(prev => ({ ...prev, isVisible: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                />
                                                <label htmlFor="isVisible" className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Publicly Visible</label>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="isFirstTimeUserOnly"
                                                    checked={form.isFirstTimeUserOnly}
                                                    onChange={(e) => setForm(prev => ({ ...prev, isFirstTimeUserOnly: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                />
                                                <label htmlFor="isFirstTimeUserOnly" className="text-[10px] font-black text-slate-900 uppercase tracking-widest">First Order Only</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-0.5">Description / Terms</label>
                                    <textarea
                                        rows={2}
                                        value={form.description}
                                        onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Briefly explain the offer terms..."
                                        className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-medium focus:ring-1 focus:ring-slate-900 outline-none transition-all resize-none"
                                    />
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="w-full mt-8 py-3.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Coupon'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r border-slate-200 pr-5">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>System</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900">Campaigns</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                            Coupons
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-[10px] font-black rounded-full uppercase tracking-tighter">Active</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search coupons..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.replace(/\s/g, ''))}
                                className="bg-slate-50/50 border border-slate-200 rounded-sm pl-10 pr-4 py-2 text-[11px] font-bold focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none w-64 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-slate-900 text-white px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                        >
                            <Plus size={14} />
                            New Coupon
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-[1400px] mx-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-9 space-y-6">
                        <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Active Campaigns</h3>
                                    <div className="h-4 w-px bg-slate-200" />
                                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">TOTAL: {filteredCoupons.length}</span>
                                </div>
                                <button
                                    onClick={fetchCoupons}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"
                                >
                                    <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">Coupon</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">Offer</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">Usage Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">Created By</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">Visibility</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredCoupons.map((coupon, idx) => (
                                            <motion.tr
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                key={coupon._id}
                                                className="group hover:bg-slate-50/80 transition-colors"
                                            >
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-900 tracking-tight uppercase group-hover:text-emerald-600 transition-colors">{coupon.code}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">{coupon.title}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-black text-slate-900 uppercase">
                                                            {coupon.type === 'free_delivery' ? 'FREE DELIVERY' :
                                                                coupon.type === 'fixed' ? `₹${coupon.value} OFF` :
                                                                    coupon.type === 'buyXgetY' ? `BUY ${coupon.buyQty}${coupon.buyUnit?.toUpperCase()} GET ${coupon.getQty}${coupon.getUnit?.toUpperCase()}` :
                                                                        `${coupon.value}% OFF`}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                            MIN: ₹{coupon.minOrderValue || 0}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-slate-900 rounded-full"
                                                                style={{ width: coupon.usageLimit ? `${(coupon.timesUsed / coupon.usageLimit) * 100}%` : '5%' }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest tabular-nums">
                                                            {coupon.timesUsed} / {coupon.usageLimit || '∞'} USES
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{coupon.createdBy?.adminName || 'ROOT'}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{coupon.createdBy?.adminRole || 'SUPER'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {coupon.isVisible ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                                            <Eye size={10} />
                                                            Public
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                                            <EyeOff size={10} />
                                                            Private
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleEdit(coupon)}
                                                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm border border-transparent hover:border-slate-200 transition-all shadow-sm"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(coupon._id)}
                                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm border border-transparent hover:border-rose-100 transition-all shadow-sm"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                        {filteredCoupons.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <Ticket size={40} className="text-slate-100" />
                                                        <div className="space-y-1">
                                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">No coupons yet</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Create a coupon to get started</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white rounded-sm border border-slate-200 p-6 space-y-6 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Info size={14} className="text-slate-900" />
                                Tips
                            </h4>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-sm space-y-2">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Public vs Private Coupons</span>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-relaxed">
                                        Private coupons work but don't appear in the customer's coupon list. Share the code yourself, e.g. on WhatsApp.
                                    </p>
                                </div>
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm flex items-start gap-3">
                                    <Trophy size={14} className="text-emerald-600 mt-0.5" />
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest block">Performance Tip</span>
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight leading-relaxed block">
                                            First-time buyer coupons increase conversion by 42%.
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100">
                                <ul className="space-y-3">
                                    {['Audit Logs', 'Analytics Export', 'Archive Policy'].map(item => (
                                        <li key={item} className="flex items-center justify-between group cursor-pointer">
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 uppercase tracking-widest transition-colors">{item}</span>
                                            <ChevronRight size={12} className="text-slate-200 group-hover:text-slate-900 transition-colors" />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
