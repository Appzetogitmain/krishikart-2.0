import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useDeliveryAuth } from '../../contexts/DeliveryAuthContext';
import CityAddressFields from '../common/CityAddressFields';

/**
 * Older partner accounts have no city: ask once. Until it is set they get no delivery requests
 * (requests go only to partners of the store's city).
 */
export default function CityPrompt() {
    const { delivery, loginSuccess } = useDeliveryAuth();
    const [form, setForm] = useState({ city: '', address: delivery?.address || '' });
    const [saving, setSaving] = useState(false);
    if (!delivery?._id || delivery.city) return null;

    const save = async (e) => {
        e.preventDefault();
        if (!form.city) return toast.error('Please choose your city');
        if (form.address.trim().length < 5) return toast.error('Please enter your address');
        setSaving(true);
        try {
            const res = await api.put('/delivery/profile', { city: form.city, address: form.address.trim() });
            loginSuccess(res.data.result, localStorage.getItem('deliveryToken'));
            toast.success('Saved - you will now get requests from stores in ' + form.city);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center" data-city-prompt>
            <form onSubmit={save} className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><MapPin size={20} /></span>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Which city do you deliver in?</h2>
                        <p className="text-sm text-slate-500">You will get delivery requests only from stores in this city.</p>
                    </div>
                </div>
                <CityAddressFields value={form} onChange={setForm} />
                <button
                    disabled={saving}
                    type="submit"
                    className="w-full bg-primary text-white p-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60"
                >
                    {saving ? 'Saving...' : 'Save and continue'}
                </button>
            </form>
        </div>
    );
}
