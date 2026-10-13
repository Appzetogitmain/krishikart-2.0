import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext';

const ProcurementContext = createContext();

export const ProcurementProvider = ({ children }) => {
    const { isAuthenticated } = useFranchiseAuth();
    const [procurementRequests, setProcurementRequests] = useState([]);
    const [cart, setCart] = useState(() => {
        const savedCart = localStorage.getItem('procurementCart');
        return savedCart ? JSON.parse(savedCart) : {};
    });

    useEffect(() => {
        localStorage.setItem('procurementCart', JSON.stringify(cart));
    }, [cart]);

    const clearCart = () => setCart({});

    const addRequest = async (request) => {
        try {
            const response = await api.post('/procurement/franchise/create', request);
            if (response.data.success) {
                // Single document comes back as `result` (not `results`)
                const created = response.data.result;
                if (created) {
                    setProcurementRequests(prev => [created, ...prev]);
                }
                return created;
            }
        } catch (error) {
            console.error('Failed to create procurement request:', error);
            throw error;
        }
    };

    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [requestsError, setRequestsError] = useState('');

    const fetchRequests = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingRequests(true);
        setRequestsError('');
        try {
            const response = await api.get('/procurement/franchise/my-requests');
            if (response.data.success) {
                setProcurementRequests(response.data.results || []);
            }
        } catch (error) {
            console.error('Failed to fetch procurement requests:', error);
            setRequestsError(error.response?.data?.message || 'Could not load your procurement requests');
        } finally {
            setIsLoadingRequests(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchRequests();
        } else {
            setProcurementRequests([]);
        }
    }, [isAuthenticated]);

    const updateRequestStatus = (id, status, extraData = {}) => {
        // Optimistic update, ideally should call API
        setProcurementRequests(prev => prev.map(req =>
            req._id === id ? { ...req, status, ...extraData } : req
        ));
    };

    return (
        <ProcurementContext.Provider value={{
            procurementRequests,
            fetchRequests,
            isLoadingRequests,
            requestsError,
            cart,
            setCart,
            clearCart,
            addRequest,
            updateRequestStatus
        }}>
            {children}
        </ProcurementContext.Provider>
    );
};

export const useProcurement = () => {
    const context = useContext(ProcurementContext);
    if (!context) throw new Error('useProcurement must be used within ProcurementProvider');
    return context;
};
