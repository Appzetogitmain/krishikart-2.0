import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    Plus,
    Wallet,
    History,
    FileText,
    Download,
    Star,
    Clock,
    ChevronRight,
    Info,
    CheckCircle2,
    RefreshCcw,
    Zap,
    X
} from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '@/lib/utils'

export default function WalletScreen() {
    const navigate = useNavigate()
    const { balance, transactions, addMoney, loyaltyPoints, redeemLoyaltyPoints, loyaltyConfig, fetchWalletData, isLoading: walletLoading } = useWallet()
    const [amountToAdd, setAmountToAdd] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [activeFilter, setActiveFilter] = useState('All')
    const [successMessage, setSuccessMessage] = useState('')
    const [isAddMoneyModalOpen, setIsAddMoneyModalOpen] = useState(false)

    const filters = [
        'All', 'Expiring', 'Recharge', 'Refund', 'Loyalty'
    ]

    const quickAddAmounts = [1000, 2000, 5000]

    const handleAddMoney = async (amount = amountToAdd) => {
        const value = amount || amountToAdd;
        if (!value || isNaN(value) || value <= 0) return

        setIsProcessing(true)
        const result = await addMoney(Number(value))
        setIsProcessing(false)
        if (result?.success) {
            setSuccessMessage('Recharge successful! Funds added to your wallet.')
            setShowSuccess(true)
            setAmountToAdd('')
        } else {
            setSuccessMessage(result?.message || 'Recharge failed. Please try again.')
            setShowSuccess(true)
        }
    }

    const filteredTransactions = activeFilter === 'All'
        ? transactions
        : transactions.filter(t => {
            if (activeFilter === 'Loyalty') return t.type === 'Loyalty Bonus' || t.type === 'Redemption';
            if (activeFilter === 'Recharge') return t.type === 'Added';
            if (activeFilter === 'Refund') return t.type === 'Refund';
            if (activeFilter === 'Used') return t.type === 'Paid';
            return true;
        })

    return (
        <PageTransition>
            <div className="bg-[#fcfdff] min-h-screen">
                {/* Mobile Header (Hidden on Desktop) */}
                <div className="lg:hidden bg-white px-6 py-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-40">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 active:scale-95 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kisaankart Wallet</h1>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
                    {/* Desktop Page Title */}
                    <h1 className="hidden lg:block text-2xl font-bold text-slate-900 mb-8 font-sans">Kisaankart Wallet</h1>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Main Content Area */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Balance Card - The Big One */}
                            <div className="bg-[#eff6ff] rounded-2xl p-5 md:p-8 flex items-center justify-between border border-blue-100 relative overflow-hidden group shadow-sm">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/40 rounded-full -mr-24 -mt-24 blur-3xl opacity-50" />
                                <div className="flex items-center gap-5 md:gap-8 relative z-10">
                                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-sm border border-blue-50 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                        <Wallet size={40} className="text-[#3b82f6]" strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-3xl md:text-5xl font-bold text-[#1e40af] tracking-tight tabular-nums leading-tight">
                                            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </h2>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[11px] font-black text-[#60a5fa] uppercase tracking-[0.15em] ml-1">
                                                Your Wallet Balance
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={() => setIsAddMoneyModalOpen(true)}
                                                className="h-8 px-3 rounded-full bg-[#1e40af] hover:bg-[#1d4ed8] text-white text-xs font-bold tracking-tight shadow-sm active:scale-[0.97]"
                                            >
                                                Add Money
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Loyalty Points Bubble */}
                                <div className="hidden md:flex flex-col items-end gap-1 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-xl border border-blue-50 relative z-10 shadow-sm">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Star size={14} className="fill-primary" />
                                        <span className="text-sm font-bold tabular-nums">{loyaltyPoints}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KK Points</span>
                                </div>
                            </div>

                            {/* Wallet History Section */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Wallet History</h3>
                                    <button
                                        onClick={fetchWalletData}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                                        disabled={walletLoading}
                                    >
                                        <RefreshCcw size={16} className={cn(walletLoading && "animate-spin")} />
                                    </button>
                                </div>

                                {/* Filters Tags */}
                                <div className="flex flex-wrap gap-2 py-1">
                                    {filters.map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setActiveFilter(filter)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                                activeFilter === filter
                                                    ? "bg-[#e2f1f1] text-[#2d7d7d] border-[#2d7d7d]/20"
                                                    : "bg-white text-slate-500 border-transparent hover:border-slate-200"
                                            )}
                                        >
                                            {filter}
                                        </button>
                                    ))}
                                </div>

                                {/* Transactions List */}
                                <div className="space-y-3 pt-2">
                                    {filteredTransactions.length > 0 ? (
                                        filteredTransactions.map((txn) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                key={txn.id}
                                                className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-blue-100 transition-colors shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-sm",
                                                        txn.type === 'Added' || txn.type === 'Refund' || txn.type === 'Redemption' ? "bg-emerald-50 text-emerald-500" :
                                                            txn.type === 'Loyalty Bonus' ? "bg-blue-50 text-blue-500" :
                                                                "bg-[#fef2f2] text-red-500"
                                                    )}>
                                                        {txn.type === 'Added' ? <RefreshCcw size={18} /> :
                                                            txn.type === 'Loyalty Bonus' ? <Star size={18} className="fill-current" /> :
                                                                txn.type === 'Redemption' || txn.type === 'Refund' ? <Zap size={18} /> :
                                                                    <Clock size={18} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 leading-none mb-1">
                                                            {txn.type === 'Added' ? 'Recharge' :
                                                                txn.type === 'Loyalty Bonus' ? 'Loyalty Bonus' :
                                                                    txn.type === 'Redemption' ? 'Points Redeemed' :
                                                                        txn.type === 'Refund' ? 'Refund Received' :
                                                                        'Paid'}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{txn.date} • {txn.id}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right space-y-0.5">
                                                    <p className={cn(
                                                        "text-base font-bold tracking-tight tabular-nums",
                                                        txn.type === 'Added' || txn.type === 'Redemption' || txn.type === 'Refund' ? "text-emerald-600" :
                                                            txn.type === 'Loyalty Bonus' ? "text-blue-600" :
                                                                "text-slate-900"
                                                    )}>
                                                        {txn.type === 'Added' || txn.type === 'Loyalty Bonus' || txn.type === 'Redemption' || txn.type === 'Refund' ? '+' : '-'}
                                                        {txn.type === 'Loyalty Bonus' ? '' : '₹'}
                                                        {txn.amount.toLocaleString('en-IN')}
                                                        {txn.type === 'Loyalty Bonus' ? ' Pts' : ''}
                                                    </p>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <div className={cn("w-1.5 h-1.5 rounded-full", txn.status === 'Success' ? "bg-emerald-500" : "bg-amber-400")} />
                                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">{txn.status}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-100 italic text-slate-400 text-sm font-bold">
                                            No transaction found for "{activeFilter}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Loyalty Points Redemption Card */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-bold text-slate-800">Redeem Points</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Convert KK Points to Cash</p>
                                    </div>
                                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                        {loyaltyPoints} Pts
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        <span>Conversion Rate</span>
                                        <span>{loyaltyConfig?.redemptionRate || 10} Pts = ₹1</span>
                                    </div>
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-1000"
                                            style={{ width: `${Math.min((loyaltyPoints / ((loyaltyConfig?.minRedeemPoints || 100) * 10)) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                        Minimum {loyaltyConfig?.minRedeemPoints || 100} points required to redeem. Current value: ₹{Math.floor(loyaltyPoints / (loyaltyConfig?.redemptionRate || 10))}
                                    </p>
                                </div>

                                <Button
                                    disabled={loyaltyPoints < (loyaltyConfig?.minRedeemPoints || 100)}
                                    onClick={async () => {
                                        if (await redeemLoyaltyPoints(loyaltyPoints)) {
                                            setSuccessMessage(`Redeemed ₹${Math.floor(loyaltyPoints / (loyaltyConfig?.redemptionRate || 10))} to your wallet!`)
                                            setShowSuccess(true);
                                            setTimeout(() => setShowSuccess(false), 2000);
                                        }
                                    }}
                                    className={cn(
                                        "w-full h-12 font-bold tracking-tight rounded-xl transition-all",
                                        loyaltyPoints >= (loyaltyConfig?.minRedeemPoints || 100)
                                            ? "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 active:scale-[0.98]"
                                            : "bg-slate-100 text-slate-400"
                                    )}
                                >
                                    Redeem Now
                                </Button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Add Money Modal */}
                <AnimatePresence>
                    {isAddMoneyModalOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/60 z-[120]"
                                onClick={() => !isProcessing && setIsAddMoneyModalOpen(false)}
                            />
                            <motion.div
                                initial={{ y: 40, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 40, opacity: 0 }}
                                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                                className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 top-1/2 -translate-y-1/2 md:w-full md:max-w-md bg-white rounded-2xl shadow-2xl z-[130] border border-slate-100"
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">Add money</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add money instantly using UPI</p>
                                    </div>
                                    <button
                                        onClick={() => !isProcessing && setIsAddMoneyModalOpen(false)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        <X size={16} strokeWidth={2.5} />
                                    </button>
                                </div>

                                <div className="p-5 space-y-4">
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">₹</span>
                                        <Input
                                            type="number"
                                            placeholder="Enter amount"
                                            className="h-12 pl-8 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold placeholder:text-slate-300 rounded-xl"
                                            value={amountToAdd}
                                            onChange={(e) => setAmountToAdd(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        onClick={() => handleAddMoney()}
                                        disabled={!amountToAdd || isProcessing}
                                        className={cn(
                                            "w-full h-12 bg-[#d1d5db] text-[#4b5563] font-bold tracking-tight rounded-xl hover:bg-slate-300 transition-all",
                                            amountToAdd && "bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 active:scale-[0.98]"
                                        )}
                                    >
                                        {isProcessing ? (
                                            <RefreshCcw className="animate-spin mr-2" size={16} />
                                        ) : "Add"}
                                    </Button>

                                    <div className="grid grid-cols-1 gap-2 pt-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quick Recharge</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {quickAddAmounts.map((amt) => (
                                                <button
                                                    key={amt}
                                                    onClick={() => setAmountToAdd(String(amt))}
                                                    className="py-2.5 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
                                                >
                                                    <span className="leading-none text-[10px]">+₹{amt.toLocaleString('en-IN')}</span>
                                                    {amt === 2000 && <span className="text-[10px] text-[#3b82f6] font-black uppercase tracking-tighter">Popular</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Success Notification Toast */}
                <AnimatePresence>
                    {showSuccess && (
                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 50, opacity: 0 }}
                            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 py-4 px-8 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10"
                        >
                            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                                <CheckCircle2 size={16} />
                            </div>
                            <span className="text-white text-sm font-bold tracking-tight">{successMessage}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PageTransition>
    )
}


