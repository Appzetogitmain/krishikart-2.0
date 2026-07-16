import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useVendorAuth } from './VendorAuthContext';

const VendorInventoryContext = createContext();

export const VendorInventoryProvider = ({ children }) => {
    const { vendor } = useVendorAuth();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const response = await api.get('/vendor/inventory');
            if (response.data.success) {
                const results = response.data.results || [];
                // Map the results to flatten the productId structure for easier use in components
                const mappedResults = (results || [])
                    .filter(item => item.productId)
                    .map(item => ({
                        id: item.productId?._id,
                        name: item.productId?.name,
                        category: item.productId?.category?.name || 'General',
                        quantity: item.currentStock,
                        available: item.available,
                        price: item.productId?.price,
                        image: item.productId?.primaryImage || (item.productId?.images?.[0]) || '',
                        unit: item.productId?.unit || 'kg'
                    }));
                setInventory(mappedResults);
            }
        } catch (error) {
            console.error("Failed to fetch vendor inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (vendor) {
            fetchInventory();
        } else {
            setInventory([]);
            setLoading(false);
        }
    }, [vendor]);

    const updateStock = async (productId, stock) => {
        try {
            const response = await api.put('/vendor/inventory/stock', { productId, stock });
            if (response.data.success) {
                toast.success('Stock updated successfully');
                await fetchInventory();
                return true;
            }
        } catch (error) {
            console.error("Update stock error:", error);
            toast.error(error.response?.data?.message || 'Failed to update stock');
            return false;
        }
    };

    const toggleAvailability = async (productId) => {
        try {
            const response = await api.put('/vendor/inventory/toggle-availability', { productId });
            if (response.data.success) {
                toast.success(response.data.message);
                await fetchInventory();
                return true;
            }
        } catch (error) {
            console.error("Toggle availability error:", error);
            toast.error(error.response?.data?.message || 'Failed to toggle availability');
            return false;
        }
    };

    return (
        <VendorInventoryContext.Provider value={{
            inventory,
            loading,
            updateStock,
            toggleAvailability,
            refreshInventory: fetchInventory
        }}>
            {children}
        </VendorInventoryContext.Provider>
    );
};

export const useVendorInventory = () => {
    const context = useContext(VendorInventoryContext);
    if (!context) throw new Error('useVendorInventory must be used within VendorInventoryProvider');
    return context;
};
