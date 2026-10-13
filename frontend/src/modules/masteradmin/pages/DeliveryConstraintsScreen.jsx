import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Truck,
    Save,
    Home,
    ChevronRight,
    IndianRupee,
    ShieldCheck,
    Info,
    Settings2,
    CheckCircle2
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function DeliveryConstraintsScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Initial state matching mock values or localStorage
    const [constraints, setConstraints] = useState({
        baseFee: '',
        freeMov: '',
        tax: '',
        platformFee: '',
        activeZones: false
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get('/masteradmin/settings');
                if (response.data.success) {
                    const deliverySetting = response.data.results.find(s => s.key === 'delivery_constraints');
                    if (deliverySetting) {
                        setConstraints(deliverySetting.value);
                    }
                }
            } catch (error) {
                console.error('Fetch settings error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await api.post('/masteradmin/settings/update', {
                key: 'delivery_constraints',
                value: {
                    baseFee: constraints.baseFee,
                    freeMov: constraints.freeMov,
                    tax: constraints.tax,
                    platformFee: constraints.platformFee,
                    activeZones: constraints.activeZones
                }
            });

            if (response.data.success) {
                toast.success('Delivery Settings Updated', {
                    description: 'New fees and tax rates are now active.',
                    icon: <CheckCircle2 size={16} className="text-emerald-500" />
                });
            }
        } catch (error) {
            console.error('Save settings error:', error);
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConstraints(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    if (isLoading) {
        return <div className="p-8 animate-pulse text-slate-400 uppercase font-black text-[10px] tracking-widest">Loading settings...</div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Delivery</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Settings</span>
                        </div>
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Delivery Fee Settings</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            disabled={isSaving}
                            onClick={handleSave}
                            className={cn(
                                "px-6 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-emerald-600 disabled:bg-slate-300",
                                isSaving && "animate-pulse"
                            )}
                        >
                            {isSaving ? 'Saving...' : (
                                <>
                                    <Save size={12} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-8">
                <div className="space-y-8">
                    {/* Security Banner */}
                    <div className="bg-slate-900 rounded-sm p-4 flex items-center justify-between border-l-4 border-emerald-500">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/5 rounded-sm flex items-center justify-center text-emerald-400">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Delivery Fee Rules</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Manage how much customers are charged for delivery.</p>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-800 px-2 py-1 rounded-sm">Delivery fee settings</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 1. Core Fee Logic */}
                        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden group">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-50 text-slate-600 flex items-center justify-center rounded-sm group-hover:bg-slate-900 group-hover:text-white transition-colors duration-350">
                                        <IndianRupee size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Standard Fees</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5 flex items-center justify-between">
                                        Standard Delivery Fee (₹)
                                        <Info size={10} className="text-slate-300" />
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                        <input
                                            type="number"
                                            name="baseFee"
                                            value={constraints.baseFee}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-8 py-2.5 text-sm font-black focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-0.5 flex items-center justify-between">
                                        Free Delivery on Orders Above (₹)
                                        <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full text-[10px]">Offer</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">₹</span>
                                        <input
                                            type="number"
                                            name="freeMov"
                                            value={constraints.freeMov}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50/50 border border-emerald-100 rounded-sm px-8 py-2.5 text-sm font-black text-emerald-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider italic mt-1">Orders above this amount will have free delivery.</p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Tax & Platform Fees */}
                        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden group">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-50 text-slate-600 flex items-center justify-center rounded-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-350">
                                        <Settings2 size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Tax & Platform Fees</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5 flex items-center justify-between">
                                        GST / Service Tax (%)
                                        <Info size={10} className="text-slate-300" />
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="tax"
                                            value={constraints.tax ?? ''}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50/50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm font-black focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                            placeholder="5"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Operational Summary Card */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-sm p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Truck size={80} className="rotate-12" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Delivery Summary</h4>
                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">Customers get free delivery on orders over <span className="text-emerald-900 font-black">₹{constraints.freeMov}</span></p>
                            </div>
                            <div className="flex items-center gap-4 border-l border-emerald-200 pl-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Settings Active</span>
                                </div>
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Applies to all orders</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
