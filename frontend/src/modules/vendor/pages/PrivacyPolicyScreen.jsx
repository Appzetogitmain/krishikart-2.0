import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Shield, Lock, User, Info, Mail, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'

export default function PrivacyPolicyScreen() {
    const navigate = useNavigate()
    const [content, setContent] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPrivacyPolicy = async () => {
            try {
                const { data } = await api.get('/masteradmin/public/legal-pages')
                if (data?.success && data?.result?.privacy) {
                    const p = data.result.privacy
                    if (p.content) setContent(p.content)
                    if (p.email) setEmail(p.email)
                    if (p.phone) setPhone(p.phone)
                }
            } catch (err) {
                console.error('Failed to fetch privacy policy:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchPrivacyPolicy()
    }, [])

    const defaultSections = [
        {
            title: '1. Data We Collect',
            icon: User,
            content: 'We collect business information such as business name, owner details, contact information, bank details, and KYC documents for verification and payment processing.'
        },
        {
            title: '2. Data Usage',
            icon: Lock,
            content: 'Your information is used for vendor onboarding, order processing, payments, and communication. We do not share your business data with unauthorized third parties.'
        },
        {
            title: '3. Security Measures',
            icon: Shield,
            content: 'We implement industry-standard security protocols to protect your business and financial information from unauthorized access or disclosure.'
        }
    ]

    const renderContent = () => {
        if (content) {
            return content.split('\n').map((paragraph, idx) => (
                <p key={idx} className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">
                    {paragraph}
                </p>
            ))
        }
        return defaultSections.map((section, idx) => (
            <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-6 md:p-8 space-y-4"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center">
                        <section.icon size={16} />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{section.title}</h3>
                </div>
                <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">
                    {section.content}
                </p>
            </motion.div>
        ))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shadow-slate-200/40">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all rounded-full border border-slate-100">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Vendor Privacy Policy</h1>
                </div>
            </header>

            <div className="max-w-2xl mx-auto p-6 py-12 space-y-12">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                >
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Data Protection <br/> Protocol</h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm">
                        This document outlines how KisaanKart handles and protects vendor business and personal information.
                    </p>
                </motion.div>

                <div className="space-y-0.5 bg-slate-200 p-px rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
                    {renderContent()}
                </div>

                {(email || phone) && (
                    <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Privacy contact</p>
                        {email && (
                            <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <Mail size={16} className="text-orange-500" />
                                {email}
                            </a>
                        )}
                        {phone && (
                            <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                <Phone size={16} className="text-orange-500" />
                                {phone}
                            </a>
                        )}
                    </div>
                )}

                <div className="p-8 bg-slate-900 rounded-3xl text-white flex items-start gap-4 shadow-xl">
                    <Info size={24} className="text-orange-500 shrink-0" />
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Legal Notice</p>
                        <p className="text-xs font-bold leading-relaxed text-slate-300 uppercase tracking-wider">
                            By registering as a vendor, you agree to the data handling practices outlined in this Privacy Policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
