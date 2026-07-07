import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    Box, 
    Truck, 
    CreditCard, 
    Scale, 
    Info, 
    Phone, 
    Mail, 
    HelpCircle, 
    ChevronDown, 
    MessageSquare, 
    ArrowRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsScreen() {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState(null);

    const sections = [
        {
            title: '1. Inventory Integrity',
            icon: Box,
            content: 'Vendors are required to maintain accurate stock levels in the portal. Any product listed as "Available" must be physically present in the warehouse and ready for dispatch within 2 hours of order acceptance.'
        },
        {
            title: '2. Logistics & Pickup',
            icon: Truck,
            content: 'Kisaankart logistics will conduct pickups at scheduled times. Items must be packed according to the "Vendor Packing Standards" to ensure zero damage during transit. Failure to comply may void insurance claims.'
        },
        {
            title: '3. Payment & Settlements',
            icon: CreditCard,
            content: 'Payments for delivered goods are processed on a T+7 cycle (7 days after delivery). Any disputes regarding payment must be raised within 48 hours of settlement through the Vendor Support Portal.'
        },
        {
            title: '4. Quality Compliance',
            icon: Scale,
            content: 'Marketplace quality is non-negotiable. Persistent quality complaints from customers or franchise nodes may result in temporary store suspension or permanent offboarding from the platform.'
        }
    ];

    const faqs = [
        {
            question: 'How do I update my inventory levels?',
            answer: 'You can update your product stock levels in real-time through the "Inventory" tab on the Vendor Dashboard. Ensure inventory reflects physical availability to prevent order cancellations.'
        },
        {
            question: 'What is the payment settlement cycle?',
            answer: 'Payments for completed and delivered orders are settled on a T+7 cycle (7 days post-delivery) directly into your linked corporate bank account.'
        },
        {
            question: 'How are packaging requirements managed?',
            answer: 'All items must be packed in Kisaankart-approved standard packaging/crates. Correct sorting and labeling are required to avoid transit damage and pickup rejection.'
        },
        {
            question: 'What happens in case of customer rejection or returns?',
            answer: 'If a customer or franchise rejects items due to quality defects, a rejection report is raised. You can view details in the "Rejected Stock" report, and items will be returned to your location.'
        },
        {
            question: 'Who should I contact for logistics delays?',
            answer: 'For delayed pickups or delivery partner issues, contact our logistics support at +91 85554 54446 or email logistics support at support@kisaankart.com.'
        }
    ];

    const toggleFaq = (idx) => {
        setOpenFaq(openFaq === idx ? null : idx);
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans pb-24">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shadow-slate-200/40">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)} 
                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all rounded-full border border-slate-100"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Vendor Terms & Protocol</h1>
                    </div>
                    
                    <button 
                        onClick={() => navigate('/vendor/help-support')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-primary transition-all shadow-md active:scale-95 border-none cursor-pointer"
                    >
                        <MessageSquare size={13} />
                        Support Center
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-12">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 space-y-3"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                        Compliance & Support Desk
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                        Marketplace <br/> Agreement
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xl">
                        This document outlines the operational compliance protocol, dispute resolution terms, and support mechanisms for vendors supplying to the Kisaankart network.
                    </p>
                </motion.div>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Left Column: Terms and FAQs */}
                    <div className="lg:col-span-2 space-y-12">
                        {/* Terms Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-primary rounded-full" />
                                Section I: Core Compliance
                            </h3>
                            <div className="space-y-0.5 bg-slate-200 p-px rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
                                {sections.map((section, idx) => (
                                    <motion.div 
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="bg-white p-6 md:p-8 space-y-4"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                                <section.icon size={16} />
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{section.title}</h4>
                                        </div>
                                        <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">
                                            {section.content}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* FAQs Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 bg-primary rounded-full" />
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                                    Section II: Vendor FAQs
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {faqs.map((faq, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${
                                            openFaq === idx ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <button
                                            onClick={() => toggleFaq(idx)}
                                            className="w-full flex items-center justify-between p-6 text-left border-none bg-transparent cursor-pointer"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 mt-0.5 border ${
                                                    openFaq === idx ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`}>
                                                    <HelpCircle size={16} />
                                                </div>
                                                <span className={`text-[13px] md:text-sm font-bold leading-snug transition-colors ${
                                                    openFaq === idx ? 'text-slate-900' : 'text-slate-600'
                                                }`}>{faq.question}</span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border border-slate-100 flex items-center justify-center transition-all ${
                                                openFaq === idx ? 'rotate-180 bg-slate-50' : 'bg-white'
                                            }`}>
                                                <ChevronDown size={12} className={openFaq === idx ? 'text-slate-900' : 'text-slate-300'} />
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {openFaq === idx && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                                >
                                                    <div className="px-6 pb-6 pt-0 text-xs md:text-sm text-slate-500 font-medium leading-relaxed pl-[60px]">
                                                        <div className="h-px w-full bg-slate-50 mb-4" />
                                                        {faq.answer}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Support & Contact Details */}
                    <div className="space-y-6 lg:sticky lg:top-24">
                        <div className="flex items-center gap-2 mb-2 lg:hidden">
                            <span className="w-2 h-2 bg-primary rounded-full" />
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                                Section III: Contact & Support
                            </h3>
                        </div>

                        <div className="bg-white p-6 md:p-8 rounded-[36px] border border-slate-200 shadow-md space-y-6">
                            <div className="space-y-2">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <MessageSquare size={20} />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic">Vendor Support</h3>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    Have queries regarding compliance terms, payment processing, or operational issues? Connect directly with our merchant support team.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <a 
                                    href="mailto:support@kisaankart.com" 
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all group decoration-none"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary/10 transition-colors shadow-sm shrink-0">
                                        <Mail size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Email Address</p>
                                        <p className="text-xs md:text-sm font-bold text-slate-800 break-all">support@kisaankart.com</p>
                                    </div>
                                </a>

                                <a 
                                    href="tel:+918555454446" 
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all group decoration-none"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary/10 transition-colors shadow-sm shrink-0">
                                        <Phone size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Contact Number</p>
                                        <p className="text-xs md:text-sm font-bold text-slate-800">+91 85554 54446</p>
                                    </div>
                                </a>
                            </div>

                            <button 
                                onClick={() => navigate('/vendor/help-support')}
                                className="group w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-primary text-white text-xs font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-slate-200 active:scale-[0.98] border-none cursor-pointer"
                            >
                                Help & Support Route
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        <div className="p-6 bg-slate-900 rounded-3xl text-white flex items-start gap-4 shadow-xl">
                            <Info size={24} className="text-primary shrink-0" />
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Legal Notice</p>
                                <p className="text-[11px] font-bold leading-relaxed text-slate-300 uppercase tracking-wider">
                                    By registering or logging in, you agree to these vendor compliance terms. Kisaankart reserves the right to modify these terms at any time.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
