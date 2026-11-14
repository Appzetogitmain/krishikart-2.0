import { useState } from 'react';
import { ArrowLeft, Save, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useDeliveryAuth } from '../contexts/DeliveryAuthContext';
import CityAddressFields from '../components/common/CityAddressFields';

/** Partner's city and address (requests come only from stores in this city) */
export default function AddressScreen() {
    const { delivery, loginSuccess } = useDeliveryAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ city: delivery?.city || '', address: delivery?.address || '' });
    const [saving, setSaving] = useState(false);

    const save = async (e) => {
        e.preventDefault();
        if (!form.city) return toast.error('Please choose your city');
        if (form.address.trim().length < 5) return toast.error('Please enter your address');
        setSaving(true);
        try {
            const res = await api.put('/delivery/profile', { city: form.city, address: form.address.trim() });
            loginSuccess(res.data.result, localStorage.getItem('deliveryToken'));
            toast.success('City and address saved');
            navigate(-1);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-white pb-20">
            <div className="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-border/50">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors" aria-label="Back">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">My City & Address</h1>
            </div>
            <form onSubmit={save} className="p-6 space-y-5" data-address-form>
                <div className="flex items-start gap-3 rounded-2xl bg-primary/5 border border-primary/10 p-4">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">Delivery requests come only from Kisaankart stores in your city.</p>
                </div>
                <CityAddressFields value={form} onChange={setForm} />
                <button
                    disabled={saving}
                    type="submit"
                    className="w-full bg-primary text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    <Save className="w-5 h-5" /> {saving ? 'Saving...' : 'Save'}
                </button>
            </form>
        </div>
    );
}
