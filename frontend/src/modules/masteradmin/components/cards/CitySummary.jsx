import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getAdminCity, setAdminCity } from '../../lib/adminCity';

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/**
 * City-wise summary on the dashboard (client, Nov 2026): every city at a glance; click a city to switch the
 * whole panel to it. Only shown when looking at more than one city.
 */
export default function CitySummary() {
    const [rows, setRows] = useState(null);
    const viewingOne = !!getAdminCity();

    useEffect(() => {
        if (viewingOne) return;
        api.get('/masteradmin/dashboard/city-summary')
            .then((res) => setRows(res.data?.result?.rows || []))
            .catch(() => setRows([]));
    }, [viewingOne]);

    if (viewingOne || !rows || rows.length < 2) return null;
    const total = rows.reduce((t, r) => ({
        stores: t.stores + r.stores, storesOnline: t.storesOnline + r.storesOnline, ordersToday: t.ordersToday + r.ordersToday,
        salesToday: t.salesToday + r.salesToday, openOrders: t.openOrders + r.openOrders, forDelivery: t.forDelivery + r.forDelivery,
    }), { stores: 0, storesOnline: 0, ordersToday: 0, salesToday: 0, openOrders: 0, forDelivery: 0 });

    return (
        <div className="bg-white border-b border-slate-200" data-city-summary>
            <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-emerald-600" />
                    <span className="text-[13px] font-bold text-slate-900">City-wise summary</span>
                    <span className="text-[12px] text-slate-500">Today · click a city to see only that city</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-left">
                            <th className="px-4 py-2 font-semibold">City</th>
                            <th className="px-4 py-2 font-semibold text-right">Stores online</th>
                            <th className="px-4 py-2 font-semibold text-right">Orders today</th>
                            <th className="px-4 py-2 font-semibold text-right">Sales today</th>
                            <th className="px-4 py-2 font-semibold text-right">Open orders</th>
                            <th className="px-4 py-2 font-semibold text-right">For delivery</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((r) => (
                            <tr
                                key={r.code || 'none'}
                                onClick={() => r.code && setAdminCity(r.code)}
                                className={cn(r.code ? 'cursor-pointer hover:bg-emerald-50/50' : 'text-slate-500')}
                                title={r.code ? `Show only ${r.name}` : 'Give these stores a city code in City Rates'}
                            >
                                <td className="px-4 py-2.5">
                                    <span className="font-semibold text-slate-900">{r.name}</span>{r.code && <span className="text-slate-400"> ({r.code})</span>}
                                    {r.cities?.length > 0 && <span className="block text-[11px] text-slate-500">{r.cities.join(', ')}</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{r.storesOnline} / {r.stores}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.ordersToday}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{money(r.salesToday)}</td>
                                <td className={cn('px-4 py-2.5 text-right tabular-nums', r.openOrders > 0 && 'text-amber-700 font-semibold')}>{r.openOrders}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{r.forDelivery}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                            <td className="px-4 py-2.5">All cities</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{total.storesOnline} / {total.stores}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{total.ordersToday}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{money(total.salesToday)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{total.openOrders}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{total.forDelivery}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
