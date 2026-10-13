import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Truck,
    MapPin,
    Package,
    ShieldCheck,
    Clock,
    AlertCircle,
    ArrowLeft,
    Phone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { b2bAssignments } from '../utils/mockData';
import StatusProgress from '../components/ui/StatusProgress';

const B2BAssignment = () => {
    const navigate = useNavigate();
    const assignment = b2bAssignments[0];
    const [isDelivered, setIsDelivered] = useState(false);

    const handleMarkDelivered = () => {
        if (isDelivered) {
            navigate('/delivery/dashboard');
        } else {
            setIsDelivered(true);
        }
    };

    const currentStatus = isDelivered ? 'Delivered' : 'Dispatched';

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-32">
            {/* App Bar */}
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-200 sticky top-0 z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Delivery Details</span>
                    <span className="text-xs font-bold">{assignment.id}</span>
                </div>
                <button className="p-2 -mr-2 text-primary">
                    <Phone className="w-5 h-5" />
                </button>
            </div>

            {/* Status Stepper */}
            <div className="bg-white px-6 border-b border-slate-200">
                <StatusProgress currentStatus={currentStatus} />
            </div>

            <div className="p-6 space-y-6 pb-32">
                {/* Visual Header */}
                <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="text-emerald-400" size={18} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Verified Delivery</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight mb-2 uppercase">Order Items</h2>
                        <div className="flex items-center gap-4 text-slate-400">
                            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-widest">
                                <Package size={14} /> {assignment.payloadWeight}
                            </div>
                            <div className="w-1 h-1 bg-slate-700 rounded-full" />
                            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-widest">
                                <Clock size={14} /> Urgent
                            </div>
                        </div>
                    </div>
                </div>

                {/* Locations Flow */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-8 relative overflow-hidden">
                    <div className="absolute left-[39px] top-12 bottom-12 w-0.5 border-l-2 border-dashed border-slate-200" />

                    {/* Origin */}
                    <div className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 z-10">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pick From Franchise</p>
                            <h3 className="font-black text-slate-900 text-sm mb-1">{assignment.franchiseName}</h3>
                            <p className="text-xs text-slate-500 font-medium">{assignment.franchiseAddress}</p>
                        </div>
                    </div>

                    {/* Destination */}
                    <div className="flex gap-4 relative">
                        <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 z-10">
                            <MapPin className="text-primary w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deliver to Customer</p>
                            <h3 className="font-black text-slate-900 text-sm mb-1">Premium Customer</h3>
                            <p className="text-xs text-slate-500 font-medium">Standard Delivery Address</p>
                        </div>
                    </div>
                </div>

                {/* Items Manifest */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Item List</h4>
                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-sm">{assignment.items.length} Units</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {assignment.items.map((item, i) => (
                            <div key={i} className="px-5 py-4 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{item.name}</span>
                                </div>
                                <span className="text-sm font-black text-slate-900 tabular-nums">{item.qty}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Safety Protocol */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
                    <AlertCircle className="text-amber-500 shrink-0" size={20} />
                    <p className="text-xs font-bold text-amber-700 leading-relaxed uppercase tracking-wide">
                        Check the item quantities at pickup. If anything is missing, tell support before you leave the franchise.
                    </p>
                </div>
            </div>

            {/* Status Trigger */}
            <div className="fixed bottom-16 left-0 right-0 p-6 bg-white border-t border-slate-200 z-30">
                <div className="max-w-md mx-auto">
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleMarkDelivered}
                        className={`w-full py-4 rounded-xl font-black shadow-xl flex items-center justify-center text-center text-lg uppercase tracking-widest transition-all ${isDelivered ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-900 text-white shadow-slate-900/20'
                            }`}
                    >
                        {isDelivered ? 'Back to Dashboard' : 'Mark as Delivered'}
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default B2BAssignment;
