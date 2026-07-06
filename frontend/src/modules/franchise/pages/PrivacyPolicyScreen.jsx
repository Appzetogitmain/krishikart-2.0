import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Shield, FileText, ScrollText, Info, Mail, Phone } from 'lucide-react'
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
            id: 'data-collection',
            title: 'Data Collection & Usage',
            icon: Shield,
            content: 'We collect franchise business details, owner information, KYC documents, and operational data for node verification, order management, and settlement purposes.'
        },
        {
            id: 'customer-data',
            title: 'Customer Data Handling',
            icon: FileText,
            content: 'Franchise nodes have access to customer order and delivery information solely for order fulfillment. Unauthorized use or sharing of customer data is strictly prohibited.'
        },
        {
            id: 'security',
            title: 'Security Protocols',
            icon: ScrollText,
            content: 'All franchise data is encrypted and stored securely. Access to the franchise terminal is protected with authentication and session management.'
        }
    ]

    const renderContent = () => {
        if (content) {
            return content.split('\n').map((paragraph, idx) => (
                <p key={idx} className="text-[12px] md:text-sm text-slate-500 font-medium leading-relaxed">
                    {paragraph}
                </p>
            ))
        }
        return defaultSections.map((section, idx) => (
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
                            <h1 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Privacy Policy</h1>
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
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Data Protection</h2>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            This policy governs how KisaanKart Network handles franchise node information and customer data access.
                        </p>
                    </div>

                    <div className="space-y-0.5 bg-slate-200 p-px rounded-sm overflow-hidden border border-slate-200">
                        {renderContent()}
                    </div>

                    {(email || phone) && (
                        <div className="p-6 bg-white border border-slate-200 rounded-sm space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Privacy contact</h4>
                            {email && (
                                <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <Mail size={16} className="text-emerald-600" />
                                    {email}
                                </a>
                            )}
                            {phone && (
                                <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <Phone size={16} className="text-emerald-600" />
                                    {phone}
                                </a>
                            )}
                        </div>
                    )}

                    <div className="p-8 bg-slate-900 rounded-sm text-white space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Acknowledgment</h4>
                        <p className="text-xs font-bold leading-relaxed text-slate-400 uppercase tracking-wider">
                            By using the franchise terminal, you agree to handle all customer and platform data in accordance with this Privacy Policy.
                        </p>
                    </div>

                    <div className="flex justify-center pt-8">
                        <button 
                            onClick={() => navigate(-1)}
                            className="text-[11px] font-black uppercase text-slate-900 border-b-2 border-slate-900 pb-1"
                        >
                            Back to Franchise Portal
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
