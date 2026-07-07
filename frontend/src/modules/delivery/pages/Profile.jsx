import React from 'react';
import { motion } from 'framer-motion';
import {
    User,
    Truck,
    Bell,
    ShieldCheck,
    HelpCircle,
    LogOut,
    ChevronRight,
    Star,
    Settings,
    FileText,
    Trash2
} from 'lucide-react';
import { useDeliveryAuth } from '../contexts/DeliveryAuthContext';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';

const Profile = () => {
    const { delivery, logout } = useDeliveryAuth();
    const navigate = useNavigate();

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
            try {
                await api.delete('/delivery/delete-account');
                alert("Account deleted successfully.");
                logout();
            } catch (error) {
                console.error("Failed to delete account", error);
                alert(error.response?.data?.message || "Failed to delete account. Please try again.");
            }
        }
    };

    const menuItems = [
        { label: 'My Documents', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50', path: '/delivery/documents' },
        { label: 'Vehicle Information', icon: Truck, color: 'text-amber-500', bg: 'bg-amber-50', path: '/delivery/vehicle' },
        { label: 'COD Remittance', icon: Settings, color: 'text-emerald-500', bg: 'bg-emerald-50', path: '/delivery/cod-remittance' },
        { label: 'Help & Support', icon: HelpCircle, color: 'text-purple-500', bg: 'bg-purple-50', path: '/delivery/help' },
    ];

    return (
        <div className="flex flex-col min-h-full pb-10">
            {/* Profile Header */}
            <div className="px-6 pt-10 pb-12 bg-primary relative overflow-hidden">
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border-4 border-white/20 p-1 mb-4 relative">
                        <img
                            src={`https://ui-avatars.com/api/?name=${delivery?.fullName || 'Delivery'}&background=random&size=200`}
                            className="w-full h-full rounded-full object-cover"
                            alt="Avatar"
                        />
                        <div className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 shadow-lg">
                            <div className="w-full h-full bg-primary rounded-full" />
                        </div>
                    </div>

                    <h1 className="text-xl font-bold text-white mb-1">{delivery?.fullName || 'Partner'}</h1>
                    <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                        <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                        <span className="text-xs font-bold text-white">4.8 Rating</span>
                        <span className="text-white/40 mx-1">•</span>
                        <span className="text-xs font-bold text-white">{delivery?.mobile}</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 -mt-6 relative z-20">
                <div className="bg-white rounded-3xl shadow-xl shadow-black/5 p-2 border border-border">
                    {menuItems.map((item, i) => (
                        <motion.button
                            key={i}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => item.path && navigate(item.path)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all hover:bg-muted/30 ${i !== menuItems.length - 1 ? 'border-b border-border/50' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <span className="text-sm font-bold text-foreground">{item.label}</span>
                            </div>

                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </motion.button>
                    ))}
                </div>

                {/* Vehicle Info Card */}
                <div className="mt-8">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground px-2 mb-4">Vehicle Status</h2>
                    <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-xs text-white/60 mb-1">{delivery?.vehicleType || 'Not Set'}</p>
                            <h3 className="text-xl font-bold mb-4">{delivery?.vehicleNumber || 'No Number'}</h3>
                            <div className="flex gap-4">
                                <div className="flex-1 bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
                                    <p className="text-[10px] text-white/60 font-medium">Efficiency</p>
                                    <p className="font-bold">92%</p>
                                </div>
                                <div className="flex-1 bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
                                    <p className="text-[10px] text-white/60 font-medium">Next Service</p>
                                    <p className="font-bold">850 km</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="w-full mt-10 p-4 rounded-2xl bg-rose-50 text-rose-500 font-bold flex items-center justify-center gap-2 border border-rose-100 active:scale-95 transition-all"
                >
                    <LogOut className="w-5 h-5" /> Logout Session
                </button>

                <button
                    onClick={handleDeleteAccount}
                    className="w-full mt-3 p-4 rounded-2xl bg-red-50 text-red-600 font-bold flex items-center justify-center gap-2 border border-red-100 mb-20 active:scale-95 transition-all"
                >
                    <Trash2 className="w-5 h-5" /> Delete Account
                </button>
            </div>
        </div>
    );
};

export default Profile;
