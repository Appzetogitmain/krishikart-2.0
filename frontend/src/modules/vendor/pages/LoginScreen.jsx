import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, Mail, Lock, Loader2, ArrowRight, Smartphone, ShieldCheck, Eye, EyeOff, Pencil } from 'lucide-react';
import api from '@/lib/axios';
import { useVendorAuth } from '@/modules/vendor/contexts/VendorAuthContext';

export default function LoginScreen() {
    const { loginSuccess, isAuthenticated } = useVendorAuth();
    const navigate = useNavigate();

    // Already logged in (e.g. the app was closed and reopened): skip the login screen
    useEffect(() => {
        if (isAuthenticated) navigate('/vendor/dashboard', { replace: true });
    }, [isAuthenticated, navigate]);

    const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'

    // Password flow
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // OTP flow
    const [mobile, setMobile] = useState('');
    const [otpStep, setOtpStep] = useState('mobile'); // 'mobile' | 'otp'
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(120);
    const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let interval;
        if (loginMethod === 'otp' && otpStep === 'otp' && timer > 0) {
            interval = setInterval(() => setTimer((p) => p - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [loginMethod, otpStep, timer]);

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const handleLoginSuccess = (result) => {
        const { token, ...vendorData } = result;
        localStorage.setItem('vendorToken', token);
        localStorage.setItem('vendorData', JSON.stringify(vendorData));
        loginSuccess(vendorData, token);
        setTimeout(() => navigate('/vendor/dashboard'), 100);
    };

    // ── Password login ──
    const handlePasswordLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await api.post('/vendor/login', { email, password });
            handleLoginSuccess(res.data.result);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    // ── OTP flow ──
    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (mobile.length !== 10) return;
        setIsLoading(true);
        try {
            await api.post('/vendor/send-otp', { mobile });
            setOtpStep('otp');
            setTimer(120);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpLogin = async (e) => {
        e.preventDefault();
        const otpVal = otp.join('');
        if (otpVal.length !== 6) return;
        setIsLoading(true);
        try {
            const res = await api.post('/vendor/verify-otp', { mobile, otp: otpVal });
            handleLoginSuccess(res.data.result);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        setIsLoading(true);
        try {
            await api.post('/vendor/send-otp', { mobile });
            setTimer(120);
            setOtp(['', '', '', '', '', '']);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value[0];
        if (!/^\d*$/.test(value)) return;
        const n = [...otp]; n[index] = value; setOtp(n);
        if (value && index < 5) otpRefs[index + 1].current.focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs[index - 1].current.focus();
    };

    return (
        <div className="min-h-screen bg-[#f8fafd] flex items-center justify-center p-6 selection:bg-emerald-100 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-100 rounded-full blur-3xl" />
                <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 50, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md bg-white/80 backdrop-blur-xl p-8 rounded-[40px] border border-white shadow-2xl shadow-emerald-900/5 relative z-10"
            >
                <div className="flex flex-col items-center mb-8 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }} className="w-20 h-20 bg-primary rounded-[24px] flex items-center justify-center text-white mb-6 shadow-xl shadow-primary/30">
                        <Sprout size={40} />
                    </motion.div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vendor Portal</h1>
                    <p className="text-slate-500 font-medium mt-2">Manage your products and orders</p>
                </div>

                {/* Toggle */}
                <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 mb-6">
                    <button type="button" onClick={() => setLoginMethod('password')} className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${loginMethod === 'password' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-slate-700'}`}>
                        Email + Password
                    </button>
                    <button type="button" onClick={() => setLoginMethod('otp')} className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${loginMethod === 'otp' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-slate-700'}`}>
                        Mobile OTP
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {/* ── EMAIL + PASSWORD ── */}
                    {loginMethod === 'password' && (
                        <motion.form key="pw" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onSubmit={handlePasswordLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"><Mail size={18} /></div>
                                    <input autoFocus type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@kisaankart.com" className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 outline-none text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-slate-900" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"><Lock size={18} /></div>
                                    <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-14 outline-none text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-slate-900" />
                                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button type="button" onClick={() => navigate('/vendor/forgot-password')} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Forgot Password?</button>
                            </div>
                            <button type="submit" disabled={isLoading} className="group w-full bg-slate-900 text-white rounded-2xl py-4 px-6 font-black text-sm flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>Log In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                            </button>
                        </motion.form>
                    )}

                    {/* ── MOBILE OTP ── */}
                    {loginMethod === 'otp' && (
                        <motion.div key="otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                            <AnimatePresence mode="wait">
                                {otpStep === 'mobile' ? (
                                    <motion.form key="mob" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSendOtp} className="space-y-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                            <div className="relative group">
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"><Smartphone size={18} /></div>
                                                <input autoFocus type="tel" maxLength={10} value={mobile} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setMobile(v); }} placeholder="9876543210" className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 outline-none text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all text-slate-900 tracking-widest" />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={mobile.length < 10 || isLoading} className="group w-full bg-slate-900 text-white rounded-2xl py-4 px-6 font-black text-sm flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>Send OTP <ArrowRight size={18} /></>}
                                        </button>
                                    </motion.form>
                                ) : (
                                    <motion.form key="otpv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleOtpLogin} className="space-y-5">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center ml-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enter OTP</label>
                                                <span className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400">{mobile}</span>
                                                    <button type="button" onClick={() => { setOtp(['', '', '', '', '', '']); setTimer(120); setOtpStep('mobile'); }} className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                                                        <Pencil size={11} /> Edit number
                                                    </button>
                                                </span>
                                            </div>
                                            <div className="flex gap-2 justify-between">
                                                {otp.map((digit, i) => (
                                                    <input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} autoFocus={i === 0} className="w-12 h-14 bg-slate-50 border-none rounded-xl outline-none text-lg font-black text-slate-900 text-center focus:ring-4 focus:ring-primary/5 transition-all" />
                                                ))}
                                            </div>
                                        </div>
                                        <button type="submit" disabled={otp.join('').length < 6 || isLoading} className="group w-full bg-slate-900 text-white rounded-2xl py-4 px-6 font-black text-sm flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><ShieldCheck size={18} /> Verify & Login</>}
                                        </button>
                                        <button type="button" onClick={handleResendOtp} disabled={timer > 0 || isLoading} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors disabled:opacity-50">
                                            {timer > 0 ? `Resend in ${formatTime(timer)}` : 'Resend OTP'}
                                        </button>
                                    </motion.form>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-8 text-center space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        By logging in, you agree to our{' '}
                        <button type="button" onClick={() => navigate('/vendor/terms')} className="text-primary hover:underline">Vendor Terms & Conditions</button>
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                        Don't have a vendor account?{' '}
                        <button type="button" onClick={() => navigate('/vendor/signup')} className="text-slate-900 font-black hover:underline">Register as a Vendor</button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
