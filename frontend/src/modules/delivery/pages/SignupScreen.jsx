import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, ShieldCheck, ArrowRight, Phone, User, Truck, Camera, Upload, X } from 'lucide-react';
import { ROUTES } from '../utils/constants';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/axios';
import { toast } from 'sonner';
import { openFlutterCamera } from '../../../lib/flutterCamera';

const VEHICLE_REGEX = /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/;

const SignupScreen = () => {
    const [step, setStep] = useState('details'); // 'details' or 'otp'
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        vehicleNumber: '',
        vehicleType: 'bike', // 'bike', 'scooter'
        aadharImage: null,
        panImage: null,
        licenseImage: null
    });
    const [previews, setPreviews] = useState({
        aadhar: null,
        pan: null,
        license: null
    });
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(120);
    const navigate = useNavigate();

    const fileInputRefs = {
        aadharImage: useRef(null),
        panImage: useRef(null),
        licenseImage: useRef(null)
    };
    const [activeUploadField, setActiveUploadField] = useState(null);

    const setFileAndPreview = (name, file) => {
        setFormData(prev => ({ ...prev, [name]: file }));
        const previewKey = name.replace('Image', '');
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviews(prev => ({ ...prev, [previewKey]: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleCameraCapture = async (name) => {
        const file = await openFlutterCamera();
        if (file) {
            setFileAndPreview(name, file);
        }
    };

    useEffect(() => {
        let interval;
        if (step === 'otp' && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        setLoading(true);
        try {
            await api.post('/delivery/send-otp', { mobile: formData.phone });
            setTimer(120);
            setOtp(['', '', '', '', '', '']);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (formData.phone.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }
        if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
            toast.error('Name should only contain alphabets');
            return;
        }
        let vehicleNumber = (formData.vehicleNumber || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (vehicleNumber.length === 9 && /^[A-Z]\d{2}[A-Z]{2}\d{4}$/.test(vehicleNumber)) {
            vehicleNumber = vehicleNumber[0] + vehicleNumber;
            setFormData(prev => ({ ...prev, vehicleNumber }));
        }
        if (!VEHICLE_REGEX.test(vehicleNumber)) {
            toast.error('Vehicle number must be 2 letters + 2 digits + 2 letters + 4 digits (e.g. MP09CS1234)');
            return;
        }
        if (!formData.aadharImage || !formData.panImage || !formData.licenseImage) {
            toast.error('Please upload all document images (Aadhar, PAN, and License)');
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('fullName', formData.name);
            data.append('mobile', formData.phone);
            data.append('vehicleNumber', vehicleNumber);
            data.append('vehicleType', formData.vehicleType);
            data.append('aadharImage', formData.aadharImage);
            data.append('panImage', formData.panImage);
            data.append('licenseImage', formData.licenseImage);

            await api.post('/delivery/register', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setStep('otp');
            setTimer(120);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const otpCode = otp.join('');
        if (otpCode.length !== 6) return;
        setLoading(true);
        try {
            const response = await api.post('/delivery/verify-otp', {
                mobile: formData.phone,
                otp: otpCode
            });
            localStorage.setItem('deliveryToken', response.data.token);
            localStorage.setItem('deliveryData', JSON.stringify(response.data));
            setStep('success');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (files) {
            const file = files[0];
            if (file) {
                setFileAndPreview(name, file);
            }
        } else if (name === 'phone') {
            setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
        } else if (name === 'name') {
            setFormData(prev => ({ ...prev, [name]: value.replace(/[^A-Za-z\s]/g, '') }));
        } else if (name === 'vehicleNumber') {
            setFormData(prev => ({ ...prev, [name]: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleOtpChange = (value, index) => {
        const val = value.replace(/\D/g, '');
        const newOtp = [...otp];
        newOtp[index] = val;
        setOtp(newOtp);

        if (val && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center p-6 overflow-hidden relative">
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.05, scale: 1 }}
                className="absolute -top-24 -right-24 w-80 h-80 bg-primary rounded-full blur-[80px]"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.03, scale: 1 }}
                className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500 rounded-full blur-[80px]"
            />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm mt-10 z-10"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.8, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-16 h-16 bg-primary rounded-[24px] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/20"
                    >
                        <Navigation className="w-8 h-8 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Become a Delivery Partner</h1>
                    <p className="text-primary font-bold tracking-[0.2em] uppercase text-[10px] mt-1">Delivery Partner Registration</p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'details' ? (
                        <motion.div
                            key="details-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <User size={16} />
                                        </div>
                                        <input
                                            name="name"
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Enter your name"
                                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-black tracking-tight"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Phone Number</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Phone size={16} />
                                        </div>
                                        <input
                                            name="phone"
                                            type="tel"
                                            required
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="Mobile number"
                                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-black tracking-tight"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Vehicle Number</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                            <Truck size={16} />
                                        </div>
                                        <input
                                            name="vehicleNumber"
                                            type="text"
                                            required
                                            value={formData.vehicleNumber}
                                            onChange={handleChange}
                                            maxLength={10}
                                            placeholder="e.g. MP09CS1234"
                                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-black tracking-tight uppercase"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider ml-1">2 letters (state) + 2 digits + 2 letters + 4 digits</p>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] text-center">Upload Documents</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { name: 'aadharImage', label: 'Aadhar', preview: previews.aadhar, ref: fileInputRefs.aadharImage },
                                            { name: 'panImage', label: 'PAN', preview: previews.pan, ref: fileInputRefs.panImage },
                                            { name: 'licenseImage', label: 'License', preview: previews.license, ref: fileInputRefs.licenseImage }
                                        ].map((doc) => (
                                            <div key={doc.name} className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">{doc.label}</label>
                                                <div 
                                                    onClick={() => {
                                                        if (window.flutter_inappwebview) {
                                                            setActiveUploadField({ name: doc.name, label: doc.label, fileRef: doc.ref });
                                                        } else {
                                                            doc.ref.current?.click();
                                                        }
                                                    }} 
                                                    className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-white hover:border-primary transition-all cursor-pointer overflow-hidden group"
                                                >
                                                    {doc.preview ? (
                                                        <img src={doc.preview} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <ShieldCheck className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                                                            <span className="text-[10px] font-black text-slate-400">UPLOAD</span>
                                                        </div>
                                                    )}
                                                    <input
                                                        ref={doc.ref}
                                                        type="file"
                                                        name={doc.name}
                                                        accept="image/*"
                                                        onChange={handleChange}
                                                        className="hidden"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Vehicle Type</label>
                                    <div className="flex gap-2">
                                        {['bike', 'scooter'].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, vehicleType: type })}
                                                className={`flex-1 py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all ${formData.vehicleType === type ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-center py-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                        By joining, you agree to our <br/>
                                        <button type="button" onClick={() => navigate('/delivery/terms')} className="text-primary border-b border-primary/20">Delivery Partner Terms & Conditions</button>
                                    </p>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    disabled={loading || !formData.name || formData.phone.length !== 10 || !formData.vehicleNumber || !formData.aadharImage || !formData.panImage || !formData.licenseImage}
                                    type="submit"
                                    className={`w-full py-4 rounded-3xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 mt-4 ${!loading && formData.name && formData.phone.length === 10 && formData.vehicleNumber && formData.aadharImage && formData.panImage && formData.licenseImage ? 'bg-primary text-white shadow-primary/30' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Continue <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Already have an account?
                                </p>
                                <button
                                    onClick={() => navigate('/delivery/login')}
                                    className="mt-1 text-primary font-black text-[11px] hover:underline"
                                >
                                    Login Here
                                </button>
                            </div>
                        </motion.div>
                    ) : step === 'success' ? (
                        <motion.div
                            key="success-step"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6 py-8"
                        >
                            <div className="w-20 h-20 bg-emerald-500 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200">
                                <ShieldCheck className="w-10 h-10 text-white" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900">Registration Complete!</h2>
                                <p className="text-sm font-bold text-slate-500 leading-relaxed px-4">
                                    Your documents have been submitted. <span className="text-primary">Admin will verify and approve</span> your account within 24-48 hours.
                                </p>
                            </div>
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-relaxed">
                                    Note: You will be able to accept delivery tasks only after admin approval.
                                </p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.96 }}
                                onClick={() => navigate(ROUTES.LOGIN)}
                                className="w-full py-4 bg-slate-900 text-white rounded-3xl font-black text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all"
                            >
                                Go to Login
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="otp-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="mb-6 flex items-center justify-between px-1">
                                <div>
                                    <h3 className="font-black text-slate-900 text-sm">Verify Details</h3>
                                    <p className="text-[10px] font-bold text-slate-400">OTP Sent to +91 {formData.phone}</p>
                                </div>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <div className="flex justify-between gap-1">
                                    {otp.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`otp-${idx}`}
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(e.target.value, idx)}
                                            onKeyDown={(e) => handleKeyDown(e, idx)}
                                            className="w-10 h-12 bg-slate-50 border border-slate-100 rounded-xl text-center text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                                        />
                                    ))}
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    disabled={otp.join('').length !== 6 || loading}
                                    type="submit"
                                    className={`w-full py-4 rounded-3xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${otp.join('').length === 6 && !loading ? 'bg-slate-900 text-white shadow-slate-900/30' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Register <ShieldCheck className="w-4 h-4" />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            <div className="mt-8 text-center">
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={timer > 0 || loading}
                                    className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                                >
                                    {timer > 0 ? `Resend Code in ${formatTime(timer)}` : 'Resend OTP'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <AnimatePresence>
                {activeUploadField && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border border-slate-100"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Upload {activeUploadField.label}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select Document Source</p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setActiveUploadField(null)} 
                                    className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-900"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const name = activeUploadField.name;
                                        setActiveUploadField(null);
                                        await handleCameraCapture(name);
                                    }}
                                    className="p-5 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/20 hover:bg-primary/[0.02] transition-all group/btn bg-slate-50/50"
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
                                        const ref = activeUploadField.fileRef;
                                        setActiveUploadField(null);
                                        setTimeout(() => {
                                            ref.current?.click();
                                        }, 100);
                                    }}
                                    className="p-5 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/20 hover:bg-primary/[0.02] transition-all group/btn bg-slate-50/50"
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
};

export default SignupScreen;
