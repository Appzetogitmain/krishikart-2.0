import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, ShieldCheck, ArrowRight, Phone, MessageSquare, RefreshCw } from 'lucide-react';
import { ROUTES } from '../utils/constants';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/axios';
import { useDeliveryAuth } from '../contexts/DeliveryAuthContext';

const DeliveryPartnerLogin = () => {
    const [step, setStep] = useState('phone'); // 'phone' or 'otp'
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(120);
    const navigate = useNavigate();
    const { loginSuccess, isAuthenticated } = useDeliveryAuth();

    React.useEffect(() => {
        if (isAuthenticated) {
            navigate(ROUTES.DASHBOARD);
        }
    }, [isAuthenticated, navigate]);

    React.useEffect(() => {
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
            await api.post('/delivery/send-otp', { mobile: phone });
            setTimer(120);
            setOtp(['', '', '', '', '', '']);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (phone.length !== 10) return;
        setLoading(true);
        try {
            await api.post('/delivery/send-otp', { mobile: phone });
            setStep('otp');
            setTimer(120);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Login failed');
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
            const response = await api.post('/delivery/verify-otp', { mobile: phone, otp: otpCode });

            // Store token and user data (includes fullName; also hydrates /me)
            await loginSuccess(response.data.result, response.data.result.token);

            navigate(ROUTES.DASHBOARD);
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (value, index) => {
        const val = value.replace(/\D/g, '');
        const newOtp = [...otp];
        newOtp[index] = val;
        setOtp(newOtp);

        // Auto focus next input
        if (val && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) {
                prevInput.focus();
                const newOtp = [...otp];
                newOtp[index - 1] = '';
                setOtp(newOtp);
            }
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center p-8 overflow-hidden relative">
            {/* Decorative Background Elements */}
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
                className="w-full max-w-sm mt-16 z-10"
            >
                <div className="text-center mb-10">
                    <motion.div
                        initial={{ scale: 0.8, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-20 h-20 bg-primary rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20"
                    >
                        <Navigation className="w-10 h-10 text-white" />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Partner Portal</h1>
                        <p className="text-primary font-bold tracking-[0.2em] uppercase text-[10px] mt-2">Logistics & Delivery Fleet</p>
                    </motion.div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'phone' ? (
                        <motion.div
                            key="phone-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <form onSubmit={handleSendOtp} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Phone Number</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 border-r border-slate-200 pr-3 h-6 group-focus-within:border-primary transition-colors">
                                            <span className="text-sm font-black text-slate-900">+91</span>
                                        </div>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            placeholder="Enter registered mobile"
                                            className="w-full pl-20 pr-4 py-5 rounded-3xl border border-border bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-lg font-black tracking-tight"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    disabled={phone.length !== 10 || loading}
                                    type="submit"
                                    className={`w-full py-5 rounded-3xl font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 ${phone.length === 10 && !loading ? 'bg-primary text-white shadow-primary/30' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Get OTP <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            <p className="mt-8 text-center text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                Don't have an account?<br />
                                <span
                                    onClick={() => navigate('/delivery/signup')}
                                    className="text-primary cursor-pointer hover:underline underline-offset-4"
                                >
                                    Register as Partner
                                </span>
                            </p>
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
                                    <h3 className="font-black text-slate-900">Verify OTP</h3>
                                    <p className="text-[11px] font-bold text-slate-400">Sent to +91 {phone}</p>
                                </div>
                                <button
                                    onClick={() => setStep('phone')}
                                    className="p-3 bg-slate-50 rounded-2xl text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-8">
                                <div className="grid grid-cols-6 gap-2">
                                    {otp.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`otp-${idx}`}
                                            autoFocus={idx === 0}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(e.target.value, idx)}
                                            onKeyDown={(e) => handleKeyDown(e, idx)}
                                            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl text-center text-xl font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                                        />
                                    ))}
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    disabled={otp.join('').length !== 6 || loading}
                                    type="submit"
                                    className={`w-full py-5 rounded-3xl font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 ${otp.join('').length === 6 && !loading ? 'bg-slate-900 text-white shadow-slate-900/30' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Verify & Login <ShieldCheck className="w-5 h-5" />
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            <div className="mt-8 text-center">
                                <button
                                    onClick={handleResendOtp}
                                    disabled={timer > 0 || loading}
                                    className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                                >
                                    <MessageSquare className="w-3 h-3" />
                                    {timer > 0 ? `Resend Code in ${formatTime(timer)}` : 'Resend OTP'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-16 flex flex-col items-center gap-6"
                >
                    <div className="flex items-center gap-3 py-3 px-6 bg-slate-50 border border-slate-100 rounded-2xl">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase italic">Enterprise Encryption</span>
                    </div>

                    <button 
                        type="button"
                        onClick={() => navigate('/delivery/terms')}
                        className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] hover:text-primary transition-colors border-b border-slate-100"
                    >
                        Terms & Conditions
                    </button>

                    <p className="text-center text-[10px] text-slate-400 leading-relaxed uppercase tracking-[0.2em] font-bold">
                        Need Help? Contact <br />
                        <span className="text-slate-900">Fleet Support Team</span>
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default DeliveryPartnerLogin;
