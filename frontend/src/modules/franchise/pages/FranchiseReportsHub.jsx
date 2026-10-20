import ReportView from '@/components/reports/ReportView';
import ReportTabs from '@/components/reports/ReportTabs';
import CommissionReportScreen from './ReportsScreen';

export default function FranchiseReportsHub() {
    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6">
            <ReportTabs
                tabs={[
                    {
                        label: 'Sales & Stock',
                        render: () => (
                            <ReportView
                                endpoint="/reports/franchise"
                                title="Sales & Stock Report"
                                subtitle="Your online orders, counter (POS) sales, stock requests and current stock."
                            />
                        ),
                    },
                    {
                        label: 'Profit & Margin',
                        render: () => (
                            <ReportView
                                endpoint="/reports/franchise/finance"
                                title="Profit & Margin"
                                subtitle="Your delivered sales, what the goods cost you from the company, and your profit and margin."
                            />
                        ),
                    },
                    { label: 'Earnings & Payments', render: () => <CommissionReportScreen /> },
                ]}
            />
        </div>
    );
}
