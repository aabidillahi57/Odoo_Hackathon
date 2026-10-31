import React from 'react';
import { Plus, ArrowDownLeft } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DEMO_PAYMENTS } from '../data/demoData';

export const PaymentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorded Payments & Collections"
        description="Log payment receipts, reconcile balances against issued invoices, and track bank transfers."
        isDemo
        breadcrumbs={['Home', 'Payments']}
        action={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => alert('Record payment modal will be implemented in Phase 8.')}
          >
            Record Payment
          </Button>
        }
      />

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Payment #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Target Invoice</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Payment Date</th>
                <th className="py-3 px-4">Transaction Ref</th>
                <th className="py-3 px-4 text-right">Amount Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DEMO_PAYMENTS.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{payment.paymentNumber}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {payment.customerName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-indigo-600 font-medium">
                    {payment.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4 capitalize">
                    <Badge variant="neutral" size="sm">
                      {payment.paymentMethod.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{payment.paymentDate}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                    {payment.transactionReference || 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-600 text-sm">
                    ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
