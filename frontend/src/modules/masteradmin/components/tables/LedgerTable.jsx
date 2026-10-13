import { motion } from 'framer-motion';
import { IndianRupee, ExternalLink, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LedgerTable({ transactions, type }) {
    if (!transactions || transactions.length === 0) {
        return (
            <div className="py-20 flex flex-col items-center text-center bg-white rounded-[32px] border border-slate-100">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                    <Calendar size={32} />
                </div>
                <h3 className="font-bold text-slate-900">No transactions recorded</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">Try a different date range.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Info</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Details</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Balance</th>
                            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {transactions.map((txn, index) => (
                            <motion.tr
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                key={txn.id}
                                className="group hover:bg-slate-50/50 transition-colors"
                            >
                                <td className="px-6 py-5">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 text-sm">
                                            {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                            {txn.id}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-sm">
                                            {txn.hotelName || txn.vendorName || txn.franchiseName || txn.source}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            Reference: {txn.orderId || txn.poId || 'Automatic Entry'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "w-2 h-2 rounded-full",
                                            txn.status === 'paid' || txn.status === 'received' ? "bg-emerald-500" : "bg-amber-500"
                                        )} />
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                            {txn.status}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className={cn(
                                        "flex items-center gap-1 font-black text-sm",
                                        txn.type === 'debit' || txn.type === 'expense' ? "text-red-600" : "text-emerald-600"
                                    )}>
                                        {txn.type === 'debit' || txn.type === 'expense' ?
                                            <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />
                                        }
                                        <IndianRupee size={12} />
                                        {txn.amount.toLocaleString()}
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-1 font-black text-slate-900 text-sm">
                                        <IndianRupee size={12} className="text-slate-400" />
                                        {txn.balance.toLocaleString()}
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <button className="p-2 text-slate-400 hover:text-primary hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100">
                                        <ExternalLink size={16} />
                                    </button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
