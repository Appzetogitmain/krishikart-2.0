import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera,
    PenTool,
    CheckCircle2,
    CreditCard,
    User,
    ChevronLeft,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { useDeliveryOrders } from '../contexts/DeliveryOrderContext';
import DocumentViewer from '../../vendor/components/documents/DocumentViewer';
import { Package } from 'lucide-react';

const DeliveryCompletion = () => {
    const [photo, setPhoto] = useState(null);
    const [signed, setSigned] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isDocOpen, setIsDocOpen] = useState(false);
    const navigate = useNavigate();
    const { dispatchedOrders, updateStatus } = useDeliveryOrders();
    const [order, setOrder] = useState(null);

    useEffect(() => {
        const activeOrderId = localStorage.getItem('activeDeliveryId');
        if (activeOrderId) {
            const found = dispatchedOrders.find(o => o._id === activeOrderId);
            if (found) setOrder(found);
        }
    }, [dispatchedOrders]);

    const submittingRef = useRef(false);

    const handleComplete = async () => {
        // Ignore repeat taps while the first request is still in flight
        if (!order || submittingRef.current) return;
        submittingRef.current = true;

        // Update status to Delivered in backend
        const ok = await updateStatus(order._id, 'Delivered');
        submittingRef.current = false;
        if (!ok) return;
        localStorage.removeItem('activeDeliveryId');

        setIsSuccess(true);
        setTimeout(() => {
            navigate(ROUTES.DASHBOARD);
        }, 2500);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 overflow-hidden">
                {/* Confetti-like effect using motion blocks */}
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ y: -100, x: Math.random() * 400 - 200, opacity: 1, rotate: 0 }}
                        animate={{
                            y: 800,
                            opacity: 0,
                            rotate: 360,
                            x: Math.random() * 400 - 200
                        }}
                        transition={{ duration: 2, delay: Math.random() * 1 }}
                        className={`absolute w-3 h-3 rounded-full ${['bg-amber-300', 'bg-white', 'bg-green-300'][i % 3]}`}
                    />
                ))}

                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 10 }}
                    className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] mb-8"
                >
                    <CheckCircle2 className="w-20 h-20 text-primary" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-center"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">Excellent Work!</h1>
                    <p className="text-white/80 max-w-[240px] mx-auto">
                        Order successfully delivered to {order?.userId?.fullName || 'Customer'}.
                    </p>

                    <div className="mt-8 bg-white/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/30">
                        <p className="text-xs text-white/70 uppercase font-bold tracking-widest mb-1">Earned Today</p>
                        <p className="text-2xl font-bold text-white">₹{order?.totalAmount || '0.00'}</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full pb-24">
            {/* Header */}
            <div className="px-6 pt-8 pb-4 bg-white sticky top-0 z-10 border-b border-border/50">
                <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:scale-90 transition-all">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold">Deliver Order</h1>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="bg-muted/30 p-5 rounded-2xl flex items-center justify-between border border-border">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl border border-border flex items-center justify-center shadow-sm">
                            <User className="text-primary w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">{order?.userId?.fullName}</h3>
                            <p className="text-xs text-muted-foreground">{order?._id} • {order?.paymentMethod}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-bold text-primary">₹{order?.totalAmount}</p>
                    </div>
                </div>

                {/* Proof of Delivery */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Proof of Delivery</h2>

                    {order?.bilty && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <Package className="w-5 h-5 text-amber-500" />
                                <p className="text-xs text-amber-900 font-bold uppercase tracking-tight">Handover Bilty To Customer</p>
                            </div>
                            <button
                                onClick={() => setIsDocOpen(true)}
                                className="w-full py-2.5 bg-white border border-amber-200 rounded-xl text-[10px] font-black text-amber-600 uppercase tracking-widest"
                            >
                                Show Digital Bilty
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setPhoto(!photo)}
                            className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${photo ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-muted text-muted-foreground'}`}
                        >
                            {photo ? (
                                <div className="relative">
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-primary text-white p-1 rounded-full absolute -top-1 -right-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                    </motion.div>
                                    <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80" className="w-12 h-12 rounded-lg object-cover" alt="Proof" />
                                </div>
                            ) : <Camera className="w-8 h-8" />}
                            <span className="text-[10px] font-bold">Take Photo</span>
                        </button>

                        <button
                            onClick={() => setSigned(!signed)}
                            className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all ${signed ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-muted text-muted-foreground'}`}
                        >
                            <div className="relative">
                                {signed && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-primary text-white p-1 rounded-full absolute -top-1 -right-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                    </motion.div>
                                )}
                                <PenTool className="w-8 h-8" />
                            </div>
                            <span className="text-[10px] font-bold">E-Signature</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-border p-5">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-foreground">Collect Payment</span>
                            <span className="text-lg font-bold text-primary">₹{order?.totalAmount}</span>
                        </div>
                        <div className="flex gap-2 p-1 bg-muted rounded-xl">
                            <button className="flex-1 py-1.5 text-[10px] font-bold bg-white rounded-lg shadow-sm text-primary uppercase tracking-wider">Cash</button>
                            <button className="flex-1 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">UPI / QR</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bilty Modal */}
            <DocumentViewer
                isOpen={isDocOpen}
                onClose={() => setIsDocOpen(false)}
                type="BILTY"
                data={order?.bilty || {}}
            />

            {/* Action Button */}
            <div className="p-6 mt-auto pb-10">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleComplete}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/30 flex items-center justify-center text-center text-lg"
                >
                    Finish Delivery
                </motion.button>
            </div>
        </div>
    );
};

export default DeliveryCompletion;
