import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '@/lib/axios';
import { useUserAuth } from './UserAuthContext';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
    const { isAuthenticated } = useUserAuth();
    const [wishlistItems, setWishlistItems] = useState([]);
    const hasFetchedRef = useRef(false);

    const loadWishlistFromStorage = () => {
        const saved = localStorage.getItem('kk_wishlist');
        setWishlistItems(saved ? JSON.parse(saved) : []);
    };

    const fetchWishlist = async () => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');
        const path = (window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname).toLowerCase();

        if (!token ||
            ['/', '/login', '/verification'].includes(path) ||
            path.includes('/masteradmin') ||
            path.includes('/franchise') ||
            path.includes('/vendor') ||
            path.includes('/delivery')
        ) {
            loadWishlistFromStorage();
            return;
        }

        try {
            const response = await api.get('/user/wishlist');
            if (response.data.success) {
                const items = (response.data.result?.products || [])
                    .filter(p => p) // Guard against nulls
                    .map(p => ({
                        ...p,
                        id: p._id // Ensure compatibility
                    }));
                setWishlistItems(items);
                localStorage.setItem('kk_wishlist', JSON.stringify(items));
            }
        } catch (error) {
            if (import.meta.env.DEV && error?.response?.status !== 500) {
                console.warn('Fetch wishlist fallback:', error?.message || error);
            }
            loadWishlistFromStorage();
        }
    };

    useEffect(() => {
        fetchWishlist();
    }, [isAuthenticated]);

    const toggleWishlist = async (product) => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');
        const productId = product._id || product.id;

        // Optimistic update
        setWishlistItems((prev) => {
            const isExist = prev.find((item) => (item._id || item.id) === productId);
            let newItems;
            if (isExist) {
                newItems = prev.filter((item) => (item._id || item.id) !== productId);
            } else {
                newItems = [...prev, { ...product, id: productId, _id: productId }];
            }
            localStorage.setItem('kk_wishlist', JSON.stringify(newItems));
            return newItems;
        });

        if (token) {
            try {
                const response = await api.post('/user/wishlist/toggle', { productId });
                if (response.data.success) {
                    const items = (response.data.result?.products || [])
                        .filter(p => p)
                        .map(p => ({
                            ...p,
                            id: p._id
                        }));
                    setWishlistItems(items);
                    localStorage.setItem('kk_wishlist', JSON.stringify(items));
                }
            } catch (error) {
                console.error("Toggle wishlist API error:", error);
                // Revert on error or fetch fresh
                fetchWishlist();
            }
        }
    };

    const isWishlisted = (productId) => {
        return wishlistItems.some((item) => (item._id || item.id) === productId);
    };

    const wishlistCount = wishlistItems.length;

    return (
        <WishlistContext.Provider
            value={{
                wishlistItems,
                toggleWishlist,
                isWishlisted,
                wishlistCount,
                fetchWishlist
            }}
        >
            {children}
        </WishlistContext.Provider>
    );
}

export function useWishlist() {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error('useWishlist must be used within a WishlistProvider');
    }
    return context;
}
