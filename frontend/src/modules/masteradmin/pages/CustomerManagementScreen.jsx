import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    User,
    Mail,
    Phone,
    Calendar,
    MapPin,
    Home,
    ChevronRight,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    Map,
    Eye,
    Trash2,
    X
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';

// Enterprise Components
import DataGrid from '../components/tables/DataGrid';
import TablePagination from '../components/tables/TablePagination';

export default function CustomerManagementScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Server-side pagination: only one page of customers is loaded at a time
    const PAGE_SIZE = 20;
    const [page, setPage] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        fetchCustomers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/masteradmin/customers', {
                params: { page, limit: PAGE_SIZE, search: debouncedSearch || undefined }
            });
            if (response.data.success) {
                const result = response.data.result || {};
                setCustomers(result.items || response.data.results || []);
                setTotalCustomers(result.total ?? (response.data.results || []).length);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Failed to load customer list');
        } finally {
            setIsLoading(false);
        }
    };

    // Search is applied on the server; this is the current page
    const filteredCustomers = customers;

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;
        try {
            await api.delete(`/masteradmin/customers/${id}`);
            toast.success("Customer deleted successfully");
            fetchCustomers();
        } catch (error) {
            console.error("Failed to delete customer:", error);
            toast.error("Failed to delete customer");
        }
    };

    const customerColumns = [
        {
            header: 'Customer Details',
            key: 'fullName',
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
                        <User size={14} className="text-slate-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-xs tracking-tight">{val || 'Anonymous User'}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <ShieldCheck size={10} className="text-emerald-500" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verified Account</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'Contact Info',
            key: 'mobile',
            render: (val, row) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Smartphone size={10} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-700">{val}</span>
                    </div>
                    {row.email && (
                        <div className="flex items-center gap-2">
                            <Mail size={10} className="text-slate-400" />
                            <span className="text-[10px] text-slate-500 font-medium">{row.email}</span>
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Primary Address',
            key: 'address',
            render: (address) => {
                if (!address) return null;
                return (
                    <div className="flex items-center gap-2 max-w-[200px]">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-500 font-medium line-clamp-1">
                            {address}
                        </span>
                    </div>
                );
            }
        },
        {
            header: 'Registration',
            key: 'createdAt',
            render: (val) => (
                <div className="flex items-center gap-2 text-slate-500">
                    <Calendar size={12} />
                    <span className="text-[10px] font-bold">
                        {new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                </div>
            )
        },
        {
            header: 'Status',
            key: 'isActive',
            render: (isActive) => (
                <div className={`px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border w-fit ${isActive !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {isActive !== false ? 'Active' : 'Inactive'}
                </div>
            )
        },
        {
            header: 'Actions',
            key: 'actions',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setSelectedCustomer(row)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        title="View Details"
                    >
                        <Eye size={14} />
                    </button>
                    <button 
                        onClick={() => handleDelete(row._id)}
                        className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors"
                        title="Delete User"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Customers</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900 font-black">All registered customers</h1>
                    </div>

                    <button 
                        onClick={fetchCustomers}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
                    >
                        <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="p-6">
                <div className="flex flex-col gap-6">
                    {/* Search & Filter Section */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name, mobile, or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-12 pr-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Customers</span>
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Total Users: {totalCustomers}</span>
                        </div>
                        <DataGrid
                            columns={customerColumns.filter(col => col.key !== 'address' || filteredCustomers.some(c => c.address))}
                            data={filteredCustomers}
                            pageSize={0}
                            density="compact"
                            isLoading={isLoading}
                        />
                        <TablePagination
                            page={page}
                            pageSize={PAGE_SIZE}
                            totalItems={totalCustomers}
                            onPageChange={setPage}
                        />
                    </div>
                </div>
            </div>

            {/* View Customer Modal */}
            <AnimatePresence>
                {selectedCustomer && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Customer Details</h3>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">ID: {selectedCustomer._id}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</span>
                                        <span className="text-sm font-black text-slate-900">{selectedCustomer.fullName || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mobile Number</span>
                                        <span className="text-sm font-black text-slate-900">{selectedCustomer.mobile || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</span>
                                        <span className="text-sm font-black text-slate-900">{selectedCustomer.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                                        <span className="text-sm font-black text-slate-900">{selectedCustomer.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Wallet & Credit</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Wallet Balance</span>
                                            <span className="text-sm font-bold text-slate-900">₹{selectedCustomer.walletBalance || 0}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Loyalty Coins</span>
                                            <span className="text-sm font-bold text-slate-900">{selectedCustomer.loyaltyCoins || 0}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Credit Limit</span>
                                            <span className="text-sm font-bold text-slate-900">₹{selectedCustomer.creditLimit || 0}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Used Credit</span>
                                            <span className="text-sm font-bold text-slate-900 text-rose-600">₹{selectedCustomer.usedCredit || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {selectedCustomer.address && (
                                    <div className="flex flex-col gap-3">
                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">Primary Address</h4>
                                        <p className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            {selectedCustomer.address}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
