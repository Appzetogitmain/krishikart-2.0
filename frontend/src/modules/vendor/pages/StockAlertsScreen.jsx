import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Package,
    TrendingDown,
    Clock,
    ChevronRight,
    Search,
    IndianRupee,
    BadgeAlert,
    Loader2
} from 'lucide-react';
import mockProduce from '../data/mockProduce.json';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import VendorBackBar from '../components/navigation/VendorBackBar';

export default function StockAlertsScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const alerts = mockProduce
        .filter(item => item.quantity <= 20)
        .map(item => ({
            ...item,
            type: item.quantity === 0 ? 'critical' : 'warning',
            message: item.quantity === 0 ? 'Out of Stock' : 'Low Stock Inventory'
        }));

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center gap-4">
                <VendorBackBar />
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Stock Alerts</h1>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">{alerts.length} Items Needing Attention</p>
                </div>
            </header>

            {/* Alert Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-3">
                        <AlertTriangle size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Critical</p>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{alerts.filter(a => a.type === 'critical').length}</h3>
                </div>
                <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-3">
                        <BadgeAlert size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Warnings</p>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{alerts.filter(a => a.type === 'warning').length}</h3>
                </div>
            </div>

            {/* Detailed Alerts List */}
            <div className="space-y-4">
                <AnimatePresence>
                    {alerts.map((alert, index) => (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                                "bg-white p-5 rounded-[32px] border flex gap-4 transition-all relative overflow-hidden group",
                                alert.type === 'critical' ? "border-red-100 shadow-red-900/5 shadow-xl" : "border-slate-100 shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center",
                                alert.type === 'critical' ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                            )}>
                                <Package size={24} />
                            </div>

                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className={cn(
                                            "text-[10px] font-black uppercase tracking-widest mb-1",
                                            alert.type === 'critical' ? "text-red-400" : "text-amber-400"
                                        )}>{alert.message}</p>
                                        <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none">{alert.name}</h4>
                                    </div>
                                    <button
                                        onClick={() => navigate('/vendor/inventory')}
                                        className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:bg-primary hover:text-white transition-all"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                <div className="mt-4 flex items-center gap-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Current Stock</p>
                                        <p className="text-sm font-black text-slate-900">{alert.quantity} {alert.unit}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Minimum Stock</p>
                                        <p className="text-sm font-black text-slate-900">50 {alert.unit}</p>
                                    </div>
                                </div>
                            </div>

                            {alert.type === 'critical' && (
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-[40px] rounded-full -mr-10 -mt-10" />
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {alerts.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center">
                        <CheckCircle2 size={48} className="text-emerald-100 mb-4" />
                        <h4 className="font-black text-slate-900 tracking-tight">Stock Healthy</h4>
                        <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">No restocking needed</p>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-xl shadow-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <TrendingDown className="text-primary" size={24} />
                    <h4 className="text-lg font-black tracking-tight leading-tight">Stock Forecast <br /> Running Low</h4>
                </div>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">Based on recent franchise orders, <b>Spinach</b> and <b>Mangoes</b> are expected to drop below safety levels within 14 hours.</p>
                <button className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Plan Restock</button>
            </div>
        </div>
    );
}
