import { useEffect, useState } from 'react';
import { MapPin, Home } from 'lucide-react';
import api from '@/lib/axios';

let cityCache = null;

/** The cities a partner can work in (where there is a Kisaankart franchise) */
export function useDeliveryCities() {
    const [cities, setCities] = useState(cityCache || []);
    useEffect(() => {
        if (cityCache) return;
        api.get('/delivery/cities')
            .then((res) => { cityCache = (res.data?.results || res.data?.result || []).map((c) => c?.name || c).filter((c) => typeof c === 'string'); setCities(cityCache); })
            .catch(() => setCities([]));
    }, []);
    return cities;
}

/**
 * City (one of the franchise cities) + address of a delivery partner. Delivery requests come only from
 * franchises in the chosen city.
 */
export default function CityAddressFields({ value, onChange, labelClass, inputClass }) {
    const cities = useDeliveryCities();
    const label = labelClass || 'text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1';
    const input = inputClass || 'w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold';
    const set = (k, v) => onChange({ ...value, [k]: v });
    const known = !value.city || cities.some((c) => c.toLowerCase() === String(value.city).toLowerCase());

    return (
        <>
            <div className="space-y-1">
                <label className={label}>City you deliver in</label>
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                        <MapPin size={16} />
                    </div>
                    <select
                        name="city"
                        required
                        value={known ? (cities.find((c) => c.toLowerCase() === String(value.city).toLowerCase()) || '') : value.city}
                        onChange={(e) => set('city', e.target.value)}
                        className={`${input} appearance-none`}
                    >
                        <option value="">{cities.length ? 'Choose your city' : 'Loading cities...'}</option>
                        {!known && <option value={value.city}>{value.city}</option>}
                        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <p className="text-[11px] text-muted-foreground ml-1">You get delivery requests only from Kisaankart stores in this city.</p>
            </div>
            <div className="space-y-1">
                <label className={label}>Your address</label>
                <div className="relative group">
                    <div className="absolute left-4 top-4 text-slate-400 group-focus-within:text-primary transition-colors">
                        <Home size={16} />
                    </div>
                    <textarea
                        name="address"
                        required
                        rows={2}
                        value={value.address}
                        onChange={(e) => set('address', e.target.value)}
                        placeholder="House no., street, area"
                        className={`${input} resize-none`}
                    />
                </div>
            </div>
        </>
    );
}
