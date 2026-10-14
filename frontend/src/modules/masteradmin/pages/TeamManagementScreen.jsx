import React, { useState, useEffect } from 'react';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    Shield,
    Check,
    X,
    Loader2,
    AlertCircle,
    ChevronRight,
    Lock,
    Mail,
    User,
    Phone,
    Eye,
    EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import { useMasterAdminAuth } from '../contexts/MasterAdminAuthContext';

const PERMISSION_GROUPS = [
    {
        title: 'Operations',
        permissions: [
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'orders', label: 'Orders' },
            { key: 'assignment', label: 'Assign Vendors' },
            { key: 'delivery', label: 'Delivery Tracking' },
            { key: 'returns', label: 'Returns' },
        ]
    },
    {
        title: 'Finance',
        permissions: [
            { key: 'credit', label: 'Credit Management' },
            { key: 'loyalty', label: 'Loyalty Points' },
            { key: 'delivery-constraints', label: 'Delivery Constraints' },
            { key: 'franchise-payouts', label: 'Franchise Payouts' },
            { key: 'cod-remittance', label: 'COD Remittance' },
            { key: 'campaigns', label: 'Marketing Campaigns (Coupons)' },
        ]
    },
    {
        title: 'Network',
        permissions: [
            { key: 'franchises', label: 'Franchises' },
            { key: 'vendors', label: 'Vendors' },
            { key: 'vendor-reports', label: 'Vendor Invoices' },
            { key: 'stock-monitoring', label: 'Stock Levels' },
            { key: 'quotations', label: 'Vendor Quotations' },
        ]
    },
    {
        title: 'Catalog',
        permissions: [
            { key: 'products', label: 'Products (Add/Manage)' },
            { key: 'categories', label: 'Categories & Subcategories' },
        ]
    },
    {
        title: 'Settings',
        permissions: [
            { key: 'approvals', label: 'Approvals (Documents)' },
            { key: 'analytics', label: 'Analytics' },
            { key: 'audit-logs', label: 'Activity Log (who changed what)' },
            { key: 'settings', label: 'System Settings' },
        ]
    }
];

const PRESETS = [
    { label: 'Select All', action: 'all' },
    { label: 'Purchase Team', action: 'purchase' },
    { label: 'Sales Team', action: 'sales' },
    { label: 'Accounts Team', action: 'accounts' },
    { label: 'Clear All', action: 'none' },
];

const PRESET_MAPPINGS = {
    purchase: ['dashboard', 'orders', 'vendors', 'assignment', 'stock-monitoring', 'quotations', 'products', 'categories'],
    sales: ['dashboard', 'orders', 'delivery', 'franchises', 'analytics', 'returns'],
    accounts: ['dashboard', 'orders', 'credit', 'loyalty', 'vendor-reports', 'analytics', 'franchise-payouts', 'cod-remittance'],
};

export default function TeamManagementScreen() {
    const { isSuperAdmin } = useMasterAdminAuth();
    const [subAdmins, setSubAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        mobile: '',
        status: 'active',
        permissions: []
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchSubAdmins();
    }, []);

    const fetchSubAdmins = async () => {
        try {
            const res = await api.get('/masteradmin/subadmins');
            if (res.data.success) {
                const data = res.data.results || res.data.result || [];
                setSubAdmins(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch sub-admins', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDrawer = (admin = null) => {
        if (admin) {
            setEditingAdmin(admin);
            setFormData({
                fullName: admin.fullName,
                email: admin.email,
                password: '', // Don't show hashed password
                mobile: admin.mobile || '',
                status: admin.status || 'active',
                permissions: admin.permissions || []
            });
        } else {
            setEditingAdmin(null);
            setFormData({
                fullName: '',
                email: '',
                password: '',
                mobile: '',
                status: 'active',
                permissions: []
            });
        }
        setIsDrawerOpen(true);
    };

    const handleTogglePermission = (key) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(key)
                ? prev.permissions.filter(p => p !== key)
                : [...prev.permissions, key]
        }));
    };

    const applyPreset = (action) => {
        if (action === 'all') {
            const allKeys = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
            setFormData(prev => ({ ...prev, permissions: allKeys }));
        } else if (action === 'none') {
            setFormData(prev => ({ ...prev, permissions: [] }));
        } else {
            setFormData(prev => ({ ...prev, permissions: PRESET_MAPPINGS[action] || [] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const mobile = (formData.mobile || '').trim();
        if (mobile && (mobile.length !== 10 || !/^\d{10}$/.test(mobile))) {
            alert('Phone number must be exactly 10 digits. No letters or symbols allowed.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (editingAdmin) {
                await api.put(`/masteradmin/subadmins/${editingAdmin._id}`, formData);
            } else {
                await api.post('/masteradmin/subadmins', formData);
            }
            setIsDrawerOpen(false);
            fetchSubAdmins();
        } catch (error) {
            alert(error.response?.data?.message || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;
        try {
            await api.delete(`/masteradmin/subadmins/${id}`);
            fetchSubAdmins();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    const filteredAdmins = (subAdmins || []).filter(admin => {
        const name = (admin.fullName || "").toLowerCase();
        const email = (admin.email || "").toLowerCase();
        const mobile = (admin.mobile || "").toLowerCase();

        const searchKeywords = searchTerm.toLowerCase().trim().split(/\s+/);
        return searchTerm.trim() === '' ? true : searchKeywords.every(kw =>
            name.includes(kw) || email.includes(kw) || mobile.includes(kw)
        );
    });

    if (!isSuperAdmin) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-[80vh]">
                <Shield size={48} className="text-slate-300 mb-4" />
                <h1 className="text-xl font-bold text-slate-900">No Access</h1>
                <p className="text-slate-500">Only the Super Admin can manage the team.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">TEAM MANAGEMENT</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-wider">Create and manage sub-admin roles & permissions</p>
                </div>
                <button
                    onClick={() => handleOpenDrawer()}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-sm font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                    <Plus size={16} />
                    Add Team Member
                </button>
            </div>

            {/* Stats & Search */}
            <div className="bg-white border border-slate-200 rounded-sm p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Staff</span>
                        <span className="text-xl font-black text-slate-900">{subAdmins.length}</span>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-100" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Now</span>
                        <span className="text-xl font-black text-emerald-600">{subAdmins.filter(a => a.status === 'active').length}</span>
                    </div>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value.trim())}
                        className="w-full bg-slate-50 border-none rounded-sm pl-10 pr-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto shadow-sm custom-scrollbar">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4">Full Name</th>
                            <th className="px-6 py-4">Login</th>
                            <th className="px-6 py-4">Permissions</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-20 text-center">
                                    <Loader2 className="animate-spin mx-auto text-slate-300" size={32} />
                                </td>
                            </tr>
                        ) : filteredAdmins.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-20 text-center text-slate-400 text-sm italic">
                                    No team members found.
                                </td>
                            </tr>
                        ) : filteredAdmins.map((admin) => (
                            <tr key={admin._id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
                                            {admin.fullName.charAt(0)}
                                        </div>
                                        <span className="font-bold text-slate-900 text-sm tracking-tight">{admin.fullName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-slate-900 text-xs font-bold tracking-tight">{admin.email}</span>
                                        <span className="text-slate-400 text-[10px] font-medium uppercase tracking-widest mt-0.5">{admin.mobile || 'No Mobile'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                                        <span className="bg-slate-100 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
                                            {admin.permissions?.length || 0} Pages
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest ${admin.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                                        }`}>
                                        {admin.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleOpenDrawer(admin)}
                                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded-sm transition-all"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(admin._id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Slide-over Drawer */}
            <AnimatePresence>
                {isDrawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDrawerOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-[101] overflow-hidden flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                        {editingAdmin ? 'EDIT TEAM MEMBER' : 'ADD TEAM MEMBER'}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                        {editingAdmin ? 'Update login details and permissions' : 'Setup a new sub-admin account'}
                                    </p>
                                </div>
                                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Drawer Content */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* Basic Info */}
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-slate-900 rounded-sm">
                                            <User size={12} className="text-white" />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.15em]">Personal Details</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                            <input
                                                required
                                                value={formData.fullName}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                                    setFormData({ ...formData, fullName: raw });
                                                }}
                                                className="w-full bg-slate-50 border-none rounded-sm px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-900 transition-all"
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={10}
                                                value={formData.mobile}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/\D/g, '');
                                                    const mobile = raw.slice(0, 10);
                                                    setFormData({ ...formData, mobile });
                                                }}
                                                className="w-full bg-slate-50 border-none rounded-sm px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-900 transition-all"
                                                placeholder="9876543210"
                                            />
                                            {formData.mobile.length > 0 && (
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    {formData.mobile.length}/10 digits
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* Credentials */}
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-slate-900 rounded-sm">
                                            <Lock size={12} className="text-white" />
                                        </div>
                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.15em]">Login Details</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                            <input
                                                required
                                                type="email"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-sm px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-900 transition-all"
                                                placeholder="john@kisaankart.com"
                                            />
                                        </div>
                                        <div className="space-y-1.5 relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                {editingAdmin ? 'New Password (Leave blank to keep current)' : 'Account Password'}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={formData.password}
                                                    required={!editingAdmin}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    className="w-full bg-slate-50 border-none rounded-sm px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-900 transition-all pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                                                >
                                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Status */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-sm border border-slate-100">
                                        <div>
                                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Account Status</h3>
                                            <p className="text-[10px] text-slate-500 font-medium">Temporarily block access</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'blocked' : 'active' })}
                                            className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.status === 'active' ? 'bg-emerald-500' : 'bg-slate-200'
                                                }`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${formData.status === 'active' ? 'left-7' : 'left-1'
                                                }`} />
                                        </button>
                                    </div>
                                </section>

                                {/* Permissions */}
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-slate-900 rounded-sm">
                                                <Shield size={12} className="text-white" />
                                            </div>
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.15em]">Access Permissions</h3>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            {formData.permissions.length} Selected
                                        </span>
                                    </div>

                                    {/* Presets */}
                                    <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-100">
                                        {PRESETS.map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => applyPreset(preset.action)}
                                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-[10px] font-black uppercase tracking-widest hover:border-slate-900 hover:bg-slate-50 transition-all"
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-8">
                                        {PERMISSION_GROUPS.map(group => (
                                            <div key={group.title} className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{group.title}</h4>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {group.permissions.map(perm => (
                                                        <button
                                                            key={perm.key}
                                                            type="button"
                                                            onClick={() => handleTogglePermission(perm.key)}
                                                            className={`flex items-center justify-between p-3 rounded-sm border transition-all ${formData.permissions.includes(perm.key)
                                                                ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                                                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                                                                }`}
                                                        >
                                                            <span className="text-[11px] font-bold tracking-tight">{perm.label}</span>
                                                            <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${formData.permissions.includes(perm.key)
                                                                ? 'bg-emerald-500 border-emerald-500'
                                                                : 'bg-slate-50 border-slate-200'
                                                                }`}>
                                                                {formData.permissions.includes(perm.key) && <Check size={10} className="text-white" />}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </form>

                            {/* Drawer Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50 mt-auto flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-400 font-black text-xs uppercase tracking-widest rounded-sm hover:bg-white transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-[2] bg-slate-900 text-white px-6 py-3 font-black text-xs uppercase tracking-widest rounded-sm hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 group"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <>
                                            {editingAdmin ? 'Update Account' : 'Create Account'}
                                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
