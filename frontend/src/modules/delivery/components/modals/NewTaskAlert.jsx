import { motion, AnimatePresence } from 'framer-motion';
import { Package, X, ArrowRight, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeliveryOrders } from '../../contexts/DeliveryOrderContext';
import { ROUTES } from '../../utils/constants';
import { useConfirm } from '../../hooks/useConfirm';

export default function NewTaskAlert({ isOpen, onClose, data }) {
    const navigate = useNavigate();
    const { ringingTaskIds, reopenTaskAlert, setActiveDeliveryId, rejectTask } = useDeliveryOrders();
    const [confirm, confirmDialog] = useConfirm();

    // The pop-up was dismissed but a task is still ringing: keep a way back to it
    if (!isOpen && ringingTaskIds?.length > 0) {
        const waitingId = ringingTaskIds[0];
        return (
            <button
                type="button"
                onClick={() => reopenTaskAlert(waitingId)}
                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 rounded-full bg-rose-600 px-5 py-3 text-white shadow-2xl animate-pulse"
            >
                <Bell className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wide">
                    Task #{String(waitingId).slice(-6).toUpperCase()} waiting
                    {ringingTaskIds.length > 1 ? ` (+${ringingTaskIds.length - 1} more)` : ''} - tap to respond
                </span>
            </button>
        );
    }

    if (!data) return null;

    const isDeliveryTask = data.type !== 'RETURN' && !!data.orderId;

    const shortRef = `#${String(data.orderId).slice(-6).toUpperCase()}`;

    const handleAccept = async () => {
        const confirmed = await confirm({
            title: `Accept task ${shortRef}?`,
            message: 'This becomes your active delivery.',
            confirmLabel: 'Yes, accept',
        });
        if (!confirmed) return;
        onClose();
        setActiveDeliveryId(data.orderId); // also stops the ring
        navigate(ROUTES.ACTIVE);
    };

    const handleReject = async () => {
        const confirmed = await confirm({
            title: `Reject task ${shortRef}?`,
            message: 'The order goes back to the franchise to assign someone else.',
            confirmLabel: 'Yes, reject',
            tone: 'danger',
        });
        if (!confirmed) return;
        await rejectTask(data.orderId); // stops the ring once the server confirms
        onClose();
    };

    const handleViewTask = () => {
        onClose();
        if (data.type === 'RETURN') {
            navigate('/delivery/return-pickups');
        } else {
            navigate('/delivery/active');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm"
                    >
                        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-emerald-100">
                            {/* Header */}
                            <div className="bg-emerald-500 p-6 text-center relative">
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, -10, 10, -10, 0]
                                    }}
                                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner"
                                >
                                    <Package className="w-8 h-8 text-emerald-500" />
                                </motion.div>
                                <h3 className="text-xl font-bold text-white mb-1">
                                    {data.type === 'RETURN' ? 'New Return Pickup!' : 'New Delivery Task!'}
                                </h3>
                                <p className="text-emerald-100 text-sm font-medium">You have been assigned a new task</p>
                            </div>

                            {/* Content */}
                            <div className="p-6 bg-white">
                                <div className="space-y-4 mb-6 text-center">
                                    <p className="text-slate-600 text-sm">
                                        {data.message || "A new task requires your attention."}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="space-y-3">
                                    {isDeliveryTask ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={handleAccept}
                                                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={handleReject}
                                                    className="flex items-center justify-center gap-2 border-2 border-rose-200 text-rose-600 font-semibold py-3 px-4 rounded-xl hover:bg-rose-50 transition-all active:scale-[0.98]"
                                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                            <button
                                                onClick={onClose}
                                                className="w-full py-3 px-4 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors active:scale-[0.98]"
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                Not Now
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleViewTask}
                                                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                View Task
                                                <ArrowRight className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={onClose}
                                                className="w-full py-3 px-4 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors active:scale-[0.98]"
                                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                            >
                                                Dismiss
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
            {confirmDialog}
        </AnimatePresence>
    );
}
