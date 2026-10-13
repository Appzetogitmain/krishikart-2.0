import { motion } from 'framer-motion';
import { ChevronLeft, Shield, FileText, ScrollText, AlertCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsScreen() {
    const navigate = useNavigate();

    const sections = [
        {
            id: 'node-auth',
            title: 'Approval & Payments',
            icon: Shield,
            content: 'Once your franchise is verified, you can take orders in your assigned delivery area. Payments for delivered orders are made weekly, after a 10% platform commission on the order value.'
        },
        {
            id: 'logistical-compliance',
            title: 'Delivery Rules',
            icon: ScrollText,
            content: 'Store every product the right way (room temperature, cold storage, etc.). Check each stock delivery within 4 hours of arrival if you want to claim for missing or damaged items.'
        },
        {
            id: 'quality-standards',
            title: 'Quality & Service Standards',
            icon: FileText,
            content: 'Pack every order to the Kisaankart packaging standard. If an accepted order is not processed within 120 minutes, it may be moved to another franchise.'
        },
        {
            id: 'data-privacy',
            title: 'Customer Data & Privacy',
            icon: Info,
            content: 'Use customer phone numbers and addresses only to deliver their orders. Using them for your own marketing or sharing them is a breach of the franchise agreement.'
        },
        {
            id: 'termination',
            title: 'Termination & Liability',
            icon: AlertCircle,
            content: 'Your franchise may be suspended if valid documents (KYC/GST) are not provided or service ratings stay low. Either side can end the agreement with 30 days’ notice through Kisaankart support.'
        }
    ];

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-4 flex items-center justify-between max-w-4xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all rounded-full border border-slate-100"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Terms & Conditions</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Last Updated: April 2026</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 py-12">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-12"
                >
                    <div className="space-y-4">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Agreement</h2>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            This agreement covers the relationship between Kisaankart (the platform) and you (the franchise). By logging in, you agree to the rules below.
                        </p>
                    </div>

                    <div className="space-y-0.5 bg-slate-200 p-px rounded-sm overflow-hidden border border-slate-200">
                        {sections.map((section, idx) => (
                            <motion.div 
                                key={section.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white p-6 md:p-8 space-y-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-sm bg-slate-900 text-white flex items-center justify-center">
                                        <section.icon size={18} />
                                    </div>
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{section.title}</h3>
                                </div>
                                <p className="text-[12px] md:text-sm text-slate-500 font-medium leading-relaxed">
                                    {section.content}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="p-8 bg-slate-900 rounded-sm text-white space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Acknowledgment</h4>
                        <p className="text-xs font-bold leading-relaxed text-slate-400 uppercase tracking-wider">
                            By continuing to use the dashboard, you confirm that the information in your KYC documents is correct and that you will follow Kisaankart’s delivery rules.
                        </p>
                    </div>

                    <div className="flex justify-center pt-8">
                        <button 
                            onClick={() => navigate(-1)}
                            className="text-[11px] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1"
                        >
                            Back
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
