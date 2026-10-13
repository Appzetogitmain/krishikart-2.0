import { motion } from 'framer-motion';
import { ChevronLeft, ShieldAlert, Cpu, Database, Eye, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsScreen() {
    const navigate = useNavigate();

    const sections = [
        {
            title: '1. Honest Use',
            icon: ShieldAlert,
            content: 'Access to the Master Console is strictly limited to authorized personnel. Sharing of credentials or providing unauthorized access to the network dashboard is a high-level security breach.'
        },
        {
            title: '2. Data Confidentiality',
            icon: Database,
            content: 'Admins have access to sensitive network data, including PII (Personally Identifiable Information) of users and vendors. Unauthorized extraction, storage, or distribution of this data is strictly prohibited.'
        },
        {
            title: '3. Making Changes',
            icon: Cpu,
            content: 'Any changes to commission rates, service zones, or system constraints must be logged through the internal change-management protocol. Actions taken in the console are immutable and fully audited.'
        },
        {
            title: '4. Activity Monitoring',
            icon: Eye,
            content: 'Administrator activity is monitored in real-time. Continuous deviations from standard operating procedures (SOPs) may trigger automated session termination and investigation by the security cell.'
        }
    ];

    return (
        <div className="bg-[#0f172a] min-h-screen font-sans text-slate-300">
            <header className="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 text-slate-500 hover:text-white transition-all rounded-xl border border-slate-800">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-[12px] font-black text-white uppercase tracking-[0.3em]">Admin Terms</h1>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto p-6 py-16 space-y-16">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">For Kisaankart staff</span>
                    </div>
                    <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Administration <br/> Terms</h2>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-lg">
                        Rules for Kisaankart admin staff. By logging in, you agree to them.
                    </p>
                </motion.div>

                <div className="grid gap-1">
                    {sections.map((section, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.98 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-slate-900/50 border border-slate-800 p-8 flex gap-6 hover:bg-slate-900 transition-colors"
                        >
                            <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/5">
                                <section.icon size={22} />
                            </div>
                            <div className="space-y-3 pt-1">
                                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">{section.title}</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                    {section.content}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="p-10 bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-[40px] space-y-4">
                    <div className="flex items-center gap-3">
                        <Info size={18} className="text-indigo-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Acknowledgment</p>
                    </div>
                    <p className="text-xs font-bold leading-relaxed text-slate-400 uppercase tracking-[0.15em]">
                        By logging in, you agree to keep customer and business data private and secure. Misuse can lead to legal action.
                    </p>
                </div>
            </div>
        </div>
    );
}
