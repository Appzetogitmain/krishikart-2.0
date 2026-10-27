import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { getSocket, joinDeliveryRoom } from '@/lib/socket';
import { useDeliveryAuth } from './DeliveryAuthContext';
import { useNotificationSound } from '@/hooks/useNotificationSound';

const DeliveryOrderContext = createContext();

export function DeliveryOrderProvider({ children }) {
    const { delivery } = useDeliveryAuth();
    const [dispatchedOrders, setDispatchedOrders] = useState([]);
    const [returnPickups, setReturnPickups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeDeliveryId, setActiveDeliveryIdState] = useState(() => localStorage.getItem('activeDeliveryId'));

    const setActiveDeliveryId = (id) => {
        if (id) {
            stopRingingFor(id); // accepting a task ends its ring
            localStorage.setItem('activeDeliveryId', id);
        } else {
            localStorage.removeItem('activeDeliveryId');
        }
        setActiveDeliveryIdState(id);
    };

    const availableRequests = useMemo(() => {
        return dispatchedOrders.filter(o => o.id !== activeDeliveryId);
    }, [dispatchedOrders, activeDeliveryId]);

    // Alert State
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [newTaskData, setNewTaskData] = useState(null);

    const { playNotificationSound, startRinging, stopRinging } = useNotificationSound();

    // Delivery tasks that ring until the partner accepts or rejects them. Closing the pop-up does
    // not stop the ring. seenRef marks ids the server list has confirmed, so a task that hasn't
    // reached the list yet isn't dropped by a stale refresh.
    const [ringingTaskIds, setRingingTaskIds] = useState([]);
    const ringSeenRef = useRef(new Set());
    const taskInfoRef = useRef({}); // orderId -> details sent with the new-task alert

    const startRingingFor = (orderId) => {
        if (!orderId) return;
        const id = String(orderId);
        setRingingTaskIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    function stopRingingFor(orderId) {
        const id = String(orderId);
        ringSeenRef.current.delete(id);
        setRingingTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
    }

    useEffect(() => {
        if (ringingTaskIds.length > 0) startRinging();
        else stopRinging();
    }, [ringingTaskIds.length, startRinging, stopRinging]);

    // Stop ringing for tasks that left the list (rejected, cancelled, reassigned) or were accepted
    useEffect(() => {
        if (ringingTaskIds.length === 0) return;
        const present = new Set(dispatchedOrders.map((o) => String(o.id)));
        ringingTaskIds.forEach((id) => {
            if (present.has(id)) ringSeenRef.current.add(id);
            const gone = !present.has(id) && ringSeenRef.current.has(id);
            if (gone || id === String(activeDeliveryId)) stopRingingFor(id);
        });
    }, [dispatchedOrders]);

    const fetchDispatchedOrders = async () => {
        setLoading(true);
        try {
            const response = await api.get('/orders/delivery/dispatched');
            if (response.data.success) {
                setDispatchedOrders(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch dispatched orders error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReturnPickups = async () => {
        try {
            const response = await api.get('/orders/delivery/return-pickups');
            if (response.data.success) {
                setReturnPickups(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch return pickups error:', error);
        }
    };

    const updateStatus = async (orderId, newStatus, extra = {}) => {
        try {
            const response = await api.put(`/orders/delivery/${orderId}/status`, { status: newStatus, ...extra });
            if (response.data.success) {
                toast.success(`Status updated to ${newStatus}`);
                fetchDispatchedOrders();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Update status error:', error);
            toast.error(error.response?.data?.message || 'Failed to update status');
            fetchDispatchedOrders(); // the list on screen may be stale
            return false;
        }
    };

    const updateReturnStatus = async (orderId, requestIndex, newStatus) => {
        try {
            const response = await api.put(`/orders/delivery/return-pickups/${orderId}/${requestIndex}/status`, { status: newStatus });
            if (response.data.success) {
                toast.success(`Return status updated`);
                fetchReturnPickups();
            }
        } catch (error) {
            console.error('Update return status error:', error);
            toast.error(error.response?.data?.message || 'Failed to update return status');
        }
    };

    // The customer did not accept the order at the door
    const refuseAtDoor = async (orderId, reason, note = '') => {
        try {
            const response = await api.put(`/orders/delivery/${orderId}/refused-at-door`, { reason, note });
            if (response.data.success) {
                toast.success('Order marked as not accepted. Please bring the goods back to the franchise.');
                fetchDispatchedOrders();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Refuse at door error:', error);
            toast.error(error.response?.data?.message || 'Could not update the order');
            fetchDispatchedOrders();
            return false;
        }
    };

    const rejectTask = async (orderId) => {
        try {
            const response = await api.put(`/orders/delivery/${orderId}/reject`);
            if (response.data.success) {
                toast.success(`Task rejected`);
                stopRingingFor(orderId);
                fetchDispatchedOrders();
            }
        } catch (error) {
            console.error('Reject task error:', error);
            toast.error(error.response?.data?.message || 'Failed to reject task');
        }
    };

    useEffect(() => {
        if (delivery?._id) {
            const socket = getSocket();
            const syncDeliveryTasks = () => {
                joinDeliveryRoom(delivery._id);
                fetchDispatchedOrders();
                fetchReturnPickups();
            };

            const handleNewTask = (data) => {
                if (data?.orderId) taskInfoRef.current[String(data.orderId)] = data;
                setNewTaskData(data);
                setIsAlertOpen(true);
                // Delivery tasks can be accepted or rejected, so they ring until one happens.
                // Return pickups have no such step and get a single chime.
                if (data?.type !== 'RETURN' && data?.orderId) startRingingFor(data.orderId);
                else playNotificationSound();
                toast.success("New delivery task assigned!");
                fetchDispatchedOrders();
                fetchReturnPickups();
            };

            // The franchise checked the cash this partner handed over
            const handleCashReviewed = (data) => {
                playNotificationSound();
                const amount = `₹${Math.round(Number(data?.amount) || 0).toLocaleString('en-IN')}`;
                if (data?.status === 'rejected') {
                    toast.error(`${data?.franchiseName || 'The franchise'} did not accept the ${amount} cash`, { description: data?.reason || 'Please talk to the franchise.', duration: 10000 });
                } else {
                    toast.success(`${data?.franchiseName || 'The franchise'} confirmed your ${amount} cash`, { duration: 8000 });
                }
            };
            const handleAccountNews = (data) => {
                playNotificationSound();
                const ok = data?.status === 'approved';
                toast[ok ? 'success' : 'error'](data?.message || (ok ? 'Approved by the admin' : 'Update from the admin'), { duration: 10000 });
            };

            syncDeliveryTasks();
            socket.on('connect', syncDeliveryTasks);
            socket.on('new_task', handleNewTask);
            socket.on('cod_remittance_reviewed', handleCashReviewed);
            socket.on('account_status', handleAccountNews);
            socket.on('docs_status', handleAccountNews);

            return () => {
                socket.off('connect', syncDeliveryTasks);
                socket.off('new_task', handleNewTask);
                socket.off('cod_remittance_reviewed', handleCashReviewed);
                socket.off('account_status', handleAccountNews);
                socket.off('docs_status', handleAccountNews);
            };
        }
    }, [delivery]);

    const taskCount = useMemo(() => availableRequests.length, [availableRequests]);

    return (
        <DeliveryOrderContext.Provider value={{
            dispatchedOrders,
            availableRequests,
            activeDeliveryId,
            setActiveDeliveryId,
            returnPickups,
            loading,
            taskCount,
            isAlertOpen,
            setIsAlertOpen,
            newTaskData,
            ringingTaskIds,
            reopenTaskAlert: (orderId) => {
                // Show the same details as the first alert (address, amount), from the task list if needed
                const o = dispatchedOrders.find((x) => String(x.id || x._id) === String(orderId));
                const fromList = o ? {
                    customerName: o.customerName,
                    address: o.customerAddress,
                    pickupFrom: o.franchise,
                    pickupAddress: o.franchiseAddress,
                    orderTotal: o.totalAmount,
                    amountToCollect: o.paymentMethod === 'COD' ? o.totalAmount : 0,
                    paymentMethod: o.paymentMethod,
                    itemCount: o.items?.length || o.itemCount,
                } : {};
                setNewTaskData({ orderId, type: 'DELIVERY', message: `Delivery task waiting for you: #${String(orderId).slice(-6)}`, ...fromList, ...(taskInfoRef.current[String(orderId)] || {}) });
                setIsAlertOpen(true);
            },
            fetchDispatchedOrders,
            fetchReturnPickups,
            updateStatus,
            updateReturnStatus,
            rejectTask,
            refuseAtDoor,
            playNotificationSound
        }}>
            {children}
        </DeliveryOrderContext.Provider>
    );
}

export function useDeliveryOrders() {
    const context = useContext(DeliveryOrderContext);
    if (!context) throw new Error('useDeliveryOrders must be used within DeliveryOrderProvider');
    return context;
}
