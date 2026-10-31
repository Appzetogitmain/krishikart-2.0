import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Package } from 'lucide-react';
import DeliveryCard from '../components/cards/DeliveryCard';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { useDeliveryOrders } from '../contexts/DeliveryOrderContext';
import { useConfirm } from '../hooks/useConfirm';

const DeliveryRequests = () => {
    const { availableRequests: requests, loading: refreshing, fetchDispatchedOrders: handleRefresh, rejectTask, setActiveDeliveryId } = useDeliveryOrders();
    const navigate = useNavigate();
    const [confirm, confirmDialog] = useConfirm();

    const shortRef = (id) => `#${String(id).slice(-6).toUpperCase()}`;

    const handleAccept = async (id) => {
        const confirmed = await confirm({
            title: `Start delivery ${shortRef(id)}?`,
            message: 'This becomes your active delivery.',
            confirmLabel: 'Yes, start',
        });
        if (!confirmed) return;
        // In this flow, "Accept" just navigates to the active delivery.
        setActiveDeliveryId(id);
        navigate(ROUTES.ACTIVE);
    };

    const handleReject = async (id) => {
        const confirmed = await confirm({
            title: `Reject task ${shortRef(id)}?`,
            message: 'The order is given to another delivery partner.',
            confirmLabel: 'Yes, reject',
            tone: 'danger',
        });
        if (!confirmed) return;
        await rejectTask(id);
    };

    return (
        <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="px-6 pt-8 pb-4 bg-white sticky top-0 z-10 border-b border-border/50">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Delivery Requests</h1>
                        <p className="text-muted-foreground text-sm">{requests.length} available requests</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className={`p-2 rounded-full bg-muted/50 text-foreground transition-all active:scale-95 ${refreshing ? 'animate-spin' : ''}`}
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Requests List */}
            <div className="p-6">
                <AnimatePresence mode="popLayout">
                    {requests.length > 0 ? (
                        requests.map((request, index) => (
                            <motion.div
                                key={request.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <DeliveryCard
                                    request={request}
                                    onAccept={handleAccept}
                                    onReject={handleReject}
                                />
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 text-center"
                        >
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                <Package className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">No new requests</h3>
                            <p className="text-muted-foreground text-sm px-10">
                                You've cleared all pending delivery tasks. We'll notify you when new ones arrive!
                            </p>
                            <button
                                onClick={handleRefresh}
                                className="mt-6 text-primary font-bold text-sm underline underline-offset-4"
                            >
                                Check for updates
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {confirmDialog}
        </div>
    );
};

export default DeliveryRequests;
