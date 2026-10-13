import { motion } from 'framer-motion';
import { Save, Info, Percent } from 'lucide-react';
import { useState } from 'react';

export default function CommissionForm({ initialRate, label, onSave }) {
    const [rate, setRate] = useState(initialRate);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            onSave(rate);
            setIsSaving(false);
        }, 1000);
    };

    return (
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300">
                        <Info size={14} />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <input
                            type="number"
                            step="0.1"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl py-5 pl-6 pr-14 outline-none text-4xl font-black text-slate-900"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2">
                            <Percent size={24} className="text-slate-300" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50/50 p-3 rounded-xl border border-dotted border-slate-200">
                        <Info size={12} className="shrink-0" />
                        <span>Commission is calculated on total purchase value before taxes.</span>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            />
                        ) : (
                            <Save size={16} />
                        )}
                        Save
                    </button>
                </div>
            </div>

            {/* Background design element */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
        </div>
    );
}
