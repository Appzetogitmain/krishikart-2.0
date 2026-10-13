import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Truck,
    Search,
    Star,
    MapPin,
    Phone,
    CheckCircle2,
    ArrowRight,
    Bike,
    Car,
    Info
} from 'lucide-react';
import mockPartners from '../../data/mockDeliveryPartners.json';
import { cn } from '@/lib/utils';

export default function DeliveryAssignmentDrawer({ isOpen, onClose, assignment, onAssign }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [success, setSuccess] = useState(false);

    const filteredPartners = mockPartners.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAssign = (partner) => {
        setIsAssigning(true);
        setTimeout(() => {
            setIsAssigning(false);
            setSuccess(true);
            setTimeout(() => {
                onAssign(partner);
                setSuccess(false);
                onClose();
            }, 1500);
        }, 1200);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[100]"
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl z-[110] flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="px-2 py-1 bg-slate-900 text-white text-[10px] font-black rounded-sm uppercase tracking-[0.2em]">Waiting for Assignment</div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-sm text-slate-400 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Assign Delivery Partner</h2>
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest bg-slate-100/50 p-2 rounded-sm border border-slate-200/50">
                        <Info size={12} className="text-slate-400" />
                        <span>Route: {assignment?.vendorName || 'Vendor'} → {assignment?.franchiseName || 'Franchise'}</span>
                    </div>

                    <div className="relative mt-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search by name, ID or vehicle type..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.trim())}
                            className="w-full bg-white border border-slate-200 rounded-sm py-2.5 pl-10 pr-4 outline-none text-[11px] font-bold focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                    </div>
                </div>

                {/* Partners List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {filteredPartners.map((partner, index) => (
                        <motion.div
                            key={partner.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                                "group bg-white p-4 border rounded-sm transition-all flex flex-col gap-4 focus-within:border-slate-900",
                                partner.status === 'available' ? "border-slate-200 hover:border-slate-400" : "border-slate-100 opacity-60 grayscale-[0.5]"
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-sm border flex items-center justify-center transition-colors shadow-sm",
                                        partner.status === 'available' ? "bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-slate-900 group-hover:text-white" : "bg-slate-100 border-slate-100 text-slate-300"
                                    )}>
                                        {partner.vehicle.includes('Truck') ? <Truck size={24} /> : (partner.vehicle.includes('Bike') ? <Bike size={24} /> : <Truck size={24} />)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-slate-900 text-[13px] tracking-tight">{partner.name}</h4>
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-widest",
                                                partner.status === 'available' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {partner.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <div className="flex items-center gap-1 text-amber-500 font-black text-[10px] tabular-nums">
                                                <Star size={10} fill="currentColor" /> {partner.rating}
                                            </div>
                                            <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{partner.vehicle}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Success Rate</div>
                                    <div className="text-xs font-black text-slate-900 tabular-nums leading-none">99.2%</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <Phone size={11} />
                                        <span className="text-[10px] font-bold tabular-nums">{partner.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <CheckCircle2 size={11} />
                                        <span className="text-[10px] font-bold tabular-nums">{partner.completedTasks} Trips</span>
                                    </div>
                                </div>

                                {partner.status === 'available' && (
                                    <button
                                        disabled={isAssigning}
                                        onClick={() => handleAssign(partner)}
                                        className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        Assign
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Success Overlay */}
                <AnimatePresence>
                    {success && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-10"
                        >
                            <div className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                    className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                                >
                                    <CheckCircle2 size={40} className="text-slate-900" />
                                </motion.div>
                                <h3 className="text-2xl font-black text-white tracking-tight mb-2 uppercase">Partner Assigned</h3>
                                <p className="text-emerald-400 font-bold text-[10px] uppercase tracking-[0.3em]">The delivery partner has been notified</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
}
