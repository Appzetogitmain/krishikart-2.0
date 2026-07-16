import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useFCM } from '@/hooks/useFCM';

export const UserAuthContext = createContext();

export function UserAuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const savedData = localStorage.getItem('userData');
        const savedToken = localStorage.getItem('userToken');
        if (!savedToken) return null;
        try {
            return savedData ? JSON.parse(savedData) : null;
        } catch (e) {
            return null;
        }
    });

    const [loading, setLoading] = useState(true);

    // Register FCM Token
    useFCM(!!user, 'user');

    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem('userToken');
            if (token) {
                try {
                    const response = await api.get('/user/me');
                    if (response.data.success) {
                        setUser(response.data.result);
                        localStorage.setItem('userData', JSON.stringify(response.data.result));
                    }
                } catch (error) {
                    console.error("Failed to load user profile", error);
                    if (error.response?.status === 401) {
                        logout();
                    }
                }
            }
            setLoading(false);
        };
        loadUser();

        // Listen for storage changes (token cleared from another tab)
        const handleStorageChange = (e) => {
            if (e.key === 'userToken' && !e.newValue) {
                logout();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const loginSuccess = async (userData, token) => {
        localStorage.setItem('userToken', token);
        localStorage.setItem('userData', JSON.stringify(userData));
        setUser(userData);
        
        try {
            const response = await api.get('/user/me');
            if (response.data.success) {
                const fullUser = response.data.result;
                setUser(fullUser);
                localStorage.setItem('userData', JSON.stringify(fullUser));
            }
        } catch (error) {
            console.error("Failed to load user profile on login success", error);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('kk_onboarding_completed');
        localStorage.removeItem('kk_business_type');
        
        // Clear location data on logout
        localStorage.removeItem('kk_franchise_location');
        localStorage.removeItem('kk_franchise_address');
        localStorage.removeItem('kk_franchise_location_pinned');
        localStorage.removeItem('kk_delivery_location');
        localStorage.removeItem('kk_delivery_address');
        localStorage.removeItem('kk_delivery_address_components');
        localStorage.removeItem('kk_delivery_location_pinned');
        localStorage.removeItem('kk_location_declined');

        window.location.href = '/#/login';
    };

    return (
        <UserAuthContext.Provider value={{
            user,
            loginSuccess,
            logout,
            isAuthenticated: !!user,
            loading
        }}>
            {children}
        </UserAuthContext.Provider>
    );
}

export function useUserAuth() {
    const context = useContext(UserAuthContext);
    if (!context) throw new Error('useUserAuth must be used within UserAuthProvider');
    return context;
}
