import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ArrowRight, ShieldCheck, CheckCircle2, Sprout, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../../../lib/axios'
import { useCart } from '../contexts/CartContext'
import { useWishlist } from '../contexts/WishlistContext'

import { useUserAuth } from '../contexts/UserAuthContext'

export default function LoginScreen() {
    const { loginSuccess, isAuthenticated } = useUserAuth()
    const { fetchCart } = useCart()
    const { fetchWishlist } = useWishlist()
    const [step, setStep] = useState('phone') // phone, otp
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from?.pathname || '/home'

    const [isLoading, setIsLoading] = useState(false)
    const [timer, setTimer] = useState(120)

    // Already logged in (e.g. the app was closed and reopened): skip the login screen
    useEffect(() => {
        if (isAuthenticated) navigate(from, { replace: true })
    }, [isAuthenticated, navigate, from])

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

    // Wrong number? Go back to the phone step with the number still filled in, ready to correct
    const handleEditNumber = () => {
        setOtp(['', '', '', '', '', '']);
        setTimer(120);
        setStep('phone');
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        setIsLoading(true);
        try {
            await api.post('/user/send-otp', { mobile: phone });
            setTimer(120);
            setOtp(['', '', '', '', '', '']);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = async () => {
        if (step === 'phone') {
            if (phone.length === 10) {
                setIsLoading(true);
                try {
                    await api.post('/user/send-otp', { mobile: phone });
                    setStep('otp')
                    setTimer(120)
                } catch (error) {
                    console.error(error);
                    toast.error(error.response?.data?.message || 'Failed to send OTP');
                } finally {
                    setIsLoading(false);
                }
            }
        } else {
            const otpValue = otp.join('');
            if (otpValue.length === 6) {
                setIsLoading(true);
                try {
                    const response = await api.post('/user/verify-otp', { mobile: phone, otp: otpValue });

                    loginSuccess(response.data.result.user, response.data.result.token);
                    window.dispatchEvent(new Event('userDataUpdated'));

                    // Sync onboarding state from backend for returning users
                    const u = response.data.result.user;
                    if (u.onboardingCompleted) {
                        localStorage.setItem('kk_onboarding_completed', 'true');
                    }
                    if (u.businessType) {
                        localStorage.setItem('kk_business_type', u.businessType);
                    }

                    // Sync cart and wishlist immediately
                    fetchCart();
                    fetchWishlist();

                    navigate(from, { replace: true })
                } catch (error) {
                    console.error(error);
                    toast.error(error.response?.data?.message || 'Verification failed');
                } finally {
                    setIsLoading(false);
                }
            }
        }
    }

    return (
        <div className="user-app-theme min-h-screen bg-slate-50 md:flex md:items-center md:justify-center md:p-12">
            <div className="bg-white min-h-screen md:min-h-0 md:h-[650px] md:w-full md:max-w-5xl md:rounded-xl md:shadow-2xl md:shadow-green-900/10 md:flex md:overflow-hidden relative border border-slate-100">

                {/* Branding Side - Desktop only */}
                <div className="hidden md:flex md:w-5/12 bg-primary relative overflow-hidden flex-col justify-between p-12 text-white">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary shadow-lg border border-white">
                            <Sprout size={24} />
                        </div>
                        <span className="text-xl font-bold tracking-tight">Kisaankart</span>
                    </div>

                    <div className="relative z-10">
                        <h2 className="text-4xl font-bold leading-tight mb-4">
                            Freshness <br />
                            <span className="text-green-200">Simplified.</span>
                        </h2>
                        <p className="text-green-50/70 text-sm font-medium leading-relaxed max-w-xs italic">
                            "Empowering local farmers by connecting them directly to your business."
                        </p>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-8">
                        <div>
                            <p className="text-2xl font-bold">25+</p>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-200 mt-1 opacity-80">Stores</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">100%</p>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-200 mt-1 opacity-80">Direct Sourced</p>
                        </div>
                    </div>
                </div>

                {/* Login Form Side */}
                <div className="flex-1 flex flex-col p-8 md:p-12 relative bg-white">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-10"
                    >
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 md:hidden">
                            <Sprout size={28} />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none md:text-4xl">
                            Welcome back
                        </h1>
                        <p className="mt-4 text-slate-500 font-medium text-base leading-relaxed md:text-slate-400">
                            {step === 'phone' ? 'Log in to access your dashboard' : 'Check your phone for the verification code'}
                        </p>
                    </motion.div>

                    <div className="flex-1 max-w-sm">
                        <AnimatePresence mode="wait">
                            {step === 'phone' ? (
                                <motion.div
                                    key="phone"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 border-r border-slate-200 pr-3 mr-3 h-5">
                                                <span className="text-sm font-bold text-slate-900">+91</span>
                                            </div>
                                            <Input
                                                type="tel"
                                                inputMode="numeric"
                                                placeholder="00000 00000"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                className="pl-16 h-12 text-md font-bold bg-white border border-slate-200 rounded-lg placeholder:text-slate-300 ring-offset-transparent focus-visible:ring-1 focus-visible:ring-primary/40 focus:bg-slate-50/30 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleNext}
                                        disabled={phone.length !== 10 || isLoading}
                                        className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-md font-bold shadow-md shadow-green-900/10 transition-all active:scale-[0.98]"
                                    >
                                        {isLoading ? 'Sending...' : 'Get OTP'} <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="otp"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-8"
                                >
                                    {/* Shows the number the code went to, with a way to fix a wrong number */}
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold text-slate-500">Code sent to</p>
                                            <p className="text-sm font-bold text-slate-900 tabular-nums">+91 {phone}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleEditNumber}
                                            disabled={isLoading}
                                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            <Pencil size={13} /> Edit number
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block mb-4">Verification Code</label>
                                        <div className="grid grid-cols-6 gap-2">
                                            {otp.map((digit, idx) => (
                                                <input
                                                    key={idx}
                                                    autoFocus={idx === 0}
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '')
                                                        const newOtp = [...otp]
                                                        newOtp[idx] = val
                                                        setOtp(newOtp)
                                                        if (val && e.target.nextSibling) e.target.nextSibling.focus()
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
                                                            const prevSibling = e.target.previousSibling
                                                            if (prevSibling) {
                                                                prevSibling.focus()
                                                                const newOtp = [...otp]
                                                                newOtp[idx - 1] = ''
                                                                setOtp(newOtp)
                                                            }
                                                        }
                                                    }}
                                                    className="w-full h-12 bg-white border border-slate-200 rounded-lg text-center text-lg font-bold text-slate-900 outline-none focus:ring-1 focus:ring-primary/40 focus:bg-slate-50/30"
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <Button
                                            onClick={handleNext}
                                            disabled={isLoading || otp.join('').length !== 6}
                                            className="w-full h-12 rounded-lg bg-slate-900 hover:bg-slate-800 text-md font-bold shadow-lg"
                                        >
                                            {isLoading ? 'Verifying...' : 'Verify & Log In'}
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={timer > 0 || isLoading}
                                            className="text-slate-400 font-bold text-xs text-center hover:text-primary transition-colors disabled:opacity-50 disabled:hover:text-slate-400"
                                        >
                                            {timer > 0 ? `Resend Code in ${formatTime(timer)}` : 'Resend OTP'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="mt-auto pt-10">
                        <div className="flex items-center gap-3 border-t border-slate-100 pt-6">
                            <ShieldCheck className="text-green-500 w-5 h-5" />
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                Your data is kept safe and secure. <br /> 
                                By continuing, you agree to our <button type="button" onClick={() => navigate('/terms')} className="text-primary border-b border-primary/20">Terms & Conditions</button>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
