import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Undo2, Truck } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusStyles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    pickup_assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    picked_up: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    completed: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function ReturnsScreen() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReturns = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const response = await api.get('/masteradmin/returns');
            if (response.data.success) {
                setOrders(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch admin return requests error:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch return requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchReturns();
    }, []);

    const rows = useMemo(() => {
        const all = [];
        for (const order of orders) {
            (order.returnRequests || []).forEach((rr, index) => {
                all.push({
                    orderId: order._id,
                    requestIndex: index,
                    status: rr.status || 'pending',
                    reason: rr.reason || '',
                    requestedAt: rr.requestedAt,
                    franchiseReviewReason: rr.franchiseReviewReason || '',
                    items: rr.items || [],
                    customerName: order.userId?.fullName || 'Customer',
                    customerMobile: order.userId?.mobile || '',
                    franchiseName:
                        order.franchiseId?.shopName ||
                        order.franchiseId?.franchiseName ||
                        order.franchiseId?.ownerName ||
                        'Franchise',
                    pickupPartnerName: rr.pickupDeliveryPartnerId?.fullName || '',
                    pickupPartnerVehicle: rr.pickupDeliveryPartnerId?.vehicleNumber || '',
                });
            });
        }
        return all.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
    }, [orders]);

    return (
        <div className="bg-slate-50 min-h-screen p-4 lg:p-6 space-y-4">
            <div className="bg-white border border-slate-200 rounded-sm p-4 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <Undo2 size={16} />
                        Returns
                    </h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                        {rows.length} total return requests
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="h-36 bg-white border border-slate-200 rounded-sm animate-pulse" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-sm p-10 text-center">
                    <p className="text-sm font-black text-slate-700 uppercase tracking-wider">No return requests found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {rows.map((row) => (
                        <div key={`${row.orderId}-${row.requestIndex}`} className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[12px] font-black text-slate-900 uppercase tracking-wider">
                                        Order #{row.orderId?.slice(-6)} | Request #{row.requestIndex + 1}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-1">
                                        {row.customerName} {row.customerMobile ? `| ${row.customerMobile}` : ''}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1">Franchise: {row.franchiseName}</p>
                                </div>
                                <span className={cn(
                                    'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-sm border',
                                    statusStyles[row.status] || statusStyles.completed,
                                )}>
                                    {row.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-sm p-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Customer Reason</p>
                                <p className="text-[12px] font-bold text-slate-700">{row.reason}</p>
                            </div>

                            <div className="space-y-1">
                                {row.items.map((item, idx) => (
                                    <div key={idx} className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex justify-between">
                                        <span>{item.name}</span>
                                        <span>{item.quantity} {item.unit}</span>
                                    </div>
                                ))}
                            </div>

                            {row.franchiseReviewReason && (
                                <div className="bg-slate-50 border border-slate-100 rounded-sm p-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Franchise Review</p>
                                    <p className="text-[11px] font-bold text-slate-700 mt-1">{row.franchiseReviewReason}</p>
                                </div>
                            )}

                            {row.pickupPartnerName && (
                                <div className="text-[10px] font-black text-blue-700 uppercase tracking-wide flex items-center gap-1">
                                    <Truck size={12} />
                                    Pickup Partner: {row.pickupPartnerName} {row.pickupPartnerVehicle ? `(${row.pickupPartnerVehicle})` : ''}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
