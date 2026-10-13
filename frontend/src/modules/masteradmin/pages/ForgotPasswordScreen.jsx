
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight, KeyRound, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import api from '../../../lib/axios';

export default function ForgotPasswordScreen() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await api.post('/masteradmin/forgot-password', { email });
            setStep(2);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await api.post('/masteradmin/reset-password', { email, otp, newPassword });
            alert('Password reset successful! Please login.');
            navigate('/masteradmin/login');
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafd] flex items-center justify-center p-6 selection:bg-emerald-100">
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#16a34a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-md bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10 relative z-10"
            >
                <button
                    onClick={() => step === 1 ? navigate('/masteradmin/login') : setStep(1)}
                    className="absolute top-8 left-8 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="flex flex-col items-center mb-10 mt-8">
                    <motion.div
                        initial={{ rotate: -10 }}
                        animate={{ rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-50 mb-6"
                    >
                        <KeyRound className="text-primary w-8 h-8" />
                    </motion.div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                        {step === 1 ? 'Forgot Password?' : 'Secure Reset'}
                    </h2>
                    <p className="text-slate-400 font-medium text-sm mt-2 uppercase tracking-widest text-center">
                        {step === 1
                            ? "Enter your admin email for verification"
                            : "Enter the code sent to your email"}
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
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Admin Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="admin@kisaankart.com"
                                        className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none shadow-xl shadow-slate-200"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Send Recovery Code
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
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Secure Code</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                        <KeyRound size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => {
                                            // Allow only numbers and limit to 6 digits
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 6) setOtp(val);
                                        }}
                                        placeholder="123456"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium tracking-widest"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-12 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-primary transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none shadow-xl shadow-emerald-200"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Reset Access
                                        <ArrowRight size={18} className="ml-1 opacity-50" />
                                    </>
                                )}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                <div className="mt-12 pt-8 border-t border-slate-50 text-center">
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
                        Kisaankart Admin
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
