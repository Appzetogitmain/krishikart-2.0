import ReportView from '@/components/reports/ReportView';
import ReportTabs from '@/components/reports/ReportTabs';

export default function ReportsScreen() {
    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6">
            <ReportTabs
                tabs={[
                    {
                        label: 'Business Report',
                        render: () => (
                            <ReportView
                                endpoint="/reports/admin"
                                title="Business Report"
                                subtitle="Sales, orders, stock purchases, COD cash and franchise payments for the selected period."
                            />
                        ),
                    },
                    {
                        label: 'Profit & Margin',
                        render: () => (
                            <ReportView
                                endpoint="/reports/admin/finance"
                                title="Profit & Margin"
                                subtitle="Vendor → Company → Franchise → Customer: buying cost, revenue, gross profit and margin at each stage, from delivered orders and actual rates."
                            />
                        ),
                    },
                ]}
            />
        </div>
    );
}
