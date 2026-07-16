import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { initSocket, joinOrderRoom, joinUserRoom } from '@/lib/socket';
import { UserAuthContext } from './UserAuthContext';

const OrderContext = createContext();

// Toast messages for each status transition
const getStatusToastMessage = (status, orderId) => {
    const shortId = orderId ? `#${String(orderId).slice(-6).toUpperCase()}` : '';
    switch ((status || '').toLowerCase()) {
        case 'accepted':
            return { msg: `Your order ${shortId} has been accepted!`, type: 'info' };
        case 'packed':
            return { msg: `Your order ${shortId} is packed and ready! 📦`, type: 'info' };
        case 'dispatched':
            return { msg: `Your order ${shortId} is on the way! 🚚`, type: 'success' };
        case 'out for delivery':
            return { msg: `Your order ${shortId} is out for delivery! 🚚`, type: 'success' };
        case 'delivered':
            return { msg: `Your order ${shortId} has been delivered! ✅`, type: 'success' };
        case 'received':
            return { msg: `Order ${shortId} marked as received. Thank you!`, type: 'success' };
        case 'cancelled':
            return { msg: `Your order ${shortId} has been cancelled.`, type: 'error' };
        case 'procuring':
            return { msg: `Your order ${shortId} is being procured.`, type: 'info' };
        default:
            return null;
    }
};

export function OrderProvider({ children }) {
    const authContext = useContext(UserAuthContext);
    const isAuthenticated = authContext?.isAuthenticated || false;
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const pollingIntervalRef = useRef(null);

    const fetchMyOrders = useCallback(async () => {
        const token = localStorage.getItem('userToken');
        const path = window.location.pathname;

        // Skip fetching if no user token or if we are in different module apps
        if (!token ||
            path.includes('/masteradmin') ||
            path.includes('/vendor') ||
            path.includes('/franchise') ||
            path.includes('/delivery')
        ) return;

        setIsLoading(true);
        try {
            const response = await api.get('/orders/my-orders');
            if (response.data.success) {
                // Backend handleResponse returns 'results' for arrays and 'result' for objects
                setOrders(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error("Fetch orders error:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Sync a single order by ID (called on socket events)
    const syncOrderById = useCallback(async (orderId, newStatus, customMessage) => {
        if (!orderId) return;
        try {
            const response = await api.get(`/orders/${orderId}`);
            if (response.data.success && response.data.result) {
                const updatedOrder = response.data.result;
                setOrders((prev) => {
                    const exists = prev.some((order) => order._id === orderId);
                    if (exists) {
                        return prev.map((order) => (order._id === orderId ? updatedOrder : order));
                    }
                    return [updatedOrder, ...prev];
                });

                // Show toast notification with "View Order" action
                if (newStatus || customMessage) {
                    const toastData = customMessage 
                        ? { msg: customMessage, type: 'info' }
                        : getStatusToastMessage(newStatus, orderId);
                        
                    if (toastData) {
                        const toastFn = toastData.type === 'error' ? toast.error
                            : toastData.type === 'success' ? toast.success
                            : toast.info;

                        toastFn(toastData.msg, {
                            duration: 6000,
                            action: {
                                label: 'View Order →',
                                onClick: () => {
                                    window.location.href = `/#/order-detail/${orderId}`;
                                },
                            },
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Sync order by id error:', error);
        }
    }, []);

    // Sync orders when authentication state changes
    useEffect(() => {
        if (isAuthenticated) {
            fetchMyOrders();
        } else {
            setOrders([]);
        }
    }, [isAuthenticated, fetchMyOrders]);

    // Background polling fallback — runs every 60 seconds when logged in
    useEffect(() => {
        if (!isAuthenticated) return;

        pollingIntervalRef.current = setInterval(() => {
            fetchMyOrders();
        }, 60000); // 60 seconds

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [isAuthenticated, fetchMyOrders]);

    // Global socket listeners — runs when user becomes authenticated
    useEffect(() => {
        if (!isAuthenticated) return;

        const socket = initSocket();

        // Join the user-specific room immediately
        joinUserRoom();

        const onReturnRequestReviewed = async (payload) => {
            if (!payload?.orderId) return;
            if (payload?.action === 'reject') {
                toast.error('Your return request has been rejected.', {
                    duration: 6000,
                    action: {
                        label: 'View Order →',
                        onClick: () => { window.location.href = `/#/order-detail/${payload.orderId}`; },
                    },
                });
            } else if (payload?.action === 'approve') {
                toast.success('Your return request has been approved! ✅', {
                    duration: 6000,
                    action: {
                        label: 'View Order →',
                        onClick: () => { window.location.href = `/#/order-detail/${payload.orderId}`; },
                    },
                });
            }
            await fetchMyOrders();
        };

        const onOrderStatusChanged = async (payload) => {
            if (!payload?.orderId) return;
            await syncOrderById(payload.orderId, payload.status, payload.message);
        };

        const onOrderRejectedByStore = async (payload) => {
            if (!payload?.orderId) return;
            toast.error(payload.message || 'Your order was rejected by the originally assigned store.', {
                duration: 8000,
                action: {
                    label: 'View Order →',
                    onClick: () => { window.location.href = `/#/order-detail/${payload.orderId}`; },
                },
            });
            await syncOrderById(payload.orderId, payload.status);
        };

        const onReturnPickupStatusUpdated = async (payload) => {
            if (!payload?.orderId) return;
            await syncOrderById(payload.orderId);
        };

        // Re-join all rooms after a socket reconnection (handles network drops)
        const onReconnect = () => {
            joinUserRoom();
            setOrders((currentOrders) => {
                currentOrders.forEach((order) => {
                    if (order?._id) joinOrderRoom(order._id);
                });
                return currentOrders;
            });
        };

        socket.on('return_request_reviewed', onReturnRequestReviewed);
        socket.on('order_status_changed', onOrderStatusChanged);
        socket.on('order_rejected_by_store', onOrderRejectedByStore);
        socket.on('return_pickup_status_updated', onReturnPickupStatusUpdated);
        socket.on('reconnect', onReconnect);

        return () => {
            socket.off('return_request_reviewed', onReturnRequestReviewed);
            socket.off('order_status_changed', onOrderStatusChanged);
            socket.off('order_rejected_by_store', onOrderRejectedByStore);
            socket.off('return_pickup_status_updated', onReturnPickupStatusUpdated);
            socket.off('reconnect', onReconnect);
        };
    }, [isAuthenticated, fetchMyOrders, syncOrderById]);

    // Join order rooms whenever the orders list changes
    useEffect(() => {
        if (!isAuthenticated || !orders?.length) return;
        orders.forEach((order) => {
            if (order?._id) joinOrderRoom(order._id);
        });
    }, [isAuthenticated, orders]);

    const placeOrder = async (orderData) => {
        try {
            const response = await api.post('/orders/place', {
                shippingAddress: orderData.shippingAddress,
                shippingLocation: orderData.shippingLocation || null,
                paymentMethod: orderData.paymentMethod,
                deliveryShift: orderData.deliveryShift,
                scheduledDate: orderData.scheduledDate,
                isPreOrder: orderData.isPreOrder,
                couponCode: orderData.couponCode || '',
                discountAmount: orderData.discountAmount || 0,
                donationAmount: orderData.donationAmount || 0,
            });

            if (response.data.success) {
                const result = response.data.result;
                const placedOrders = Array.isArray(result?.orders)
                    ? result.orders
                    : result?.order
                      ? [result.order]
                      : result?._id
                        ? [result]
                        : [];
                if (placedOrders.length) {
                    setOrders((prev) => [...placedOrders, ...prev]);
                    // Join socket rooms for newly placed orders immediately
                    placedOrders.forEach((order) => {
                        if (order?._id) joinOrderRoom(order._id);
                    });
                }
                return {
                    success: true,
                    orders: placedOrders,
                    order: placedOrders[0] ?? null,
                    orderGroupId: result?.orderGroupId ?? null,
                    grandTotal: result?.grandTotal,
                };
            } else {
                toast.error(response.data.message || "Failed to place order");
                return { success: false, message: response.data.message };
            }
        } catch (error) {
            console.error("Place order error:", error);
            const msg = error.response?.data?.message || "Something went wrong";
            toast.error(msg);
            return { success: false, message: msg };
        }
    };

    const getOrderById = async (id) => {
        try {
            const response = await api.get(`/orders/${id}`);
            return response.data.result;
        } catch (error) {
            console.error("Get order error:", error);
            return null;
        }
    };

    const updateOrderStatus = async (orderId, status, additionalData = {}) => {
        try {
            const response = await api.put(`/orders/${orderId}/status`, { status });
            if (response.data.success) {
                const updatedOrder = response.data.result;
                setOrders(prev => prev.map(order =>
                    order._id === orderId ? updatedOrder : order
                ));
                return { success: true };
            }
        } catch (error) {
            console.error("Update order status error:", error);
            const msg = error.response?.data?.message || "Failed to update status";
            toast.error(msg);
            return { success: false, message: msg };
        }
    };

    const requestReturn = async (orderId, payload) => {
        try {
            const response = await api.post(`/orders/${orderId}/return-request`, payload);
            if (response.data.success) {
                const updatedOrder = response.data.result;
                setOrders(prev => prev.map(order =>
                    order._id === orderId ? updatedOrder : order
                ));
                return { success: true, order: updatedOrder };
            }
            const msg = response.data.message || "Failed to submit return request";
            toast.error(msg);
            return { success: false, message: msg };
        } catch (error) {
            console.error("Request return error:", error);
            const msg = error.response?.data?.message || "Failed to submit return request";
            toast.error(msg);
            return { success: false, message: msg };
        }
    };

    return (
        <OrderContext.Provider value={{ orders, placeOrder, updateOrderStatus, requestReturn, getOrderById, isLoading, fetchMyOrders, syncOrderById }}>
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (!context) {
        throw new Error('useOrders must be used within an OrderProvider');
    }
    return context;
}
