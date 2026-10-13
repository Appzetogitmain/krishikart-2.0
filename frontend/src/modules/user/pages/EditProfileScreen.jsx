import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft, Phone, Mail, Loader2
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import api from '../../../lib/axios'

export default function EditProfileScreen() {
    const navigate = useNavigate()
    const [isPasswordDrawerOpen, setIsPasswordDrawerOpen] = useState(false)
    const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // User State
    const [user, setUser] = useState({
        fullName: '',
        mobile: '',
        email: '',
    })

    const [editData, setEditData] = useState({
        fullName: '',
        email: '',
    })



    const [preferences, setPreferences] = useState({
        whatsapp: false,
        tax: false,
        paper: false
    })

    const [passwordData, setPasswordData] = useState({
        old: '',
        new: '',
        confirm: ''
    })

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        setIsLoading(true)
        try {
            const response = await api.get('/user/me')
            const userData = response.data.result
            setUser({
                fullName: userData.fullName || '',
                mobile: userData.mobile || '',
                email: userData.email || '',
            })
            localStorage.setItem('userData', JSON.stringify(userData))
            setEditData({
                fullName: userData.fullName || '',
                email: userData.email || '',
            })
            setPreferences({
                whatsapp: userData.preferences?.whatsappUpdates || false,
                tax: userData.preferences?.showTaxInclusive || false,
                paper: userData.preferences?.paperInvoice || false
            })

        } catch (error) {
            console.error('Failed to fetch profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveProfile = async () => {
        // Email Validation (Strict)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        if (editData.email && !emailRegex.test(editData.email)) {
            alert('Please enter a valid email address (e.g., user@example.com)');
            return;
        }
        setIsSaving(true)
        try {
            const response = await api.put('/user/update-profile', {
                fullName: editData.fullName,
                email: editData.email,
            })
            const updatedUser = response.data.result
            setUser(updatedUser)
            localStorage.setItem('userData', JSON.stringify(updatedUser))
            window.dispatchEvent(new Event('userDataUpdated'));
            setIsEditDrawerOpen(false)
            alert('Profile updated successfully')
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update profile')
        } finally {
            setIsSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwordData.new !== passwordData.confirm) {
            alert('Passwords do not match')
            return
        }
        setIsSaving(true)
        try {
            await api.post('/user/change-password', {
                oldPassword: passwordData.old,
                newPassword: passwordData.new
            })
            setIsPasswordDrawerOpen(false)
            setPasswordData({ old: '', new: '', confirm: '' })
            alert('Password changed successfully')
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to change password')
        } finally {
            setIsSaving(false)
        }
    }

    const togglePreference = async (key) => {
        const newPreferences = { ...preferences, [key]: !preferences[key] }
        setPreferences(newPreferences)

        try {
            await api.put('/user/update-profile', {
                preferences: {
                    whatsappUpdates: newPreferences.whatsapp,
                    showTaxInclusive: newPreferences.tax,
                    paperInvoice: newPreferences.paper
                }
            })
        } catch (error) {
            console.error('Failed to update preferences:', error)
            setPreferences(preferences) // revert on error
        }
    }



    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    return (
        <PageTransition>
            <div className="bg-[#fcfdff] min-h-screen pb-20 font-sans relative overflow-x-hidden">
                {/* Mobile Header (Hidden on Desktop) */}
                <div className="md:hidden bg-white px-4 py-3 flex items-center gap-3 shadow-sm border-b border-slate-100 sticky top-0 z-40">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-90 transition-transform"
                    >
                        <ArrowLeft size={18} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-[16px] font-black text-slate-900 tracking-tight">Profile settings</h1>
                </div>

                <div className="max-w-6xl mx-auto px-4 py-5 md:px-6 md:py-8">
                    {/* Desktop Page Title */}
                    <h1 className="hidden md:block text-3xl font-bold text-slate-900 mb-10">Profile settings</h1>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Form Card */}
                        <div className="lg:col-span-7 bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm space-y-8">
                            <div className="space-y-6">
                                {/* Personal Info Section */}
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 mb-4">Personal Information</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                                                <Input
                                                    value={editData.fullName}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                                        setEditData({ ...editData, fullName: val });
                                                        setUser(prev => ({ ...prev, fullName: val }));
                                                    }}
                                                    placeholder="Enter your name"
                                                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 text-base font-bold focus:bg-white focus:ring-[#10b981]/20 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone number (Read-only)</label>
                                                <Input
                                                    value={user.mobile}
                                                    disabled
                                                    className="h-12 bg-slate-100 border-slate-200 rounded-xl px-4 text-base font-bold text-slate-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email address</label>
                                            <Input
                                                value={editData.email}
                                                onChange={(e) => {
                                                    setEditData({ ...editData, email: e.target.value });
                                                    setUser(prev => ({ ...prev, email: e.target.value }));
                                                }}
                                                placeholder="e.g. user@example.com"
                                                className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 text-base font-bold focus:bg-white focus:ring-[#10b981]/20 transition-all"
                                            />
                                        </div>


                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100">
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-lg shadow-lg shadow-emerald-100 active:scale-[0.98] transition-all"
                                    >
                                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Save Profile Changes'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Preview & Summary Card */}
                        <div className="lg:col-span-5 space-y-6">
                            {/* Profile Preview Card */}
                            <div className="bg-white rounded-2xl md:rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm relative group hover:border-emerald-600/20 transition-all duration-300">
                                <div className="absolute top-6 right-6 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                    Preview
                                </div>
                                <div className="space-y-1 mb-8 mt-2">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight break-words">{user.fullName || 'Guest User'}</h2>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-50">
                                    <div className="flex items-center gap-4 text-slate-600">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                            <Phone size={18} />
                                        </div>
                                        <span className="text-base font-bold text-slate-800">{user.mobile}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-600">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                            <Mail size={18} />
                                        </div>
                                        <span className="text-base font-bold text-slate-800 break-all">{user.email || 'Email not set'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    )
}
