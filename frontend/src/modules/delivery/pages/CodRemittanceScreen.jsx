import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, IndianRupee, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
// import { useDeliveryAuth } from '../contexts/DeliveryAuthContext'; // Razorpay prefill — disabled

export default function CodRemittanceScreen() {
    const navigate = useNavigate();
    // const { delivery } = useDeliveryAuth(); // used by Razorpay UPI prefill (disabled)
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [history, setHistory] = useState([]);
    const [totals, setTotals] = useState({
        pendingAmount: 0,
        submittedAmount: 0,
        verifiedAmount: 0,
    });
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [referenceNo, setReferenceNo] = useState('');
    const [note, setNote] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [summaryRes, historyRes] = await Promise.all([
                api.get('/delivery/cod/summary'),
                api.get('/delivery/cod/remittances'),
            ]);

            if (summaryRes.data.success) {
                const orders = summaryRes.data.result?.pendingOrders || [];
                setPendingOrders(orders);
                setTotals(summaryRes.data.result?.totals || {
                    pendingAmount: 0,
                    submittedAmount: 0,
                    verifiedAmount: 0,
                });
                setSelectedOrderIds(orders.map((o) => o.orderId));
            }

            if (historyRes.data.success) {
                setHistory(historyRes.data.result || []);
            }
        } catch (error) {
            console.error('COD fetch error:', error);
            toast.error(error.response?.data?.message || 'Failed to load COD data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const selectedAmount = useMemo(
        () => pendingOrders
            .filter((o) => selectedOrderIds.includes(o.orderId))
            .reduce((sum, o) => sum + Number(o.amount || 0), 0),
        [pendingOrders, selectedOrderIds]
    );

    const toggleOrder = (orderId) => {
        setSelectedOrderIds((prev) =>
            prev.includes(orderId)
                ? prev.filter((id) => id !== orderId)
                : [...prev, orderId]
        );
    };

    /* Razorpay (UPI remittance) — temporarily disabled
    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };
    */

    const handleSubmitRemittance = async () => {
        if (!selectedOrderIds.length) {
            toast.error('Select at least one order');
            return;
        }

        // Razorpay UPI disabled — use cash / manual remittance only
        if (paymentMethod === 'upi') {
            toast.error('UPI remittance is temporarily unavailable. Please use cash.');
            return;
        }

        try {
            setSubmitting(true);

            /* Razorpay UPI flow — temporarily disabled
            if (paymentMethod === 'upi') {
                const isLoaded = await loadRazorpay();
                if (!isLoaded) {
                    toast.error('Razorpay SDK failed to load');
                    return;
                }

                // 1. Create Razorpay order for the remittance
                const orderRes = await api.post('/delivery/cod/razorpay-order', {
                    amount: selectedAmount
                });

                if (!orderRes.data.success) throw new Error('Order creation failed');

                const { amount, id: rzpOrderId, currency } = orderRes.data.result;

                // 2. Open Razorpay Checkout
                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    amount,
                    currency,
                    name: "Kisaankart Admin",
                    description: `COD Remittance for ${selectedOrderIds.length} orders`,
                    order_id: rzpOrderId,
                    handler: async (response) => {
                        try {
                            // 3. Verify payment on backend
                            const verifyRes = await api.post('/delivery/cod/verify-upi', {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                orderIds: selectedOrderIds,
                                note
                            });

                            if (verifyRes.data.success) {
                                toast.success('Remittance verified and completed');
                                setReferenceNo('');
                                setNote('');
                                await fetchData();
                            }
                        } catch (err) {
                            toast.error(err.response?.data?.message || 'Verification failed');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setSubmitting(false);
                        }
                    },
                    prefill: {
                        name: delivery?.fullName || '',
                        contact: delivery?.mobile || ''
                    },
                    theme: { color: "#16a34a" }
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
                // Note: We don't setSubmitting(false) here because Razorpay is async
            } else {
            */

            // Cash Flow (Existing)
            const response = await api.post('/delivery/cod/remittance', {
                orderIds: selectedOrderIds,
                paymentMethod,
                referenceNo,
                note
            });
            if (response.data.success) {
                toast.success('COD remittance submitted to admin');
                setReferenceNo('');
                setNote('');
                await fetchData();
            }
            setSubmitting(false);
            // } // end Razorpay else
        } catch (error) {
            console.error('COD submit error:', error);
            toast.error(error.response?.data?.message || 'Failed to submit remittance');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="px-6 pt-8 pb-4 bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900">COD Remittance</h1>
                </div>
            </div>

            <div className="p-6 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Pending" value={totals.pendingAmount} tone="amber" />
                    <StatCard label="Submitted" value={totals.submittedAmount} tone="blue" />
                    <StatCard label="Verified" value={totals.verifiedAmount} tone="emerald" />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-slate-900">Pending COD Orders</h2>
                        <button
                            onClick={() => setSelectedOrderIds(pendingOrders.map((o) => o.orderId))}
                            className="text-xs font-bold text-primary"
                        >
                            Select all
                        </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {pendingOrders.length === 0 && (
                            <p className="text-xs text-slate-500">No pending COD orders.</p>
                        )}
                        {pendingOrders.map((order) => (
                            <label key={order.orderId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedOrderIds.includes(order.orderId)}
                                        onChange={() => toggleOrder(order.orderId)}
                                    />
                                    <div>
                                        <p className="text-xs font-bold text-slate-900">#{String(order.orderId).slice(-6)}</p>
                                        <p className="text-[11px] text-slate-500">{order.collectedAt && !isNaN(new Date(order.collectedAt).getTime()) ? new Date(order.collectedAt).toLocaleString() : 'N/A'}</p>
                                    </div>
                                </div>
                                <p className="text-sm font-black text-slate-900">Rs {Number(order.amount || 0).toFixed(2)}</p>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <h2 className="text-sm font-bold text-slate-900">Submit to Admin</h2>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Razorpay UPI option temporarily disabled — only cash */}
                        {['cash' /* , 'upi' */].map((method) => (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={`py-4 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all ${paymentMethod === method
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                                    : 'bg-white text-slate-500 border-slate-200'
                                    }`}
                            >
                                {method.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <input
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        placeholder="Reference no. (optional)"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all"
                    />
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Note (optional)"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all min-h-[72px]"
                    />
                    <button
                        disabled={submitting || !selectedOrderIds.length}
                        onClick={handleSubmitRemittance}
                        className="w-full h-14 rounded-2xl bg-primary text-white font-black text-[12px] uppercase tracking-[0.2em] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-3 shadow-[0_20px_40px_-15px_rgba(22,163,74,0.3)] active:scale-95 transition-all"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <IndianRupee className="w-5 h-5" />}
                        Submit ₹{selectedAmount.toFixed(2)}
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h2 className="text-sm font-bold text-slate-900 mb-3">My Remittance History</h2>
                    <div className="space-y-2">
                        {history.length === 0 && <p className="text-xs text-slate-500">No remittances yet.</p>}
                        {history.map((r) => (
                            <div key={r._id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{r.createdAt && !isNaN(new Date(r.createdAt).getTime()) ? new Date(r.createdAt).toLocaleString() : 'N/A'}</p>
                                    <p className="text-[11px] text-slate-500">{r.paymentMethod.toUpperCase()} {r.referenceNo ? `• ${r.referenceNo}` : ''}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">Rs {Number(r.amount || 0).toFixed(2)}</p>
                                    <p className={`text-[11px] font-bold uppercase ${r.status === 'verified' ? 'text-emerald-600' : r.status === 'submitted' ? 'text-blue-600' : 'text-rose-600'}`}>
                                        {r.status}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, tone }) {
    const toneClass = tone === 'emerald'
        ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
        : tone === 'blue'
            ? 'text-blue-700 bg-blue-50 border-blue-100'
            : 'text-amber-700 bg-amber-50 border-amber-100';

    return (
        <div className={`rounded-xl border p-3 ${toneClass}`}>
            <p className="text-[10px] font-bold uppercase">{label}</p>
            <p className="text-sm font-black mt-1">Rs {Number(value || 0).toFixed(2)}</p>
        </div>
    );
}
