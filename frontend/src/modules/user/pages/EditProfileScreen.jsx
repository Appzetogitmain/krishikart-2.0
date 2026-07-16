import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft, AlertCircle,
    CircleDollarSign, FileText, Phone, Mail, Edit3,
    Smartphone, Receipt, X, CheckCircle2,
    Plus, Briefcase, Trash2, Loader2
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
        panNumber: '',
        legalEntityName: '',
        address: ''
    })

    const [editData, setEditData] = useState({
        fullName: '',
        email: '',
        panNumber: '',
        legalEntityName: '',
        address: ''
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
                panNumber: userData.panNumber || '',
                legalEntityName: userData.legalEntityName || '',
                address: userData.address || ''
            })
            localStorage.setItem('userData', JSON.stringify(userData))
            setEditData({
                fullName: userData.fullName || '',
                email: userData.email || '',
                panNumber: userData.panNumber || '',
                legalEntityName: userData.legalEntityName || '',
                address: userData.address || ''
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

    // PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
    const formatPanInput = (raw) => {
        const s = raw.toUpperCase().replace(/\s/g, '')
        let out = ''
        for (let i = 0; i < s.length && out.length < 10; i++) {
            const pos = out.length
            const ch = s[i]
            if (pos < 5 && /[A-Z]/.test(ch)) out += ch
            else if (pos >= 5 && pos < 9 && /\d/.test(ch)) out += ch
            else if (pos === 9 && /[A-Z]/.test(ch)) out += ch
        }
        return out
    }

    const isValidPan = (pan) => !pan || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)

    const handleSaveProfile = async () => {
        // Email Validation (Strict)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
        if (editData.email && !emailRegex.test(editData.email)) {
            alert('Please enter a valid email address (e.g., user@example.com)');
            return;
        }
        // PAN Validation (format: 5 letters + 4 digits + 1 letter, e.g. ABCDE1234F)
        if (editData.panNumber && !isValidPan(editData.panNumber)) {
            alert('Please enter a valid PAN (e.g. ABCDE1234F – 5 letters, 4 digits, 1 letter)');
            return;
        }

        setIsSaving(true)
        try {
            const response = await api.put('/user/update-profile', {
                fullName: editData.fullName,
                email: editData.email,
                panNumber: editData.panNumber,
                legalEntityName: editData.legalEntityName,
                address: editData.address
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

                                <hr className="border-slate-100" />

                                {/* Business Details Section */}
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                                            <Briefcase size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 leading-tight">Business Details</h3>
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Official details of your outlet</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Legal Entity Name</label>
                                                <Input
                                                    value={editData.legalEntityName}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                                        setEditData({ ...editData, legalEntityName: val });
                                                        setUser(prev => ({ ...prev, legalEntityName: val }));
                                                    }}
                                                    placeholder="Enter business name"
                                                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 text-base font-bold focus:bg-white focus:ring-[#10b981]/20 transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">PAN Number</label>
                                                <Input
                                                    value={editData.panNumber}
                                                    onChange={(e) => {
                                                        const val = formatPanInput(e.target.value);
                                                        setEditData({ ...editData, panNumber: val });
                                                        setUser(prev => ({ ...prev, panNumber: val }));
                                                    }}
                                                    placeholder="ABCDE1234F"
                                                    maxLength={10}
                                                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 text-base font-bold uppercase focus:bg-white focus:ring-[#10b981]/20 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Complete Address</label>
                                            <Input
                                                value={editData.address}
                                                onChange={(e) => {
                                                    setEditData({ ...editData, address: e.target.value });
                                                    setUser(prev => ({ ...prev, address: e.target.value }));
                                                }}
                                                placeholder="Enter full address"
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
                                    Live Preview
                                </div>
                                <div className="space-y-1 mb-8 mt-2">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight break-words">{user.fullName || 'Guest User'}</h2>
                                    <p className="text-[14px] font-medium text-slate-500 leading-relaxed break-words">{user.address || 'Address not set'}</p>
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
                                    <div className="flex items-center gap-4 text-slate-600">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                            <Briefcase size={18} />
                                        </div>
                                        <span className="text-base font-bold text-slate-800 break-all">{user.legalEntityName || 'Business not set'}</span>
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
