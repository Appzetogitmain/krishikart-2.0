import { motion } from 'framer-motion';
import StatusBadge from '../common/StatusBadge';
import {
    MoreVertical,
    ExternalLink,
    IndianRupee,
    CreditCard,
    Wallet,
    Banknote,
    ShoppingBag,
    Truck,
    Package,
    AlertCircle,
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PaymentBadge = ({ method }) => {
    const config = {
        'Prepaid': { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        'COD': { icon: Banknote, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
        'Credit': { icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' }
    };

    const { icon: Icon, color, bg, border } = config[method] || config['COD'];

    return (
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border", bg, color, border)}>
            <Icon size={10} />
            {method}
        </span>
    );
};

export default function OrdersTable({ orders, onAction, onOrderClick, onProcure, onAllowPartial }) {
    const navigate = useNavigate();

    return (
        <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Franchise</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                    {orders.map((order, idx) => (
                        <tr
                            key={order._id || idx}
                            onClick={() => onOrderClick?.(order._id)}
                            className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                            <td className="px-4 py-4">
                                <div className="flex flex-col">
                                    {(() => {
                                        const wasRejected = Array.isArray(order.assignmentAttempts) && order.assignmentAttempts.some(a => a.reason === 'rejected');
                                        if (order.franchiseId) {
                                            return (
                                                <>
                                                    <span className="font-bold text-[11px] tracking-widest uppercase text-slate-900">
                                                        {order.franchiseId.franchiseName || order.franchiseId.ownerName}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                                                        {order.franchiseId.franchiseName ? order.franchiseId.ownerName : order.franchiseId.mobile}
                                                    </span>
                                                </>
                                            );
                                        }
                                        if (wasRejected) {
                                            return (
                                                <>
                                                    <span className="font-bold text-[11px] tracking-widest uppercase text-orange-600">Waiting for a Franchise</span>
                                                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wide mt-0.5">Rejected — finding another franchise</span>
                                                </>
                                            );
                                        }
                                        return <span className="font-bold text-[11px] tracking-widest uppercase text-amber-600">Unassigned</span>;
                                    })()}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 text-[11px] leading-none mb-1">
                                        {order.userId?.fullName || 
                                         (order.franchiseId?.mobile === order.userId?.mobile ? order.franchiseId?.ownerName : 'Unnamed User')}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{order.userId?.mobile || 'No Mobile'}</span>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1 items-start">
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm">
                                        {order.items?.length || 0} {order.items?.length === 1 ? 'Item' : 'Items'}
                                    </span>
                                    {order.items?.some(i => i.isShortage) && (
                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter animate-pulse">
                                            Stock Shortage
                                        </span>
                                    )}
                                    {order.isPartOfGroup && (
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">
                                            Split Order
                                        </span>
                                    )}
                                    {Array.isArray(order.assignmentAttempts) && order.assignmentAttempts.some(a => a.reason === 'rejected') && (
                                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">
                                            Franchise Rejected ×{order.assignmentAttempts.filter(a => a.reason === 'rejected').length}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-700">{order.date || new Date(order.createdAt).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-slate-400 font-medium tabular-nums mb-1">{order.time || new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {(order.scheduledDateFormatted || order.scheduledDate) && (
                                        <span className="mt-2 text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5 w-fit border-2 border-amber-200 shadow-sm animate-pulse">
                                            <Clock size={10} strokeWidth={3} />
                                            Target: {order.scheduledDateFormatted || new Date(order.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' })}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <PaymentBadge method={order.paymentMethod || 'COD'} />
                            </td>
                            <td className="px-4 py-4">
                                <StatusBadge status={
                                    order.orderStatus === 'Cancelled'
                                        ? 'Cancelled'
                                        : ['Placed', 'Assigned'].includes(order.orderStatus) &&
                                          Array.isArray(order.assignmentAttempts) &&
                                          order.assignmentAttempts.some(a => a.reason === 'rejected')
                                            ? 'franchise_rejected'
                                            : order.orderStatus
                                } />
                            </td>
                            <td className="px-4 py-4 text-right">
                                <span className="tabular-nums text-[11px] font-bold text-slate-900">₹{order.totalAmount?.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {order.items?.some(i => i.isShortage) && (order.orderStatus || '').toLowerCase() !== 'procuring' && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAllowPartial?.(order);
                                                }}
                                                disabled={!order.franchiseId || order.allowPartialFulfillment}
                                                title={!order.franchiseId ? 'Assign franchise before allowing available delivery' : 'Allow franchise to dispatch current available stock'}
                                                className={cn(
                                                    "px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] rounded-sm transition-all flex items-center gap-2 border",
                                                    !order.franchiseId || order.allowPartialFulfillment
                                                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                        : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                                )}
                                            >
                                                <Truck size={13} strokeWidth={3} />
                                                {order.allowPartialFulfillment ? 'Approved' : 'Allow Partial'}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onProcure?.(order);
                                                }}
                                                disabled={!order.franchiseId}
                                                title={!order.franchiseId ? 'Assign franchise before procurement' : 'Create procurement request'}
                                                className={cn(
                                                    "px-5 py-2.5 text-white text-[11px] font-black uppercase tracking-[0.15em] rounded-sm transition-all flex items-center gap-2.5 border-2 group/button",
                                                    order.franchiseId
                                                        ? "bg-amber-600 hover:bg-slate-900 shadow-[0_4px_15px_rgba(217,119,6,0.3)] hover:shadow-[0_4px_20px_rgba(217,119,6,0.5)] active:scale-95 border-amber-500/50"
                                                        : "bg-slate-300 border-slate-300 cursor-not-allowed opacity-70"
                                                )}
                                            >
                                                <Package size={14} strokeWidth={3} className="group-hover/button:scale-110 transition-transform" />
                                                Request Stock
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOrderClick?.(order._id);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-sm transition-all"
                                    >
                                        <ExternalLink size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
