import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, XCircle, FileText, Calendar, Building, User, Mail, Phone, MapPin, ExternalLink, Download, AlertCircle, CheckCircle2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

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

export default function ApprovalDetailDrawer({ isOpen, onClose, item, type, onApprove, onReject }) {
    const isVendor = type === 'vendor';
    const isFranchise = type === 'franchise';
    const isDelivery = type === 'delivery';
    const isCredit = type === 'credit';
    const [isProcessing, setIsProcessing] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [activePreview, setActivePreview] = useState({ url: null, title: '' });
    const [approvedCategories, setApprovedCategories] = useState([]);

    useEffect(() => {
        if (isOpen && item && (isFranchise || isVendor)) {
            const reqCats = item.requestedCategories || [];
            const srvCats = item.servedCategories || [];
            
            // Combine both arrays, removing duplicates based on _id or string value
            const combined = [...reqCats, ...srvCats].reduce((acc, current) => {
                const id = current._id || current;
                if (!acc.find(item => (item._id || item) === id)) {
                    acc.push(current);
                }
                return acc;
            }, []);
            
            setApprovedCategories(combined.map(c => c._id || c));
        } else {
            setApprovedCategories([]);
        }
    }, [isOpen, item, isFranchise, isVendor]);

    if (!isOpen || !item) return null;

    const handleDownload = async (doc, idx) => {
        if (!doc?.url) return;
        setDownloadingId(idx);

        const baseName = (doc.type || 'document')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_-]/gi, '_')
            .toLowerCase();

        // Detect extension from URL path (before query string)
        const urlPath = doc.url.split('?')[0];
        const urlExt = urlPath.split('.').pop()?.toLowerCase();
        const knownExts = ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'gif'];
        const ext = knownExts.includes(urlExt) ? urlExt : 'jpg';
        const fileName = `${baseName}.${ext}`;

        try {
            // For Cloudinary URLs, inject fl_attachment transform to force browser download
            let downloadUrl = doc.url;
            if (doc.url.includes('cloudinary.com') && doc.url.includes('/upload/')) {
                downloadUrl = doc.url.replace('/upload/', `/upload/fl_attachment:${baseName}/`);
            }

            const res = await fetch(downloadUrl, { mode: 'cors', credentials: 'omit' });
            if (!res.ok) throw new Error('fetch failed');
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = fileName;
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
        } catch {
            // Fallback: open Cloudinary URL with fl_attachment so browser prompts save-as
            const fallback = doc.url.includes('cloudinary.com') && doc.url.includes('/upload/')
                ? doc.url.replace('/upload/', `/upload/fl_attachment:${baseName}/`)
                : doc.url;
            window.open(fallback, '_blank', 'noopener,noreferrer');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleAction = async (action) => {
        setIsProcessing(true);
        try {
            const fn = action === 'approve' ? onApprove : onReject;
            const result = typeof fn === 'function' ? await Promise.resolve(fn(item, approvedCategories)) : undefined;
            if (result !== false) onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    const documents = isVendor ? [
        { type: 'Aadhar Card', fileName: item.aadharCard ? 'aadhar_upload.pdf' : 'Not Uploaded', url: item.aadharCard },
        { type: 'PAN Card', fileName: item.panCard ? 'pan_upload.pdf' : 'Not Uploaded', url: item.panCard },
        { type: 'Shop Proof', fileName: item.shopEstablishmentProof ? 'shop_proof.pdf' : 'Not Uploaded', url: item.shopEstablishmentProof },
        ...((item.fssaiLicense || item.fssaiImage) ? [{ type: 'FSSAI License', fileName: item.fssaiLicense || (item.fssaiImage ? 'fssai_license.pdf' : 'Not Provided'), url: item.fssaiImage }] : [])
    ] :
        isFranchise ? [
            { type: 'Aadhaar Card', fileName: `Aadhaar: ${item.kyc?.aadhaarNumber || 'N/A'}`, url: item.kyc?.aadhaarImage, submitted: !!item.kyc?.aadhaarImage },
            { type: 'PAN Card', fileName: `PAN: ${item.kyc?.panNumber || 'N/A'}`, url: item.kyc?.panImage, submitted: !!item.kyc?.panImage },
            { type: 'FSSAI', fileName: `FSSAI: ${item.kyc?.fssaiNumber || 'N/A'}`, url: item.kyc?.fssaiCertificate, submitted: !!item.kyc?.fssaiCertificate },
            { type: 'Shop establishment', fileName: 'Shop establishment certificate', url: item.kyc?.shopEstablishmentCertificate, submitted: !!item.kyc?.shopEstablishmentCertificate },
            { type: 'GST', fileName: `GSTIN: ${item.kyc?.gstNumber || 'N/A'}`, url: item.kyc?.gstCertificate, submitted: !!item.kyc?.gstCertificate },
        ] :
            isDelivery ? [
                { type: 'Aadhar Card', fileName: item.aadharNumber || 'Verification Image', url: item.aadharImage, submitted: !!item.aadharImage },
                ...(item.pendingDocs?.aadharImage || item.pendingDocs?.aadharNumber ? [{
                    type: 'New Aadhar Request',
                    fileName: `Update: ${item.pendingDocs.aadharNumber || 'New Image'}`,
                    url: item.pendingDocs.aadharImage,
                    isPending: true,
                    submitted: true
                }] : []),

                { type: 'PAN Card', fileName: item.panNumber || 'Verification Image', url: item.panImage, submitted: !!item.panImage },
                ...(item.pendingDocs?.panImage || item.pendingDocs?.panNumber ? [{
                    type: 'New PAN Request',
                    fileName: `Update: ${item.pendingDocs.panNumber || 'New Image'}`,
                    url: item.pendingDocs.panImage,
                    isPending: true,
                    submitted: true
                }] : []),

                { type: 'License Image', fileName: item.licenseNumber || 'Verification Image', url: item.licenseImage, submitted: !!item.licenseImage },
                ...(item.pendingDocs?.licenseImage || item.pendingDocs?.licenseNumber ? [{
                    type: 'New License Request',
                    fileName: `Update: ${item.pendingDocs.licenseNumber || 'New Image'}`,
                    url: item.pendingDocs.licenseImage,
                    isPending: true,
                    submitted: true
                }] : []),

                { type: 'Vehicle', fileName: `${item.vehicleType?.toUpperCase()}: ${item.vehicleNumber}`, url: null, submitted: true }
            ] :
                item.supportingDocs || [];

    return (
        <>
            <AnimatePresence>
                <div className="fixed inset-0 z-[110] flex justify-end overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-4xl bg-[#f8fafd] h-full shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-white p-8 border-b border-slate-100 sticky top-0 z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className={cn(
                                        "w-16 h-16 rounded-[24px] flex items-center justify-center shadow-inner",
                                        isVendor ? "bg-emerald-50 text-emerald-500" :
                                            isFranchise ? "bg-blue-50 text-blue-500" :
                                                isDelivery ? "bg-amber-50 text-amber-500" : "bg-purple-50 text-purple-500"
                                    )}>
                                        {isVendor ? <User size={32} /> : isFranchise ? <Building size={32} /> : <ShieldCheck size={32} />}
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
                                            {item.fullName || item.vendorName || item.franchiseName || item.hotelName}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-200">
                                                {item._id || item.id}
                                            </span>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <Calendar size={14} className="text-slate-300" />
                                                Submitted {new Date(item.createdAt || item.submittedAt || item.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all active:scale-95"
                                >
                                    <X size={28} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                {/* Detailed Information */}
                                <div className="lg:col-span-7 space-y-8">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8">Application Details</h4>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-4 p-4 rounded-3xl bg-slate-50/50">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <User size={12} /> Contact Person
                                                </div>
                                                <p className="font-black text-slate-900">{item.fullName || item.ownerName || 'Not provided'}</p>
                                            </div>
                                            <div className="space-y-4 p-4 rounded-3xl bg-slate-50/50">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <Phone size={12} /> Contact
                                                </div>
                                                <p className="font-black text-slate-900">{item.mobile || 'Not provided'}</p>
                                            </div>
                                            <div className="space-y-4 p-4 rounded-3xl bg-slate-50/50">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <Mail size={12} /> Email
                                                </div>
                                                <p className="font-black text-slate-900 truncate">{item.email || 'Not provided'}</p>
                                            </div>
                                            {isCredit ? (
                                                <div className="space-y-4 p-4 rounded-3xl bg-slate-900 text-white">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Requested Limit
                                                    </div>
                                                    <p className="text-2xl font-black italic">₹{item.requestedLimit.toLocaleString()}</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4 p-4 rounded-3xl bg-slate-50/50">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <MapPin size={12} /> Location
                                                    </div>
                                                    <p className="font-black text-slate-900">{[item.area, item.city].filter(Boolean).join(', ') || item.farmLocation || 'Not provided'}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 p-6 bg-amber-50 rounded-[32px] border border-amber-100 flex items-start gap-4">
                                            <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
                                            <div>
                                                <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Note</p>
                                                <p className="text-sm text-amber-800/80 font-medium mt-1">
                                                    Before approving, check that the name and numbers above match the uploaded documents.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {(isFranchise || isVendor) && (
                                            <div className="mt-8 pt-8 border-t border-slate-100">
                                                <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">Requested Categories</h5>
                                                {((item.requestedCategories && item.requestedCategories.length > 0) || (item.servedCategories && item.servedCategories.length > 0)) ? (
                                                    <>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Click to select which categories to approve</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {[...(item.requestedCategories || []), ...(item.servedCategories || [])].reduce((acc, current) => {
                                                                const id = current._id || current;
                                                                if (!acc.find(c => (c._id || c) === id)) {
                                                                    acc.push(current);
                                                                }
                                                                return acc;
                                                            }, []).map(cat => {
                                                                const catId = cat._id || cat;
                                                                const isApproved = approvedCategories.includes(catId);
                                                                return (
                                                                    <button
                                                                        key={catId}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setApprovedCategories(prev => 
                                                                                isApproved ? prev.filter(id => id !== catId) : [...prev, catId]
                                                                            );
                                                                        }}
                                                                        className={cn(
                                                                            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer",
                                                                            isApproved ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                                                                        )}
                                                                    >
                                                                        {cat.name || 'Unknown Category'}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="text-xs text-slate-500 font-medium italic mt-2">No categories were selected during registration.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Document & Checklist Section */}
                                <div className="lg:col-span-5 space-y-8">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm overflow-hidden relative group">
                                        <div className="relative z-10">
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-2">
                                                <FileText size={18} className="text-primary" />
                                                Uploaded Documents
                                            </h4>
                                            <div className="space-y-4">
                                                {documents.map((doc, idx) => (
                                                    <div key={idx} className="p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all group/doc cursor-pointer">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover/doc:text-primary transition-colors shadow-sm">
                                                                    <FileText size={20} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                                                        {(doc.type || 'Document').replace('_', ' ')}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 truncate">
                                                                        {isVendor ? doc.fileName : isDelivery ? doc.fileName : doc.submitted ? 'Verified File' : 'Missing File'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                {doc.url && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setActivePreview({ url: doc.url, title: doc.type }); }}
                                                                            className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-primary hover:border-primary transition-all shadow-sm"
                                                                            title="Preview document"
                                                                        >
                                                                            <Eye size={14} />
                                                                        </button>
                                                                        <a
                                                                            href={doc.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-300 hover:text-primary hover:border-primary transition-all shadow-sm"
                                                                        >
                                                                            <ExternalLink size={14} />
                                                                        </a>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); handleDownload(doc, idx); }}
                                                                            disabled={downloadingId === idx}
                                                                            className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-70 disabled:cursor-wait"
                                                                        >
                                                                            {downloadingId === idx ? (
                                                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                            ) : (
                                                                                <Download size={14} />
                                                                            )}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Sticky Action Footer */}
                        <div className="bg-white p-6 border-t border-slate-100 sticky bottom-0 z-10 flex items-center justify-end gap-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={async () => {
                                    setIsProcessing(true);
                                    await onReject(item);
                                    setIsProcessing(false);
                                }}
                                className="px-6 py-4 rounded-xl text-xs font-black uppercase tracking-[0.15em] text-slate-500 hover:text-white hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/25 transition-all disabled:opacity-50"
                            >
                                Reject Application
                            </button>
                            <button
                                type="button"
                                disabled={isProcessing}
                                onClick={async () => {
                                    setIsProcessing(true);
                                    await onApprove(item, approvedCategories);
                                    setIsProcessing(false);
                                }}
                                className="px-8 py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-[0.15em] shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95 disabled:bg-slate-300 disabled:shadow-none flex items-center gap-3"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Verify & Approve
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            <DocPreviewModal
                isOpen={!!activePreview.url}
                onClose={() => setActivePreview({ url: null, title: '' })}
                url={activePreview.url}
                title={activePreview.title}
            />
        </>
    );
}


