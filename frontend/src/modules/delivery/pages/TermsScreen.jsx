import { motion } from 'framer-motion';
import { ChevronLeft, Truck, Clock, ShieldCheck, MapPin, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsScreen() {
    const navigate = useNavigate();

    const sections = [
        {
            title: '1. Service Excellence',
            icon: ShieldCheck,
            content: 'Delivery Partners must maintain a minimum service rating of 4.5. Professionalism, punctuality, and careful handling of products are core requirements of the Kisaankart network.'
        },
        {
            title: '2. Delivery Rules',
            icon: Truck,
            content: 'All pickups must be verified through the app or terminal. You are responsible for the items from the point of pickup until they are officially handed over to the customer or franchise node.'
        },
        {
            title: '3. Live Location Tracking',
            icon: MapPin,
            content: 'By using the Delivery Partner App, you agree to provide real-time location data while on-duty. This data is used to optimize delivery routes and provide live tracking to customers.'
        },
        {
            title: '4. On-Time Delivery',
            icon: Clock,
            content: 'Turnaround Time (TAT) for deliveries must adhere to the assigned slot. Intentional delays or unauthorized diversions from the logistics path may result in payout deductions.'
        }
    ];

    return (
        <div className="bg-[#f0f9ff] min-h-screen font-sans">
            <header className="bg-white border-b border-blue-100 sticky top-0 z-30">
                <div className="px-6 h-16 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-blue-50 text-blue-400 hover:text-blue-900 transition-all rounded-full border border-blue-50">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-[12px] font-black text-blue-900 uppercase tracking-[0.2em]">Delivery Partner Guidelines</h1>
                </div>
            </header>

            <div className="max-w-2xl mx-auto p-6 py-12 space-y-12">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                >
                    <div className="px-3 py-1 bg-blue-500 text-white inline-flex rounded-md text-[10px] font-black uppercase tracking-widest">Guidelines</div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Deliver <br/> with Trust</h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm">
                        Simple rules for delivering with Kisaankart. Your work helps thousands of families get fresh produce every day.
                    </p>
                </motion.div>

                <div className="grid gap-4">
                    {sections.map((section, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white p-7 rounded-[32px] border border-blue-100 shadow-sm shadow-blue-200/20 flex flex-col sm:flex-row gap-6"
                        >
                            <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <section.icon size={24} />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{section.title}</h3>
                                <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                                    {section.content}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="p-10 bg-blue-900 rounded-[48px] text-white flex items-center gap-6 shadow-2xl shadow-blue-900/40 border-4 border-white">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                        <Info size={24} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Acknowledgment</p>
                        <p className="text-xs font-bold leading-relaxed text-blue-50 uppercase tracking-widest">
                            By continuing, you confirm that you have a valid vehicle registration and driving licence, and you agree to follow the Kisaankart safety rules.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
