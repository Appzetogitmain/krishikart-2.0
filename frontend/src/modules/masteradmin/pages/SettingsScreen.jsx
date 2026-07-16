import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck,
    Home,
    ChevronRight,
    Save,
    User,
    ChevronDown,
    Activity,
    UserCircle,
    Mail,
    Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

export default function SettingsScreen() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('profile');
    const [adminData, setAdminData] = useState(null);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        mobile: ''
    });
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        const fetchAdminProfile = async () => {
            try {
                const { data } = await api.get('/masteradmin/me');
                setAdminData(data.result);
                setFormData({
                    fullName: data.result.fullName || '',
                    email: data.result.email || '',
                    mobile: data.result.mobile || ''
                });
            } catch (error) {
                console.error("Failed to fetch profile", error);
            }
        };
        fetchAdminProfile();
    }, []);

    const handleProfileChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleUpdateProfile = async () => {
        try {
            const { data } = await api.put('/masteradmin/update', formData);
            alert("Profile Updated Successfully");
            if (data.result) {
                setAdminData(data.result);
                setFormData({
                    fullName: data.result.fullName || '',
                    email: data.result.email || '',
                    mobile: data.result.mobile || ''
                });
            }
        } catch (error) {
            console.error("Update failed", error);
            alert(error.response?.data?.message || "Failed to update profile");
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            alert("New passwords do not match");
            return;
        }
        try {
            await api.post('/masteradmin/change-password', {
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword
            });
            alert("Password Changed Successfully");
            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error("Password change failed", error);
            alert(error.response?.data?.message || "Failed to change password");
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const section = params.get('section');
        if (section) {
            setActiveSection(section);
        }
    }, [location.search]);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    const sections = [
        { id: 'profile', label: 'Identity Protocol', icon: User },
        { id: 'security', label: 'Change Password', icon: ShieldCheck },
    ];

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-20 bg-slate-50 border border-slate-200" />
                <div className="flex gap-4 h-[500px]">
                    <div className="w-1/4 bg-slate-50 border border-slate-200" />
                    <div className="w-3/4 bg-slate-50 border border-slate-200" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 w-full">
            {/* Enterprise Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>System</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">Configuration</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900 whitespace-nowrap">Core Protocol Settings</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 text-white text-[9px] font-black rounded-sm uppercase tracking-widest">
                            <Activity size={12} className="text-emerald-400" />
                            Security Integrity: 100%
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row min-h-[calc(100vh-42px)]">
                {/* Secondary Navigation (Sidebar) */}
                <div className="w-full lg:w-64 bg-white border-r border-slate-200 p-6 space-y-1">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Administrative Scope</h3>
                    {sections.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => {
                                setActiveSection(section.id);
                                navigate(`?section=${section.id}`);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-all",
                                activeSection === section.id
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <section.icon size={14} className={activeSection === section.id ? "text-slate-400" : "text-slate-300"} />
                            {section.label}
                        </button>
                    ))}

                    <div className="pt-8 mt-8 border-t border-slate-100">
                        <div className="bg-slate-50 p-3 rounded-sm border border-slate-200">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] block mb-2">Build Manifest</span>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-slate-900 tabular-nums uppercase">v2.4.8-Enterprise</span>
                                <span className="text-[9px] text-slate-400 font-medium italic">Synchronized 4m ago</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Configuration Interface */}
                <div className="flex-1 p-6 lg:p-12">
                    <motion.div
                        key={activeSection}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl"
                    >
                        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                            <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">{sections.find(s => s.id === activeSection).label}</h2>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Parameter ID: {activeSection.toUpperCase()}_SET</span>
                            </div>

                            <div className="p-8">
                                <AnimatePresence mode="wait">
                                    {activeSection === 'profile' && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                                            <div className="flex items-center gap-8 pb-8 border-b border-slate-100">
                                                <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-sm flex items-center justify-center text-slate-400 relative group overflow-hidden">
                                                    <User size={32} />
                                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Override</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">{formData.fullName || "Master Administrator"}</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">System Governance Level 10</p>
                                                    <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-100 w-fit">
                                                        <ShieldCheck size={12} />
                                                        IDENTITY VERIFIED
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                                <SettingsField
                                                    label="Core Principal"
                                                    name="fullName"
                                                    value={formData.fullName}
                                                    onChange={handleProfileChange}
                                                />
                                                <SettingsField
                                                    label="Primary Signaling Email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleProfileChange}
                                                    isVerified
                                                />
                                                <SettingsField
                                                    label="Emergency Uplink"
                                                    name="mobile"
                                                    value={formData.mobile}
                                                    onChange={handleProfileChange}
                                                />
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeSection === 'security' && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                                <div className="md:col-span-2">
                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-1">Update Credentials</h3>
                                                    <p className="text-[10px] font-medium text-slate-500">Secure your account with a new strong password.</p>
                                                </div>

                                                <SettingsField
                                                    label="Old Password"
                                                    name="oldPassword"
                                                    type="password"
                                                    value={passwordData.oldPassword}
                                                    onChange={handlePasswordChange}
                                                />
                                                <div className="hidden md:block"></div>

                                                <SettingsField
                                                    label="New Password"
                                                    name="newPassword"
                                                    type="password"
                                                    value={passwordData.newPassword}
                                                    onChange={handlePasswordChange}
                                                />
                                                <SettingsField
                                                    label="Confirm Password"
                                                    name="confirmPassword"
                                                    type="password"
                                                    value={passwordData.confirmPassword}
                                                    onChange={handlePasswordChange}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Settings Synchronized // 0 SEC AGO</span>
                                </div>
                                <button
                                    onClick={activeSection === 'profile' ? handleUpdateProfile : handleChangePassword}
                                    className="bg-slate-900 text-white px-6 py-2.5 rounded-sm text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <Save size={14} />
                                    {activeSection === 'profile' ? 'Push Changes' : 'Update Credentials'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

function SettingsField({ label, value, name, onChange, isVerified, type = "text" }) {
    return (
        <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>
            <div className="relative group">
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-sm py-3 px-4 outline-none text-xs font-bold text-slate-900 focus:border-slate-300 transition-all font-sans"
                />
                {isVerified && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                )}
            </div>
        </div>
    );
}


