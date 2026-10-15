import { cn } from '@/lib/utils';

const statusConfig = {
    pending: { label: 'New', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
    placed: { label: 'New Order', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
    assigned: { label: 'Assigned', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    accepted: { label: 'Order Accepted', hint: 'Order accept ho gaya hai', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-400' },
    procuring: { label: 'Stock Arranging', hint: 'Samaan arrange ho raha hai', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-400' },
    packed: { label: 'Packed', bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-400' },
    ready: { label: 'Ready for Pickup', bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
    dispatched: { label: 'Dispatched', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
    'out for delivery': { label: 'Out for Delivery', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
    delivered: { label: 'Delivered', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
    received: { label: 'Received', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
    cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },

    // Legacy/Old Keys
    new: { label: 'New Order', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
    processing: { label: 'Processing', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    pending_assignment: { label: 'Pending Assignment', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    preparing: { label: 'Being Packed', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    in_transit: { label: 'In Transit', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
    out_for_delivery: { label: 'Out for Delivery', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' },
    incoming: { label: 'Incoming', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    franchise_rejected: { label: 'Franchise Rejected', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
};

export default function StatusBadge({ status }) {
    const normalizedStatus = (status || '').toLowerCase();
    const config = statusConfig[normalizedStatus] || { label: status, bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

    return (
        <div title={config.hint} className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
            config.bg,
            config.text
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", config.dot)} />
            {config.label}
        </div>
    );
}
