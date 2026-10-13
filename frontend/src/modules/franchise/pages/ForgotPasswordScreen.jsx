import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, Loader2, ArrowRight, KeyRound, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import api from '../../../lib/axios';
import { toast } from 'sonner';

export default function ForgotPasswordScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Mobile, 2: OTP & New Password
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!/^[6-9]\d{9}$/.test(mobile)) {
            toast.error('Invalid mobile number');
            return;
        }
        setIsLoading(true);
        try {
            await api.post('/franchise/forgot-password', { mobile });
            toast.success('OTP sent to your mobile number');
            setStep(2);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) {
            toast.error('Please enter 6-digit OTP');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        setIsLoading(true);
        try {
            await api.post('/franchise/reset-password', { mobile, otp, newPassword });
            toast.success('Password reset successful! Please login.');
            navigate('/franchise/login');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafd] flex items-center justify-center p-6 selection:bg-blue-100">
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#2563eb 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-md bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10 relative z-10"
            >
                <button
                    onClick={() => step === 1 ? navigate('/franchise/login') : setStep(1)}
                    className="absolute top-8 left-8 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="flex flex-col items-center mb-10 mt-8">
                    <motion.div
                        initial={{ rotate: -10 }}
                        animate={{ rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-50 mb-6"
                    >
                        <KeyRound className="text-blue-600 w-8 h-8" />
                    </motion.div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
                        {step === 1 ? 'Reset Password' : 'Reset your password'}
                    </h2>
                    <p className="text-slate-400 font-bold text-[10px] mt-2 uppercase tracking-[0.2em] text-center">
                        {step === 1
                            ? "Enter your registered mobile number"
                            : "Enter the code sent to your phone"}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <motion.form
                            key="step1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onSubmit={handleSendOtp}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Phone size={18} />
                                    </div>
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="9876543210"
                                        className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-bold tracking-wider"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none shadow-xl shadow-slate-200"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Send OTP
                                        <ArrowRight size={18} className="ml-1 opacity-50" />
                                    </>
                                )}
                            </button>
                        </motion.form>
                    ) : (
                        <motion.form
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleResetPassword}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">OTP</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <KeyRound size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 6) setOtp(val);
                                        }}
                                        placeholder="123456"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-bold tracking-[0.5em] text-center"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-bold"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none shadow-xl shadow-blue-200"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Reset Password
                                        <ArrowRight size={18} className="ml-1 opacity-50" />
                                    </>
                                )}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                <div className="mt-12 pt-8 border-t border-slate-50 text-center">
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
                        Kisaankart Franchise
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
