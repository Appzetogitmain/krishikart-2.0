import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import { Loader2, Save, Upload, X } from 'lucide-react';

const initialState = {
    fullName: '',
    email: '',
    mobile: '',
    farmLocation: '',
    fssaiLicense: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    password: '',
    servedCategories: [],
    aadharFile: null,
    panFile: null,
    shopProofFile: null,
    fssaiFile: null,
};

import api from '@/lib/axios';

export default function VendorOnboardingDrawer({ isOpen, onClose, onSave }) {
    const [form, setForm] = useState(initialState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        if (isOpen) {
            api.get('/catalog/categories').then(res => {
                if (res.data.success) {
                    setCategories(res.data.result || res.data.results || []);
                }
            }).catch(err => console.error(err));
        }
    }, [isOpen]);

    const canSubmit = useMemo(() => {
        return Boolean(
            form.fullName &&
            form.email &&
            form.mobile &&
            form.farmLocation &&
            // fssaiLicense is now optional
            form.bankName &&
            form.accountHolderName &&
            form.accountNumber &&
            form.ifscCode &&
            form.aadharFile &&
            form.panFile &&
            form.shopProofFile
        );
    }, [form]);

    const handleChange = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit || isSubmitting) return;

        const payload = new FormData();
        payload.append('fullName', form.fullName);
        payload.append('email', form.email);
        payload.append('mobile', form.mobile);
        payload.append('farmLocation', form.farmLocation);
        payload.append('fssaiLicense', form.fssaiLicense);
        if (form.password) payload.append('password', form.password);

        payload.append('bankDetails', JSON.stringify({
            accountHolderName: form.accountHolderName,
            accountNumber: form.accountNumber,
            ifscCode: form.ifscCode,
            bankName: form.bankName,
        }));

        payload.append('aadharFile', form.aadharFile);
        payload.append('panFile', form.panFile);
        payload.append('shopProofFile', form.shopProofFile);
        if (form.fssaiFile) payload.append('fssaiFile', form.fssaiFile);
        
        if (form.servedCategories.length > 0) {
            payload.append('servedCategories', JSON.stringify(form.servedCategories));
        }

        setIsSubmitting(true);
        const created = await onSave(payload);
        setIsSubmitting(false);

        if (created) {
            setForm(initialState);
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
                    className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col"
                >
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Onboard Vendor</h3>
                            <p className="text-xs text-slate-500">Create vendor account directly from admin panel.</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded hover:bg-slate-100 text-slate-500">
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Owner Name" required value={form.fullName} onChange={(v) => handleChange('fullName', v.replace(/[^A-Za-z\s]/g, ""))} />
                            <Input label="Email" required type="email" value={form.email} onChange={(v) => handleChange('email', v)} />
                            <Input label="Mobile" required value={form.mobile} onChange={(v) => handleChange('mobile', v.replace(/\D/g, '').slice(0, 10))} />
                            <Input label="Farm / Shop Location" required value={form.farmLocation} onChange={(v) => handleChange('farmLocation', v.replace(/[^A-Za-z\s,]/g, ""))} />
                            <Input label="FSSAI License" value={form.fssaiLicense} onChange={(v) => handleChange('fssaiLicense', v)} />
                            <Input label="Login Password (optional)" type="text" value={form.password} onChange={(v) => handleChange('password', v)} />
                        </div>

                        <div className="border border-slate-200 rounded p-4">
                            <p className="text-xs font-bold text-slate-800 mb-3">Bank Details</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Bank Name" required value={form.bankName} onChange={(v) => handleChange('bankName', v)} />
                                <Input label="Account Holder" required value={form.accountHolderName} onChange={(v) => handleChange('accountHolderName', v)} />
                                <Input label="Account Number" required value={form.accountNumber} onChange={(v) => handleChange('accountNumber', v)} />
                                <Input label="IFSC Code" required value={form.ifscCode} onChange={(v) => handleChange('ifscCode', v.toUpperCase())} />
                            </div>
                        </div>

                        {categories.length > 0 && (
                            <div className="border border-slate-200 rounded-[20px] p-5 bg-slate-50/30">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Served Categories</label>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map(cat => {
                                        const isSelected = form.servedCategories.includes(cat._id);
                                        return (
                                            <button
                                                key={cat._id}
                                                type="button"
                                                onClick={() => {
                                                    handleChange(
                                                        'servedCategories',
                                                        isSelected
                                                            ? form.servedCategories.filter(id => id !== cat._id)
                                                            : [...form.servedCategories, cat._id]
                                                    );
                                                }}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border-2 active:scale-95 flex items-center gap-1.5 ${
                                                    isSelected 
                                                    ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10' 
                                                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600'
                                                }`}
                                            >
                                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                                {cat.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="border border-slate-200 rounded p-4">
                            <p className="text-xs font-bold text-slate-800 mb-3">Required Documents</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <FileField label="Aadhaar" required onChange={(f) => handleChange('aadharFile', f)} file={form.aadharFile} />
                                <FileField label="PAN" required onChange={(f) => handleChange('panFile', f)} file={form.panFile} />
                                <FileField label="Shop Proof" required onChange={(f) => handleChange('shopProofFile', f)} file={form.shopProofFile} />
                                <FileField label="FSSAI File" onChange={(f) => handleChange('fssaiFile', f)} file={form.fssaiFile} />
                            </div>
                        </div>
                    </form>

                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                        <button onClick={onClose} type="button" className="px-4 py-2 text-xs font-bold border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={!canSubmit || isSubmitting}
                            className="px-4 py-2 text-xs font-bold rounded bg-slate-900 text-white disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Create Vendor
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function Input({ label, value, onChange, type = 'text', required }) {
    return (
        <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
        </div>
    );
}

function FileField({ label, file, onChange, required }) {
    return (
        <label className="border border-dashed border-slate-300 rounded p-3 cursor-pointer hover:bg-slate-50">
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
