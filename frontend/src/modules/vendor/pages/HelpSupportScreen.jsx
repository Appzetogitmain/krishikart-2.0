import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageCircle, Phone, Mail, ChevronDown, HelpCircle } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

export default function HelpSupportScreen() {
    const navigate = useNavigate();
    const [openIndex, setOpenIndex] = useState(null);
    const [faqs, setFaqs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const { data } = await api.get('/masteradmin/public-faqs', { params: { audience: 'vendor' } });
                if (data.success) {
                    setFaqs(data.results || data.result || []);
                }
            } catch (error) {
                console.error("Failed to fetch vendor FAQs", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFaqs();
    }, []);

    return (
        <div className="bg-[#fbfcff] min-h-screen pb-32">
            {/* Header with mesh gradient effect */}
            <div className="bg-white px-8 py-10 border-b border-slate-100 sticky top-0 z-30 shadow-sm shadow-slate-200/20">
                <div className="max-w-4xl mx-auto flex items-center gap-6">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 text-slate-800 hover:bg-slate-900 hover:text-white transition-all transform active:scale-95 shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Help Center</p>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Vendor Help</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-8 space-y-12">
                {/* FAQ Section with better typography */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-slate-900 rounded-full" />
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Common Questions</h3>
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {faqs.length} questions
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className="py-24 text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Loading...</p>
                        </div>
                    ) : faqs.length > 0 ? (
                        <div className="space-y-4">
                            {faqs.map((faq, idx) => (
                                <div key={faq._id} className={cn(
                                    "bg-white rounded-[32px] border transition-all duration-300 overflow-hidden",
                                    openIndex === idx ? "border-emerald-200 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-50" : "border-slate-100 hover:border-slate-300 shadow-sm"
                                )}>
                                    <button
                                        onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                                        className="w-full flex items-center justify-between p-8 text-left"
                                    >
                                        <div className="flex items-start gap-5">
                                            <div className={cn(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 mt-0.5 border shadow-sm",
                                                openIndex === idx ? "bg-emerald-500 text-white border-emerald-400" : "bg-white text-slate-400 border-slate-100"
                                            )}>
                                                <HelpCircle size={18} />
                                            </div>
                                            <span className={cn(
                                                "text-[15px] font-bold leading-tight transition-colors",
                                                openIndex === idx ? "text-slate-900" : "text-slate-600"
                                            )}>{faq.question}</span>
                                        </div>
                                        <div className={cn(
                                            "w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center transition-all",
                                            openIndex === idx ? "rotate-180 bg-slate-50 border-slate-200" : "bg-white"
                                        )}>
                                            <ChevronDown size={14} className={cn(openIndex === idx ? "text-slate-900" : "text-slate-300")} />
                                        </div>
                                    </button>
                                    <AnimatePresence>
                                        {openIndex === idx && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                            >
                                                <div className="px-10 pb-10 pt-0 text-sm text-slate-500 font-medium leading-relaxed pl-[92px] max-w-[90%]">
                                                    <div className="h-px w-FULL bg-slate-50 mb-6" />
                                                    {faq.answer}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[40px] p-24 text-center border border-slate-100 border-dashed">
                            <HelpCircle size={48} className="text-slate-100 mx-auto mb-6" />
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">No help articles yet</h4>
                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Answers will appear here once the admin adds them</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
