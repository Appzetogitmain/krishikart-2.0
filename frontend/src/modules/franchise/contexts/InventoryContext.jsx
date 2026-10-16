import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/axios';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext';

const InventoryContext = React.createContext();

export const InventoryProvider = ({ children }) => {
    const { isAuthenticated } = useFranchiseAuth();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInventory = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const response = await api.get('/franchise/inventory');
            if (response.data.success && Array.isArray(response.data.results)) {
                const mappedInventory = response.data.results.map(item => ({
                    id: item.id || item.productId?._id,
                    productId: item.productId?._id,
                    name: item.productId?.name || 'Unknown Product',
                    currentStock: Math.max(0, Number(item.currentStock) || 0),
                    mbq: item.mbq,
                    // Selling price at this store as set by admin (store price / city rate / main rate)
                    price: item.sellingPrice ?? item.productId?.price ?? 0,
                    mainPrice: item.productId?.price || 0,
                    priceZoneCode: item.priceZoneCode || null,
                    bestPrice: item.productId?.bestPrice || 0,
                    comparePrice: item.sellingComparePrice ?? item.productId?.comparePrice ?? 0,
                    image: item.productId?.primaryImage || (item.productId?.images?.[0]) || '',
                    unit: item.productId?.unit || 'kg',
                    unitValue: item.productId?.unitValue || 1,
                    dietaryType: item.productId?.dietaryType || 'none',
                    category: item.productId?.category?.name || 'General',
                    showOnPOS: item.productId?.showOnPOS !== undefined ? item.productId?.showOnPOS : true,
                    lastUpdated: item.lastUpdated
                }));
                setInventory(mappedInventory);
            } else {
                setInventory([]);
            }
        } catch (error) {
            console.error("Failed to fetch inventory from server:", error);
            setInventory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchInventory();
        } else {
            setInventory([]);
        }
    }, [isAuthenticated]);

    const getLowStockItems = () => {
        return inventory.filter(item => item.currentStock <= item.mbq);
    };

    const getStockStats = () => {
        const totalItems = inventory.length;
        const healthyCount = inventory.filter(item => item.currentStock > item.mbq).length;
        const lowStockCount = getLowStockItems().length;
        const outOfStockCount = inventory.filter(item => item.currentStock === 0).length;
        const totalValue = inventory.reduce((sum, item) => sum + (item.currentStock * (item.price || 0)), 0);

        return {
            totalItems,
            healthyCount,
            lowStockCount,
            outOfStockCount,
            totalValue,
            healthPercentage: totalItems > 0 ? Math.round((healthyCount / totalItems) * 100) : 100
        };
    };

    const categories = Array.from(new Set(inventory.map(item => item.category)));

    const updateStock = (productId, newStock) => {
        const clamped = Math.max(0, Number(newStock) || 0);
        setInventory(prev => prev.map(item => {
            const id = item.id?.toString?.() || item.productId?.toString?.();
            if (id === productId?.toString?.()) {
                return { ...item, currentStock: clamped };
            }
            return item;
        }));
    };

    return (
        <InventoryContext.Provider value={{
            inventory,
            categories,
            loading,
            getLowStockItems,
            getStockStats,
            refreshInventory: fetchInventory,
            updateStock
        }}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) throw new Error('useInventory must be used within InventoryProvider');
    return context;
};
