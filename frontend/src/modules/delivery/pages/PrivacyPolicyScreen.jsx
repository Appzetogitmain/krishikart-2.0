import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, ChevronLeft, Lock, User, Info, Mail, Phone } from 'lucide-react'
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
            title: '1. Information Collection',
            icon: User,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            content: 'We collect personal details, vehicle information, and location data for delivery partner onboarding, task assignment, and payments.'
        },
        {
            title: '2. Data Usage',
            icon: Lock,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            content: 'Your information is used to manage deliveries, process payments, and ensure safety. Location data is used solely for delivery routing and tracking.'
        },
        {
            title: '3. Security',
            icon: Shield,
            color: 'text-purple-500',
            bg: 'bg-purple-50',
            content: 'All personal and payment information is encrypted and secured. We do not share your data with third parties without consent.'
        }
    ]

    const renderContent = () => {
        if (content) {
            return (
                <div className="space-y-6">
                    {content.split('\n').map((paragraph, idx) => (
                        <p key={idx} className="text-sm text-slate-500 font-medium leading-relaxed">
                            {paragraph}
                        </p>
                    ))}
                </div>
            )
        }
        return (
            <div className="space-y-4">
                {defaultSections.map((section, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 ${section.bg} rounded-xl flex items-center justify-center`}>
                                <section.icon className={`w-5 h-5 ${section.color}`} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                            {section.content}
                        </p>
                    </motion.div>
                ))}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-20">
            <div className="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-border/50 shadow-sm">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-foreground">Privacy Policy</h1>
            </div>

            <div className="p-6 space-y-8">
                <div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-emerald-900">Your Data is Protected</h2>
                            <p className="text-xs text-emerald-700">We take your privacy seriously.</p>
                        </div>
                    </div>
                </div>

                {renderContent()}

                {(email || phone) && (
                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                        <h3 className="text-sm font-bold text-slate-900">Privacy contact</h3>
                        {email && (
                            <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                                <Mail size={16} />
                                {email}
                            </a>
                        )}
                        {phone && (
                            <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                                <Phone size={16} />
                                {phone}
                            </a>
                        )}
                    </div>
                )}

                <div className="p-6 bg-slate-100 rounded-3xl flex items-start gap-4">
                    <Info className="text-slate-400 shrink-0" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                        Last Modified: April 2026. Kisaankart reserves the right to update this policy at any time.
                    </p>
                </div>
            </div>
        </div>
    )
}
