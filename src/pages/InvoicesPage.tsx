import React, { useState } from 'react';
import { Receipt, Plus, Printer, Send } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DEMO_RECENT_INVOICES } from '../data/demoData';

export const InvoicesPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredInvoices = statusFilter === 'all'
    ? DEMO_RECENT_INVOICES
    : DEMO_RECENT_INVOICES.filter((inv) => inv.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      case 'confirmed':
        return <Badge variant="info">Confirmed</Badge>;
      case 'draft':
        return <Badge variant="neutral">Draft</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Recurring Billing"
        description="Automated invoice generation from due subscriptions with dynamic tax rules, discount redemption, and lifecycle actions."
        isDemo
        breadcrumbs={['Home', 'Invoices']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => alert('Batch print invoices (Phase 7)')}
            >
              Print Statements
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => alert('Manual invoice generation modal (Phase 7)')}
            >
              Generate Due Invoices
            </Button>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['all', 'draft', 'confirmed', 'paid', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              statusFilter === status
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Origin Subscription</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{inv.invoiceNumber}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {inv.customerName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                    {inv.subscriptionNumber || 'Ad-hoc'}
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(inv.status)}</td>
                  <td className="py-3.5 px-4 text-slate-600">{inv.dueDate}</td>
                  <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                    ${inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold">
                    {inv.balanceDue > 0 ? (
                      <span className="text-amber-600">
                        ${inv.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-emerald-600">$0.00</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Send invoice to customer via Brevo"
                        onClick={() => alert(`Email invoice ${inv.invoiceNumber} via Brevo (Phase 10)`)}
                      >
                        <Send className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Print / Export PDF"
                        onClick={() => alert(`Print Invoice ${inv.invoiceNumber}`)}
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                    </div>
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
