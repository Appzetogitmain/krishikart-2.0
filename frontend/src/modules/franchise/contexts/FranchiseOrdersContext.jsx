import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { getSocket, joinFranchiseRoom } from '@/lib/socket';
import { useFranchiseAuth } from '@/modules/franchise/contexts/FranchiseAuthContext'; // Need franchise ID
import { useNotificationSound } from '@/hooks/useNotificationSound';

const FranchiseOrdersContext = createContext();

// An order in one of these states is still waiting for the franchise to accept or reject it
const AWAITING_DECISION = ['assigned', 'placed', 'pending', 'new'];

export function FranchiseOrdersProvider({ children }) {
    const { franchise, isAuthenticated } = useFranchiseAuth();
    const [liveOrders, setLiveOrders] = useState([]);
    const [deliveryPartners, setDeliveryPartners] = useState([]);
    const [loading, setLoading] = useState(false);

    // Alert State
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [newOrderData, setNewOrderData] = useState(null);
    const [isProcurementAlertOpen, setIsProcurementAlertOpen] = useState(false);
    const [procurementAlertData, setProcurementAlertData] = useState(null);
    
    const { playNotificationSound, startRinging, stopRinging } = useNotificationSound();
    const knownOrderIdsRef = useRef(new Set());

    // Orders that are ringing until the franchise accepts or rejects them. "Not Now" closes the
    // pop-up but not the ring. seenRef marks ids the server list has confirmed, so an order that
    // simply hasn't reached the list yet isn't dropped by a stale refresh.
    const [ringingOrderIds, setRingingOrderIds] = useState([]);
    const ringSeenRef = useRef(new Set());

    const startRingingFor = (orderId) => {
        if (!orderId) return;
        const id = String(orderId);
        setRingingOrderIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const stopRingingFor = (orderId) => {
        const id = String(orderId);
        ringSeenRef.current.delete(id);
        setRingingOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
    };

    useEffect(() => {
        if (ringingOrderIds.length > 0) startRinging();
        else stopRinging();
    }, [ringingOrderIds.length, startRinging, stopRinging]);

    // Stop ringing for orders that were decided elsewhere (another device, admin, the orders page)
    useEffect(() => {
        if (ringingOrderIds.length === 0) return;
        const byId = new Map(liveOrders.map((o) => [String(o._id), o]));
        const decided = ringingOrderIds.filter((id) => {
            const order = byId.get(id);
            if (!order) return ringSeenRef.current.has(id); // gone from the list after being seen
            ringSeenRef.current.add(id);
            return !AWAITING_DECISION.includes(String(order.orderStatus || '').toLowerCase());
        });
        if (decided.length > 0) decided.forEach(stopRingingFor);
    }, [liveOrders]);

    const fetchOrders = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const response = await api.get('/orders/franchise/all');
            if (response.data.success) {
                const incomingOrders = response.data.results || [];
                const incomingIds = new Set(incomingOrders.map((o) => String(o._id)));
                const knownIds = knownOrderIdsRef.current;

                if (knownIds.size > 0) {
                    const newlyAddedOrder = incomingOrders.find((o) => !knownIds.has(String(o._id)));
                    if (newlyAddedOrder) {
                        setNewOrderData(newlyAddedOrder);
                        setIsAlertOpen(true);
                        const needsDecision =
                            !newlyAddedOrder.franchiseAutoAccepted &&
                            AWAITING_DECISION.includes(String(newlyAddedOrder.orderStatus || '').toLowerCase());
                        if (needsDecision) startRingingFor(newlyAddedOrder._id);
                        else playNotificationSound();
                    }
                }

                knownOrderIdsRef.current = incomingIds;
                setLiveOrders(incomingOrders);
            }
        } catch (error) {
            console.error('Fetch franchise orders error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveryPartners = async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get('/delivery/partners');
            if (response.data.success) {
                setDeliveryPartners(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch delivery partners error:', error);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        
        fetchOrders();
        fetchDeliveryPartners();

        const pollInterval = setInterval(() => {
            fetchOrders();
        }, 30000);

        return () => clearInterval(pollInterval);
    }, [isAuthenticated]);

    useEffect(() => {
        if (!franchise?._id) return;

        const socket = getSocket();
        joinFranchiseRoom();

        const handleNewOrder = (data) => {
            const oid = data?.orderId ?? data?._id;
            setNewOrderData({
                ...data,
                orderId: oid,
                autoAccepted: data?.autoAccepted === true,
                showRejectOnly: data?.showRejectOnly === true,
                franchiseAutoAccepted: data?.franchiseAutoAccepted === true,
            });
            setIsAlertOpen(true);
            const autoAccepted =
                data?.autoAccepted === true || data?.showRejectOnly === true || data?.franchiseAutoAccepted === true;
            if (!autoAccepted && oid) startRingingFor(oid);
            else playNotificationSound();
            fetchOrders(); // Immediate refresh
        };

        const handleProcurementUpdate = (data) => {
            console.log("Procurement Cycle Update Received:", data);
            setProcurementAlertData(data);
            setIsProcurementAlertOpen(true);
            playNotificationSound();

            toast.info(data.title || "Procurement Update", {
                description: data.message || `Status updated to ${data.status?.replace('_', ' ')}`
            });
            // Optional: refresh any relevant procurement list
        };

        const handlePartialFulfillmentApproved = (data) => {
            console.log("Partial Fulfillment Approved:", data);
            toast.success(data.message || "Admin has allowed delivery with available stock!", {
                duration: 8000
            });
            fetchOrders(); // Refresh to get updated order status
        };

        socket.on('new_order', handleNewOrder);
        socket.on('procurement_cycle_update', handleProcurementUpdate);
        socket.on('partial_fulfillment_approved', handlePartialFulfillmentApproved);

        return () => {
            socket.off('new_order', handleNewOrder);
            socket.off('procurement_cycle_update', handleProcurementUpdate);
            socket.off('partial_fulfillment_approved', handlePartialFulfillmentApproved);
        };
    }, [franchise?._id]);

    // Computed combined orders with mapping
    const orders = useMemo(() => {
        return liveOrders.map(o => ({
            id: o._id,
            hotelName: o.userId?.legalEntityName || o.userId?.fullName || o.user?.legalEntityName || o.user?.fullName || 'Guest User',
            hotelImage: (o.items && o.items[0]?.image) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80",
            status: (o.orderStatus || '').toLowerCase(),
            numberOfPackages: Number(o.numberOfPackages) || 0,
            deliveryRefusal: o.deliveryRefusal?.reason ? o.deliveryRefusal : null,
            returnOtpCode: o.returnOtpCode || null,
            total: o.totalAmount,
            items: (Array.isArray(o.items) ? o.items : []).map(i => ({
                id: i.productId || i.product,
                productId: i.productId || i.product,
                name: i.name || 'Unnamed Product',
                image: i.image,
                quantity: i.quantity || 0,
                qty: i.quantity || 0,
                unit: i.unit || 'units',
                price: i.price || 0,
                subtotal: i.subtotal || 0,
                isShortage: i.isShortage || false
            })),
            address: o.userId?.address || o.user?.address || o.shippingAddress || 'Address not provided',
            deliveryTime: "30-45 mins",
            deliverySlot: o.deliveryShift || o.deliverySlot || "Standard",
            paymentMode: o.paymentMethod || "Prepaid",
            timeline: [
                { status: 'Order Placed', time: o.time || 'N/A', completed: true },
                ...(Array.isArray(o.statusHistory) ? o.statusHistory : []).map(h => ({
                    status: h.status,
                    time: h.updatedAt || o.time,
                    completed: true
                }))
            ].sort((a, b) => new Date(a.time) - new Date(b.time)),
            date: o.date,
            time: o.time,
            scheduledDate: o.scheduledDate,
            scheduledDateFormatted: o.scheduledDateFormatted,
            isPreOrder: !!o.isPreOrder,
            franchiseId: o.franchiseId || o.franchise || null,
            franchiseAutoAccepted: !!o.franchiseAutoAccepted,
            allowPartialFulfillment: !!o.allowPartialFulfillment,
            deliveryPartnerId: o.deliveryPartnerId?._id || o.deliveryPartnerId,
            deliveryPartner: o.deliveryPartnerId,
            statusHistory: o.statusHistory || []
        }));
    }, [liveOrders]);

    const updateOrderStatus = async (orderId, newStatus, extraData = {}) => {
        try {
            const response = await api.put(`/orders/franchise/${orderId}/status`, {
                status: newStatus,
                ...extraData
            });
            if (response.data.success) {
                toast.success(`Order status updated to ${newStatus}`);
                stopRingingFor(orderId);
                setLiveOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: newStatus, ...extraData } : o));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Update order status error:', error);
            toast.error(error.response?.data?.message || 'Failed to update status');
            return false;
        }
    };

    const acceptOrder = async (orderId) => {
        try {
            const response = await api.put(`/orders/franchise/${orderId}/accept`);
            if (response.data.success) {
                toast.success('Order accepted successfully');
                stopRingingFor(orderId);
                setLiveOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: 'Accepted' } : o));
                fetchOrders(); // Refresh to get full details from server
                return true;
            }
            return false;
        } catch (error) {
            console.error('Accept order error:', error);
            toast.error(error.response?.data?.message || 'Failed to accept order');
            return false;
        }
    };

    /** Reject auto-assigned order → backend reassigns to next nearest franchise (same category rules). */
    const rejectFranchiseOrder = async (orderId, reason = '') => {
        try {
            const response = await api.put(`/orders/franchise/${orderId}/reject`, { reason });
            if (response.data.success) {
                toast.success(response.data.message || 'Order rejected');
                stopRingingFor(orderId);
                fetchOrders();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Reject franchise order error:', error);
            toast.error(error.response?.data?.message || 'Failed to reject order');
            return false;
        }
    };

    const assignDeliveryPartner = async (orderId, deliveryPartnerId) => {
        try {
            const response = await api.put(`/orders/franchise/${orderId}/assign-delivery`, { deliveryPartnerId });
            if (response.data.success) {
                toast.success('Order dispatched successfully');
                fetchOrders();
                return true;
            }
        } catch (error) {
            console.error('Assign delivery error:', error);
            toast.error(error.response?.data?.message || 'Failed to assign delivery');
            return false;
        }
    };

    const stats = useMemo(() => ({
        todayOrders: orders.length,
        newOrders: orders.filter(o => ['placed', 'pending', 'new', 'procuring', 'assigned', 'accepted'].includes(o.status)).length,
        readyToDispatch: orders.filter(o => ['packed', 'dispatched', 'ready'].includes(o.status)).length,
        outForDelivery: orders.filter(o => ['dispatched'].includes(o.status)).length,
        dispatch: orders.filter(o => ['packed', 'dispatched'].includes(o.status)).length,
        completedCount: orders.filter(o => ['delivered', 'received', 'completed'].includes(o.status)).length,
        scheduledOrders: orders.filter(o => o.isPreOrder && !['delivered', 'received', 'completed', 'cancelled'].includes(o.status)).length,
        revenue: orders.filter(o => ['delivered', 'received', 'completed'].includes(o.status)).reduce((acc, curr) => acc + (curr.total || 0), 0)
    }), [orders]);

    return (
        <FranchiseOrdersContext.Provider value={{
            orders,
            updateOrderStatus,
            acceptOrder,
            rejectFranchiseOrder,
            assignDeliveryPartner,
            deliveryPartners,
            stats,
            loading,
            isAlertOpen,
            setIsAlertOpen,
            newOrderData,
            ringingOrderIds,
            reopenOrderAlert: (orderId) => {
                setNewOrderData((prev) => (String(prev?.orderId ?? prev?._id) === String(orderId) ? prev : { orderId }));
                setIsAlertOpen(true);
            },
            isProcurementAlertOpen,
            setIsProcurementAlertOpen,
            procurementAlertData,
            refreshOrders: fetchOrders,
            refreshPartners: fetchDeliveryPartners,
            fetchOrdersByDate: async (date) => {
                try {
                    const response = await api.get(`/orders/franchise/all?date=${date}`);
                    if (response.data.success) {
                        return response.data.results.map(o => ({
                            id: o._id,
                            hotelName: o.userId?.fullName || o.user?.fullName || 'Guest User',
                            status: (o.orderStatus || '').toLowerCase() || 'new',
                            total: o.totalAmount,
                            items: o.items || [],
                            date: o.date,
                            time: o.time
                        }));
                    }
                    return [];
                } catch (error) {
                    console.error('Fetch history error:', error);
                    return [];
                }
            }
        }}>
            {children}
        </FranchiseOrdersContext.Provider>
    );
}

export function useFranchiseOrders() {
    const context = useContext(FranchiseOrdersContext);
    if (!context) throw new Error('useFranchiseOrders must be used within FranchiseOrdersProvider');
    return context;
}
