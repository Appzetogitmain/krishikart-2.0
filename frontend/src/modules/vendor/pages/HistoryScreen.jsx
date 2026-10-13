import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Clock,
    TrendingUp,
    CheckCircle2,
    Calendar,
    ChevronRight,
    Search,
    IndianRupee,
    BarChart3,
    TrendingDown,
    Loader2,
    XCircle,
    Filter
} from 'lucide-react';
import mockOrders from '../data/mockVendorOrders.json';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import VendorBackBar from '../components/navigation/VendorBackBar';
import { useOrders } from '@/modules/user/contexts/OrderContext';

export default function HistoryScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    const { orders: contextOrders } = useOrders();

    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    // Merge mock orders with live completed/rejected orders
    const liveArchives = contextOrders
        .filter(o => o.status === 'completed' || o.status === 'rejected')
        .map(o => ({
            ...o,
            total: o.procurementTotal || o.total,
            franchiseName: o.franchise || 'Main Center',
            timestamp: o.lastUpdated || new Date().toISOString()
        }));

    const allArchives = [...liveArchives, ...mockOrders];

    const filteredOrders = allArchives.filter(o => {
        if (activeTab === 'all') return o.status === 'completed' || o.status === 'rejected';
        return o.status === activeTab;
    });

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center gap-4">
                <VendorBackBar />
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Order History</h1>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Past Performance</p>
                </div>
            </header>

            {/* Performance Snapshot */}
            <div className="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-10">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-primary">
                            <BarChart3 size={24} />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Orders Completed</p>
                            <h3 className="text-3xl font-black">98.4%</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp size={12} className="text-emerald-400" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Growth</p>
                            </div>
                            <p className="text-lg font-black">+14.2%</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Clock size={12} className="text-blue-400" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg. Time</p>
                            </div>
                            <p className="text-lg font-black">42m Avg</p>
                        </div>
                    </div>
                </div>
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -mr-32 -mt-32" />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                {['all', 'completed', 'rejected'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab === tab
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        {tab === 'completed' ? 'Delivered' : tab}
                    </button>
                ))}
            </div>

            {/* Past Deliveries */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Recent Orders</h3>

                {filteredOrders.map((order, index) => (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => navigate(`/vendor/orders/${order.id}`)}
                        className={cn(
                            "bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-lg hover:shadow-slate-200/50 transition-all cursor-pointer overflow-hidden",
                            order.status === 'rejected' && "border-red-50"
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                                order.status === 'completed'
                                    ? "bg-slate-50 text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500"
                                    : "bg-red-50 text-red-500"
                            )}>
                                {order.status === 'completed' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900 tracking-tight">{order.franchiseName}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                    {new Date(order.timestamp).toLocaleDateString('en-GB')}
                                    {order.status === 'rejected' && <span className="text-red-400 ml-2 italic">• {order.rejectionReason}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-1 text-sm font-black text-slate-900 justify-end">
                                <IndianRupee size={10} className="text-slate-400" />
                                {order.total}
                            </div>
                            <p className={cn(
                                "text-[10px] font-bold uppercase tracking-tighter mt-1",
                                order.status === 'completed' ? "text-emerald-500" : "text-red-500"
                            )}>
                                {order.status === 'completed' ? 'Paid-Out' : 'Cancelled'}
                            </p>
                        </div>
                    </motion.div>
                ))}

                {filteredOrders.length === 0 && (
                    <div className="py-20 text-center">
                        <Calendar size={48} className="text-slate-100 mx-auto mb-4" />
                        <h4 className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No past orders</h4>
                    </div>
                )}
            </div>

            <button className="w-full bg-white border border-slate-100 py-5 rounded-[24px] font-black text-[10px] text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all">
                Download Statement (PDF)
            </button>
        </div>
    );
}
