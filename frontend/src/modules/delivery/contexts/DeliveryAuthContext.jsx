import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useFCM } from '@/hooks/useFCM';

const DeliveryAuthContext = createContext();

export function DeliveryAuthProvider({ children }) {
    const normalizeToken = (t) => {
        if (!t) return null;
        let s = String(t).trim();
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1).trim();
        }
        return s || null;
    };

    const [token, setToken] = useState(() => normalizeToken(localStorage.getItem('deliveryToken')));
    const [delivery, setDelivery] = useState(() => {
        const saved = localStorage.getItem('deliveryData');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(true);

    // Register FCM Token
    useFCM(!!token, 'delivery');

    useEffect(() => {
        const loadUser = async () => {
            const storedToken = normalizeToken(localStorage.getItem('deliveryToken'));
            setToken(storedToken);
            if (storedToken) {
                try {
                    // Explicit token avoids any interceptor timing/context issues on refresh
                    const { data } = await api.get('/delivery/me', {
                        headers: { Authorization: `Bearer ${storedToken}` },
                    });
                    setDelivery(data.result);
                    localStorage.setItem('deliveryData', JSON.stringify(data.result));
                } catch (error) {
                    console.error("Failed to load delivery profile", error);
                    if (error.response?.status === 401) {
                        setDelivery(null);
                        setToken(null);
                        localStorage.removeItem('deliveryToken');
                        localStorage.removeItem('deliveryData');
                        window.location.href = '/#/delivery/login';
                        return;
                    }
                    // Non-401 errors should NOT force logout; keep token for refresh stability.
                }
            }
            setLoading(false);
        };
        loadUser();

        const handleStorageChange = (e) => {
            if (e.key === 'deliveryToken' && !e.newValue) {
                logout();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const loginSuccess = (data, token) => {
        const normalized = normalizeToken(token);
        setDelivery(data);
        setToken(normalized);
        if (normalized) localStorage.setItem('deliveryToken', normalized);
        localStorage.setItem('deliveryData', JSON.stringify(data));
    };

    const logout = () => {
        setDelivery(null);
        setToken(null);
        localStorage.removeItem('deliveryToken');
        localStorage.removeItem('deliveryData');
        window.location.href = '/#/delivery/login';
    };

    return (
        <DeliveryAuthContext.Provider value={{
            delivery,
            setDelivery,
            loginSuccess,
            logout,
            isAuthenticated: !!token,
            loading
        }}>
            {children}
        </DeliveryAuthContext.Provider>
    );
}

export function useDeliveryAuth() {
    const context = useContext(DeliveryAuthContext);
    if (!context) throw new Error('useDeliveryAuth must be used within DeliveryAuthProvider');
    return context;
}
