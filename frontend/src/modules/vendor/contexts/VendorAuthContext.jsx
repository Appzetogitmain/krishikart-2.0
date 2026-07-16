import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { getSocket, joinVendorRoom } from '@/lib/socket';
import { useFCM } from '@/hooks/useFCM';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from 'sonner';


const VendorAuthContext = createContext();

export function VendorAuthProvider({ children }) {
    const [vendor, setVendor] = useState(() => {
        const savedData = localStorage.getItem('vendorData');
        const savedToken = localStorage.getItem('vendorToken');
        if (!savedToken) return null;
        try {
            return savedData ? JSON.parse(savedData) : null;
        } catch (e) {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    // Alert State
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [newAssignmentData, setNewAssignmentData] = useState(null);
    const [isStatusAlertOpen, setIsStatusAlertOpen] = useState(false);
    const [statusAlertData, setStatusAlertData] = useState(null);

    // Register FCM Token
    useFCM(!!vendor, 'vendor');

    const { playNotificationSound } = useNotificationSound();

    useEffect(() => {
        const loadVendor = async () => {
            const token = localStorage.getItem('vendorToken');
            if (token) {
                try {
                    const response = await api.get('/vendor/me');
                    if (response.data.success) {
                        setVendor(response.data.result);
                        localStorage.setItem('vendorData', JSON.stringify(response.data.result));
                    }
                } catch (error) {
                    console.error("Failed to load vendor profile", error);
                    if (error.response?.status === 401) {
                        logout();
                    }
                }
            }
            setLoading(false);
        };
        loadVendor();

        const handleStorageChange = (e) => {
            if (e.key === 'vendorToken' && !e.newValue) {
                logout();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Socket Setup
    useEffect(() => {
        if (vendor?._id) {
            // Join secured vendor room using JWT (handled inside helper)
            joinVendorRoom();
            const socket = getSocket();

            const handleNewAssignment = (data) => {
                setNewAssignmentData(data);
                setIsAlertOpen(true);
                playNotificationSound();
                toast.success('New Order Assigned!', {
                    description: `You have received a new procurement request #${data.requestId?.toString().slice(-6).toUpperCase()}`,
                    action: {
                        label: 'View Order',
                        onClick: () => window.location.href = `/#/vendor/orders/${data.requestId}`
                    },
                    duration: 10000
                });
            };

            const handleProcurementUpdate = (data) => {
                console.log("Procurement Update Received for Vendor:", data);
                setStatusAlertData(data);
                setIsStatusAlertOpen(true);
                playNotificationSound();
                toast.info(data.message || "Procurement status updated");
            };

            socket.on('new_assignment', handleNewAssignment);
            socket.on('procurement_update', handleProcurementUpdate);
            
            return () => {
                socket.off('new_assignment', handleNewAssignment);
                socket.off('procurement_update', handleProcurementUpdate);
            };
        }
    }, [vendor]);

    const loginSuccess = (data, token) => {
        setVendor(data);
        localStorage.setItem('vendorToken', token);
        localStorage.setItem('vendorData', JSON.stringify(data));
    };

    const logout = () => {
        setVendor(null);
        localStorage.removeItem('vendorToken');
        localStorage.removeItem('vendorData');
        window.location.href = '/#/vendor/login';
    };

    return (
        <VendorAuthContext.Provider value={{
            vendor,
            loginSuccess,
            logout,
            isAuthenticated: !!vendor,
            loading,
            isAlertOpen,
            setIsAlertOpen,
            newAssignmentData,
            isStatusAlertOpen,
            setIsStatusAlertOpen,
            statusAlertData,
            playNotificationSound
        }}>
            {loading ? (
                <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                    <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialising Secure Session...</p>
                </div>
            ) : children}
        </VendorAuthContext.Provider>
    );
}

export function useVendorAuth() {
    const context = useContext(VendorAuthContext);
    if (!context) throw new Error('useVendorAuth must be used within VendorAuthProvider');
    return context;
}
