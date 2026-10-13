import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShieldCheck, ExternalLink, X, FileText, CreditCard, BookOpen, Edit2, Upload, AlertCircle, Clock, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeliveryAuth } from '../contexts/DeliveryAuthContext';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { openFlutterCamera } from '../../../lib/flutterCamera';

export default function MyDocumentsScreen() {
    const { delivery, fetchData } = useDeliveryAuth();
    const navigate = useNavigate();
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [editDoc, setEditDoc] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [newImage, setNewImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [docNumber, setDocNumber] = useState('');
    const fileInputRef = useRef(null);
    const [showSourceSelect, setShowSourceSelect] = useState(false);

    const handleCameraCapture = async () => {
        const file = await openFlutterCamera();
        if (file) {
            setNewImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const documents = [
        {
            id: 'aadhar',
            label: 'Aadhar Card',
            field: 'aadharNumber',
            imageField: 'aadharImage',
            icon: CreditCard,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            image: delivery?.aadharImage,
            number: delivery?.aadharNumber || 'Not Set',
            pending: delivery?.pendingDocs?.status === 'pending' && (delivery.pendingDocs.aadharImage || delivery.pendingDocs.aadharNumber)
        },
        {
            id: 'pan',
            label: 'PAN Card',
            field: 'panNumber',
            imageField: 'panImage',
            icon: FileText,
            color: 'text-orange-500',
            bg: 'bg-orange-50',
            image: delivery?.panImage,
            number: delivery?.panNumber || 'Not Set',
            pending: delivery?.pendingDocs?.status === 'pending' && (delivery.pendingDocs.panImage || delivery.pendingDocs.panNumber)
        },
        {
            id: 'license',
            label: 'Driving License',
            field: 'licenseNumber',
            imageField: 'licenseImage',
            icon: BookOpen,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            image: delivery?.licenseImage,
            number: delivery?.licenseNumber || 'Not Set',
            pending: delivery?.pendingDocs?.status === 'pending' && (delivery.pendingDocs.licenseImage || delivery.pendingDocs.licenseNumber)
        }
    ];

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateDoc = async () => {
        if (!newImage && !docNumber) {
            toast.error('Please provide a new image or document number');
            return;
        }

        let processedDocNumber = docNumber ? docNumber.trim() : '';
        if (processedDocNumber) {
            if (editDoc.id === 'aadhar') {
                if (!/^\d{12}$/.test(processedDocNumber)) {
                    toast.error('Aadhaar card number must be exactly 12 numeric digits');
                    return;
                }
            } else if (editDoc.id === 'pan') {
                processedDocNumber = processedDocNumber.toUpperCase();
                if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(processedDocNumber)) {
                    toast.error('PAN card number must be in the format: AAAAA9999A (e.g. ABCDE1234F)');
                    return;
                }
            } else if (editDoc.id === 'license') {
                processedDocNumber = processedDocNumber.replace(/[\s.-]/g, '').toUpperCase();
                if (!/^[A-Z]{2}\d{13}$/.test(processedDocNumber)) {
                    toast.error('Driving License must start with a 2-letter state code followed by 13 digits (e.g., MH1220180004567)');
                    return;
                }
            }
        }

        setUploading(true);
        try {
            const formData = new FormData();
            if (newImage) formData.append(`${editDoc.id}Image`, newImage);
            if (processedDocNumber) formData.append(`${editDoc.id}Number`, processedDocNumber);

            const response = await api.put('/delivery/profile/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                toast.success('Update request submitted for admin approval');
                setEditDoc(null);
                setNewImage(null);
                setPreview(null);
                setDocNumber('');
                if (fetchData) fetchData();
            }
        } catch (error) {
            console.error('Update doc error:', error);
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-20">
            {/* Header */}
            <div className="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-border/50 shadow-sm">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-foreground">My Documents</h1>
            </div>

            <div className="p-6 space-y-6">
                {delivery?.pendingDocs?.status === 'pending' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 flex items-center gap-4 animate-pulse">
                        <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xs font-black text-blue-900 uppercase tracking-tight">Update Pending</h2>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Admin is reviewing your changes</p>
                        </div>
                    </div>
                )}

                {delivery?.pendingDocs?.status === 'rejected' && (
                    <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-rose-900 uppercase tracking-tight">Update Rejected</h2>
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Please check reason and re-submit</p>
                            </div>
                        </div>
                        {delivery.pendingDocs.rejectionReason && (
                            <p className="text-[10px] font-bold text-rose-800 bg-white/50 p-3 rounded-xl border border-rose-100">
                                Reason: {delivery.pendingDocs.rejectionReason}
                            </p>
                        )}
                    </div>
                )}

                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Verified Profile</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Your documents are secured</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="bg-white rounded-3xl p-5 border border-border shadow-sm flex flex-col gap-4 group transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${doc.bg} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                                        <doc.icon className={`w-6 h-6 ${doc.color}`} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-slate-900">{doc.label}</h3>
                                            {doc.pending && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-400 font-mono mt-0.5">{doc.number}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {doc.image && (
                                        <button
                                            onClick={() => setSelectedDoc(doc)}
                                            className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-all"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setEditDoc(doc);
                                            setDocNumber(doc.number !== 'Not Set' ? doc.number : '');
                                        }}
                                        className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-amber-500 hover:text-white transition-all"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6">
                    <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2">Important Note</h4>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                        Changes to your documents require manual verification by the admin team. Your current documents will remain active until the new ones are approved.
                    </p>
                </div>
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4"
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className="bg-white w-full max-w-md rounded-t-[40px] p-8 pb-12 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black text-slate-900">Update {editDoc.label}</h3>
                                <button onClick={() => {
                                    setEditDoc(null);
                                    setPreview(null);
                                    setNewImage(null);
                                }} className="p-2 bg-slate-100 rounded-full">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Document Number</label>
                                    <input
                                        type="text"
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all uppercase"
                                        placeholder={`Enter ${editDoc.label} Number`}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Upload New Photo</label>
                                    <div
                                        onClick={() => {
                                            if (window.flutter_inappwebview) {
                                                setShowSourceSelect(true);
                                            } else {
                                                fileInputRef.current?.click();
                                            }
                                        }}
                                        className="relative flex flex-col items-center justify-center aspect-[16/9] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-white hover:border-primary transition-all cursor-pointer overflow-hidden group"
                                    >
                                        {preview ? (
                                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Image</span>
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                <button
                                    disabled={uploading || (!newImage && docNumber === editDoc.number)}
                                    onClick={handleUpdateDoc}
                                    className="w-full bg-primary text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    {uploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                    Submit for Approval
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Viewer Modal */}
            <AnimatePresence>
                {selectedDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6"
                    >
                        <button
                            onClick={() => setSelectedDoc(null)}
                            className="absolute top-8 right-6 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="w-full max-w-lg aspect-[4/3] relative rounded-3xl overflow-hidden shadow-2xl">
                            <img
                                src={selectedDoc.image}
                                alt={selectedDoc.label}
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div className="mt-8 text-center">
                            <h3 className="text-white text-lg font-bold">{selectedDoc.label}</h3>
                            <p className="text-white/60 text-xs font-mono mt-1 uppercase tracking-widest">{selectedDoc.number}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Source Selection Modal for Flutter WebView */}
            <AnimatePresence>
                {showSourceSelect && (
                    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-slate-100"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Upload {editDoc?.label}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select Document Source</p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowSourceSelect(false)} 
                                    className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-900"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setShowSourceSelect(false);
                                        await handleCameraCapture();
                                    }}
                                    className="p-5 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/20 hover:bg-primary/[0.02] transition-all group/btn bg-slate-50/50 cursor-pointer"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover/btn:text-primary transition-colors border border-slate-100">
                                        <Camera size={22} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Take Photo</span>
                                    <span className="text-[10px] font-medium text-slate-400 text-center">Use Device Camera</span>
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSourceSelect(false);
                                        setTimeout(() => {
                                            fileInputRef.current?.click();
                                        }, 100);
                                    }}
                                    className="p-5 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/20 hover:bg-primary/[0.02] transition-all group/btn bg-slate-50/50 cursor-pointer"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover/btn:text-primary transition-colors border border-slate-100">
                                        <Upload size={22} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Choose File</span>
                                    <span className="text-[10px] font-medium text-slate-400 text-center">Gallery or Files</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
