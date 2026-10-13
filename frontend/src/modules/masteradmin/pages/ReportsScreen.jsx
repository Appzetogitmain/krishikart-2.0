import ReportView from '@/components/reports/ReportView';

export default function ReportsScreen() {
    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6">
            <ReportView
                endpoint="/reports/admin"
                title="Business Report"
                subtitle="Sales, orders, stock purchases, COD cash and franchise payments for the selected period."
            />
        </div>
    );
}
