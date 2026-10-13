import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';

import api from '../../../lib/axios';
import { useMasterAdminAuth } from '../contexts/MasterAdminAuthContext';

export default function LoginScreen() {
    const navigate = useNavigate();
    const { loginSuccess, isAuthenticated } = useMasterAdminAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/masteradmin/dashboard');
        }
    }, [isAuthenticated, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await api.post('/masteradmin/login', { email, password });

            // The backend returns { token, result: { ...user details } } inside response.data.result
            const { token, result: adminData } = response.data.result;
            loginSuccess(adminData, token);
            navigate('/masteradmin/dashboard');
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || 'Login failed');
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
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-10">
                    <motion.div
                        initial={{ rotate: -10 }}
                        animate={{ rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 mb-6"
                    >
                        <ShieldCheck className="text-white w-10 h-10" />
                    </motion.div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Master Admin</h2>
                    <p className="text-slate-400 font-medium text-sm mt-2 uppercase tracking-widest">Admin Panel</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
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
                                placeholder="name@kisaankart.com"
                                autoComplete="username email"
                                className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
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

                    <div className="flex items-center justify-between px-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 rounded border-slate-200 text-primary focus:ring-primary transition-all" />
                            <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">Stay Logged In</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => navigate('/masteradmin/forgot-password')}
                            className="text-xs font-bold text-primary hover:underline underline-offset-4 tracking-tight"
                        >
                            Forgot Password?
                        </button>
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
                                Log In
                                <ArrowRight size={18} className="ml-1 opacity-50" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-12 pt-8 border-t border-slate-50 text-center space-y-3">
                    <button 
                        type="button"
                        onClick={() => navigate('/masteradmin/terms')}
                        className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] hover:text-primary underline underline-offset-4 decoration-slate-200"
                    >
                        Terms & Conditions
                    </button>
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">
                        Kisaankart Admin
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
