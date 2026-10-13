import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Upload, CheckCircle2, ChevronRight, Home, CreditCard, Loader2 } from 'lucide-react';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function PaymentSettingsScreen() {
    const { franchise, updateFranchiseData } = useFranchiseAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(franchise?.storeQRCode || null);

    const handleQRUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preview locally
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);

        setIsUploading(true);
        const formData = new FormData();
        formData.append('qrCode', file);

        try {
            const response = await api.put('/franchise/qr-code', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                toast.success('Payment QR Code updated successfully');
                // Update context state
                const updatedFranchise = { ...franchise, storeQRCode: response.data.result.qrCode };
                updateFranchiseData(updatedFranchise);
                setPreviewUrl(response.data.result.qrCode);
            }
        } catch (error) {
            console.error('QR Upload failed', error);
            toast.error(error.response?.data?.message || 'Failed to upload QR code. Please try again.');
            setPreviewUrl(franchise?.storeQRCode || null);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 font-sans">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Franchise</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Payment Settings</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">Payment QR Code</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-8 pt-12 space-y-10 font-sans">
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Payment Methods</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Set how customers pay you at the counter</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* QR Display Card */}
                    <div className="bg-white border border-slate-200 rounded-sm p-8 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-full aspect-square max-w-[240px] bg-slate-50 border border-slate-100 rounded-sm flex items-center justify-center relative overflow-hidden group">
                            {previewUrl ? (
                                <img src={previewUrl} className="w-full h-full object-contain p-4" alt="Store QR" />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-slate-300">
                                    <QrCode size={64} strokeWidth={1} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">No QR Uploaded</span>
                                </div>
                            )}

                            {isUploading && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 className="animate-spin text-slate-900" size={32} />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Your UPI QR Code</h3>
                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest px-4">This image will be shown to customers using the 'Online Payment' option at the billing counter.</p>
                        </div>
                    </div>

                    {/* Upload Section */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-sm p-8 text-white space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/10 rounded-sm flex items-center justify-center text-white">
                                    <Upload size={20} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest">Change QR Code</h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Recommended: Square JPEG/PNG</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label
                                    htmlFor="qr-upload"
                                    className="block w-full h-32 border-2 border-dashed border-slate-700 hover:border-white transition-all rounded-sm flex flex-col items-center justify-center cursor-pointer group"
                                >
                                    <input
                                        type="file"
                                        id="qr-upload"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleQRUpload}
                                        disabled={isUploading}
                                    />
                                    <Upload size={24} className="text-slate-700 group-hover:text-white mb-2 transition-colors" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-white transition-colors">Select QR Image</span>
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-800 space-y-3">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Shown at the billing counter</span>
                                </div>
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Updates instantly</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-sm">
                            <p className="text-[10px] font-bold text-amber-900 leading-relaxed uppercase tracking-wider">
                                Important: Make sure your QR code is clear and linked to your business bank account. Kisaankart is not responsible for payment problems caused by a wrong QR code.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
