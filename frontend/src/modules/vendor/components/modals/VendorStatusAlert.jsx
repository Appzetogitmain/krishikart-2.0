import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, X, Bell, Package, CheckCircle, Info, ClipboardCheck } from 'lucide-react';
import { useVendorAuth } from '../../contexts/VendorAuthContext';
import { useNavigate } from 'react-router-dom';

const VendorStatusAlert = () => {
    const {
        isStatusAlertOpen,
        setIsStatusAlertOpen,
        statusAlertData,
    } = useVendorAuth();
    const navigate = useNavigate();

    if (!isStatusAlertOpen || !statusAlertData) return null;

    const { requestId, status, message } = statusAlertData;
    const shortId = requestId ? requestId.toString().slice(-6).toUpperCase() : '---';

    const getStatusConfig = (status) => {
        switch (status) {
            case 'approved':
            case 'preparing':
                return {
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-50',
                    accentColor: 'bg-blue-500',
                    icon: <ClipboardCheck className="w-10 h-10 animate-pulse" />,
                    title: 'Quote Approved!'
                };
            case 'negotiating':
                return {
                    color: 'text-orange-600',
                    bgColor: 'bg-orange-50',
                    accentColor: 'bg-orange-500',
                    icon: <ClipboardCheck className="w-10 h-10" />,
                    title: 'New Rate Offered'
                };
            case 'ready_for_pickup':
                return {
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-50',
                    accentColor: 'bg-amber-500',
                    icon: <Package className="w-10 h-10 animate-bounce" />,
                    title: 'Ready for Pickup'
                };
            case 'shipped':
            case 'dispatched':
                return {
                    color: 'text-indigo-600',
                    bgColor: 'bg-indigo-50',
                    accentColor: 'bg-indigo-500',
                    icon: <Truck className="w-10 h-10 animate-pulse" />,
                    title: 'Shipment in Transit'
                };
            case 'completed':
                return {
                    color: 'text-emerald-600',
                    bgColor: 'bg-emerald-50',
                    accentColor: 'bg-emerald-500',
                    icon: <CheckCircle className="w-10 h-10" />,
                    title: 'Inventory Received!'
                };
            default:
                return {
                    color: 'text-slate-600',
                    bgColor: 'bg-slate-50',
                    accentColor: 'bg-slate-500',
                    icon: <Info className="w-10 h-10" />,
                    title: 'Order Status Update'
                };
        }
    };

    const config = getStatusConfig(status);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsStatusAlertOpen(false)}
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 40 }}
                    className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20"
                >
                    {/* Top Accent Bar */}
                    <div className={`h-3 ${config.accentColor} w-full animate-pulse`} />

                    <div className="p-8">
                        {/* Header Area */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="relative">
                                <div className={`absolute inset-0 ${config.accentColor} rounded-full animate-ping opacity-20`} />
                                <div className={`relative ${config.bgColor} p-6 rounded-2xl`}>
                                    <div className={config.color}>
                                        {config.icon}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsStatusAlertOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Title & Description */}
                        <div className="mb-6">
                            <h2 className={`text-2xl font-black text-slate-900 mb-2 tracking-tight`}>
                                {config.title}
                            </h2>
                            <p className="text-slate-500 font-bold text-base leading-relaxed">
                                {message || `The status of procurement request #${shortId} has been updated by the system.`}
                            </p>
                        </div>

                        {/* Procurement Reference Card */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="bg-white p-3 rounded-xl shadow-sm">
                                    <Package className="text-slate-900 w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Request ID</p>
                                    <p className="text-lg font-black text-slate-900">
                                        #{shortId}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStatusAlertOpen(false);
                                    if (status === 'negotiating' && requestId) {
                                        navigate(`/vendor/orders/${requestId}`);
                                    } else if (status === 'approved' || status === 'preparing') {
                                        navigate(`/vendor/dispatch`);
                                    } else {
                                        navigate(`/vendor/orders`);
                                    }
                                }}
                                className={`h-14 px-6 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group`}
                            >
                                View Order
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsStatusAlertOpen(false)}
                                className="h-14 px-6 rounded-2xl border-2 border-slate-100 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-50 hover:border-slate-200 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-slate-900 py-3 px-6 flex items-center justify-center gap-2">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.3em]">Kisaankart</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default VendorStatusAlert;
