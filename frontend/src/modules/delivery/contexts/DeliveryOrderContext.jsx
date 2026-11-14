import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { getSocket, joinDeliveryRoom } from '@/lib/socket';
import { useDeliveryAuth } from './DeliveryAuthContext';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { byDeliveryTime } from '@/lib/deliverySlots';

const DeliveryOrderContext = createContext();

export function DeliveryOrderProvider({ children }) {
    const { delivery } = useDeliveryAuth();
    const [dispatchedOrders, setDispatchedOrders] = useState([]);
    // Delivery requests sent to several partners: the first to accept gets the order (client, Nov 2026)
    const [offers, setOffers] = useState([]);
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
        // Earliest delivery day + slot first
        return dispatchedOrders.filter(o => o.id !== activeDeliveryId).sort(byDeliveryTime);
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

    // Stop ringing for tasks that left the list (rejected, cancelled, reassigned, taken by someone else) or were accepted
    useEffect(() => {
        if (ringingTaskIds.length === 0) return;
        const present = new Set([...dispatchedOrders, ...offers].map((o) => String(o.id)));
        ringingTaskIds.forEach((id) => {
            if (present.has(id)) ringSeenRef.current.add(id);
            const gone = !present.has(id) && ringSeenRef.current.has(id);
            if (gone || id === String(activeDeliveryId)) stopRingingFor(id);
        });
    }, [dispatchedOrders, offers]);

    const fetchOffers = async () => {
        try {
            const response = await api.get('/orders/delivery/offers');
            if (response.data.success) setOffers(response.data.results || []);
        } catch (error) {
            console.error('Fetch delivery requests error:', error);
        }
    };

    const dropOffer = (orderId) => {
        const id = String(orderId);
        setOffers((prev) => prev.filter((o) => String(o.id) !== id));
        stopRingingFor(id);
    };

    /** Accept a request: the first partner to accept gets the order */
    const acceptOffer = async (orderId) => {
        try {
            const response = await api.put(`/orders/delivery/${orderId}/accept-offer`);
            dropOffer(orderId);
            toast.success(response.data?.message || 'The order is yours');
            await Promise.all([fetchDispatchedOrders(), fetchOffers()]);
            const mine = response.data?.result?.orderIds || [orderId];
            if (!localStorage.getItem('activeDeliveryId')) setActiveDeliveryId(String(mine[0]));
            return true;
        } catch (error) {
            dropOffer(orderId);
            toast.error(error.response?.data?.message || 'Could not accept this request');
            fetchOffers();
            return false;
        }
    };

    /** Decline a request: it leaves this app for good and goes to other partners */
    const declineOffer = async (orderId) => {
        try {
            await api.put(`/orders/delivery/${orderId}/decline-offer`);
            toast.success('Request declined');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not decline the request');
        } finally {
            dropOffer(orderId);
            fetchOffers();
        }
    };

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
                fetchOffers();
                fetchReturnPickups();
            };

            const handleNewTask = (data) => {
                if (data?.orderId) taskInfoRef.current[String(data.orderId)] = data;
                // This partner accepted a request (or a same-customer order came along in that trip): just confirm it,
                // no "assigned to you" pop-up - nothing is ever given to a partner without them accepting
                if (data?.accepted) {
                    if (data?.orderId) dropOffer(data.orderId);
                    toast.success(data?.message || 'The order is yours');
                    fetchDispatchedOrders();
                    fetchOffers();
                    return;
                }
                setNewTaskData(data);
                setIsAlertOpen(true);
                // Requests go to every suitable partner and ring until this partner accepts or declines;
                // orders the franchise assigns by hand chime once. Older servers still ring until accepted.
                if (data?.offer) {
                    // A request also sent to other partners: rings until this partner accepts or declines
                    if (data?.orderId) startRingingFor(data.orderId);
                    toast.success("New delivery request - accept it before someone else does");
                    fetchOffers();
                    return;
                }
                if (data?.autoAccepted) {
                    playNotificationSound();
                    if (data?.orderId && !localStorage.getItem('activeDeliveryId')) setActiveDeliveryId(String(data.orderId));
                    toast.success("New delivery assigned to you");
                } else {
                    if (data?.type !== 'RETURN' && data?.orderId) startRingingFor(data.orderId);
                    else playNotificationSound();
                    toast.success("New delivery task assigned!");
                }
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
            // The franchise gave this task to someone else
            const handleTaskRemoved = (data) => {
                if (data?.orderId && localStorage.getItem('activeDeliveryId') === String(data.orderId)) setActiveDeliveryId(null);
                toast.info(`Order #${String(data?.orderId || '').slice(-6).toUpperCase()} was given to another delivery partner`);
                fetchDispatchedOrders();
            };
            socket.on('task_removed', handleTaskRemoved);
            // Another partner accepted a request this partner also had
            const handleOfferTaken = (data) => {
                if (!data?.orderId) return;
                dropOffer(data.orderId);
                setNewTaskData((cur) => {
                    if (cur?.orderId && String(cur.orderId) === String(data.orderId)) setIsAlertOpen(false);
                    return cur;
                });
                toast.info(`Order #${String(data.orderId).slice(-6).toUpperCase()} was taken by another delivery partner`);
            };
            socket.on('offer_taken', handleOfferTaken);
            socket.on('cod_remittance_reviewed', handleCashReviewed);
            socket.on('account_status', handleAccountNews);
            socket.on('docs_status', handleAccountNews);

            return () => {
                socket.off('connect', syncDeliveryTasks);
                socket.off('new_task', handleNewTask);
                socket.off('task_removed', handleTaskRemoved);
                socket.off('offer_taken', handleOfferTaken);
                socket.off('cod_remittance_reviewed', handleCashReviewed);
                socket.off('account_status', handleAccountNews);
                socket.off('docs_status', handleAccountNews);
            };
        }
    }, [delivery]);

    const taskCount = useMemo(() => availableRequests.length + offers.length, [availableRequests, offers]);

    return (
        <DeliveryOrderContext.Provider value={{
            dispatchedOrders,
            availableRequests,
            offers,
            fetchOffers,
            acceptOffer,
            declineOffer,
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
                const offer = offers.find((x) => String(x.id || x._id) === String(orderId));
                const o = offer || dispatchedOrders.find((x) => String(x.id || x._id) === String(orderId));
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
                setNewTaskData({ orderId, type: 'DELIVERY', message: `Delivery task waiting for you: #${String(orderId).slice(-6)}`, ...fromList, ...(taskInfoRef.current[String(orderId)] || {}), ...(offer ? { offer: true } : {}) });
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
