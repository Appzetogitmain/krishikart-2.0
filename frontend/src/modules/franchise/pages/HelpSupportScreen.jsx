import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, Mail, ChevronDown, HelpCircle, Info } from 'lucide-react';
import api from '@/lib/axios';

export default function HelpSupportScreen() {
    const navigate = useNavigate();
    const [openIndex, setOpenIndex] = useState(null);
    const [faqs, setFaqs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const { data } = await api.get('/masteradmin/public-faqs', { params: { audience: 'franchise' } });
                if (data.success) {
                    setFaqs(data.results || data.result || []);
                }
            } catch (error) {
                console.error("Failed to fetch franchise FAQs", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFaqs();
    }, []);

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            {/* Header */}
            <div className="bg-white px-6 py-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-30">
                <button 
                    onClick={() => navigate(-1)} 
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Franchise Help Center</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Guides and support</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6 space-y-8 text-left">
                {/* Contact Channels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="tel:+918555454446" className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3 group hover:shadow-xl transition-all">
                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Phone size={22} />
                        </div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase">24/7 Helpline</h4>
                    </a>
                    <a href="mailto:franchise@kisaankart.com" className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3 group hover:shadow-xl transition-all">
                        <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Mail size={22} />
                        </div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase">Raise a Complaint</h4>
                    </a>
                    <div className="bg-slate-900 p-6 rounded-[32px] flex flex-col items-center text-center gap-3 text-white">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                            <Info size={22} />
                        </div>
                        <h4 className="text-[11px] font-black uppercase">How-to Guides</h4>
                    </div>
                </div>

                {/* FAQ Inventory */}
                <div>
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Common Questions</h3>
                    </div>

                    {isLoading ? (
                        <div className="py-24 text-center">
                            <div className="text-[10px] font-black text-slate-300 uppercase animate-pulse tracking-widest">Loading...</div>
                        </div>
                    ) : faqs.length > 0 ? (
                        <div className="space-y-4">
                            {faqs.map((faq, idx) => (
                                <div key={faq._id} className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden transition-all hover:bg-slate-50/50">
                                    <button
                                        onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                                        className="w-full flex items-center justify-between p-6 text-left"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100">
                                                <HelpCircle size={16} />
                                            </div>
                                            <span className="text-sm font-black text-slate-800 tracking-tight leading-tight">{faq.question}</span>
                                        </div>
                                        <motion.div
                                            animate={{ rotate: openIndex === idx ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronDown size={18} className="text-slate-300" />
                                        </motion.div>
                                    </button>
                                    <AnimatePresence>
                                        {openIndex === idx && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                            >
                                                <div className="px-18 pb-8 pt-0 text-[13px] text-slate-500 font-medium leading-relaxed pl-[60px] pr-8 italic">
                                                    "{faq.answer}"
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center bg-white rounded-[40px] border border-slate-100 border-dashed">
                            <HelpCircle size={40} className="text-slate-100 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No guides available yet</p>
                        </div>
                    )}
                </div>

                {/* Status Card */}
                <div className="p-6 bg-emerald-50 rounded-[32px] border border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Info size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Franchise Status</p>
                            <p className="text-sm font-black text-slate-900 tracking-tight">Active Franchise</p>
                        </div>
                    </div>
                    <div className="px-4 py-1.5 bg-white rounded-full text-[10px] font-black text-emerald-500 uppercase tracking-widest border border-emerald-100 shadow-sm">
                        Verified
                    </div>
                </div>
            </div>
        </div>
    );
}
