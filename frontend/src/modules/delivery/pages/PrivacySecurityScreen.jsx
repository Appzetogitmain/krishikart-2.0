import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, ChevronRight, Lock, EyeOff, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacySecurityScreen() {
    const navigate = useNavigate();

    const options = [
        { label: 'Change Password', icon: Lock, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: 'Two-Step Verification', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { label: 'Login Activity', icon: Smartphone, color: 'text-purple-500', bg: 'bg-purple-50' },
        { label: 'Privacy Policy', icon: EyeOff, color: 'text-slate-500', bg: 'bg-slate-50' },
    ];

    return (
        <div className="flex flex-col min-h-full bg-slate-50 pb-20">
            <div className="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-border/50 shadow-sm">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-foreground">Privacy & Security</h1>
            </div>

            <div className="p-6 space-y-4">
                <div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20 mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-emerald-900">Account Secured</h2>
                            <p className="text-xs text-emerald-700">Your account is safe and secure.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {options.map((item, i) => (
                        <button key={i} className="w-full bg-white p-5 rounded-3xl border border-border shadow-sm flex items-center justify-between active:scale-95 transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <span className="text-sm font-black text-foreground">{item.label}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
