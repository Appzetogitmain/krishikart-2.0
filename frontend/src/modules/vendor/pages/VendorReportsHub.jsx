import ReportView from '@/components/reports/ReportView';
import ReportTabs from '@/components/reports/ReportTabs';
import ReceivablesReportScreen from './ReceivablesReportScreen';

export default function VendorReportsHub() {
    return (
        <div className="space-y-4">
            <ReportTabs
                tabs={[
                    {
                        label: 'Supply Report',
                        render: () => (
                            <ReportView
                                endpoint="/reports/vendor"
                                title="Supply Report"
                                subtitle="Orders you received, quotes, approved and dispatched value, and damaged items."
                            />
                        ),
                    },
                    {
                        label: 'Sales Value & Rates',
                        render: () => (
                            <ReportView
                                endpoint="/reports/vendor/finance"
                                title="Sales Value & Rates"
                                subtitle="What franchises accepted from you, at your selling rates, minus damaged goods and return credit notes."
                            />
                        ),
                    },
                    { label: 'Payments Due', render: () => <ReceivablesReportScreen /> },
                ]}
            />
        </div>
    );
}
