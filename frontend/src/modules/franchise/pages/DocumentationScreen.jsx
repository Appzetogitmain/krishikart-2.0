import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    Upload,
    CheckCircle2,
    CreditCard,
    User,
    X,
    Info,
    UtensilsCrossed,
    Store,
    Landmark,
    Download,
    Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import api from '@/lib/axios';
import {
    getGstParts,
    isValidFssai,
    isValidGst,
    isValidPan,
    normalizeFssaiInput,
    normalizeGstInput,
    normalizePanInput,
} from '../utils/gstin';

const FILE_FIELDS = {
    aadhaar: { formKey: 'aadhaarImage', previewKey: 'aadhaar' },
    pan: { formKey: 'panImage', previewKey: 'pan' },
    fssai: { formKey: 'fssaiCertificate', previewKey: 'fssai' },
    shopEstablishment: { formKey: 'shopEstablishmentCertificate', previewKey: 'shopEstablishment' },
    gst: { formKey: 'gstCertificate', previewKey: 'gst' },
};

function DocPreviewModal({ isOpen, onClose, url, title }) {
    if (!isOpen || !url) return null;
    const isPdf = url.toLowerCase().includes('pdf') || url.startsWith('data:application/pdf');

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
                >
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                                <FileText size={16} />
                            </div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{title || 'Document Preview'}</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 bg-slate-50 overflow-auto p-4 flex items-center justify-center">
                        {isPdf ? (
                            <iframe
                                src={url}
                                className="w-full h-full rounded-xl border border-slate-200"
                                title="PDF Preview"
                            />
                        ) : (
                            <img
                                src={url}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
                            />
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function DocUploadZone({
    preview,
    onPick,
    onRemove,
    disabled,
    title,
    subtitle,
    inputId,
    error,
    docName,
    onPreview,
}) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // A remote URL (already uploaded) vs a local blob/data URL
    const isRemoteUrl = preview && preview.startsWith('http');
    const isPdf = preview && (preview.toLowerCase().includes('pdf') || preview.startsWith('data:application/pdf'));

    const handleDownload = async () => {
        if (!preview) return;
        setIsDownloading(true);

        const baseName = (docName || title || 'document')
            .replace(/\s+/g, '_')
            .toLowerCase();

        const urlPath = preview.split('?')[0];
        const urlExt = urlPath.split('.').pop()?.toLowerCase();
        const knownExts = ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'gif'];
        const ext = knownExts.includes(urlExt) ? urlExt : 'jpg';
        const fileName = `${baseName}.${ext}`;

        try {
            // Inject Cloudinary fl_attachment transform to force download
            let downloadUrl = preview;
            if (preview.includes('cloudinary.com') && preview.includes('/upload/')) {
                downloadUrl = preview.replace('/upload/', `/upload/fl_attachment:${baseName}/`);
            }

            const res = await fetch(downloadUrl, { mode: 'cors', credentials: 'omit' });
            if (!res.ok) throw new Error('fetch failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            const fallback = preview.includes('cloudinary.com') && preview.includes('/upload/')
                ? preview.replace('/upload/', `/upload/fl_attachment:${baseName}/`)
                : preview;
            window.open(fallback, '_blank', 'noopener,noreferrer');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">
                {title}
            </label>
            <div
                className={cn(
                    'relative aspect-[1.6/1] border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden group/upload',
                    preview
                        ? 'border-slate-900'
                        : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-400',
                )}
            >
                {preview ? (
                    <>
                        {isPdf || hasError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
                                <FileText size={48} className={cn("mb-2", isPdf ? "text-rose-500" : "text-slate-300")} />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                    {isPdf ? "PDF Document" : "Document View"}
                                </span>
                            </div>
                        ) : (
                            <img
                                src={preview}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={() => setHasError(true)}
                            />
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            {/* Preview button */}
                            <button
                                type="button"
                                onClick={() => onPreview(preview, title)}
                                className="p-2 bg-white text-slate-900 rounded-full shadow-lg hover:scale-110 transition-transform"
                                title="Preview document"
                            >
                                <Eye size={18} />
                            </button>

                            {/* Download button — always shown for remote URLs */}
                            {isRemoteUrl && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="p-2 bg-white text-slate-900 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-70"
                                    title="Download document"
                                >
                                    {isDownloading ? (
                                        <div className="w-[18px] h-[18px] border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                                    ) : (
                                        <Download size={18} />
                                    )}
                                </button>
                            )}
                            {/* Remove button — only when not read-only */}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={onRemove}
                                    className="p-2 bg-white text-rose-600 rounded-full shadow-lg hover:scale-110 transition-transform"
                                    title="Remove document"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <label
                        htmlFor={inputId}
                        className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-6 text-center"
                    >
                        <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-slate-400 group-hover/upload:text-slate-900 transition-colors">
                            <Upload size={20} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 mb-1">{subtitle}</span>
                        <span className="text-[10px] text-slate-400 font-medium font-mono uppercase">
                            PDF, JPG or PNG (Max 20MB)
                        </span>
                        <input
                            id={inputId}
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            disabled={disabled}
                            onChange={onPick}
                        />
                    </label>
                )}
            </div>
            {error ? <p className="text-[11px] font-medium text-rose-600">{error}</p> : null}
        </div>
    );
}

export default function DocumentationScreen() {
    const { franchise } = useFranchiseAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        aadhaarNumber: franchise?.kyc?.aadhaarNumber || '',
        panNumber: franchise?.kyc?.panNumber || '',
        fssaiNumber: String(franchise?.kyc?.fssaiNumber || '').replace(/\D/g, '').slice(0, 14),
        gstNumber: normalizeGstInput(franchise?.kyc?.gstNumber || ''),
        aadhaarImage: null,
        panImage: null,
        fssaiCertificate: null,
        shopEstablishmentCertificate: null,
        gstCertificate: null,
    });

    const [previews, setPreviews] = useState({
        aadhaar: franchise?.kyc?.aadhaarImage || null,
        pan: franchise?.kyc?.panImage || null,
        fssai: franchise?.kyc?.fssaiCertificate || null,
        shopEstablishment: franchise?.kyc?.shopEstablishmentCertificate || null,
        gst: franchise?.kyc?.gstCertificate || null,
    });
    const [errors, setErrors] = useState({});
    const [activePreview, setActivePreview] = useState({ url: null, title: '' });

    // Sync previews when franchise data loads/updates
    useEffect(() => {
        if (franchise?.kyc) {
            setPreviews({
                aadhaar: franchise.kyc.aadhaarImage || null,
                pan: franchise.kyc.panImage || null,
                fssai: franchise.kyc.fssaiCertificate || null,
                shopEstablishment: franchise.kyc.shopEstablishmentCertificate || null,
                gst: franchise.kyc.gstCertificate || null,
            });
            setFormData(prev => ({
                ...prev,
                aadhaarNumber: franchise.kyc.aadhaarNumber || '',
                panNumber: franchise.kyc.panNumber || '',
                fssaiNumber: String(franchise.kyc.fssaiNumber || '').replace(/\D/g, '').slice(0, 14),
                gstNumber: normalizeGstInput(franchise.kyc.gstNumber || ''),
            }));
        }
    }, [franchise]);

    const isVerified = franchise?.kyc?.status === 'verified';
    const isPending = franchise?.kyc?.status === 'pending';
    const franchiseAccountPending = franchise && !franchise.isVerified;
    const readOnly = isVerified || isPending;
    const gstParts = getGstParts(formData.gstNumber);

    const handlePreview = (url, title) => {
        setActivePreview({ url, title });
    };

    const validateForm = () => {
        const nextErrors = {};
        const aadhaarNumber = formData.aadhaarNumber.trim();
        const panNumber = normalizePanInput(formData.panNumber);
        const fssaiDigits = normalizeFssaiInput(formData.fssaiNumber);
        const gstNumber = normalizeGstInput(formData.gstNumber);

        if (!aadhaarNumber) {
            nextErrors.aadhaarNumber = 'Enter the Aadhaar number shown on the card.';
        }

        if (!panNumber) {
            nextErrors.panNumber = 'Enter your PAN card number.';
        } else if (!isValidPan(panNumber)) {
            nextErrors.panNumber = 'Enter a valid PAN in this format: ABCDE1234F.';
        }

        if (fssaiDigits && !isValidFssai(fssaiDigits)) {
            nextErrors.fssaiNumber = 'FSSAI number must contain exactly 14 digits.';
        }

        if (gstNumber && !isValidGst(gstNumber)) {
            nextErrors.gstNumber = 'Enter a valid GSTIN like 27ABCDE1234F1Z5.';
        }

        if (!formData.aadhaarImage && !previews.aadhaar) {
            nextErrors.aadhaarImage = 'Upload a clear Aadhaar image.';
        }
        if (!formData.panImage && !previews.pan) {
            nextErrors.panImage = 'Upload a clear PAN card image.';
        }
        // FSSAI and GST are optional
        // if (!formData.fssaiCertificate && !previews.fssai) {
        //     nextErrors.fssaiCertificate = 'Upload your FSSAI certificate.';
        // }
        if (!formData.shopEstablishmentCertificate && !previews.shopEstablishment) {
            nextErrors.shopEstablishmentCertificate = 'Upload your shop establishment certificate.';
        }
        // if (!formData.gstCertificate && !previews.gst) {
        //     nextErrors.gstCertificate = 'Upload your GST certificate.';
        // }

        return {
            nextErrors,
            normalizedValues: {
                aadhaarNumber,
                panNumber,
                fssaiDigits,
                gstNumber,
            },
        };
    };

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const updated = { ...prev };
            delete updated[field];
            return updated;
        });
    };

    const handleFileChange = (e, fieldId) => {
        if (readOnly) return;
        const { formKey, previewKey } = FILE_FIELDS[fieldId];
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 20 * 1024 * 1024) {
                toast.error('File size should be less than 20MB');
                return;
            }
            setFormData((prev) => ({ ...prev, [formKey]: file }));
            setErrors((prev) => {
                if (!prev[formKey]) return prev;
                const updated = { ...prev };
                delete updated[formKey];
                return updated;
            });
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews((prev) => ({ ...prev, [previewKey]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleRemoveFile = (fieldId) => {
        if (readOnly) return;
        const { formKey, previewKey } = FILE_FIELDS[fieldId];
        setFormData((prev) => ({ ...prev, [formKey]: null }));
        setPreviews((prev) => ({ ...prev, [previewKey]: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (readOnly) return;

        if (!formData.aadhaarNumber?.trim() || !formData.panNumber?.trim()) {
            toast.error('Please fill in Aadhaar and PAN numbers');
            return;
        }
        const fssaiDigits = String(formData.fssaiNumber || '').replace(/\D/g, '');
        if (fssaiDigits && fssaiDigits.length !== 14) {
            toast.error('FSSAI number must be exactly 14 digits');
            return;
        }
        if (formData.gstNumber && !isValidGst(formData.gstNumber)) {
            toast.error(
                'GSTIN must be a 15-character alphanumeric string (e.g. 22AAAAA0000A1Z5)',
            );
            return;
        }

        setErrors({});
        setIsSubmitting(true);
        try {
            const data = new FormData();
            data.append('aadhaarNumber', formData.aadhaarNumber.trim());
            data.append('panNumber', formData.panNumber.trim());
            data.append('fssaiNumber', fssaiDigits);
            data.append('gstNumber', formData.gstNumber);
            if (formData.aadhaarImage) data.append('aadhaarImage', formData.aadhaarImage);
            if (formData.panImage) data.append('panImage', formData.panImage);
            if (formData.fssaiCertificate) data.append('fssaiCertificate', formData.fssaiCertificate);
            if (formData.shopEstablishmentCertificate) {
                data.append('shopEstablishmentCertificate', formData.shopEstablishmentCertificate);
            }
            if (formData.gstCertificate) data.append('gstCertificate', formData.gstCertificate);

            const response = await api.post('/franchise/kyc/submit', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data.success) {
                toast.success('Documentation submitted successfully for verification!');
                window.location.reload();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to submit documentation');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                        <FileText size={20} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                        My Documents
                    </h1>
                </div>
                <p className="text-slate-500 text-sm font-medium">
                    Upload your documents so the admin can verify your franchise.
                </p>
            </header>

            {franchiseAccountPending && (
                <div
                    role="status"
                    className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
                >
                    <Info className="shrink-0 mt-0.5" size={18} aria-hidden />
                    <div className="space-y-1 text-sm">
                        <p className="font-bold">Franchise approval pending</p>
                        <p className="text-amber-900/90 leading-relaxed">
                            Your franchise account is not verified by admin yet. Until then, only this page is
                            available. After approval, all dashboard sections will unlock automatically.
                        </p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:border-slate-300 transition-all"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <User size={18} className="text-slate-900" />
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                            Aadhaar Card Verification
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">
                                Aadhaar Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="123456789012"
                                maxLength={12}
                                value={formData.aadhaarNumber}
                                readOnly={readOnly}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, aadhaarNumber: e.target.value }))
                                }
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all disabled:opacity-50"
                            />
                        </div>
                        <DocUploadZone
                            preview={previews.aadhaar}
                            disabled={readOnly}
                            title={<>Aadhaar Card Photo <span className="text-red-500">*</span></>}
                            subtitle="Upload Aadhaar Front/Back"
                            inputId="doc-aadhaar"
                            docName="aadhaar_card"
                            error={errors.aadhaarImage}
                            onPick={(e) => handleFileChange(e, 'aadhaar')}
                            onRemove={() => handleRemoveFile('aadhaar')}
                            onPreview={handlePreview}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:border-slate-300 transition-all"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <CreditCard size={18} className="text-slate-900" />
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                            Permanent Account Number (PAN)
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">
                                PAN Card Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="ABCDE1234F"
                                value={formData.panNumber}
                                readOnly={readOnly}
                                maxLength={10}
                                onChange={(e) => handleFieldChange('panNumber', normalizePanInput(e.target.value))}
                                className={cn(
                                    'w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all uppercase disabled:opacity-50',
                                    errors.panNumber ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200',
                                )}
                            />
                            {errors.panNumber ? (
                                <p className="text-[11px] font-medium text-rose-600">{errors.panNumber}</p>
                            ) : (
                                <p className="text-[10px] text-slate-400 font-medium mt-1">
                                    Use your PAN in this format: AAAAA9999A
                                </p>
                            )}
                        </div>
                        <DocUploadZone
                            preview={previews.pan}
                            disabled={readOnly}
                            title={<>PAN Card Image <span className="text-red-500">*</span></>}
                            subtitle="Upload PAN Card Image"
                            inputId="doc-pan"
                            docName="pan_card"
                            error={errors.panImage}
                            onPick={(e) => handleFileChange(e, 'pan')}
                            onRemove={() => handleRemoveFile('pan')}
                            onPreview={handlePreview}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:border-slate-300 transition-all"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <UtensilsCrossed size={18} className="text-slate-900" />
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                            FSSAI License
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">
                                FSSAI Number
                            </label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="12345678901234"
                                maxLength={14}
                                pattern="\d{14}"
                                title="14 digits only"
                                value={formData.fssaiNumber}
                                readOnly={readOnly}
                                onChange={(e) => handleFieldChange('fssaiNumber', normalizeFssaiInput(e.target.value))}
                                className={cn(
                                    'w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm font-bold tracking-widest focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all disabled:opacity-50',
                                    errors.fssaiNumber ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200',
                                )}
                            />
                            {errors.fssaiNumber ? (
                                <p className="text-[11px] font-medium text-rose-600">{errors.fssaiNumber}</p>
                            ) : (
                                <p className="text-[10px] text-slate-400 font-medium mt-1">
                                    {formData.fssaiNumber.length}/14 digits entered
                                </p>
                            )}
                        </div>
                        <DocUploadZone
                            preview={previews.fssai}
                            disabled={readOnly}
                            title="FSSAI Certificate"
                            subtitle="Upload FSSAI license / certificate"
                            inputId="doc-fssai"
                            docName="fssai_certificate"
                            error={errors.fssaiCertificate}
                            onPick={(e) => handleFileChange(e, 'fssai')}
                            onRemove={() => handleRemoveFile('fssai')}
                            onPreview={handlePreview}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:border-slate-300 transition-all"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <Landmark size={18} className="text-slate-900" />
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">GST</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">
                                GSTIN (15-digit Alphanumeric)
                            </label>
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="off"
                                placeholder="27ABCDE1234F1Z5"
                                maxLength={15}
                                title="GSTIN has 15 characters, e.g. 27ABCDE1234F1Z5"
                                value={formData.gstNumber}
                                readOnly={readOnly}
                                onChange={(e) => handleFieldChange('gstNumber', normalizeGstInput(e.target.value))}
                                className={cn(
                                    'w-full bg-slate-50 border rounded-lg px-4 py-3 text-sm font-bold tracking-wide focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all disabled:opacity-50 font-mono',
                                    errors.gstNumber ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200',
                                )}
                            />
                            {errors.gstNumber ? (
                                <p className="text-[11px] font-medium text-rose-600">{errors.gstNumber}</p>
                            ) : (
                                <>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">
                                        GSTIN has 15 characters, e.g. 27ABCDE1234F1Z5
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest font-bold">
                                        Progress: {formData.gstNumber.length}/15 chars
                                    </p>
                                </>
                            )}
                        </div>
                        <DocUploadZone
                            preview={previews.gst}
                            disabled={readOnly}
                            title="GST Certificate"
                            subtitle="Upload GST registration certificate"
                            inputId="doc-gst"
                            docName="gst_certificate"
                            error={errors.gstCertificate}
                            onPick={(e) => handleFileChange(e, 'gst')}
                            onRemove={() => handleRemoveFile('gst')}
                            onPreview={handlePreview}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14 }}
                    className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:border-slate-300 transition-all"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                        <Store size={18} className="text-slate-900" />
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                            Shop Establishment Certificate
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="max-w-xl">
                            <DocUploadZone
                                preview={previews.shopEstablishment}
                                disabled={readOnly}
                                title={<>Certificate Upload <span className="text-red-500">*</span></>}
                                subtitle="Upload shop / establishment proof (Shop Act, Udyam, etc.)"
                                inputId="doc-shop"
                                docName="shop_establishment_certificate"
                                error={errors.shopEstablishmentCertificate}
                                onPick={(e) => handleFileChange(e, 'shopEstablishment')}
                                onRemove={() => handleRemoveFile('shopEstablishment')}
                                onPreview={handlePreview}
                            />
                        </div>
                    </div>
                </motion.div>

                <div className="lg:col-span-2 space-y-6 pt-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                            <Info size={20} />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">
                                Verification
                            </h4>
                            <p className="text-xs text-emerald-800/80 font-medium leading-relaxed">
                                Our team checks your documents within 24–48 working hours. Make sure photos are clear and numbers match the certificates so we can approve you faster.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-6 border-t border-slate-100">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Please Note
                            </span>
                            <span className="text-[11px] font-bold text-slate-900">Required before you can receive payments</span>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || readOnly}
                            className={cn(
                                'px-8 py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center gap-3',
                                isSubmitting && 'animate-pulse',
                                isVerified && 'bg-emerald-600 shadow-emerald-100',
                            )}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : isVerified ? (
                                <>
                                    <CheckCircle2 size={16} />
                                    Account Verified
                                </>
                            ) : isPending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Verification Pending
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    Submit Documents
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Document Preview Modal */}
            <DocPreviewModal
                isOpen={!!activePreview.url}
                onClose={() => setActivePreview({ url: null, title: '' })}
                url={activePreview.url}
                title={activePreview.title}
            />
        </div>
    );
}
