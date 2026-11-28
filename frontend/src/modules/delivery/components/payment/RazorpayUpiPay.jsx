import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import api from '@/lib/axios';

/**
 * UPI at the door, confirmed by Razorpay (client, Nov 2026: payment integrity).
 * Shows a Razorpay UPI QR for exactly `amount`; the customer pays with any UPI app. The screen checks
 * every few seconds and moves on by itself once Razorpay has the money - there is no "payment received"
 * button, and the server checks again before the delivery can be completed.
 * When the Razorpay account has no "QR Codes" feature (kind "checkout"), Razorpay's own payment window
 * opens on this phone instead: the customer pays by UPI there (UPI ID / UPI app); verified the same way.
 */

const loadCheckout = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const sc = document.createElement('script');
    sc.src = 'https://checkout.razorpay.com/v1/checkout.js';
    sc.async = true;
    sc.onload = () => resolve(true);
    sc.onerror = () => resolve(false);
    document.body.appendChild(sc);
});
export default function RazorpayUpiPay({ orderId, amount, onPaid, onCancel, cancelLabel = 'Customer wants to pay cash instead' }) {
    const [qr, setQr] = useState(null);
    const [error, setError] = useState('');
    const [starting, setStarting] = useState(true);
    const [windowOpen, setWindowOpen] = useState(false);
    const autoOpenedRef = useRef('');
    const paidRef = useRef(false);
    // The parent passes a new function each render: keep the latest without re-creating the QR
    const onPaidRef = useRef(onPaid);
    useEffect(() => { onPaidRef.current = onPaid; }, [onPaid]);

    const done = useCallback((info) => {
        if (paidRef.current) return;
        paidRef.current = true;
        setQr(info);
        setTimeout(() => onPaidRef.current?.(info), 900); // let the partner see the tick
    }, []);

    const start = useCallback(async () => {
        setStarting(true);
        setError('');
        try {
            const { data } = await api.post(`/orders/delivery/${orderId}/upi-qr`, { amount });
            const info = data?.result;
            if (info?.status === 'paid') done(info);
            else setQr(info);
        } catch (e) {
            setError(e.response?.data?.message || 'UPI payment could not be started. Please collect cash or try again.');
        } finally {
            setStarting(false);
        }
    }, [orderId, amount, done]);

    useEffect(() => { start(); }, [start]);

    // Ask the server (which asks Razorpay) every 3 seconds while the QR is shown
    useEffect(() => {
        if ((!qr?.qrId && !qr?.rzpOrderId) || qr.status === 'paid') return undefined;
        const id = setInterval(async () => {
            try {
                const { data } = await api.get(`/orders/delivery/${orderId}/upi-qr`);
                if (data?.result?.status === 'paid') done(data.result);
            } catch { /* keep trying */ }
        }, 3000);
        return () => clearInterval(id);
    }, [qr?.qrId, qr?.rzpOrderId, qr?.status, orderId, done]);

    // kind "checkout": Razorpay's payment window for this order, UPI first
    const openCheckout = useCallback(async () => {
        if (!qr?.rzpOrderId) return;
        setError('');
        const ok = await loadCheckout();
        if (!ok || !window.Razorpay) { setError('Could not open the UPI payment. Check the internet connection and try again.'); return; }
        setWindowOpen(true);
        const rzp = new window.Razorpay({
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            order_id: qr.rzpOrderId,
            amount: Math.round(Number(qr.amount) * 100),
            currency: 'INR',
            name: 'KisaanKart',
            description: `Order ${qr.orderRef || ''} - payment at delivery`.trim(),
            prefill: qr.customer?.contact ? { name: qr.customer.name || '', contact: qr.customer.contact } : undefined,
            config: { display: { blocks: { upi: { name: 'Pay by UPI', instruments: [{ method: 'upi' }] } }, sequence: ['block.upi'], preferences: { show_default_blocks: false } } },
            theme: { color: '#15803d' },
            handler: async (resp) => {
                setWindowOpen(false);
                try {
                    const { data } = await api.post(`/orders/delivery/${orderId}/upi-qr/verify`, resp);
                    if (data?.result?.status === 'paid') done(data.result);
                } catch (e) {
                    setError(e.response?.data?.message || 'Payment could not be verified yet. Please wait a moment.');
                }
            },
            modal: { ondismiss: () => setWindowOpen(false) },
        });
        rzp.on('payment.failed', (r) => setError(r?.error?.description ? `Payment failed: ${r.error.description}` : 'Payment failed. Ask the customer to try again or pay cash.'));
        rzp.open();
    }, [qr, orderId, done]);

    // Open Razorpay's payment window once by itself
    useEffect(() => {
        if (qr?.kind === 'checkout' && qr.rzpOrderId && qr.status !== 'paid' && autoOpenedRef.current !== qr.rzpOrderId) {
            autoOpenedRef.current = qr.rzpOrderId;
            openCheckout();
        }
    }, [qr, openCheckout]);

    const paid = qr?.status === 'paid';

    return (
        <div className="space-y-4 text-center" data-razorpay-upi>
            <div>
                <p className="text-xs font-bold uppercase text-slate-400">Customer pays by UPI</p>
                <p className="text-3xl font-black text-slate-900">Rs {Number(amount).toFixed(2)}</p>
            </div>

            {starting ? (
                <div className="mx-auto w-64 h-64 max-w-full rounded-2xl border border-slate-200 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : error ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 space-y-3" data-upi-error>
                    <p>{error}</p>
                    <button type="button" onClick={start} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-800 font-bold">
                        <RefreshCw className="w-4 h-4" /> Try again
                    </button>
                </div>
            ) : paid ? (
                <div className="mx-auto w-64 max-w-full rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 flex flex-col items-center gap-2" data-upi-paid>
                    <CheckCircle2 className="w-14 h-14 text-emerald-600" />
                    <p className="text-base font-black text-emerald-800">Payment received</p>
                    <p className="text-xs text-emerald-700">Confirmed by Razorpay</p>
                </div>
            ) : qr?.kind === 'checkout' ? (
                <div className="space-y-3" data-upi-checkout>
                    <div className="mx-auto w-64 max-w-full rounded-2xl border border-indigo-100 bg-indigo-50 p-5 flex flex-col items-center gap-2">
                        <Smartphone className="w-10 h-10 text-indigo-600" />
                        <p className="text-sm font-semibold text-indigo-900">Customer pays by UPI in the payment window on this phone</p>
                        <p className="text-[11px] text-indigo-700">Enter the customer's UPI ID (e.g. name@okaxis) - they approve it in their UPI app.</p>
                    </div>
                    <button type="button" onClick={openCheckout} disabled={windowOpen} data-upi-open
                        className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                        {windowOpen ? <Loader2 className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />} {windowOpen ? 'Payment window open…' : 'Pay by UPI now'}
                    </button>
                    <p className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700" data-upi-waiting>
                        <Loader2 className="w-4 h-4 animate-spin" /> Waiting for the payment…
                    </p>
                    <p className="text-[11px] text-slate-500">This screen moves on by itself once Razorpay confirms the payment.</p>
                </div>
            ) : (
                <>
                    <div className="mx-auto w-64 max-w-full bg-white border border-slate-200 rounded-2xl p-2">
                        {qr?.imageUrl
                            ? <img src={qr.imageUrl} alt="UPI QR to pay" className="w-full h-auto rounded-lg" data-upi-qr />
                            : <div className="h-60 flex items-center justify-center"><QrCode className="w-10 h-10 text-slate-300" /></div>}
                    </div>
                    <p className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700" data-upi-waiting>
                        <Loader2 className="w-4 h-4 animate-spin" /> Waiting for the payment…
                    </p>
                    <p className="text-[11px] text-slate-500">Ask the customer to scan this QR with any UPI app and pay. This screen moves on by itself once the payment is received. Only this QR can be used.</p>
                </>
            )}

            {!paid && (
                <button type="button" onClick={onCancel} className="text-xs font-bold text-slate-500" data-upi-cancel>
                    {cancelLabel}
                </button>
            )}
        </div>
    );
}
