import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { getGstParts, isValidGst, normalizeGstInput } from '@/modules/franchise/utils/gstin';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

const initialForm = {
    franchiseName: '',
    ownerName: '',
    mobile: '',
    email: '',
    area: '',
    city: '',
    state: '',
    aadhaarNumber: '',
    panNumber: '',
    fssaiNumber: '',
    gstNumber: '',
    servedCategories: [],
    aadhaarImage: null,
    panImage: null,
    fssaiCertificate: null,
    shopEstablishmentCertificate: null,
    gstCertificate: null,
};

export default function FranchiseOnboardingDrawer({ isOpen, onClose, onSave, initialData }) {
    const isEdit = !!initialData;
    const [form, setForm] = useState(initialForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setIsLoadingCategories(true);
                const response = await api.get('/catalog/categories');
                if (response.data.success) {
                    setCategories(response.data.results || []);
                }
            } catch (err) {
                console.error("Error fetching categories:", err);
            } finally {
                setIsLoadingCategories(false);
            }
        };
        if (isOpen) fetchCategories();
    }, [isOpen]);

    // Populate form on edit
    useEffect(() => {
        if (initialData) {
            setForm({
                franchiseName: initialData.franchiseName || '',
                ownerName: initialData.ownerName || '',
                mobile: initialData.mobile || '',
                email: initialData.email || '',
                area: initialData.area || '',
                city: initialData.city || '',
                state: initialData.state || '',
                aadhaarNumber: initialData.kyc?.aadhaarNumber || '',
                panNumber: initialData.kyc?.panNumber || '',
                fssaiNumber: initialData.kyc?.fssaiNumber || '',
                gstNumber: initialData.kyc?.gstNumber || '',
                servedCategories: (initialData.servedCategories || []).map(c => c._id || c),
                aadhaarImage: null,
                panImage: null,
                fssaiCertificate: null,
                shopEstablishmentCertificate: null,
                gstCertificate: null,
            });
        }
    }, [initialData]);

    // Reset form when drawer closes
    useEffect(() => {
        if (!isOpen && !initialData) {
            setForm(initialForm);
        }
    }, [isOpen, initialData]);

    const canSubmit = useMemo(() => {
        return Boolean(form.franchiseName && form.ownerName && form.mobile && form.city && form.state);
    }, [form]);

    const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleToggleCategory = (catId) => {
        setForm(prev => {
            const current = prev.servedCategories || [];
            if (current.includes(catId)) {
                return { ...prev, servedCategories: current.filter(id => id !== catId) };
            }
            return { ...prev, servedCategories: [...current, catId] };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit || isSubmitting) return;

        const payload = isEdit ? {} : new FormData();

        const append = (key, val) => {
            if (isEdit) payload[key] = val;
            else payload.append(key, val);
        };

        append('franchiseName', form.franchiseName);
        append('ownerName', form.ownerName);
        append('mobile', form.mobile);
        append('city', form.city);
        append('state', form.state);
        if (form.email) append('email', form.email);
        if (form.area) append('area', form.area);

        const aadhaarDigits = String(form.aadhaarNumber || '').replace(/\D/g, '');
        if (aadhaarDigits) append('aadhaarNumber', aadhaarDigits);
        if (form.panNumber) append('panNumber', form.panNumber);
        
        const fssaiDigits = String(form.fssaiNumber || '').replace(/\D/g, '');
        if (fssaiDigits) append('fssaiNumber', fssaiDigits);
        
        if (form.gstNumber) append('gstNumber', form.gstNumber);

        // Include categories
        if (isEdit) {
            payload.servedCategories = form.servedCategories;
        } else {
            payload.append('servedCategories', JSON.stringify(form.servedCategories));
        }
        
        let finalPayload = payload;
        if (!isEdit) {
            if (form.aadhaarImage) payload.append('aadhaarImage', form.aadhaarImage);
            if (form.panImage) payload.append('panImage', form.panImage);
            if (form.fssaiCertificate) payload.append('fssaiCertificate', form.fssaiCertificate);
            if (form.shopEstablishmentCertificate) payload.append('shopEstablishmentCertificate', form.shopEstablishmentCertificate);
            if (form.gstCertificate) payload.append('gstCertificate', form.gstCertificate);
            finalPayload = payload;
        }

        setIsSubmitting(true);
        const success = await onSave(finalPayload, initialData?._id);
        setIsSubmitting(false);

        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex justify-end">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40"
                />

                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 24, stiffness: 190 }}
                    className="relative w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col min-h-0"
                >
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                        <div>
                            <h3 className="text-lg font-black text-slate-900">{isEdit ? 'Edit Franchise' : 'Onboard Franchise'}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {isEdit ? `Modifying technical parameters for ${initialData.franchiseName}` : 'Franchise details and KYC documents.'}
                            </p>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 rounded hover:bg-slate-100 text-slate-500">
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                    Franchise details
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input label="Franchise Name" required value={form.franchiseName} onChange={(v) => setValue('franchiseName', v)} />
                                    <Input label="Owner Name" required value={form.ownerName} onChange={(v) => setValue('ownerName', v.replace(/[^a-zA-Z\s]/g, ''))} />
                                    <Input label="Mobile" required value={form.mobile} onChange={(v) => setValue('mobile', v.replace(/\D/g, '').slice(0, 10))} />
                                    <Input label="Email" value={form.email} onChange={(v) => setValue('email', v)} />
                                    <Input label="Area" value={form.area} onChange={(v) => setValue('area', v)} />
                                    <Input label="City" required value={form.city} onChange={(v) => setValue('city', v.replace(/[^a-zA-Z\s]/g, ''))} />
                                    <Input label="State" required value={form.state} onChange={(v) => setValue('state', v.replace(/[^a-zA-Z\s]/g, ''))} />
                                </div>
                            </div>

                            {/* Category Selection Section */}
                            <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50/40">
                                <div>
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Categories Served</p>
                                    <p className="text-[10px] text-slate-500 mt-1 font-bold">Select the product categories this franchise will sell.</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {categories.map(cat => (
                                        <button
                                            key={cat._id}
                                            type="button"
                                            onClick={() => handleToggleCategory(cat._id)}
                                            className={cn(
                                                "px-3 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition-all text-left flex items-center justify-between",
                                                form.servedCategories.includes(cat._id)
                                                    ? "bg-slate-900 border-slate-900 text-white"
                                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                            )}
                                        >
                                            <span className="truncate mr-2">{cat.name}</span>
                                            {form.servedCategories.includes(cat._id) && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                {isLoadingCategories && (
                                    <div className="py-4 text-center border border-dashed border-slate-200 rounded flex items-center justify-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Loading categories...</span>
                                    </div>
                                )}
                                {!isLoadingCategories && categories.length === 0 && (
                                    <div className="py-4 text-center border border-dashed border-slate-200 rounded text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        No categories found in system
                                    </div>
                                )}
                            </div>

                            <div className="border border-slate-200 rounded-lg p-4 space-y-5 bg-slate-50/40">
                                <div>
                                    <p className="text-xs font-black text-slate-900">Aadhaar &amp; PAN</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Numbers and document uploads.</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Input
                                            label="Aadhaar Number"
                                            type="tel"
                                            inputMode="numeric"
                                            maxLength={12}
                                            value={form.aadhaarNumber}
                                            onChange={(v) => setValue('aadhaarNumber', v.replace(/\D/g, '').slice(0, 12))}
                                        />
                                    </div>
                                    <Input label="PAN Number" value={form.panNumber} onChange={(v) => setValue('panNumber', v.toUpperCase())} />
                                    {!isEdit && (
                                        <>
                                            <FileField label="Aadhaar image / PDF" required onChange={(f) => setValue('aadhaarImage', f)} file={form.aadhaarImage} />
                                            <FileField label="PAN image / PDF" required onChange={(f) => setValue('panImage', f)} file={form.panImage} />
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-lg p-4 space-y-5 bg-slate-50/40">
                                <div>
                                    <p className="text-xs font-black text-slate-900">Business Documents</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label="FSSAI number"
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={14}
                                        value={form.fssaiNumber}
                                        onChange={(v) => setValue('fssaiNumber', v.replace(/\D/g, '').slice(0, 14))}
                                    />
                                    <Input
                                        label="GSTIN"
                                        maxLength={15}
                                        value={form.gstNumber}
                                        onChange={(v) => setValue('gstNumber', normalizeGstInput(v))}
                                    />
                                    {!isEdit && (
                                        <>
                                            <FileField label="FSSAI certificate" onChange={(f) => setValue('fssaiCertificate', f)} file={form.fssaiCertificate} />
                                            <FileField label="Shop establishment" required onChange={(f) => setValue('shopEstablishmentCertificate', f)} file={form.shopEstablishmentCertificate} />
                                            <FileField label="GST certificate" onChange={(f) => setValue('gstCertificate', f)} file={form.gstCertificate} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0 bg-white">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold border border-slate-300 rounded hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit || isSubmitting}
                                className="px-4 py-2 text-xs font-bold rounded bg-slate-900 text-white disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {isEdit ? 'Update Franchise' : 'Create Franchise'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function Input({ label, value, onChange, type = 'text', inputMode, maxLength, placeholder, required }) {
    return (
        <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                inputMode={inputMode}
                maxLength={maxLength}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
        </div>
    );
}

function FileField({ label, file, onChange, required }) {
    return (
        <label className="border border-dashed border-slate-300 rounded p-3 cursor-pointer hover:bg-white bg-white block min-h-[88px]">
            <div className="flex items-center gap-2 text-slate-700">
                <Upload size={14} />
                <span className="text-xs font-bold">{label} {required && <span className="text-red-500">*</span>}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 truncate">{file?.name || 'Upload file'}</p>
            <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => onChange(e.target.files?.[0] || null)}
            />
        </label>
    );
}
