import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useFCM } from '@/hooks/useFCM';

const FranchiseAuthContext = createContext();

export function FranchiseAuthProvider({ children }) {
    const normalizeToken = (t) => {
        if (!t) return null;
        let s = String(t).trim();
        // If something stored the token as JSON string (with quotes), strip them.
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1).trim();
        }
        return s || null;
    };

    const [token, setToken] = useState(() => normalizeToken(localStorage.getItem('franchiseToken')));
    const [franchise, setFranchise] = useState(() => {
        const savedData = localStorage.getItem('franchiseData');
        const savedToken = localStorage.getItem('franchiseToken');
        if (!savedToken) return null;
        try {
            return savedData ? JSON.parse(savedData) : null;
        } catch (e) {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    // Register FCM Token
    useFCM(!!token, 'franchise');

    useEffect(() => {
        const loadUser = async () => {
            const storedToken = normalizeToken(localStorage.getItem('franchiseToken'));
            setToken(storedToken);
            if (!storedToken) {
                setLoading(false);
                return;
            }
            try {
                // Explicit token so session restores reliably on refresh (no interceptor timing issues)
                const { data } = await api.get('/franchise/me', {
                    headers: { Authorization: `Bearer ${storedToken}` },
                });
                if (data?.result) {
                    setFranchise(data.result);
                    localStorage.setItem('franchiseData', JSON.stringify(data.result));
                }
            } catch (error) {
                console.error("Failed to load franchise profile", error);
                if (error.response?.status === 401) {
                    setFranchise(null);
                    setLoading(false);
                    localStorage.removeItem('franchiseToken');
                    localStorage.removeItem('franchiseData');
                    setToken(null);
                    window.location.href = '/#/franchise/login';
                    return;
                }
                // Non-401 errors (network/server) should NOT force logout.
                // Keep existing token + cached franchiseData so refresh doesn't bounce to login.
            }
            setLoading(false);
        };
        loadUser();

        const handleStorageChange = (e) => {
            if (e.key === 'franchiseToken' && !e.newValue) {
                logout();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const loginSuccess = (data, token) => {
        const normalized = normalizeToken(token);
        setFranchise(data);
        setToken(normalized);
        if (normalized) localStorage.setItem('franchiseToken', normalized);
        localStorage.setItem('franchiseData', JSON.stringify(data));
    };

    const updateProfile = async (data) => {
        try {
            const response = await api.put('/franchise/update', data);
            const updated = response.data.result;
            setFranchise(updated);
            localStorage.setItem('franchiseData', JSON.stringify(updated));
            return { success: true };
        } catch (error) {
            console.error("Update profile failed", error);
            throw error;
        }
    };

    const updatePassword = async (oldPassword, newPassword) => {
        try {
            await api.post('/franchise/change-password', { oldPassword, newPassword });
            return { success: true };
        } catch (error) {
            console.error("Update password failed", error);
            throw error;
        }
    };

    const logout = () => {
        setFranchise(null);
        setToken(null);
        localStorage.removeItem('franchiseToken');
        localStorage.removeItem('franchiseData');
        localStorage.removeItem('kk_franchise'); // Cleanup old
        window.location.href = '/#/franchise/login';
    };

    return (
        <FranchiseAuthContext.Provider value={{
            franchise,
            loginSuccess,
            logout,
            updateProfile,
            updatePassword,
            // Auth should be based on JWT presence; profile may still be loading/refetching.
            isAuthenticated: !!token,
            loading,
            /** When false, franchise UI should only allow Documentation until admin approves the franchise. */
            isFranchiseVerified: !!franchise?.isVerified,
        }}>
            {children}
        </FranchiseAuthContext.Provider>
    );
}

export function useFranchiseAuth() {
    const context = useContext(FranchiseAuthContext);
    return context;
}
