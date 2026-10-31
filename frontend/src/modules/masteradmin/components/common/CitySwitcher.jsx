import { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { getAdminCity, setAdminCity } from '../../lib/adminCity';

/**
 * Top-bar city filter. Shown to head office (all cities) and to regional admins (their own cities only).
 * A city admin with a single city does not see it - they only ever see their city.
 */
export default function CitySwitcher({ isCityAdmin, cityCodes = [] }) {
    const [zones, setZones] = useState([]);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const current = getAdminCity();
    const usable = !isCityAdmin || cityCodes.length > 1;

    useEffect(() => {
        if (!usable) return;
        // The city summary lists exactly the cities this admin may see (City Rates needs its own permission)
        api.get('/masteradmin/dashboard/city-summary', { headers: { 'X-Admin-City': '' } })
            .then((res) => {
                const list = (res.data?.result?.rows || []).filter((z) => z.code);
                setZones(list);
                // A city that is gone (or no longer allowed) falls back to all cities
                if (current && list.length && !list.some((z) => z.code === current)) setAdminCity('');
            })
            .catch(() => setZones([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usable]);

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    if (!usable || (!zones.length && !current)) return null;
    const label = current ? (zones.find((z) => z.code === current)?.name || current) : (isCityAdmin ? 'All my cities' : 'All cities');

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'h-10 px-3 rounded-sm border flex items-center gap-2 text-[13px] font-semibold transition-colors',
                    current ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
                title="Show the whole panel for one city"
                aria-label={`City: ${label}`}
            >
                <MapPin size={15} /> <span className="max-w-[140px] truncate">{label}</span> <ChevronDown size={14} />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-sm shadow-lg py-1">
                    {[{ code: '', name: isCityAdmin ? 'All my cities' : 'All cities' }, ...zones].map((z) => (
                        <button
                            key={z.code || 'all'}
                            type="button"
                            onClick={() => { setOpen(false); if (z.code !== current) setAdminCity(z.code); }}
                            className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 flex items-center justify-between gap-2"
                        >
                            <span className="min-w-0">
                                <span className="block font-semibold text-slate-800 truncate">{z.name}{z.code ? ` (${z.code})` : ''}</span>
                                {z.cities?.length > 0 && <span className="block text-[11px] text-slate-500 truncate">{z.cities.join(', ')}</span>}
                            </span>
                            {z.code === current && <Check size={15} className="text-emerald-600 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
