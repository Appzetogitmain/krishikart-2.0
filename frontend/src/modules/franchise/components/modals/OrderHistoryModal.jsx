import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ShoppingBag, History } from 'lucide-react';
import { useFranchiseOrders } from '../../contexts/FranchiseOrdersContext';
import DataGrid from '../tables/DataGrid';
import { cn } from '@/lib/utils';

export default function OrderHistoryModal({ isOpen, onClose }) {
    const { fetchOrdersByDate } = useFranchiseOrders();
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadHistory = async () => {
        const safeSelectedDate = selectedDate > today ? today : selectedDate;
        if (safeSelectedDate !== selectedDate) {
            setSelectedDate(today);
            return;
        }

        setIsLoading(true);
        const data = await fetchOrdersByDate(safeSelectedDate);
        setOrders(data);
        setIsLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen, selectedDate]);

    const filteredOrders = orders.filter(order => {
        const orderId = order.id?.toString().toLowerCase() || '';
        const hotelName = order.hotelName?.toLowerCase() || '';
        return orderId.includes(searchQuery.toLowerCase()) || hotelName.includes(searchQuery.toLowerCase());
    });

    const totalRevenue = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);

    const columns = [
        {
            header: 'Order Details',
            key: 'hotelName',
            render: (val, row) => (
                <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-[11px] tracking-tight">{val}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] mt-0.5">Order #{row.id?.slice(-6)}</span>
                </div>
            )
        },
        {
            header: 'Time',
            key: 'time',
            render: (val) => <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{val}</span>
        },
        {
            header: 'Items',
            key: 'items',
            render: (items) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{items?.length || 0} items</span>
        },
        {
            header: 'Status',
            key: 'status',
            render: (val) => (
                <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    val === 'delivered' || val === 'received' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"
                )}>
                    {val}
                </span>
            )
        },
        {
            header: 'Amount',
            key: 'total',
            align: 'right',
            render: (val) => <span className="text-[11px] font-black text-slate-900 tabular-nums">₹{(val || 0).toLocaleString()}</span>
        }
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence mode="wait">
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-4xl bg-white rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Modal Header */}
                    <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-sm">
                                <History size={20} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest">Order History</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Your past orders and sales</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 shrink-0">
                        <div className="flex items-center bg-white border border-slate-200 p-1.5 rounded-sm px-4">
                            <input
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={(e) => setSelectedDate(e.target.value > today ? today : e.target.value)}
                                className="text-[11px] font-black text-slate-900 outline-none uppercase bg-white cursor-pointer"
                            />
                        </div>

                        <div className="relative group flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search past orders..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.trim())}
                                className="bg-white border border-slate-200 rounded-sm py-1.5 pl-9 pr-4 outline-none text-[11px] font-black text-slate-900 placeholder:text-slate-400 focus:border-slate-400 transition-all w-full"
                            />
                        </div>

                        <div className="flex-1" />

                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Orders</span>
                                <span className="text-xs font-black text-slate-900">{orders.length}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Revenue</span>
                                <span className="text-xs font-black text-emerald-600">₹{totalRevenue.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto min-h-[400px]">
                        {isLoading ? (
                            <div className="p-8 space-y-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="h-12 bg-slate-50 rounded-sm animate-pulse" />
                                ))}
                            </div>
                        ) : filteredOrders.length > 0 ? (
                            <DataGrid
                                columns={columns}
                                data={filteredOrders}
                                density="compact"
                                showSearch={false}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <ShoppingBag size={24} className="text-slate-300" />
                                </div>
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">No records found</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">No orders were processed on this selected date</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-sm shadow-sm"
                        >
                            Close History
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
