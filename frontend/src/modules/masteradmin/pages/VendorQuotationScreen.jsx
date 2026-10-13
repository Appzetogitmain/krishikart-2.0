import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingBasket,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronRight,
    HandHelping,
    Package,
    IndianRupee,
    Info,
    FileText,
    ArrowUpRight,
    Loader2
} from 'lucide-react';
// import { useProcurement } from '../../franchise/contexts/ProcurementContext'; // Removed context
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdmin } from '../contexts/AdminContext';

export default function VendorQuotationScreen() {
    const [quotations, setQuotations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [editedItems, setEditedItems] = useState([]);

    const { newQuotationData } = useAdmin();

    useEffect(() => {
        fetchQuotations();
    }, []);

    useEffect(() => {
        if (newQuotationData) {
            fetchQuotations();
        }
    }, [newQuotationData]);

    useEffect(() => {
        if (selectedRequest) {
            setEditedItems(selectedRequest.items.map(item => ({
                ...item,
                quantity: item.qty || item.quantity,
                quotedPrice: item.quotedPrice
            })));
        } else {
            setEditedItems([]);
        }
    }, [selectedRequest]);

    const fetchQuotations = async () => {
        try {
            const response = await api.get('/procurement/admin/all');
            if (response.data.success) {
                const allRequests = response.data.results;
                const filtered = allRequests.filter(req => req.status === 'quoted' || req.status === 'approved');
                setQuotations(filtered);
            }
        } catch (error) {
            console.error("Failed to fetch quotations:", error);
            toast.error("Failed to load quotations");
        } finally {
            setIsLoading(false);
        }
    };

    const handleItemEdit = (idx, field, value) => {
        const newItems = [...editedItems];
        newItems[idx] = { ...newItems[idx], [field]: Number(value) || 0 };
        setEditedItems(newItems);
    };

    const currentTotal = editedItems.reduce((acc, item) => 
        acc + (Number(item.quotedPrice || 0) * Number(item.quantity || 0)), 0
    );

    const handleApprove = async (id) => {
        try {
            const response = await api.put(`/procurement/admin/${id}/status`, { 
                status: 'approved',
                items: editedItems 
            });
            if (response.data.success) {
                toast.success('Quotation approved with changes! Vendor has been notified.');
                setSelectedRequest(null);
                fetchQuotations(); 
            }
        } catch (error) {
            console.error("Failed to approve:", error);
            toast.error("Failed to approve quotation");
        }
    };

    const handleReject = async (id) => {
        try {
            const response = await api.put(`/procurement/admin/${id}/status`, { status: 'rejected' });
            if (response.data.success) {
                toast.success('Quotation rejected.');
                setSelectedRequest(null);
                fetchQuotations();
            }
        } catch (error) {
            console.error("Failed to reject:", error);
            toast.error("Failed to reject quotation");
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50">
                <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-slate-50">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                        <HandHelping size={20} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Vendor Quotations</h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Review, edit and approve vendor quotations</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quotation List */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quotations</h3>
                    <div className="space-y-3">
                        {quotations.length > 0 ? quotations.map((req) => (
                            <motion.button
                                key={req._id || req.id}
                                whileHover={{ x: 4 }}
                                onClick={() => setSelectedRequest(req)}
                                className={cn(
                                    "w-full p-4 rounded-xl border text-left transition-all group",
                                    (selectedRequest?._id || selectedRequest?.id) === (req._id || req.id)
                                        ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                                        : "bg-white border-slate-200 hover:border-slate-400 text-slate-600"
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm",
                                        req.status === 'approved' ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                                    )}>
                                        {req.status}
                                    </span>
                                    <span className="text-[10px] font-bold opacity-60 tabular-nums">
                                        {new Date(req.createdAt || req.date).toLocaleDateString()}
                                    </span>
                                </div>
                                <h4 className="text-[11px] font-black uppercase tracking-wider mb-1">REQ #{(req._id || req.id).slice(-6)}</h4>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{req.items.length} items</span>
                                    <span className="text-sm font-black tabular-nums">₹{req.totalQuotedAmount?.toLocaleString()}</span>
                                </div>
                            </motion.button>
                        )) : (
                            <div className="p-12 text-center rounded-xl border border-dashed border-slate-200 bg-white">
                                <Clock size={32} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No active quotations found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quotation Details */}
                <div className="lg:col-span-2">
                    {selectedRequest ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm sticky top-8"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-900 shadow-sm">
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Review Quotation</h3>
                                            <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded-sm uppercase tracking-tighter">Editable</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REQ #{(selectedRequest._id || selectedRequest.id).slice(-6)}</p>
                                    </div>
                                </div>
                                {selectedRequest.status === 'approved' && (
                                    <div className="flex items-center gap-2 text-emerald-600 px-3 py-1 bg-emerald-50 rounded-sm border border-emerald-100">
                                        <CheckCircle2 size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Approved</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-6">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                <th className="text-left pb-4">Product</th>
                                                <th className="text-center pb-4">Quantity</th>
                                                <th className="text-right pb-4">Rate (INR)</th>
                                                <th className="text-right pb-4">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {editedItems.map((item, idx) => (
                                                <tr key={idx} className="group italic-row hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-sm bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                                {item.image ? (
                                                                    <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                                                ) : (
                                                                    <Package size={16} className="text-slate-300" />
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none max-w-[150px]">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 text-center">
                                                        {selectedRequest.status === 'quoted' ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleItemEdit(idx, 'quantity', e.target.value)}
                                                                    className="w-16 h-8 bg-slate-50 border border-slate-200 rounded text-center text-[10px] font-black focus:outline-none focus:border-slate-900 transition-all"
                                                                />
                                                                <span className="text-[10px] font-black text-slate-400 uppercase">{item.unit}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{item.quantity} {item.unit}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 text-right">
                                                        {selectedRequest.status === 'quoted' ? (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span className="text-[10px] font-black text-slate-400 tracking-tighter">₹</span>
                                                                <input
                                                                    type="number"
                                                                    value={item.quotedPrice}
                                                                    onChange={(e) => handleItemEdit(idx, 'quotedPrice', e.target.value)}
                                                                    className="w-20 h-8 bg-slate-50 border border-slate-200 rounded text-right pr-2 text-[10px] font-black focus:outline-none focus:border-slate-900 transition-all"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-black text-slate-900 tabular-nums">₹{item.quotedPrice}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 text-right">
                                                        <span className="text-[11px] font-black text-slate-900 tabular-nums">₹{(item.quantity * item.quotedPrice).toLocaleString()}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-end pt-8 border-t border-slate-100">
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 text-orange-900 mb-1">
                                            <Info size={14} />
                                            <h5 className="text-[10px] font-black uppercase tracking-widest">Note</h5>
                                        </div>
                                        <p className="text-[10px] text-orange-800/70 font-bold uppercase leading-relaxed tracking-wider">
                                            You can change quantities or prices here. Your changes replace the vendor’s quote and become the final approved amount.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-baseline mb-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Approved Total</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">₹{currentTotal.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">INR</span>
                                            </div>
                                        </div>

                                        {selectedRequest.status === 'quoted' && (
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleReject(selectedRequest._id || selectedRequest.id)}
                                                    className="flex-1 h-12 rounded-sm border border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <XCircle size={16} /> Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(selectedRequest._id || selectedRequest.id)}
                                                    className="flex-[2] h-12 bg-slate-900 text-white rounded-sm font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle2 size={16} /> Approve
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-20 text-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50">
                            <div className="w-20 h-20 bg-white shadow-xl rounded-full flex items-center justify-center text-slate-200 mb-6">
                                <ArrowUpRight size={32} strokeWidth={1} />
                            </div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Choose a quotation to review</h3>
                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2 max-w-[200px] leading-relaxed">
                                You can check and edit a quotation before approving it.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
