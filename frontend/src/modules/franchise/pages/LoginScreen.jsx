import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, ShieldCheck, Zap, ChevronRight, Home, Smartphone, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import api from '../../../lib/axios';

export default function LoginScreen() {
    const navigate = useNavigate();
    const { loginSuccess } = useFranchiseAuth();

    const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'

    // OTP flow
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpMode, setOtpMode] = useState('mobile'); // 'mobile' | 'otp'
    const [timer, setTimer] = useState(120);
    const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    // Password flow
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let interval;
        if (loginMethod === 'otp' && otpMode === 'otp' && timer > 0) {
            interval = setInterval(() => setTimer((p) => p - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [loginMethod, otpMode, timer]);

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const handleLoginSuccess = (result) => {
        const { token, ...franchiseData } = result;
        if (token) {
            localStorage.setItem('franchiseToken', token);
            localStorage.setItem('franchiseData', JSON.stringify(franchiseData));
        }
        loginSuccess(franchiseData, token);
        navigate(franchiseData.isVerified ? '/franchise/dashboard' : '/franchise/documentation');
    };

    // ── OTP flow ──
    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (mobile.length !== 10) return;
        setIsLoading(true);
        try {
            await api.post('/franchise/send-otp', { mobile });
            setOtpMode('otp');
            setTimer(120);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        setIsLoading(true);
        try {
            await api.post('/franchise/send-otp', { mobile });
            setTimer(120);
            setOtp(['', '', '', '', '', '']);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpLogin = async (e) => {
        e.preventDefault();
        const otpValue = otp.join('');
        if (otpValue.length !== 6) return;
        setIsLoading(true);
        try {
            const res = await api.post('/franchise/verify-otp', { mobile, otp: otpValue });
            handleLoginSuccess(res.data.result);
        } catch (err) {
            alert(err.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value[0];
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5) otpRefs[index + 1].current.focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs[index - 1].current.focus();
    };

    // ── Password flow ──
    const handlePasswordLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) return;
        setIsLoading(true);
        try {
            const res = await api.post('/franchise/login', { email, password });
            handleLoginSuccess(res.data.result);
        } catch (err) {
            alert(err.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row relative overflow-hidden font-sans">
            {/* Left Panel */}
            <div className="hidden md:flex flex-1 flex-col justify-between p-12 relative z-10 border-r border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-sm flex items-center justify-center text-slate-900 shadow-xl">
                        <Home size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white text-lg font-black tracking-tight leading-none uppercase">Kisaankart</span>
                        <span className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase">Franchise Portal</span>
                    </div>
                </div>
                <div className="space-y-6 max-w-md">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-sm">
                        <Zap size={10} /> Franchise Portal
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter leading-[0.9] uppercase">
                        Franchise <br />Access <br />Login.
                    </h1>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed uppercase tracking-tight">
                        Welcome back! Login to manage your orders, deliveries, and business profile securely.
                    </p>
                </div>
                <div className="flex items-center gap-12 text-slate-500">
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-white uppercase tabular-nums tracking-widest">99.9%</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Always On</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-white uppercase tabular-nums tracking-widest">Fast</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Quick Updates</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-white uppercase tabular-nums tracking-widest">Secure</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Login</span>
                    </div>
                </div>
                <div className="absolute inset-0 opacity-10 -z-10" style={{ backgroundImage: 'radial-gradient(#fff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-900 md:bg-white relative">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-sm space-y-8"
                >
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            <Home size={12} /><ChevronRight size={10} />
                            <span className="text-slate-900 border-b border-slate-900 pb-px">Login</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Account Access</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Log in to your franchise account</p>
                    </div>

                    {/* Method Toggle */}
                    <div className="flex bg-slate-100 rounded-sm p-1 gap-1">
                        <button
                            type="button"
                            onClick={() => setLoginMethod('password')}
                            className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${loginMethod === 'password' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Email + Password
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginMethod('otp')}
                            className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${loginMethod === 'otp' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Mobile OTP
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ── EMAIL + PASSWORD ── */}
                        {loginMethod === 'password' && (
                            <motion.form
                                key="password-form"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                onSubmit={handlePasswordLogin}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">Email Address</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                                            <Mail size={16} />
                                        </div>
                                        <input
                                            autoFocus
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="business@email.com"
                                            className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">Password</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                                            <Lock size={16} />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Your password"
                                            className="w-full h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((p) => !p)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <div className="flex justify-end px-1">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/franchise/forgot-password')}
                                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                </div>
                                <button
                                    disabled={!email || !password || isLoading}
                                    className="w-full h-14 bg-slate-900 text-white rounded-sm font-black uppercase text-[11px] tracking-[0.3em] shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-3 mt-2"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={16} /> Login to Account</>}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/franchise/signup')}
                                    className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 hover:text-slate-900 transition-colors underline underline-offset-8 decoration-slate-200"
                                >
                                    Register as New Franchise
                                </button>
                            </motion.form>
                        )}

                        {/* ── MOBILE OTP ── */}
                        {loginMethod === 'otp' && (
                            <motion.div
                                key="otp-form"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                            >
                                <AnimatePresence mode="wait">
                                    {otpMode === 'mobile' ? (
                                        <motion.form
                                            key="mobile-step"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            onSubmit={handleSendOtp}
                                            className="space-y-4"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">Mobile Number</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                                                        <Smartphone size={16} />
                                                    </div>
                                                    <input
                                                        autoFocus
                                                        type="tel"
                                                        maxLength={10}
                                                        value={mobile}
                                                        onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setMobile(v); }}
                                                        placeholder="Enter Mobile Number"
                                                        className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-slate-900 transition-all font-sans tracking-widest"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                disabled={mobile.length < 10 || isLoading}
                                                className="w-full h-14 bg-slate-900 text-white rounded-sm font-black uppercase text-[11px] tracking-[0.3em] shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-3"
                                            >
                                                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <>Request OTP <ArrowRight size={16} /></>}
                                            </button>
                                        </motion.form>
                                    ) : (
                                        <motion.form
                                            key="otp-step"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            onSubmit={handleOtpLogin}
                                            className="space-y-6"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">OTP Verification</label>
                                                    <span className="text-[10px] font-bold text-slate-400">{mobile}</span>
                                                </div>
                                                <div className="flex gap-2 justify-between">
                                                    {otp.map((digit, index) => (
                                                        <input
                                                            key={index}
                                                            ref={otpRefs[index]}
                                                            type="text"
                                                            inputMode="numeric"
                                                            maxLength={1}
                                                            value={digit}
                                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                                            className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-sm outline-none text-lg font-black text-slate-900 text-center focus:bg-white focus:border-slate-900 transition-all font-sans"
                                                            autoFocus={index === 0}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <button
                                                    disabled={isLoading || otp.join('').length < 6}
                                                    className="w-full h-14 bg-slate-900 text-white rounded-sm font-black uppercase text-[11px] tracking-[0.3em] shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:text-slate-400"
                                                >
                                                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <><ShieldCheck size={16} /> Login to Account</>}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleResendOtp}
                                                    disabled={timer > 0 || isLoading}
                                                    className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors underline underline-offset-8 decoration-slate-200 disabled:opacity-50"
                                                >
                                                    {timer > 0 ? `Resend in ${formatTime(timer)}` : 'Resend OTP'}
                                                </button>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Secure connection</span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest text-center leading-relaxed">
                            By logging in, you agree to our{' '}
                            <button type="button" onClick={() => navigate('/franchise/terms')} className="text-slate-900 border-b border-slate-900">Franchise Terms</button>.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
