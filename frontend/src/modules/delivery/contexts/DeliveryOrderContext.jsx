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

            syncDeliveryTasks();
            socket.on('connect', syncDeliveryTasks);
            socket.on('new_task', handleNewTask);

            return () => {
                socket.off('connect', syncDeliveryTasks);
                socket.off('new_task', handleNewTask);
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
                setNewTaskData({ orderId, type: 'DELIVERY', message: `Delivery task waiting for you: #${String(orderId).slice(-6)}` });
                setIsAlertOpen(true);
            },
            fetchDispatchedOrders,
            fetchReturnPickups,
            updateStatus,
            updateReturnStatus,
            rejectTask,
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
