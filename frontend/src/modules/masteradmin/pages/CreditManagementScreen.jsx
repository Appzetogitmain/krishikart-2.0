import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Download,
    ShieldAlert,
    ArrowUpRight,
    CreditCard,
    IndianRupee,
    AlertCircle,
    TrendingUp,
    Filter,
    Home,
    ChevronRight,
    History,
    Settings2,
    ShieldCheck,
    Lock,
    Unlock
} from 'lucide-react';
import CreditLimitCard from '../components/cards/CreditLimitCard';
import CreditOverrideModal from '../components/modals/CreditOverrideModal';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Enterprise Components
import MetricRow from '../components/cards/MetricRow';
import DataGrid from '../components/tables/DataGrid';
import FilterBar from '../components/tables/FilterBar';

export default function CreditManagementScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/masteradmin/customers');
            setCustomers(response.data.results || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Failed to load customers');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCustomers = customers.filter(customer =>
        (customer.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.mobile || '').includes(searchTerm)
    );

    const handleOverride = (customer) => {
        setSelectedCustomer(customer);
        setIsModalOpen(true);
    };

    const handleSaveOverride = async (data) => {
        try {
            const response = await api.put(`/masteradmin/customers/${selectedCustomer._id}/credit`, {
                creditLimit: Number(data.limit),
                usedCredit: data.resetBalance ? 0 : undefined,
                resetOverdue: data.resetBalance ? true : undefined
            });

            if (response.data) {
                toast.success(data.resetBalance ? 'Credit balance cleared and limit updated' : 'Credit limit updated successfully');
                fetchCustomers();
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error('Error updating credit:', error);
            toast.error(error.response?.data?.message || 'Failed to update credit');
        }
    };

    const customerColumns = [
        {
            header: 'Customer',
            key: 'fullName',
            align: 'center',
            render: (val, row) => (
                <div className="flex flex-col items-center">
                    <span className="font-black text-slate-900 text-xs tracking-tight">{val || 'Unnamed Customer'}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-0.5">{row.mobile}</span>
                </div>
            )
        },
        {
            header: 'Credit Limit',
            key: 'creditLimit',
            align: 'center',
            render: (val) => <span className="text-xs font-black text-slate-900 tabular-nums">₹{val?.toLocaleString() ?? '0'}</span>
        },
        {
            header: 'Used',
            key: 'utilization',
            align: 'center',
            render: (_, row) => {
                const percentage = ((row.usedCredit || 0) / (row.creditLimit || 1)) * 100;
                return (
                    <div className="flex items-center justify-center gap-3">
                        <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full transition-all duration-500", percentage > 90 ? "bg-rose-500" : percentage > 70 ? "bg-amber-400" : "bg-emerald-500")}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-black tabular-nums text-slate-900">{percentage.toFixed(1)}%</span>
                    </div>
                );
            }
        },
        {
            header: 'Outstanding',
            key: 'usedCredit',
            align: 'center',
            render: (val) => <span className="text-xs font-black text-slate-600 tabular-nums">₹{val?.toLocaleString() ?? '0'}</span>
        },
        {
            header: 'Due Date',
            key: 'creditOverdueDate',
            align: 'center',
            render: (val, row) => {
                const hasOutstanding = (row.usedCredit || 0) > 0;
                if (!hasOutstanding) {
                    return (
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">All Cleared</span>
                            <span className="text-[10px] text-slate-300 font-bold mt-1 tracking-tighter italic">N/A</span>
                        </div>
                    );
                }

                if (!val) return <span className="text-[10px] font-bold text-slate-400 italic text-center">No due date</span>;

                const dueDate = new Date(val);
                const now = new Date();
                const diffTime = dueDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    return (
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none underline decoration-2 underline-offset-2">Overdue</span>
                            <span className="text-[10px] text-rose-400 font-bold mt-1 tracking-tighter">{Math.abs(diffDays)} Days Late</span>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Payment Pending</span>
                        <span className="text-[10px] text-amber-500 font-bold mt-1 tracking-tighter">Due in {diffDays} Days</span>
                    </div>
                );
            }
        },
        {
            header: 'Status',
            key: 'status',
            align: 'center',
            render: (_, row) => {
                const percentage = ((row.usedCredit || 0) / (row.creditLimit || 1)) * 100;
                const isOverdue = row.usedCredit > 0 && row.creditOverdueDate && new Date() > new Date(row.creditOverdueDate);

                let status = "Stabilized";
                let styles = "bg-emerald-50 text-emerald-600 border-emerald-100";

                if (isOverdue) {
                    status = "Default / Account Locked";
                    styles = "bg-red-500 text-white border-red-600 shadow-sm";
                } else if (percentage > 90) {
                    status = "Critical Exposure";
                    styles = "bg-rose-50 text-rose-600 border-rose-100";
                } else if (percentage > 70) {
                    status = "Alert Threshold";
                    styles = "bg-amber-50 text-amber-600 border-amber-100";
                }

                return (
                    <div className="flex justify-center">
                        <div className={cn("px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest border w-fit", styles)}>
                            {status}
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Actions',
            key: 'actions',
            align: 'center',
            render: (_, row) => (
                <div className="flex items-center justify-center">
                    <button onClick={() => handleOverride(row)} className="p-1 px-2 text-[10px] font-black uppercase text-slate-900 border border-slate-900 rounded-sm hover:bg-slate-900 hover:text-white transition-all">Change Limit</button>
                </div>
            )
        }
    ];

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-50 border border-slate-200" />
                <div className="h-[500px] bg-slate-50 border border-slate-200" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Financials</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Credit Management</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Customer credit limits and dues</h1>
                    </div>

                    <div className="flex items-center gap-2">
                    </div>
                </div>
            </div>

            {/* Credit Performance Corridor */}
            <div className="bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-3">
                <MetricRow
                    label="Total Credit Given"
                    value={`₹${(customers.reduce((acc, curr) => acc + (curr.usedCredit || 0), 0) / 100000).toFixed(2)}L`}
                    change={12.4}
                    trend="up"
                    icon={IndianRupee}
                    sparklineData={[3.8, 3.9, 4.1, 4.0, 4.2, 4.25, 4.28].map(v => ({ value: v }))}
                />
                <MetricRow
                    label="Total Credit Limit"
                    value={`₹${(customers.reduce((acc, curr) => acc + (curr.creditLimit || 0), 0) / 100000).toFixed(2)}L`}
                    sub="Allocated Capital"
                    icon={CreditCard}
                />
                <MetricRow
                    label="Status"
                    value={`${(customers.length > 0 ? ((customers.length - customers.filter(c => ((c.usedCredit || 0) / (c.creditLimit || 1)) > 0.9).length) / customers.length) * 100 : 100).toFixed(1)}%`}
                    trend="Stable"
                    isPositive={true}
                    icon={ShieldCheck}
                />
            </div>

            <div className="p-6">
                <div className="flex flex-col gap-px">
                    {/* Search & Intelligence Controls */}

                    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                        <DataGrid
                            title="Customer credit limits and usage"
                            columns={customerColumns}
                            data={filteredCustomers}
                            density="compact"
                        />
                    </div>
                </div>
            </div>

            <CreditOverrideModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                customer={selectedCustomer}
                onSave={handleSaveOverride}
            />
        </div>
    );
}
