import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertCircle,
    Clock,
    X,
    Loader2,
    Eye,
    Trash2,
    Pencil,
    Camera
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { openFlutterCamera } from '@/lib/flutterCamera';

export default function DocumentUploadCard({ title, icon: Icon, status: initialStatus, fileName: initialFileName, uploadDate: initialUploadDate, url, fieldName, onUpload }) {
    const [status, setStatus] = useState(initialStatus || 'not_uploaded');
    const [fileName, setFileName] = useState(initialFileName || null);
    const [uploadDate, setUploadDate] = useState(initialUploadDate || null);
    const [currentUrl, setCurrentUrl] = useState(url || null);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleFlutterCamera = async () => {
        const file = await openFlutterCamera();
        if (file) {
            // Fake an event object to reuse the same upload logic
            handleFileSelect({ target: { files: [file], value: '' } });
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // If a real upload handler is provided, use it
        if (onUpload && fieldName) {
            setIsUploading(true);
            setProgress(0);

            // Simulate progress while uploading
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 15, 85));
            }, 200);

            try {
                const formData = new FormData();
                formData.append(fieldName, file);
                const newUrl = await onUpload(formData);
                clearInterval(progressInterval);
                setProgress(100);
                setTimeout(() => {
                    setIsUploading(false);
                    setStatus('pending');
                    setFileName(file.name);
                    setUploadDate(new Date().toISOString().split('T')[0]);
                    if (newUrl) setCurrentUrl(newUrl);
                }, 400);
            } catch (err) {
                clearInterval(progressInterval);
                setIsUploading(false);
                setProgress(0);
            }
        } else {
            // Fallback: local-only mock upload
            setIsUploading(true);
            setProgress(0);
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setTimeout(() => {
                            setIsUploading(false);
                            setStatus('pending');
                            setFileName(file.name);
                            setUploadDate(new Date().toISOString().split('T')[0]);
                        }, 500);
                        return 100;
                    }
                    return prev + 10;
                });
            }, 200);
        }

        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        setStatus('not_uploaded');
        setFileName(null);
        setUploadDate(null);
        setCurrentUrl(null);
    };

    const StatusBadge = () => {
        switch (status) {
            case 'verified':
                return <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-tighter"><CheckCircle2 size={10} /> Verified</span>;
            case 'pending':
                return <span className="flex items-center gap-1 text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-tighter"><Clock size={10} /> Pending</span>;
            case 'expiring_soon':
                return <span className="flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-tighter"><AlertCircle size={10} /> Expiring</span>;
            default:
                return <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">Not Uploaded</span>;
        }
    };

    return (
        <div className={cn(
            "bg-white p-5 rounded-[32px] border transition-all relative overflow-hidden group flex flex-col h-full",
            status === 'not_uploaded' ? "border-slate-100 hover:border-primary/20" : "border-slate-100 shadow-sm"
        )}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileSelect}
            />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        status === 'not_uploaded' ? "bg-slate-50 text-slate-400" : "bg-slate-900 text-white"
                    )}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">{title}</h4>
                        <StatusBadge />
                    </div>
                </div>

                <AnimatePresence>
                    {status !== 'not_uploaded' && !isUploading && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-2"
                        >
                            {/* View */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const link = currentUrl || url;
                                    if (link && (link.startsWith('http://') || link.startsWith('https://'))) {
                                        window.open(link, '_blank');
                                    }
                                }}
                                className="p-2 text-slate-400 hover:text-primary transition-colors bg-slate-50 rounded-lg"
                                title="View document"
                            >
                                <Eye size={14} />
                            </button>
                            {/* Edit / Re-upload */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                className="p-2 text-slate-400 hover:text-amber-500 transition-colors bg-slate-50 rounded-lg"
                                title="Replace document"
                            >
                                <Pencil size={14} />
                            </button>
                            {/* Delete */}
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-lg"
                                title="Remove document"
                            >
                                <Trash2 size={14} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {isUploading ? (
                <div className="space-y-3 py-2 flex-1">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                        <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Uploading...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            ) : status === 'not_uploaded' ? (
                <div className="w-full flex-1 flex gap-2">
                    {window.flutter_inappwebview && (
                        <button
                            onClick={handleFlutterCamera}
                            className="flex-1 py-4 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group/btn"
                        >
                            <Camera size={18} className="text-slate-300 group-hover/btn:text-primary transition-colors" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/btn:text-primary transition-colors">Camera</span>
                        </button>
                    )}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-4 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group/btn"
                    >
                        <Upload size={18} className="text-slate-300 group-hover/btn:text-primary transition-colors" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/btn:text-primary transition-colors">
                            {window.flutter_inappwebview ? "Gallery" : "Select File"}
                        </span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100/50 flex-1">
                    <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-primary shrink-0">
                        <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-900 truncate">{fileName || 'Document'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Uploaded on {uploadDate}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
