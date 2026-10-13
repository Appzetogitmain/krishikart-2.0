import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReportView from '@/components/reports/ReportView';

export default function DeliveryReportsScreen() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="px-4 pt-6 pb-3 bg-white border-b border-slate-200 sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100" aria-label="Back">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold text-slate-900">My Reports</h1>
            </div>
            <div className="p-4">
                <ReportView
                    endpoint="/reports/delivery"
                    title="My Delivery Report"
                    subtitle="Your deliveries, COD cash collected and submitted, and return pickups."
                    defaultPreset="7days"
                />
            </div>
        </div>
    );
}
