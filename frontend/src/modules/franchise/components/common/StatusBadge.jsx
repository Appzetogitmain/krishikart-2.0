import { cn } from '@/lib/utils';

export default function StatusBadge({ status, variant = 'default' }) {
    const configs = {
        // Order Status
        pending: { label: 'New', bg: 'bg-blue-50', text: 'text-blue-600' },
        placed: { label: 'New Order', bg: 'bg-blue-50', text: 'text-blue-600' },
        assigned: { label: 'Assigned', bg: 'bg-amber-50', text: 'text-amber-600' },
        accepted: { label: 'Accepted', bg: 'bg-indigo-50', text: 'text-indigo-600' },
        procuring: { label: 'Procuring', bg: 'bg-orange-50', text: 'text-orange-600' },
        packed: { label: 'Packed', bg: 'bg-yellow-50', text: 'text-yellow-600' },
        ready: { label: 'Ready', bg: 'bg-purple-50', text: 'text-purple-600' },
        dispatched: { label: 'Dispatched', bg: 'bg-indigo-50', text: 'text-indigo-600' },
        'out for delivery': { label: 'In Transit', bg: 'bg-sky-50', text: 'text-sky-600' },
        delivered: { label: 'Delivered', bg: 'bg-emerald-50', text: 'text-emerald-600' },
        received: { label: 'Received', bg: 'bg-green-50', text: 'text-green-600' },
        cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600' },

        // Keeping old keys for legacy or other modules
        new: { label: 'New', bg: 'bg-blue-50', text: 'text-blue-600' },
        preparing: { label: 'Preparing', bg: 'bg-orange-50', text: 'text-orange-600' },
        out_for_delivery: { label: 'In Transit', bg: 'bg-indigo-50', text: 'text-indigo-600' },

        // Stock Status
        good: { label: 'Good', bg: 'bg-emerald-50', text: 'text-emerald-600' },
        low: { label: 'Low', bg: 'bg-yellow-50', text: 'text-yellow-600' },
        critical: { label: 'Critical', bg: 'bg-orange-50', text: 'text-orange-600', pulse: true },
        out: { label: 'Out of Stock', bg: 'bg-red-50', text: 'text-red-600', pulse: true },

        // Payment Mode
        prepaid: { label: 'Prepaid', bg: 'bg-emerald-50', text: 'text-emerald-600' },
        cod: { label: 'COD', bg: 'bg-blue-50', text: 'text-blue-600' },
        credit: { label: 'Credit', bg: 'bg-slate-50', text: 'text-slate-600' },

        // Deposit Status
        'pending deposit': { label: 'Pending Deposit', bg: 'bg-red-50', text: 'text-red-600' },
        deposited: { label: 'Deposited', bg: 'bg-emerald-50', text: 'text-emerald-600' }
    };

    const normalizedStatus = (status || 'new').toLowerCase();
    const config = configs[normalizedStatus] || configs.new;

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight inline-flex items-center gap-1.5",
            config.bg,
            config.text,
            config.pulse && "animate-pulse"
        )}>
            <div className={cn("w-1 h-1 rounded-full", config.text.replace('text', 'bg'))} />
            {config.label}
        </span>
    );
}
