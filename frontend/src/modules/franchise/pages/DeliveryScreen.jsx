import { useState, useEffect } from 'react';
import {
    Truck,
    User,
    CheckCircle2,
    Search,
    MapPin,
    Package,
    Phone,
    Clock,
    RefreshCw,
    ArrowRight,
    Map as MapIcon,
    Users,
    History,
    Send,
    Box,
    Printer,
} from 'lucide-react';
import { useFranchiseOrders } from '../contexts/FranchiseOrdersContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { FranchisePageHeader, StatTile, PillTabs } from '../components/layout/FranchisePageHeader';
import { byDeliveryTime } from '@/lib/deliverySlots';
import { printBills, canBill } from '../utils/printBill';
import { useFranchiseAuth } from '../contexts/FranchiseAuthContext';
import { estimateWeightKg, vehicleFor, vehicleLabel, isTwoWheeler, TWO_WHEELER_MAX_KG, MAX_ORDER_WEIGHT_KG } from '@/lib/deliveryVehicles';

const paymentText = (val) => {
    const m = String(val || 'COD').toUpperCase();
    if (m === 'COD') return 'Cash on Delivery';
    if (m.includes('WALLET')) return 'Wallet';
    if (m.includes('CREDIT')) return 'KK Credit';
    if (m === 'UPI' || m === 'ONLINE' || m === 'PREPAID') return 'Paid online';
    return m;
};

/**
 * A packed order waiting to go out (usually because no partner was free for the automatic assignment): pick the
 * delivery partner and the packed weight, then one button saves the weight and assigns the partner.
 * Up to 20 kg goes on a bike / scooter, more on an auto / 4-wheeler.
 */
function AssignBox({ order, partners, onAssign, onSaved }) {
    const saved = Number(order.packedWeightKg) || 0;
    const [weight, setWeight] = useState(saved || estimateWeightKg(order.items) || '');
    const [partnerId, setPartnerId] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (saved) setWeight(saved); }, [saved]);
    const kg = Number(weight) || 0;
    const heavy = kg > TWO_WHEELER_MAX_KG;
    // Bigger vehicles first for heavy orders
    const sorted = [...partners].sort((a, b) => (heavy ? Number(isTwoWheeler(a.vehicleType)) - Number(isTwoWheeler(b.vehicleType)) : 0));
    const chosen = partners.find((p) => p._id === partnerId);

    const send = async () => {
        if (!partnerId) return toast.error('Select a delivery partner');
        if (!(kg > 0)) return toast.error('Enter the packed weight (kg)');
        setBusy(true);
        try {
            if (kg !== saved) {
                await api.put(`/orders/franchise/${order.id}/packages`, { packedWeightKg: kg });
                if (onSaved) await onSaved();
            }
            await onAssign(order.id, partnerId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save the weight');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5" htmlFor={`dp-${order.id}`}>Select Delivery Partner</label>
                {partners.length ? (
                    <select id={`dp-${order.id}`} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                        className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-green-600">
                        <option value="">Choose partner</option>
                        {sorted.map((dp) => (
                            <option key={dp._id} value={dp._id}>
                                {dp.fullName}{dp.vehicleType ? ` (${vehicleLabel(dp.vehicleType)})` : ''}{dp.mobile || dp.phone ? ` - ${dp.mobile || dp.phone}` : ''}{heavy && isTwoWheeler(dp.vehicleType) ? ' - over 20 kg' : ''}
                            </option>
                        ))}
                    </select>
                ) : (
                    <p className="text-[14px] text-slate-500 p-3 text-center border border-dashed border-slate-200 rounded-xl">No delivery partners are available in your area right now</p>
                )}
            </div>
            <div>
                <p className={cn('text-[13px] font-semibold mb-1.5', saved ? 'text-slate-600' : 'text-amber-700')}>Packed weight (kg)</p>
                <div className="relative">
                    <input type="number" inputMode="decimal" min="0" step="0.1" value={weight} placeholder="0"
                        onChange={(e) => setWeight(e.target.value === '' ? '' : Math.min(MAX_ORDER_WEIGHT_KG, Math.max(0, Math.round(Number(e.target.value) * 100) / 100 || 0)))}
                        className={cn('w-full h-12 rounded-xl border bg-white text-center text-lg font-bold tabular-nums outline-none focus:border-green-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
                            saved ? 'border-slate-200' : 'border-amber-300')}
                        aria-label="Packed weight in kg" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-400">kg</span>
                </div>
                {kg > 0 && <p className={cn('text-[13px] font-semibold mt-1.5', heavy ? 'text-violet-700' : 'text-green-700')}>Goes on: {vehicleFor(kg)}</p>}
                {chosen && heavy && isTwoWheeler(chosen.vehicleType) && (
                    <p className="text-[13px] font-semibold text-rose-600 mt-1">{chosen.fullName} has a {vehicleLabel(chosen.vehicleType).toLowerCase()} - over {TWO_WHEELER_MAX_KG} kg needs an auto / 4-wheeler.</p>
                )}
            </div>
            <button type="button" onClick={send} disabled={busy || !partners.length}
                className="w-full h-12 rounded-xl bg-green-700 text-white text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-green-800 disabled:opacity-50">
                <Send size={18} /> {busy ? 'Sending…' : 'Assign & Send for Delivery'}
            </button>
        </div>
    );
}

export default function DeliveryScreen() {
    const {
        orders,
        updateOrderStatus,
        deliveryPartners,
        assignDeliveryPartner,
        refreshOrders,
        refreshPartners
    } = useFranchiseOrders();
    const [activeTab, setActiveTab] = useState('ready'); // 'ready' | 'way' | 'history'
    const { franchise } = useFranchiseAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // Franchise confirming a delivery also needs the customer's 4-digit code
    const [confirmingId, setConfirmingId] = useState(null);
    const [deliveryCode, setDeliveryCode] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 600);
        return () => clearTimeout(timer);
    }, []);

    const handleRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        try {
            await Promise.all([
                refreshOrders?.(),
                refreshPartners?.()
            ]);
            toast.success('Delivery data refreshed');
        } catch (error) {
            console.error('Refresh dispatch data error:', error);
            toast.error('Failed to refresh delivery data');
        } finally {
            setIsRefreshing(false);
        }
    };

    const TAB_STATUS = { ready: ['packed'], way: ['dispatched'], history: ['delivered', 'received'] };
    const matching = orders.filter(o => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (o.hotelName?.toLowerCase() || '').includes(q) || (o.id?.toLowerCase() || '').includes(q);
        return matchesSearch && TAB_STATUS[activeTab].includes(o.status);
    });
    // Earliest delivery day + slot first while assigning / delivering
    const filteredOrders = activeTab === 'history' ? matching : [...matching].sort(byDeliveryTime);

    const readyCount = orders.filter(o => o.status === 'packed').length;
    const outCount = orders.filter(o => o.status === 'dispatched').length;
    const completedCount = orders.filter(o => ['delivered', 'received'].includes(o.status)).length;

    if (isLoading) {
        return (
            <div className="p-4 lg:p-6 space-y-4 animate-pulse bg-[#f6f8f7] min-h-screen">
                <div className="h-14 w-72 bg-slate-200 rounded-2xl" />
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-2xl" />)}</div>
                <div className="h-[400px] bg-white rounded-3xl" />
            </div>
        );
    }

    const renderSide = (order) => {
        if (activeTab === 'ready') {
            return <AssignBox order={order} partners={deliveryPartners} onAssign={assignDeliveryPartner} onSaved={refreshOrders} />;
        }
        if (activeTab === 'way') {
            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-violet-50/70 border border-violet-100">
                        <span className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><User size={22} /></span>
                        <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-violet-700">Out for delivery</p>
                            <p className="text-[15px] font-bold text-slate-900 truncate">{order.deliveryPartner?.fullName || 'Assigned Partner'}</p>
                            <p className="text-[13px] text-slate-500 tabular-nums">{order.deliveryPartner?.mobile || 'Contact pending'}</p>
                        </div>
                    </div>
                    {confirmingId === order.id ? (
                        <div className="flex gap-2">
                            <input
                                inputMode="numeric"
                                autoFocus
                                maxLength={4}
                                value={deliveryCode}
                                onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="Customer code"
                                className="flex-1 min-w-0 h-12 border border-slate-200 rounded-xl px-2 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-green-600"
                            />
                            <button
                                disabled={deliveryCode.length !== 4}
                                onClick={async () => {
                                    const ok = await updateOrderStatus(order.id, 'Delivered', { otp: deliveryCode });
                                    if (ok) { setConfirmingId(null); setDeliveryCode(''); }
                                }}
                                className="h-12 px-4 bg-green-700 text-white rounded-xl font-bold text-[14px] disabled:opacity-40"
                            >
                                Confirm
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => { setConfirmingId(order.id); setDeliveryCode(''); }}
                            className="w-full h-12 rounded-xl border border-green-700 text-green-800 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-green-50"
                        >
                            Confirm Delivery <ArrowRight size={18} />
                        </button>
                    )}
                </div>
            );
        }
        const deliveryLog = order.statusHistory?.find(h => h.status?.toLowerCase() === 'delivered');
        const isFranchiseDelivered = deliveryLog?.updatedBy === 'franchise';
        return (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50/70 border border-green-100">
                <span className="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0"><CheckCircle2 size={22} /></span>
                <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-green-700">Delivered</p>
                    <p className="text-[15px] font-bold text-slate-900 truncate">{isFranchiseDelivered ? 'Franchise Self-Delivery' : (order.deliveryPartner?.fullName || 'Hub Management')}</p>
                    <p className="text-[13px] text-slate-500">{isFranchiseDelivered ? 'Confirmed by franchise' : 'Partner verified'}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#f6f8f7] min-h-screen pb-24 lg:pb-8">
            <FranchisePageHeader icon={Truck} title="Deliveries" subtitle="Send ready orders with a delivery partner and track them" />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4 px-4 lg:px-6">
                <StatTile tone="orange" icon={Package} label="Ready to Send" value={readyCount} note="Packed, choose a partner" onClick={() => setActiveTab('ready')} active={activeTab === 'ready'} />
                <StatTile tone="purple" icon={Truck} label="On the Way" value={outCount} note="With delivery partners" onClick={() => setActiveTab('way')} active={activeTab === 'way'} />
                <StatTile tone="green" icon={CheckCircle2} label="Delivered" value={completedCount} note="Total delivered" onClick={() => setActiveTab('history')} active={activeTab === 'history'} />
                <StatTile tone="blue" icon={Users} label="Delivery Partners" value={deliveryPartners.length} note="Available now" />
            </div>

            <div className="px-4 lg:px-6 mt-5 flex flex-wrap items-center gap-3">
                <PillTabs
                    tabs={[
                        { id: 'ready', label: 'Ready to Send', icon: Package, count: readyCount },
                        { id: 'way', label: 'On the Way', icon: Truck, count: outCount },
                        { id: 'history', label: 'Delivery History', icon: History, count: completedCount },
                    ]}
                    active={activeTab}
                    onChange={setActiveTab}
                />
                <div className="flex-1" />
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search order no. or hotel"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.trim())}
                        className="w-full sm:w-72 h-11 bg-white border border-slate-200 rounded-xl pl-11 pr-4 outline-none text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-green-600"
                    />
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Refresh delivery data"
                    aria-label="Refresh delivery data"
                    className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60"
                >
                    <RefreshCw size={18} className={cn(isRefreshing && 'animate-spin')} />
                </button>
            </div>

            <div className="px-4 lg:px-6 mt-4 space-y-4">
                {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                    <div key={order.id} className="bg-white rounded-3xl border border-slate-100 p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
                        <div className="space-y-4 min-w-0">
                            <div className="flex flex-wrap items-start gap-4">
                                <span className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center shrink-0"><Package size={26} /></span>
                                <div className="flex-1 min-w-[180px]">
                                    <p className="text-[16px] font-bold text-slate-900">Order #{String(order.id).slice(-6).toUpperCase()}</p>
                                    <p translate="no" className="text-[16px] font-semibold text-slate-800">{order.hotelName}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[13px] text-slate-500">
                                        {order.customerMobile && <a href={`tel:${order.customerMobile}`} className="flex items-center gap-1 hover:text-green-700"><Phone size={13} /> {order.customerMobile}</a>}
                                        <span className="flex items-center gap-1"><Clock size={13} /> {order.deliverySlot}</span>
                                        {order.city && <span className="flex items-center gap-1"><MapPin size={13} /> {order.city}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[12px] text-slate-500">Order value</p>
                                    <p className="text-[18px] font-bold text-slate-900 tabular-nums">₹{Number(order.total || 0).toLocaleString('en-IN')}</p>
                                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-[12px] font-semibold bg-amber-50 text-amber-700">{paymentText(order.paymentMode)}</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                                <MapPin size={18} className="text-slate-500 shrink-0 mt-0.5" />
                                <p className="flex-1 text-[14px] text-slate-700 leading-snug">{order.address}</p>
                                {order.address && order.address !== 'Address not provided' && (
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer"
                                        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 text-[13px] font-semibold text-green-800 hover:bg-green-50">
                                        <MapIcon size={15} /> View Map
                                    </a>
                                )}
                            </div>
                            <div>
                                <p className="text-[13px] font-semibold text-slate-600 mb-2">Items ({order.items?.length || 0})</p>
                                <div className="flex flex-wrap gap-2">
                                    {order.items?.map((item, idx) => (
                                        <span key={idx} className="px-3 py-1.5 rounded-lg bg-slate-50 text-[13px] text-slate-700">
                                            {item.name} <b className="text-slate-900 tabular-nums">{item.quantity ?? item.qty} {item.unit}</b>
                                        </span>
                                    ))}
                                </div>
                                {Number(order.packedWeightKg) > 0 ? (
                                    <p className="mt-2 text-[13px] text-slate-600 flex items-center gap-1.5"><Box size={14} /> {order.packedWeightKg} kg packed · {vehicleFor(order.packedWeightKg)}</p>
                                ) : Number(order.numberOfPackages) > 0 && (
                                    <p className="mt-2 text-[13px] text-slate-600 flex items-center gap-1.5"><Box size={14} /> {order.numberOfPackages} package{order.numberOfPackages > 1 ? 's' : ''}</p>
                                )}
                                {canBill(order) && (
                                    <button
                                        type="button"
                                        onClick={() => { if (!printBills([order], franchise)) toast.error('Allow pop-ups for this site to print the bill'); }}
                                        className="mt-3 h-10 px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-800 inline-flex items-center gap-2 hover:bg-slate-50"
                                    >
                                        <Printer size={16} /> Print Bill
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="lg:border-l lg:border-slate-100 lg:pl-5">{renderSide(order)}</div>
                    </div>
                )) : (
                    <div className="bg-white rounded-3xl border border-slate-100 py-20 text-center text-slate-500">
                        <Truck size={44} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-[16px] font-semibold">
                            {activeTab === 'ready' ? 'No orders ready to send' : activeTab === 'way' ? 'No orders on the way' : 'No deliveries yet'}
                        </p>
                        <p className="text-[14px] mt-1">Orders appear here once they are packed</p>
                    </div>
                )}
            </div>
        </div>
    );
}
