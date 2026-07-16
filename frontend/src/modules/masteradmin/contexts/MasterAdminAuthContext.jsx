import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useFCM } from '@/hooks/useFCM';
import { getSocket, joinAdminDeliveryTracking } from '@/lib/socket';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from 'sonner';

const MasterAdminAuthContext = createContext();

export function MasterAdminAuthProvider({ children }) {
    const [admin, setAdmin] = useState(() => {
        const savedData = localStorage.getItem('masterAdminData');
        const savedToken = localStorage.getItem('masterAdminToken');
        if (!savedToken) return null;
        try {
            return savedData ? JSON.parse(savedData) : null;
        } catch (e) {
            console.error("Error parsing masterAdminData", e);
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    // Register FCM Token
    useFCM(!!admin, 'masteradmin');

    useEffect(() => {
        const loadAdmin = async () => {
            const token = localStorage.getItem('masterAdminToken');
            if (token) {
                try {
                    const response = await api.get('/masteradmin/me');
                    if (response.data.success) {
                        setAdmin(response.data.result);
                        localStorage.setItem('masterAdminData', JSON.stringify(response.data.result));
                    }
                } catch (error) {
                    console.error("Failed to load admin profile", error);
                    if (error.response?.status === 401) {
                        logout();
                    }
                }
            }
            setLoading(false);
        };
        loadAdmin();

        const handleStorageChange = (e) => {
            if (e.key === 'masterAdminToken' && !e.newValue) {
                logout();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const loginSuccess = (data, token) => {
        setAdmin(data);
        localStorage.setItem('masterAdminToken', token);
        localStorage.setItem('masterAdminData', JSON.stringify(data));
    };

    const logout = () => {
        setAdmin(null);
        localStorage.removeItem('masterAdminToken');
        localStorage.removeItem('masterAdminData');
    };

    // Socket Setup for Admin Notifications
    const { playNotificationSound } = useNotificationSound();

    useEffect(() => {
        if (admin) {
            joinAdminDeliveryTracking();
            const socket = getSocket();

            const handleNewProcurement = (data) => {
                playNotificationSound();
                toast.success('New Procurement Request', {
                    description: data.message || 'A new procurement request has arrived.',
                    duration: 10000,
                    action: {
                        label: 'View',
                        onClick: () => window.location.href = '/#/masteradmin/assignment'
                    }
                });
            };

            const handleNewVendor = (data) => {
                playNotificationSound();
                toast.info('New Vendor Registration', {
                    description: data.message || 'A new vendor is pending approval.',
                    duration: 10000,
                    action: {
                        label: 'Review',
                        onClick: () => window.location.href = '/#/masteradmin/approvals?type=vendor'
                    }
                });
            };

            const handleNewFranchise = (data) => {
                playNotificationSound();
                toast.info('New Franchise Registration', {
                    description: data.message || 'A new franchise is pending approval.',
                    duration: 10000,
                    action: {
                        label: 'Review',
                        onClick: () => window.location.href = '/#/masteradmin/approvals?type=franchise'
                    }
                });
            };

            socket.on('new_procurement_request', handleNewProcurement);
            socket.on('new_vendor_signup', handleNewVendor);
            socket.on('new_franchise_signup', handleNewFranchise);

            return () => {
                socket.off('new_procurement_request', handleNewProcurement);
                socket.off('new_vendor_signup', handleNewVendor);
                socket.off('new_franchise_signup', handleNewFranchise);
            };
        }
    }, [admin, playNotificationSound]);

    const hasPermission = (permissionKey) => {
        if (!admin) return false;

        // Root access for super/master roles
        const role = admin.role?.toLowerCase();
        if (role === 'superadmin' || role === 'masteradmin') return true;

        // Essential access for all authenticated staff
        if (permissionKey === 'dashboard' || !permissionKey) return true;

        // Role-based permission check
        if (role === 'subadmin') {
            const perms = admin.permissions || [];
            return perms.includes(permissionKey);
        }

        return false;
    };

    return (
        <MasterAdminAuthContext.Provider value={{
            admin,
            loginSuccess,
            logout,
            isAuthenticated: !!admin,
            isSuperAdmin: admin?.role === 'superadmin' || admin?.role === 'masteradmin',
            hasPermission,
            loading
        }}>
            {children}
        </MasterAdminAuthContext.Provider>
    );
}

export function useMasterAdminAuth() {
    const context = useContext(MasterAdminAuthContext);
    if (!context) throw new Error('useMasterAdminAuth must be used within MasterAdminAuthProvider');
    return context;
}
