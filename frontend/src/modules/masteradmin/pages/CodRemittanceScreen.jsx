import { useCallback, useEffect, useMemo, useState } from 'react';
import { Home, ChevronRight, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import FilterBar from '../components/tables/FilterBar';
import DataGrid from '../components/tables/DataGrid';

const formatMoney = (v) => `Rs ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function CodRemittanceScreen() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('submitted');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [rejectionModal, setRejectionModal] = useState({ open: false, id: null });
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchRemittances = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/masteradmin/cod/remittances', { params: { status } });
            if (response.data.success) {
                setRows(response.data.results || []);
            }
        } catch (error) {
            console.error('Fetch COD remittances error:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch remittances');
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchRemittances();
    }, [fetchRemittances]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            r.deliveryPartnerId?.fullName?.toLowerCase().includes(q) ||
            r.deliveryPartnerId?.mobile?.toLowerCase().includes(q) ||
            r.referenceNo?.toLowerCase().includes(q)
        );
    }, [rows, search]);

    const reviewRemittance = async (remittanceId, action, reason = '') => {
        try {
            const response = await api.put(`/masteradmin/cod/remittances/${remittanceId}/review`, {
                action,
                reason
            });
            if (response.data.success) {
                toast.success(`Remittance ${action}d`);
                setRejectionModal({ open: false, id: null });
                setRejectionReason('');
                fetchRemittances();
            }
        } catch (error) {
            console.error('Review remittance error:', error);
            toast.error(error.response?.data?.message || 'Failed to review remittance');
        }
    };

    const columns = [
        {
            header: 'Delivery Partner',
            key: 'deliveryPartnerId',
            render: (partner) => (
                <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-900">{partner?.fullName || 'Unknown'}</span>
                    <span className="text-[10px] text-slate-500">{partner?.mobile || ''}</span>
                </div>
            )
        },
        {
            header: 'Handed to',
            key: 'franchiseId',
            render: (franchise) => <span className="text-[11px] font-bold text-slate-700">{franchise?.franchiseName || 'Head office'}</span>
        },
        {
            header: 'Orders',
            key: 'orderIds',
            render: (orderIds) => <span className="text-[11px] font-bold text-slate-700">{orderIds?.length || 0}</span>
        },
        {
            header: 'Amount',
            key: 'amount',
            align: 'right',
            render: (amount) => <span className="text-[11px] font-black text-emerald-600">{formatMoney(amount)}</span>
        },
        {
            header: 'Mode',
            key: 'paymentMethod',
            render: (mode) => <span className="text-[10px] font-bold uppercase text-slate-600">{mode?.replace('_', ' ')}</span>
        },
        {
            header: 'Reference',
            key: 'referenceNo',
            render: (ref) => <span className="text-[10px] font-medium text-slate-500">{ref || 'N/A'}</span>
        },
        {
            header: 'Status',
            key: 'status',
            render: (st, row) => (
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${st === 'verified'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : st === 'submitted'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                    {row?.franchiseId
                        ? (st === 'verified' ? 'Received by franchise' : st === 'submitted' ? 'Awaiting franchise' : st)
                        : st}
                </span>
            )
        },
        {
            header: 'Actions',
            key: '_id',
            render: (_id, row) => (
                row.status === 'submitted' && row.franchiseId ? (
                    <span className="text-[10px] font-bold text-blue-600">Franchise is checking</span>
                ) : row.status === 'submitted' ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                reviewRemittance(_id, 'verify');
                            }}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1"
                        >
                            <CheckCircle2 size={12} />
                            Verify
                        </button>
                    </div>
                ) : <span className="text-[10px] text-slate-400">{row.verifiedByFranchise?.franchiseName ? `By ${row.verifiedByFranchise.franchiseName}` : 'Reviewed'}</span>
            )
        }
    ];

    if (loading) {
        return (
            <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-100 rounded" />
                <div className="h-16 bg-slate-50 border border-slate-200" />
                <div className="h-[500px] bg-slate-50 border border-slate-200" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-200 pr-4">
                            <Home size={12} />
                            <ChevronRight size={10} />
                            <span>Finance</span>
                            <ChevronRight size={10} />
                            <span className="text-slate-900 uppercase tracking-widest">COD Remittance</span>
                        </div>
                        <h1 className="text-sm font-bold text-slate-900">COD cash handed over by delivery partners (verified by franchises)</h1>
                    </div>

                    <button
                        onClick={fetchRemittances}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                    >
                        <RefreshCw size={12} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-0 p-px">
                <FilterBar
                    onSearch={(v) => setSearch(typeof v === 'string' ? v.trim() : v)}
                    onRefresh={fetchRemittances}
                    activeFilter={status}
                    onFilterChange={setStatus}
                    filters={['submitted', 'verified', 'rejected', 'all']}
                />
                <div className="bg-white border-t border-slate-200">
                    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Records: {filteredRows.length}</span>
                    </div>
                    <DataGrid
                        title="Cash Submissions"
                        columns={columns}
                        data={filteredRows}
                        density="compact"
                    />
                </div>
            </div>

            {/* Rejection Modal */}
            {rejectionModal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Reason</h3>
                            <button onClick={() => setRejectionModal({ open: false, id: null })} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Reason for Rejection</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter rejection subject or reason here..."
                                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setRejectionModal({ open: false, id: null })}
                                className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!rejectionReason.trim()}
                                onClick={() => reviewRemittance(rejectionModal.id, 'reject', rejectionReason)}
                                className="px-6 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
