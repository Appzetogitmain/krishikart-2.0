import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

export default function StockAlertBadge({ status }) {
    const config = {
        'critical': {
            label: 'Very Low Stock',
            icon: AlertCircle,
            bg: 'bg-red-50',
            text: 'text-red-600',
            border: 'border-red-100',
            pulse: true
        },
        'low': {
            label: 'Low Stock',
            icon: AlertTriangle,
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            border: 'border-amber-100',
            pulse: false
        },
        'ok': {
            label: 'Enough Stock',
            icon: CheckCircle2,
            bg: 'bg-emerald-50',
            text: 'text-emerald-600',
            border: 'border-emerald-100',
            pulse: false
        }
    };

    const { label, icon: Icon, bg, text, border, pulse } = config[status] || config['ok'];

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${bg} ${text} ${border} relative overflow-hidden`}>
            {pulse && (
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-red-400"
                />
            )}
            <Icon size={12} className="relative z-10" />
            <span className="relative z-10">{label}</span>
        </div>
    );
}
