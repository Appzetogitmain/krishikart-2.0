import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const MetricCard = ({ label, value, icon: Icon, color = 'slate', index = 0, trend, sub }) => {
    const colorMap = {
        emerald: "bg-emerald-50 text-emerald-600 shadow-emerald-100",
        blue: "bg-blue-50 text-blue-600 shadow-blue-100",
        amber: "bg-amber-50 text-amber-600 shadow-amber-100",
        red: "bg-red-50 text-red-600 shadow-red-100",
        slate: "bg-slate-50 text-slate-600 shadow-slate-100"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all group"
        >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm",
                    colorMap[color] || colorMap.slate
                )}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                </div>
                {trend && (
                    <div className={cn(
                        "text-[10px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg",
                        trend.positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                        {trend.positive ? '+' : ''}{trend.value}%
                    </div>
                )}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] sm:text-[10px] font-black text-slate-300 uppercase tracking-[0.08em] sm:tracking-[0.1em] leading-snug mb-1 line-clamp-2">{label}</p>
                <div className="flex flex-col min-w-0">
                    <h3 className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight sm:tracking-tighter tabular-nums break-words leading-none">{value}</h3>
                    {sub && (
                        <p className="text-[10px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{sub}</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default MetricCard;
