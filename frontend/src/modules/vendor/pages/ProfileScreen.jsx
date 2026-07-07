import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Settings,
    Bell,
    Shield,
    LogOut,
    ChevronRight,
    Camera,
    Trash2,
    Globe,
    Store,
    Smartphone,
    CreditCard,
    FileCheck,
    Award,
    Activity,
    ShieldCheck,
    HelpCircle,
    X,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import DocumentUploadCard from '../components/DocumentUploadCard';
import VendorBackBar from '../components/navigation/VendorBackBar';
import api from '../../../lib/axios';
import { useVendorAuth } from '../contexts/VendorAuthContext';

const SettingItem = ({ icon: Icon, label, value, color, onClick }) => (
    <button
        onClick={onClick}
        className="w-full bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:shadow-slate-200/40 transition-all active:scale-[0.98]"
    >
        <div className="flex items-center gap-4">
            <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm",
                color === 'blue' ? "bg-blue-50 text-blue-600 shadow-blue-100" :
                    color === 'primary' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100" :
                        color === 'amber' ? "bg-amber-50 text-amber-600 shadow-amber-100" :
                            color === 'purple' ? "bg-purple-50 text-purple-600 shadow-purple-100" :
                                "bg-slate-50 text-slate-500 shadow-slate-100"
            )}>
                <Icon size={20} />
            </div>
            <div className="text-left">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none mb-1.5">{label}</p>
                <p className="text-[13px] font-black text-slate-900 tracking-tight">{value}</p>
            </div>
        </div>
        <ChevronRight size={18} className="text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
    </button>
);

const EditProfileModal = ({ isOpen, onClose, vendorData, onUpdate }) => {
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([
        ...(vendorData?.servedCategories?.map(c => (c && typeof c === 'object') ? c._id : c).filter(Boolean) || []),
        ...(vendorData?.requestedCategories?.map(c => (c && typeof c === 'object') ? c._id : c).filter(Boolean) || [])
    ]);
    const [formData, setFormData] = useState({
        fullName: vendorData?.fullName || '',
        mobile: vendorData?.mobile || '',
        farmLocation: vendorData?.farmLocation || '',
        fssaiLicense: vendorData?.fssaiLicense || '',
        bankAccountHolderName: vendorData?.bankDetails?.accountHolderName || '',
        bankAccountNumber: vendorData?.bankDetails?.accountNumber || '',
        bankIfscCode: vendorData?.bankDetails?.ifscCode || '',
        bankName: vendorData?.bankDetails?.bankName || '',
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.get('/catalog/categories');
                if (response.data?.success) {
                    setCategories(response.data.results || []);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen]);

    const toggleCategory = (catId) => {
        setSelectedCategories(prev => 
            prev.includes(catId) 
                ? prev.filter(id => id !== catId)
                : [...prev, catId]
        );
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'fullName' || name === 'bankAccountHolderName') {
            const lettersAndSpacesOnly = value.replace(/[^A-Za-z\s]/g, '');
            setFormData({ ...formData, [name]: lettersAndSpacesOnly });
            return;
        }
        if (name === 'bankAccountNumber') {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 16);
            setFormData({ ...formData, [name]: digitsOnly });
            return;
        }
        if (name === 'bankName') {
            const lettersAndSpacesOnly = value.replace(/[^A-Za-z\s]/g, '');
            setFormData({ ...formData, [name]: lettersAndSpacesOnly });
            return;
        }
        if (name === 'bankIfscCode') {
            const upper = value.toUpperCase();
            let result = '';
            for (let i = 0; i < upper.length && result.length < 11; i++) {
                const ch = upper[i];
                const pos = result.length;
                if (pos < 4) {
                    // Positions 0-3: alphabets only
                    if (/[A-Z]/.test(ch)) result += ch;
                } else if (pos === 4) {
                    // Position 4: only '0'
                    if (ch === '0') result += ch;
                } else {
                    // Positions 5-10: digits only
                    if (/[0-9]/.test(ch)) result += ch;
                }
            }
            setFormData({ ...formData, [name]: result });
            return;
        }
        if (name === 'fssaiLicense') {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 14);
            setFormData({ ...formData, [name]: digitsOnly });
            return;
        }
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const accNo = (formData.bankAccountNumber || '').trim();
        if (accNo && (accNo.length < 9 || accNo.length > 16)) {
            alert('Account number must be 9 to 16 digits (Indian bank standards).');
            return;
        }
        const ifsc = (formData.bankIfscCode || '').trim();
        if (ifsc && !/^[A-Z]{4}0\d{6}$/.test(ifsc)) {
            alert('Invalid IFSC code. Format: 4 letters, then 0, then 6 digits (e.g. HDFC0001234).');
            return;
        }
        const fssai = (formData.fssaiLicense || '').trim();
        if (fssai && !/^\d{14}$/.test(fssai)) {
            alert('FSSAI License must be exactly 14 digits.');
            return;
        }
        setIsLoading(true);
        try {
            const updateData = new FormData();
            updateData.append('fullName', formData.fullName);
            updateData.append('mobile', formData.mobile);
            updateData.append('farmLocation', formData.farmLocation);
            updateData.append('fssaiLicense', formData.fssaiLicense);

            const bankDetails = {
                accountHolderName: formData.bankAccountHolderName,
                accountNumber: formData.bankAccountNumber,
                ifscCode: formData.bankIfscCode,
                bankName: formData.bankName
            };
            updateData.append('bankDetails', JSON.stringify(bankDetails));
            updateData.append('servedCategories', JSON.stringify(selectedCategories));

            await onUpdate(updateData);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-900">Edit Profile</h2>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input name="fullName" value={formData.fullName} onChange={handleChange} pattern="[A-Za-z\s]+" title="Only alphabets and spaces allowed" placeholder="Full Name" className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile</label>
                        <input name="mobile" value={formData.mobile} onChange={handleChange} className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                        <input name="farmLocation" value={formData.farmLocation} onChange={handleChange} className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FSSAI License</label>
                        <input name="fssaiLicense" type="tel" inputMode="numeric" value={formData.fssaiLicense} onChange={handleChange} maxLength={14} placeholder="14-digit number" pattern="[0-9]*" title="Exactly 14 digits only" className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-3">Bank Details</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank Name</label>
                                <input name="bankName" value={formData.bankName} onChange={handleChange} placeholder="Letters only" className="w-full bg-slate-50 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20" pattern="[A-Za-z\s]*" title="Letters and spaces only" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Name</label>
                                <input name="bankAccountHolderName" value={formData.bankAccountHolderName} onChange={handleChange} pattern="[A-Za-z\s]+" title="Only alphabets and spaces allowed" placeholder="Name on Passbook" className="w-full bg-slate-50 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Account No.</label>
                                <input
                                    name="bankAccountNumber"
                                    type="tel"
                                    inputMode="numeric"
                                    value={formData.bankAccountNumber}
                                    onChange={handleChange}
                                    maxLength={16}
                                    placeholder="9–16 digits"
                                    className="w-full bg-slate-50 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    title="Indian bank account: 9 to 16 digits"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">IFSC</label>
                                <input name="bankIfscCode" value={formData.bankIfscCode} onChange={handleChange} maxLength={11} placeholder="HDFC0001234" pattern="[A-Z]{4}0[A-Z0-9]{6}" title="4 letters, 0, 6 alphanumeric (e.g. HDFC0001234)" className="w-full bg-slate-50 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 uppercase" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Served Categories</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {categories.map((cat) => {
                                const catId = cat._id;
                                const isInitiallyServed = vendorData?.servedCategories?.some(
                                    c => ((c && typeof c === 'object') ? c._id : c) === catId
                                );
                                const isInitiallyRequested = vendorData?.requestedCategories?.some(
                                    c => ((c && typeof c === 'object') ? c._id : c) === catId
                                );
                                const isSelected = selectedCategories.includes(catId);

                                let btnClass = "bg-slate-50 border-slate-100 text-slate-400";
                                let badgeText = "";

                                if (isSelected) {
                                    if (isInitiallyServed) {
                                        btnClass = "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700";
                                        badgeText = " ✓ Active";
                                    } else if (isInitiallyRequested) {
                                        btnClass = "bg-amber-50 border-amber-300 text-amber-700 border-dashed hover:bg-amber-100/50";
                                        badgeText = " ⏳ Pending";
                                    } else {
                                        btnClass = "bg-slate-900 border-slate-900 text-white hover:bg-slate-800";
                                        badgeText = " ➕ Request";
                                    }
                                }

                                return (
                                    <button
                                        key={catId}
                                        type="button"
                                        onClick={() => toggleCategory(catId)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border-2 flex items-center gap-1",
                                            btnClass
                                        )}
                                    >
                                        {cat.name}
                                        {badgeText && <span className="opacity-80 text-[8px] font-black tracking-normal">{badgeText}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black mt-4 hover:bg-primary transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Save Changes'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await api.post('/vendor/change-password', passwords);
            alert('Password changed successfully');
            onClose();
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to change password');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-900">Change Password</h2>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="password" name="currentPassword" placeholder="Current Password" value={passwords.currentPassword} onChange={handleChange} className="w-full bg-slate-50 rounded-xl p-4 font-bold outline-none" required />
                    <input type="password" name="newPassword" placeholder="New Password" value={passwords.newPassword} onChange={handleChange} className="w-full bg-slate-50 rounded-xl p-4 font-bold outline-none" required />
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" value={passwords.confirmPassword} onChange={handleChange} className="w-full bg-slate-50 rounded-xl p-4 font-bold outline-none" required />
                    <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black mt-2 hover:bg-primary transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Update Password'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default function ProfileScreen() {
    const { logout } = useVendorAuth();
    const navigate = useNavigate();

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
            try {
                await api.delete('/vendor/delete-account');
                alert("Account deleted successfully.");
                logout();
            } catch (error) {
                console.error("Failed to delete account", error);
                alert(error.response?.data?.message || "Failed to delete account. Please try again.");
            }
        }
    };

    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchVendorProfile();
    }, []);

    const fetchVendorProfile = async () => {
        try {
            const { data } = await api.get('/vendor/me');
            setVendor(data.result);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            if (error.response?.status === 401) {
                logout();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (formData) => {
        try {
            const { data } = await api.put('/vendor/update', formData, {
                headers: { 'Content-Type': null }
            });
            setVendor(data.result);
            localStorage.setItem('vendorData', JSON.stringify(data.result));
            alert('Profile updated successfully!');
            return data.result;
        } catch (error) {
            console.error('Update failed:', error);
            alert(error.response?.data?.message || 'Failed to update profile');
            throw error;
        }
    };

    const handleProfilePictureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profilePicture', file);

        try {
            await handleProfileUpdate(formData);
        } catch (error) {
            alert('Failed to update profile picture');
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;
    }

    if (!vendor) return null;

    return (
        <div className="space-y-8 pb-32">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                    <VendorBackBar className="mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Sovereign Identity</p>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Identity Suite</h1>
                    </div>
                </div>
                <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 self-start shrink-0">
                    <ShieldCheck size={10} className="text-emerald-400" />
                    Verified Node
                </div>
            </header>

            {/* Premium Profile Card */}
            <div className="bg-slate-900 rounded-[44px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200 group">
                {/* Background Textures */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -z-0 group-hover:bg-primary/30 transition-colors" />
                <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full -z-0" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="relative mb-6 group/avatar cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="w-28 h-28 rounded-[36px] bg-white p-1.5 overflow-hidden shadow-2xl shadow-black/20"
                        >
                            <img
                                src={vendor.profilePicture || "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&auto=format&fit=crop&q=60"}
                                className="w-full h-full object-cover rounded-[32px]"
                                alt="Profile"
                            />
                        </motion.div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/20 rounded-[36px]">
                            <Camera size={24} className="text-white drop-shadow-lg" />
                        </div>
                        <button className="absolute -bottom-1 -right-1 w-10 h-10 bg-white text-slate-900 rounded-2xl flex items-center justify-center border-4 border-slate-900 shadow-xl hover:scale-110 transition-transform pointer-events-none">
                            <Camera size={18} />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleProfilePictureUpload} className="hidden" accept="image/*" />
                    </div>

                    <h2 className="text-2xl font-black tracking-tight mb-1">{vendor.fullName}</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{vendor.email}</span>
                        {/* <Award size={12} className="text-amber-400" /> */}
                    </div>
                    <p className="text-slate-400 text-xs font-bold mt-1">{vendor.mobile}</p>

                    <div className="w-full mt-10 flex justify-center">
                        <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 text-center w-1/2">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Location</p>
                            <p className="text-sm font-black text-white tracking-widest truncate">{vendor.farmLocation || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Sections */}
            <div className="space-y-10">
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Identity Documents</h3>
                        {/* <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-100">
                            <ShieldCheck size={10} /> Fully Attested
                        </div> */}
                    </div>
                    {/* Display uploaded documents status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DocumentUploadCard title="Aadhar Card" icon={User} status={vendor.aadharCard ? "verified" : "pending"} url={vendor.aadharCard} fieldName="aadharFile" onUpload={handleProfileUpdate} />
                        <DocumentUploadCard title="PAN Card" icon={CreditCard} status={vendor.panCard ? "verified" : "pending"} url={vendor.panCard} fieldName="panFile" onUpload={handleProfileUpdate} />
                        <DocumentUploadCard title="Shop Proof" icon={Store} status={vendor.shopEstablishmentProof ? "verified" : "pending"} url={vendor.shopEstablishmentProof} fieldName="shopProofFile" onUpload={handleProfileUpdate} />
                        <DocumentUploadCard title="FSSAI License" icon={FileCheck} status={vendor.fssaiLicense ? "verified" : "pending"} url={vendor.fssaiLicense} fieldName="fssaiLicense" onUpload={handleProfileUpdate} />
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-4 ml-2">
                        <Award size={14} className="text-slate-400" />
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Served Categories</h3>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        {((vendor.servedCategories && vendor.servedCategories.length > 0) || (vendor.requestedCategories && vendor.requestedCategories.length > 0)) ? (
                            <div className="flex flex-wrap gap-2">
                                {vendor.servedCategories?.map(cat => {
                                    const name = (cat && typeof cat === 'object') ? cat.name : cat;
                                    return (
                                        <span key={(cat?._id || cat)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            {name}
                                        </span>
                                    );
                                })}
                                {vendor.requestedCategories?.map(cat => {
                                    const name = (cat && typeof cat === 'object') ? cat.name : cat;
                                    return (
                                        <span key={(cat?._id || cat)} className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-dashed border-amber-300 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            {name} (Pending Approval)
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider py-2">No categories assigned or requested yet.</p>
                        )}
                    </div>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center gap-2 mb-4 ml-2">
                        <Activity size={14} className="text-slate-400" />
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Account Management</h3>
                    </div>
                    <SettingItem icon={User} label="Profile Details" value="Edit Personal Info" color="blue" onClick={() => setIsEditModalOpen(true)} />
                    <SettingItem icon={Shield} label="Security" value="Change Password" color="slate" onClick={() => setIsPasswordModalOpen(true)} />
                    <SettingItem icon={HelpCircle} label="Help & Support" value="FAQs & Protocols" color="purple" onClick={() => navigate('/vendor/help-support')} />
                    {/* <SettingItem icon={Globe} label="Marketplace Engine" value="Global Store Visibility" color="primary" onClick={() => navigate('/vendor/preview')} /> */}
                </section>

                <div className="pt-8 space-y-4">
                    <button
                        onClick={logout}
                        className="w-full bg-white text-red-500 py-6 rounded-[36px] font-black text-sm flex items-center justify-center gap-3 border border-red-50 hover:bg-red-50 transition-all active:scale-[0.98] shadow-sm hover:shadow-red-100/50"
                    >
                        Logout
                        <LogOut size={18} />
                    </button>

                    <button
                        onClick={handleDeleteAccount}
                        className="w-full bg-red-50 text-red-600 py-6 rounded-[36px] font-black text-sm flex items-center justify-center gap-3 border border-red-100 hover:bg-red-100/50 transition-all active:scale-[0.98] shadow-sm hover:shadow-red-200/50"
                    >
                        Delete Account
                        <Trash2 size={18} />
                    </button>

                    <div className="text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] leading-none">Powered by Kisaankart Ledger v1.0</p>
                        <p className="text-[9px] font-bold text-slate-200 mt-2">DEPLOYMENT_NODE: PROD-MUM-882</p>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isEditModalOpen && (
                    <EditProfileModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        vendorData={vendor}
                        onUpdate={handleProfileUpdate}
                    />
                )}
                {isPasswordModalOpen && (
                    <ChangePasswordModal
                        isOpen={isPasswordModalOpen}
                        onClose={() => setIsPasswordModalOpen(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
