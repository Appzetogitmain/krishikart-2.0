import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, FileText, Info, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { STATIC_TERMS_CONTACT, STATIC_TERMS_CONTENT } from '@/lib/legalDefaults';

export default function TermsScreen() {
    const navigate = useNavigate();
    const [content, setContent] = useState(STATIC_TERMS_CONTENT);
    const [email, setEmail] = useState(STATIC_TERMS_CONTACT.email);
    const [phone, setPhone] = useState(STATIC_TERMS_CONTACT.phone);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const [legalRes, settingsRes] = await Promise.all([
                    api.get('/masteradmin/public/legal-pages'),
                    api.get('/masteradmin/public-settings'),
                ]);

                const settings = settingsRes.data?.results || settingsRes.data?.result || [];
                const supportEmail =
                    settings.find((s) => s.key === 'support_email')?.value || STATIC_TERMS_CONTACT.email;
                const supportPhone =
                    settings.find((s) => s.key === 'support_phone')?.value || STATIC_TERMS_CONTACT.phone;

                if (legalRes.data?.success && legalRes.data?.result) {
                    const t = legalRes.data.result.terms || {};
                    const c = legalRes.data.result.contact || {};
                    setContent(t.content?.trim() || STATIC_TERMS_CONTENT);
                    setEmail(String(t.email || c.email || supportEmail).trim() || STATIC_TERMS_CONTACT.email);
                    setPhone(String(t.phone || c.phone || supportPhone).trim() || STATIC_TERMS_CONTACT.phone);
                }
            } catch (err) {
                console.error('Failed to fetch terms:', err);
                setContent(STATIC_TERMS_CONTENT);
                setEmail(STATIC_TERMS_CONTACT.email);
                setPhone(STATIC_TERMS_CONTACT.phone);
            } finally {
                setLoading(false);
            }
        };
        fetchTerms();
    }, []);

    const defaultSections = [
        {
            title: '1. Account Responsibility',
            content:
                'You are responsible for maintaining the confidentiality of your account credentials. Any activity occurring under your account is your sole responsibility.',
        },
        {
            title: '2. Product Quality & Returns',
            content:
                'Kisaankart strives for the highest quality. Report damaged or incorrect products within 24 hours of delivery for a valid return or refund request.',
        },
        {
            title: '3. Delivery Protocol',
            content:
                'Estimated delivery times are provided for convenience. Deliveries will be made to the address specified in your profile.',
        },
    ];

    const renderContent = () => {
        if (content) {
            return content.split('\n').map((paragraph, idx) => (
                <p key={idx} className="text-sm text-slate-500 font-medium leading-relaxed">
                    {paragraph}
                </p>
            ));
        }
        return defaultSections.map((section, idx) => (
            <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-2"
            >
                <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{section.content}</p>
            </motion.div>
        ));
    };

    const contactBlock = useMemo(() => {
        if (!email && !phone) return null;
        return (
            <div className="p-5 bg-white rounded-2xl border-2 border-primary/20 shadow-sm shadow-primary/5 space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <FileText size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Contact for terms queries</h3>
                        <p className="text-xs text-slate-500 font-medium">Email or call us about these terms</p>
                    </div>
                </div>
                <div className="space-y-3">
                    {email && (
                        <a
                            href={`mailto:${email}`}
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-900 font-semibold hover:bg-primary/5 transition-colors"
                        >
                            <Mail size={18} className="text-primary shrink-0" />
                            <span className="break-all">{email}</span>
                        </a>
                    )}
                    {phone && (
                        <a
                            href={`tel:${phone.replace(/\s/g, '')}`}
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-900 font-semibold hover:bg-primary/5 transition-colors"
                        >
                            <Phone size={18} className="text-primary shrink-0" />
                            <span>{phone}</span>
                        </a>
                    )}
                </div>
            </div>
        );
    }, [email, phone]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen font-sans pb-20">
            <div className="bg-primary text-white p-6 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-1 hover:bg-white/10 rounded-full">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-lg font-bold">Terms of Service</h1>
                </div>
            </div>

            <div className="p-6 space-y-8 max-w-2xl mx-auto">
                <div className="space-y-4">
                    <div className="w-16 h-1 bg-primary rounded-full" />
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">Consumer Agreement</h2>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed">
                        Welcome to Kisaankart. By using our application, you agree to comply with and be bound by the
                        following terms and conditions.
                    </p>
                </div>

                {contactBlock}

                <div className="space-y-8">{renderContent()}</div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                    <Info size={20} className="text-primary shrink-0" />
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                        Last Modified: April 2026. Kisaankart reserves the right to update these terms at any time
                        without prior notice.
                    </p>
                </div>
            </div>
        </div>
    );
}
