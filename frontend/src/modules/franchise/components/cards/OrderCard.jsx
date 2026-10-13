import { motion } from 'framer-motion';
import { ShoppingBag, MapPin, Clock, ChevronRight, CheckCircle2, XCircle, Truck, Info, CreditCard, Wallet, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from '../common/StatusBadge';

export default function OrderCard({ order, onAction }) {
    const getPaymentIcon = (mode) => {
        switch (mode?.toLowerCase()) {
            case 'prepaid': return <CreditCard size={14} className="text-emerald-500" />;
            case 'cod': return <Wallet size={14} className="text-blue-500" />;
            case 'credit': return <Landmark size={14} className="text-slate-500" />;
            default: return <Info size={14} />;
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-green-900/5 transition-all group"
        >
            <div className="p-6">
                {/* Header: Hotel Info & Status */}
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors">
                            <ShoppingBag size={24} className="text-slate-400 group-hover:text-primary" />
                        </div>
                        <div>
                            <h4 className="text-base font-black text-slate-900 tracking-tight leading-tight">{order.hotelName}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.id}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                <div className="flex items-center gap-1">
                                    {getPaymentIcon(order.paymentMode)}
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{order.paymentMode}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <StatusBadge status={order.status} />
                </div>

                {/* Content: Delivery Info */}
                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Delivery Slot</p>
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-primary" />
                            <span className="text-xs font-bold text-slate-700">{order.deliverySlot}</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Order Value</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">₹{order.total.toLocaleString()}</p>
                    </div>
                    <div className="col-span-2 space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Delivery Address</p>
                        <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-slate-300 mt-0.5 shrink-0" />
                            <p className="text-xs font-bold text-slate-500 leading-tight">{order.address}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-col gap-3">
                    {/* Accept Action */}
                    {(order.status === 'placed' || order.status === 'assigned' || order.status === 'new') && (
                        <button
                            onClick={() => onAction?.(order.id, 'accept')}
                            className="w-full h-12 bg-slate-900 text-white rounded-[18px] font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-lg"
                        >
                            Accept Order
                        </button>
                    )}

                    {/* Conditional Action post-acceptance */}
                    {order.status === 'accepted' && (
                        order.items.some(i => i.isShortage) ? (
                            <button
                                onClick={() => onAction?.(order.id, 'procure')}
                                className="w-full h-12 bg-amber-500 text-white rounded-[18px] font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                            >
                                <Info size={16} /> Request Stock
                            </button>
                        ) : (
                            <button
                                onClick={() => onAction?.(order.id, 'preparing')}
                                className="w-full h-12 bg-emerald-600 text-white rounded-[18px] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-900/10"
                            >
                                Mark Packed
                            </button>
                        )
                    )}

                    {order.status === 'preparing' && (
                        <button
                            onClick={() => onAction?.(order.id, 'ready')}
                            className="flex-1 h-12 bg-orange-500 text-white rounded-[18px] font-black uppercase text-[10px] tracking-widest hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-100"
                        >
                            Mark Ready to Dispatch
                        </button>
                    )}

                    {order.status === 'ready' && (
                        <button
                            onClick={() => onAction?.(order.id, 'out_for_delivery')}
                            className="flex-1 h-12 bg-indigo-500 text-white rounded-[18px] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 active:scale-95 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                        >
                            Assign & Dispatch <Truck size={16} />
                        </button>
                    )}

                    {order.status === 'out_for_delivery' && (
                        <button
                            onClick={() => onAction?.(order.id, 'delivered')}
                            className="flex-1 h-12 bg-emerald-500 text-white rounded-[18px] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-100"
                        >
                            Mark as Delivered
                        </button>
                    )}

                    {order.status === 'delivered' && (
                        <div className="flex-1 h-12 bg-slate-50 text-slate-400 rounded-[18px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-slate-100">
                            Order Complete <CheckCircle2 size={16} />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
