import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deliveryConstraints, setDeliveryConstraints] = useState({
        baseFee: 40,
        freeMov: 500,
        tax: 5,
        platformFee: 2
    });

    // Fetch cart on mount if token exists
    const fetchCart = async () => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');
        const path = (window.location.hash ? window.location.hash.replace(/^#/, '') : window.location.pathname).toLowerCase();

        // Skip if no token or if on auth/separate module pages
        if (!token ||
            ['/', '/login', '/verification'].includes(path) ||
            path.includes('/masteradmin') ||
            path.includes('/franchise') ||
            path.includes('/vendor') ||
            path.includes('/delivery')
        ) return;

        try {
            const response = await api.get('/user/cart');
            if (response.data.success) {
                // Map API response to context structure
                const items = (response.data.result?.items || [])
                    .filter(item => item.productId) // Guard against null productId
                    .map(item => ({
                        ...item.productId,
                        quantity: item.quantity,
                        id: item.productId._id // Ensure compatibility
                    }));
                setCartItems(items);
            }
        } catch (error) {
            console.error("Fetch cart error:", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await api.get('/catalog/settings');
            const settingsArray = response.data.results || response.data.result || [];

            if (Array.isArray(settingsArray)) {
                const deliverySetting = settingsArray.find(s => s.key === 'delivery_constraints');
                if (deliverySetting && deliverySetting.value) {
                    setDeliveryConstraints(deliverySetting.value);
                }
            }
        } catch (error) {
            console.error("Fetch settings error:", error);
        }
    };

    useEffect(() => {
        fetchCart();
        fetchSettings();
    }, []);

    const getPriceForQuantity = (product, quantity) => {
        const base = Number(product.effectiveStorefrontPrice ?? product.price ?? 0);
        if (!product.bulkPricing) return base;
        const applicableBulk = [...product.bulkPricing]
            .reverse()
            .find(b => quantity >= b.minQty);
        return applicableBulk ? applicableBulk.price : base;
    };

    const addToCart = async (product, quantity = 1) => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');

        // Optimistic local update
        setCartItems((prevItems) => {
            const existingItem = prevItems.find((item) => item.id === product._id || item.id === product.id);
            if (existingItem) {
                return prevItems.map((item) =>
                    (item.id === product._id || item.id === product.id)
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prevItems, { ...product, id: product._id || product.id, quantity }];
        });

        if (token) {
            try {
                await api.post('/user/cart/add', { productId: product._id || product.id, quantity });
                fetchCart(); // Sync with backend to be safe
            } catch (error) {
                console.error("API add to cart error:", error);
                toast.error("Failed to sync cart with server");
            }
        }
    };

    const removeFromCart = async (productId) => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');

        setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));

        if (token) {
            try {
                await api.delete(`/user/cart/remove/${productId}`);
            } catch (error) {
                console.error("API remove from cart error:", error);
            }
        }
    };

    const updateQuantity = async (productId, delta) => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');

        let newQty = 1;
        setCartItems((prevItems) => {
            const updated = prevItems.map((item) => {
                if (item.id === productId) {
                    newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0);
            return updated;
        });

        if (token) {
            try {
                await api.put('/user/cart/update', { productId, quantity: newQty });
            } catch (error) {
                console.error("API update quantity error:", error);
            }
        }
    };

    const setQuantity = async (productId, quantity) => {
        const token = localStorage.getItem('userToken') || localStorage.getItem('token');
        const targetQty = Math.max(0, parseInt(quantity) || 0);

        setCartItems((prevItems) =>
            prevItems.map((item) => {
                if (item.id === productId) {
                    return { ...item, quantity: targetQty };
                }
                return item;
            }).filter(item => item.quantity > 0)
        );

        if (token && targetQty >= 0) {
            try {
                await api.put('/user/cart/update', { productId, quantity: targetQty });
            } catch (error) {
                console.error("API set quantity error:", error);
            }
        }
    };

    const clearCart = () => setCartItems([]);

    const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

    const cartTotal = useMemo(() => {
        return cartItems.reduce((total, item) => {
            const activePrice = getPriceForQuantity(item, item.quantity);
            return total + (activePrice * item.quantity);
        }, 0);
    }, [cartItems]);

    const getActivePrice = (item) => getPriceForQuantity(item, item.quantity);

    return (
        <CartContext.Provider
            value={{
                cartItems,
                addToCart,
                removeFromCart,
                updateQuantity,
                setQuantity,
                clearCart,
                cartCount,
                cartTotal,
                getActivePrice,
                fetchCart,
                isLoading,
                deliveryConstraints
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
