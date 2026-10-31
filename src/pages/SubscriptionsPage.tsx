import React, { useState } from 'react';
import { Repeat, Plus, Calendar, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DEMO_RECENT_SUBSCRIPTIONS } from '../data/demoData';

export const SubscriptionsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredSubs = statusFilter === 'all'
    ? DEMO_RECENT_SUBSCRIPTIONS
    : DEMO_RECENT_SUBSCRIPTIONS.filter((s) => s.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'quotation':
        return <Badge variant="warning">Quotation</Badge>;
      case 'draft':
        return <Badge variant="neutral">Draft</Badge>;
      case 'paused':
        return <Badge variant="neutral">Paused</Badge>;
      case 'closed':
        return <Badge variant="danger">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Monitor full contract lifecycles: Draft → Quotation → Confirmed → Active → Closed."
        isDemo
        breadcrumbs={['Home', 'Subscriptions']}
        action={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => alert('New subscription creation workflow will be implemented in Phase 6.')}
          >
            New Subscription
          </Button>
        }
      />

      {/* Lifecycle Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {['all', 'draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'].map((status) => (
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

      {/* Subscriptions Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Subscription #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Plan Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Next Billing Date</th>
                <th className="py-3 px-4 text-right">Recurring Total</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubs.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{sub.subscriptionNumber}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {sub.customerName}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {sub.planName}
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{sub.nextBillingDate}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    ${sub.recurringAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                      onClick={() => alert(`View Subscription ${sub.subscriptionNumber} details (Phase 6)`)}
                    >
                      Manage
                    </Button>
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
