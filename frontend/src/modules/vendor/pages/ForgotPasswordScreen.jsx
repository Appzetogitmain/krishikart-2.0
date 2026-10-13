
import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, Mail, Lock, Loader2, ArrowRight, KeyRound, ChevronLeft } from 'lucide-react';

import api from '../../../lib/axios';

export default function ForgotPasswordScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await api.post('/vendor/forgot-password', { mobile });
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
        setIsLoading(true);
        try {
            await api.post('/vendor/reset-password', {
                mobile,
                otp,
                newPassword,
                confirmPassword: newPassword
            });
            toast.success('Password reset successful! Please login.');
            navigate('/vendor/login');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafd] flex items-center justify-center p-6 selection:bg-emerald-100 overflow-hidden relative">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-100 rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        x: [0, 50, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md bg-white/80 backdrop-blur-xl p-8 rounded-[40px] border border-white shadow-2xl shadow-emerald-900/5 relative z-10"
            >
                <button
                    onClick={() => step === 1 ? navigate('/vendor/login') : setStep(1)}
                    className="absolute top-8 left-8 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="flex flex-col items-center mb-10 text-center mt-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                        className="w-20 h-20 bg-primary/10 rounded-[24px] flex items-center justify-center text-primary mb-6 shadow-xl shadow-primary/5"
                    >
                        <KeyRound size={40} />
                    </motion.div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        {step === 1 ? 'Forgot Password?' : 'Reset your password'}
                    </h1>
                    <p className="text-slate-500 font-medium mt-2">
                        {step === 1
                            ? "Enter your mobile number to get an OTP"
                            : "Enter the code sent to your mobile"}
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
                            className="space-y-5"
                        >
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="tel"
                                        required
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value)}
                                        placeholder="+91 98765 43210"
                                        className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 outline-none text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-slate-900"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group w-full bg-slate-900 text-white rounded-2xl py-4 px-6 font-black text-sm flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-4"
                            >
                                {isLoading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        Send OTP
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
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
                            className="space-y-5"
                        >
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">OTP</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <KeyRound size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="123456"
                                        maxLength={6}
                                        className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 outline-none text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-slate-900 tracking-widest"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 outline-none text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-slate-900"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group w-full bg-emerald-500 text-white rounded-2xl py-4 px-6 font-black text-sm flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-4"
                            >
                                {isLoading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        Reset Password
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
