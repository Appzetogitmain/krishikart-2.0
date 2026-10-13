import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Plus, Trash2, Home, Briefcase, MapPinned, X, Loader2 } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import api from '@/lib/axios'
import { toast } from 'sonner'
import {
    ADDRESS_TAGS,
    EMPTY_ADDRESS_DETAILS,
    buildFullAddress,
    deleteSavedAddress,
    loadSavedAddresses,
    saveSavedAddresses,
    upsertAddressByTag,
} from '../utils/savedAddresses'

const TAG_ICONS = {
    home: Home,
    work: Briefcase,
    other: MapPinned,
}

export default function AddressBookScreen() {
    const navigate = useNavigate()
    const [userId, setUserId] = useState(null)
    const [savedAddresses, setSavedAddresses] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [addressTag, setAddressTag] = useState('home')
    const [addressDetails, setAddressDetails] = useState({ ...EMPTY_ADDRESS_DETAILS })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const init = async () => {
            setIsLoading(true)
            try {
                const cached = JSON.parse(localStorage.getItem('userData') || '{}')
                if (cached?._id) {
                    setUserId(cached._id)
                    setSavedAddresses(loadSavedAddresses(cached._id))
                } else {
                    const response = await api.get('/user/me')
                    const userData = response.data.result
                    setUserId(userData._id)
                    setSavedAddresses(loadSavedAddresses(userData._id))
                }
            } catch (error) {
                console.error('Failed to load address book:', error)
                toast.error('Could not load your saved addresses')
            } finally {
                setIsLoading(false)
            }
        }
        init()
    }, [])

    const persistAddresses = (addresses) => {
        setSavedAddresses(addresses)
        if (userId) saveSavedAddresses(userId, addresses)
    }

    const openAddDrawer = () => {
        setEditingId(null)
        setAddressTag('home')
        setAddressDetails({ ...EMPTY_ADDRESS_DETAILS })
        setIsDrawerOpen(true)
    }

    const openEditDrawer = (saved) => {
        setEditingId(saved.id || saved.tag)
        setAddressTag(saved.tag || 'other')
        setAddressDetails({ ...EMPTY_ADDRESS_DETAILS, ...(saved.details || {}) })
        setIsDrawerOpen(true)
    }

    const handleDelete = (saved) => {
        const label = saved.label || 'this address'
        if (!window.confirm(`Delete ${label}?`)) return
        const next = deleteSavedAddress(savedAddresses, saved.id || saved.tag)
        persistAddresses(next)
        toast.success('Address removed')
    }

    const handleSave = async () => {
        if (!addressDetails.flat?.trim() || !addressDetails.colony?.trim() || !addressDetails.city?.trim() || !addressDetails.state?.trim()) {
            toast.error('Please fill Flat, Colony, City, and State')
            return
        }

        setIsSaving(true)
        try {
            const fullAddress = buildFullAddress(addressDetails)
            let next = upsertAddressByTag(savedAddresses, addressTag, addressDetails)

            if (editingId && addressTag === 'other') {
                next = deleteSavedAddress(next, editingId)
                next = upsertAddressByTag(next, 'other', addressDetails)
            }

            persistAddresses(next)

            if (addressTag === 'home') {
                await api.put('/user/update-profile', { address: fullAddress })
                const cached = JSON.parse(localStorage.getItem('userData') || '{}')
                localStorage.setItem('userData', JSON.stringify({ ...cached, address: fullAddress }))
            }

            toast.success(editingId ? 'Address updated' : 'Address saved')
            setIsDrawerOpen(false)
        } catch (error) {
            console.error('Save address error:', error)
            toast.error('Failed to save address')
        } finally {
            setIsSaving(false)
        }
    }

    const sortedAddresses = [...savedAddresses].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    )

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#f8fafd]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    return (
        <PageTransition>
            <div className="bg-[#f8fafd] min-h-screen pb-10">
                <div className="bg-white px-4 md:px-6 py-4 md:py-6 border-b border-slate-50 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Address book</h1>
                            <p className="text-[11px] text-slate-400 font-bold">Your saved delivery addresses</p>
                        </div>
                    </div>
                    <button
                        onClick={openAddDrawer}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-green-100"
                        aria-label="Add address"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
                    {sortedAddresses.length === 0 ? (
                        <div className="bg-white rounded-[28px] p-10 border border-slate-100 shadow-sm text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-4">
                                <MapPin size={28} />
                            </div>
                            <h2 className="text-lg font-black text-slate-900 mb-2">No saved addresses</h2>
                            <p className="text-sm text-slate-400 font-medium mb-6">
                                Add your home, work, or other delivery addresses for faster checkout.
                            </p>
                            <Button onClick={openAddDrawer} className="rounded-xl h-12 px-6 font-bold">
                                Add your first address
                            </Button>
                        </div>
                    ) : (
                        sortedAddresses.map((addr) => {
                            const Icon = TAG_ICONS[addr.tag] || MapPinned
                            return (
                                <div
                                    key={addr.id || addr.tag}
                                    className="bg-white rounded-[28px] p-5 md:p-6 border border-slate-100 shadow-sm"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                            <Icon size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-black text-slate-900">{addr.label || 'Address'}</h3>
                                            <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">
                                                {addr.fullAddress || buildFullAddress(addr.details)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-5 flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => openEditDrawer(addr)}
                                            className="flex-1 h-11 rounded-2xl border-slate-100 font-bold text-xs uppercase tracking-widest text-slate-500"
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => handleDelete(addr)}
                                            className="w-11 h-11 p-0 rounded-2xl border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-100"
                                        >
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                <AnimatePresence>
                    {isDrawerOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsDrawerOpen(false)}
                                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100]"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[101] shadow-2xl md:max-w-xl md:mx-auto md:bottom-10 md:rounded-[32px] flex flex-col max-h-[90vh]"
                            >
                                <div className="flex justify-between items-center px-6 pt-6 pb-4 shrink-0">
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {editingId ? 'Edit address' : 'Add address'}
                                    </h2>
                                    <button
                                        onClick={() => setIsDrawerOpen(false)}
                                        className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4 pb-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Save as</label>
                                        <div className="flex gap-2">
                                            {ADDRESS_TAGS.map((tag) => (
                                                <button
                                                    key={tag.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setAddressTag(tag.value)
                                                        if (!editingId) {
                                                            const existing = savedAddresses.find((a) => a.tag === tag.value)
                                                            if (existing?.details) {
                                                                setAddressDetails({ ...EMPTY_ADDRESS_DETAILS, ...existing.details })
                                                            }
                                                        }
                                                    }}
                                                    className={cn(
                                                        'px-3 py-2 rounded-xl border text-xs font-bold transition-all',
                                                        addressTag === tag.value
                                                            ? 'border-primary bg-primary/5 text-primary'
                                                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                    )}
                                                >
                                                    {tag.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        value={addressDetails.flat}
                                        onChange={(e) => setAddressDetails((prev) => ({ ...prev, flat: e.target.value }))}
                                        placeholder="Flat / House No. *"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                    />
                                    <input
                                        type="text"
                                        value={addressDetails.floor}
                                        onChange={(e) => setAddressDetails((prev) => ({ ...prev, floor: e.target.value }))}
                                        placeholder="Floor (Optional)"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                    />
                                    <input
                                        type="text"
                                        value={addressDetails.colony}
                                        onChange={(e) => setAddressDetails((prev) => ({ ...prev, colony: e.target.value }))}
                                        placeholder="Colony / Street / Area *"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                    />
                                    <input
                                        type="text"
                                        value={addressDetails.landmark}
                                        onChange={(e) => setAddressDetails((prev) => ({ ...prev, landmark: e.target.value }))}
                                        placeholder="Landmark (Optional)"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                    />
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={addressDetails.city}
                                            onChange={(e) => setAddressDetails((prev) => ({ ...prev, city: e.target.value }))}
                                            placeholder="City *"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="text"
                                            value={addressDetails.state}
                                            onChange={(e) => setAddressDetails((prev) => ({ ...prev, state: e.target.value }))}
                                            placeholder="State *"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={addressDetails.pincode}
                                        onChange={(e) => setAddressDetails((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                        placeholder="Pincode (Optional)"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="shrink-0 px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="w-full h-12 rounded-xl bg-primary font-bold text-white"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save address'}
                                    </Button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </PageTransition>
    )
}
