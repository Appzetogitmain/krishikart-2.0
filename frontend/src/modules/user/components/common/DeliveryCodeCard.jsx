import { KeyRound } from 'lucide-react';

/** The customer's delivery code, shown while the order is on the way. */
export default function DeliveryCodeCard({ order }) {
    const status = String(order?.orderStatus || '').toLowerCase();
    if (!order?.deliveryOtpCode || !['dispatched', 'out for delivery'].includes(status)) return null;
    return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-[20px] p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <KeyRound size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Delivery code</p>
                <p className="text-[11px] font-semibold text-emerald-800 leading-snug">Tell this code to the delivery partner only after you receive your order.</p>
            </div>
            <p className="text-2xl font-black tracking-[0.3em] text-emerald-900 tabular-nums">{order.deliveryOtpCode}</p>
        </div>
    );
}
