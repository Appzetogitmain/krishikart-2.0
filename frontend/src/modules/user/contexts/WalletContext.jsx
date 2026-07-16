import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserAuthContext } from './UserAuthContext';
import api from '@/lib/axios';

const WalletContext = createContext();

export function WalletProvider({ children }) {
    const [balance, setBalance] = useState(0);
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [creditLimit, setCreditLimit] = useState(0);
    const [creditUsed, setCreditUsed] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loyaltyConfig, setLoyaltyConfig] = useState({
        awardRate: 5,
        redemptionRate: 10,
        minRedeemPoints: 100
    });

    const [isLoading, setIsLoading] = useState(false);
    const auth = useContext(UserAuthContext);
    const user = auth?.user;

    const syncWalletFromUser = useCallback((userData) => {
        if (!userData) return;
        setBalance(userData.walletBalance || 0);
        setCreditLimit(userData.creditLimit || 0);
        setCreditUsed(userData.usedCredit || userData.creditUsed || 0);
        setLoyaltyPoints(userData.loyaltyPoints || 0);
        const txns = (userData.walletTransactions || []).map((txn, idx) => ({
            id: txn.txnId || `TXN-${idx}`,
            type: txn.type || 'Added',
            amount: Number(txn.amount || 0),
            date: txn.createdAt
                ? new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A',
            status: txn.status || 'Success'
        }));
        setTransactions(txns);
    }, []);

    // Sync wallet data whenever the global user profile updates
    useEffect(() => {
        if (user) syncWalletFromUser(user);
    }, [user, syncWalletFromUser]);

    const fetchWalletData = useCallback(async () => {
        const token = localStorage.getItem('userToken');
        const path = (window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname).toLowerCase();

        if (!token ||
            ['/', '/login', '/verification'].includes(path) ||
            path.includes('/masteradmin') ||
            path.includes('/franchise') ||
            path.includes('/vendor') ||
            path.includes('/delivery')
        ) return;

        setIsLoading(true);
        try {
            const settingsRes = await api.get('/masteradmin/public-settings');
            const settings = settingsRes.data?.results || settingsRes.data?.result || [];

            if (Array.isArray(settings)) {
                const loyaltySetting = settings.find((s) => s.key === 'loyalty_config');
                if (loyaltySetting?.value && typeof loyaltySetting.value === 'object') {
                    setLoyaltyConfig((prev) => ({ ...prev, ...loyaltySetting.value }));
                }
            }
        } catch (error) {
            console.error('Failed to fetch wallet data config:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWalletData();
    }, [fetchWalletData]);

    const updateLoyaltyConfig = useCallback((newConfig) => {
        setLoyaltyConfig(prev => ({ ...prev, ...newConfig }));
    }, []);

    const addLoyaltyPoints = useCallback((points) => {
        setLoyaltyPoints(prev => prev + points);
        const newTxn = {
            id: `LYT-${Math.floor(1000 + Math.random() * 9000)}`,
            type: 'Loyalty Bonus',
            amount: points,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: 'Success'
        };
        setTransactions(prev => [newTxn, ...prev]);
    }, []);

    const redeemLoyaltyPoints = useCallback(async (points) => {
        try {
            const response = await api.post('/user/wallet/redeem-loyalty', { points });
            if (response.data?.success) {
                syncWalletFromUser(response.data.result || {});
                return true;
            }
            return false;
        } catch (error) {
            console.error('Redeem loyalty points failed:', error);
            return false;
        }
    }, [syncWalletFromUser]);

    const loadRazorpay = useCallback(() => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }, []);

    const addMoney = useCallback(async (amount) => {
        try {
            const value = Number(amount || 0);
            if (!Number.isFinite(value) || value <= 0) return { success: false, message: 'Invalid amount' };

            const sdkLoaded = await loadRazorpay();
            if (!sdkLoaded) return { success: false, message: 'Razorpay SDK failed to load' };

            const createRes = await api.post('/user/wallet/recharge/create-order', { amount: value });
            if (!createRes.data?.success || !createRes.data?.result?.id) {
                return { success: false, message: createRes.data?.message || 'Failed to create recharge order' };
            }
            const order = createRes.data.result;

            const prefill = user ? {
                name: user.fullName || '',
                email: user.email || '',
                contact: user.mobile || ''
            } : {};

            return await new Promise((resolve) => {
                const paymentObject = new window.Razorpay({
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    amount: order.amount,
                    currency: order.currency || 'INR',
                    name: 'Kisaankart',
                    description: 'Wallet Recharge',
                    order_id: order.id,
                    prefill,
                    theme: { color: '#00b894' },
                    handler: async (response) => {
                        try {
                            const verifyRes = await api.post('/user/wallet/recharge/verify', response);
                            if (verifyRes.data?.success) {
                                syncWalletFromUser(verifyRes.data.result || {});
                                resolve({ success: true, message: verifyRes.data?.message || 'Wallet recharged successfully' });
                                return;
                            }
                            resolve({ success: false, message: verifyRes.data?.message || 'Payment verification failed' });
                        } catch (verifyError) {
                            resolve({ success: false, message: 'Payment verification failed' });
                        }
                    },
                    modal: { ondismiss: () => resolve({ success: false, message: 'Payment cancelled' }) }
                });
                paymentObject.open();
            });
        } catch (error) {
            return { success: false, message: error?.response?.data?.message || 'Wallet recharge failed' };
        }
    }, [user, loadRazorpay, syncWalletFromUser]);

    const repayCredit = useCallback(async () => {
        try {
            const sdkLoaded = await loadRazorpay();
            if (!sdkLoaded) return { success: false, message: 'Razorpay SDK failed to load' };

            const createRes = await api.post('/user/wallet/repay-credit/create-order');
            if (!createRes.data?.success || !createRes.data?.result?.id) {
                return { success: false, message: createRes.data?.message || 'Failed to initialize payment' };
            }
            const order = createRes.data.result;

            const prefill = user ? {
                name: user.fullName || '',
                email: user.email || '',
                contact: user.mobile || ''
            } : {};

            return await new Promise((resolve) => {
                const paymentObject = new window.Razorpay({
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    amount: order.amount,
                    currency: order.currency || 'INR',
                    name: 'Kisaankart',
                    description: 'KK Credit Repayment',
                    order_id: order.id,
                    prefill,
                    theme: { color: '#ef4444' },
                    handler: async (response) => {
                        try {
                            const verifyRes = await api.post('/user/wallet/repay-credit/verify', response);
                            if (verifyRes.data?.success) {
                                syncWalletFromUser(verifyRes.data.result || {});
                                resolve({ success: true, message: 'Credit balance cleared!' });
                                window.location.reload(); 
                                return;
                            }
                            resolve({ success: false, message: 'Payment verification failed' });
                        } catch (err) {
                            resolve({ success: false, message: 'Payment verification failed' });
                        }
                    },
                    modal: { ondismiss: () => resolve({ success: false, message: 'Payment cancelled' }) }
                });
                paymentObject.open();
            });
        } catch (error) {
            return { success: false, message: 'Repayment failed' };
        }
    }, [user, loadRazorpay, syncWalletFromUser]);

    const payWithWallet = useCallback((amount) => {
        if (balance >= amount) {
            const newTxn = {
                id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
                type: 'Paid',
                amount: amount,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: 'Success'
            };
            setBalance(prev => prev - amount);
            setTransactions(prev => [newTxn, ...prev]);
            return true;
        }
        return false;
    }, [balance]);

    const availableCredit = Math.max(0, creditLimit - creditUsed);

    const useCreditAmount = useCallback((amount) => {
        const value = Number(amount || 0);
        if (!Number.isFinite(value) || value <= 0 || availableCredit < value) return false;

        const newTxn = {
            id: `CRD-${Math.floor(1000 + Math.random() * 9000)}`,
            type: 'Credit Used',
            amount: value,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: 'Success'
        };

        setCreditUsed(prev => prev + value);
        setTransactions(prev => [newTxn, ...prev]);
        return true;
    }, [availableCredit]);

    const value = useMemo(() => ({
        balance,
        transactions,
        addMoney,
        repayCredit,
        payWithWallet,
        useCreditAmount,
        creditLimit,
        creditUsed,
        availableCredit,
        loyaltyPoints,
        addLoyaltyPoints,
        redeemLoyaltyPoints,
        loyaltyConfig,
        updateLoyaltyConfig,
        fetchWalletData,
        isLoading
    }), [
        balance,
        transactions,
        addMoney,
        repayCredit,
        payWithWallet,
        useCreditAmount,
        creditLimit,
        creditUsed,
        availableCredit,
        loyaltyPoints,
        addLoyaltyPoints,
        redeemLoyaltyPoints,
        loyaltyConfig,
        updateLoyaltyConfig,
        fetchWalletData,
        isLoading
    ]);

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider >
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
