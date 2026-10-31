import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Save, ArrowLeft, Bike } from 'lucide-react';
import { VEHICLES } from '@/lib/deliveryVehicles';
import { useNavigate } from 'react-router-dom';
import { useDeliveryAuth } from '../contexts/DeliveryAuthContext';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function VehicleInfoScreen() {
    const { delivery, loginSuccess } = useDeliveryAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: delivery?.fullName || '',
        vehicleNumber: delivery?.vehicleNumber || '',
        vehicleType: delivery?.vehicleType || 'bike'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.put('/delivery/profile', formData);
            if (response.data.success) {
                toast.success('Vehicle information updated');
                loginSuccess(response.data.result, localStorage.getItem('deliveryToken'));
                navigate(-1);
            }
        } catch (error) {
            console.error('Update profile error:', error);
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-white pb-20">
            <div className="px-6 pt-8 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-border/50">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold">Vehicle Information</h1>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">
                <div className="flex flex-col items-center py-6 bg-primary/5 rounded-3xl border border-primary/10">
                    <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
                        <Truck className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-primary uppercase tracking-wider">Verified Vehicle</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">Partner Name</label>
                        <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value.replace(/[^A-Za-z\s]/g, '') })}
                            pattern="[A-Za-z\s]+"
                            title="Only alphabets and spaces are allowed"
                            className="w-full p-4 rounded-2xl border border-border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                            placeholder="Full Name"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">Vehicle Number</label>
                        <input
                            type="text"
                            value={formData.vehicleNumber}
                            onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                            pattern="^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"
                            title="Please enter a valid vehicle number, e.g. MP09AB1234"
                            maxLength={10}
                            className="w-full p-4 rounded-2xl border border-border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold uppercase"
                            placeholder="e.g. MP09AB1234"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">Vehicle Type</label>
                        <div className="grid grid-cols-2 gap-4">
                            {VEHICLES.map(({ id: type, label }) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, vehicleType: type })}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${formData.vehicleType === type
                                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5'
                                        : 'border-border bg-white text-muted-foreground'
                                        }`}
                                >
                                    {type === 'bike' || type === 'scooter' ? <Bike className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
                                    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    disabled={loading}
                    type="submit"
                    className="w-full bg-primary text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <Save className="w-5 h-5" /> Save Changes
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
