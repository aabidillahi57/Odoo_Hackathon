import React, { useState } from 'react';
import {
  Repeat,
  CreditCard,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useDashboardMetrics } from '../services/api';
import {
  DEMO_DASHBOARD_METRICS,
  DEMO_RECENT_INVOICES,
  DEMO_RECENT_SUBSCRIPTIONS,
} from '../data/demoData';

export const OverviewPage: React.FC = () => {
  const [useLiveDb, setUseLiveDb] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  // Live Database Metrics Query
  const { data: liveData, isLoading, refetch } = useDashboardMetrics();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getInvoiceStatusBadge = (status: string) => {
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

  const getSubStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'quotation':
        return <Badge variant="warning">Quotation</Badge>;
      case 'paused':
        return <Badge variant="neutral">Paused</Badge>;
      case 'closed':
        return <Badge variant="danger">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const metrics = (useLiveDb && liveData?.metrics) ? liveData.metrics : DEMO_DASHBOARD_METRICS;
  const recentInvoices = (useLiveDb && liveData?.recentInvoices) ? liveData.recentInvoices : DEMO_RECENT_INVOICES;
  const recentSubscriptions = (useLiveDb && liveData?.recentSubscriptions) ? liveData.recentSubscriptions : DEMO_RECENT_SUBSCRIPTIONS;

  return (
    <div className="space-y-6">
      {/* Top Controls & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Overview</h1>
            <Badge variant={useLiveDb ? 'success' : 'warning'} size="sm">
              {useLiveDb ? (
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3" /> Live MySQL Database
                </span>
              ) : (
                'Sample Demo Figures'
              )}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real-time financial pulse, subscription MRR/ARR velocity, and accounts receivable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh button */}
          {useLiveDb && (
            <button
              onClick={() => refetch()}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
              title="Refresh live metrics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Date range filter */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-medium focus:ring-0 cursor-pointer pr-3"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last Quarter</option>
              <option value="1y">Year to Date</option>
            </select>
          </div>

          {/* Toggle between Live Database and Demo Data */}
          <button
            onClick={() => setUseLiveDb(!useLiveDb)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-colors"
            title="Toggle between live MySQL metrics and sample demo figures"
          >
            {useLiveDb ? (
              <ToggleRight className="w-4 h-4 text-emerald-600" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-slate-400" />
            )}
            <span>{useLiveDb ? 'Live Database' : 'Demo Sandbox'}</span>
          </button>
        </div>
      </div>

      {isLoading && useLiveDb ? (
        <div className="p-12 flex justify-center">
          <LoadingSpinner size="lg" label="Loading live executive metrics..." />
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Active Subscriptions */}
            <Card className="hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Subscriptions
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Repeat className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">
                  {metrics.activeSubscriptions}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{metrics.activeSubscriptionsChange}</span>
                </div>
              </div>
            </Card>

            {/* Metric 2: Revenue Received */}
            <Card className="hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Revenue Received
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(Number(metrics.revenueReceived))}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {metrics.revenueReceivedPeriod}
                </div>
              </div>
            </Card>

            {/* Metric 3: Outstanding Balance */}
            <Card className="hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Outstanding Balance
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(Number(metrics.outstandingBalance))}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Across {metrics.outstandingInvoicesCount} pending invoices
                </div>
              </div>
            </Card>

            {/* Metric 4: Overdue Invoices */}
            <Card className="hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Overdue Invoices
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-rose-600">
                  {metrics.overdueInvoices}
                </div>
                <div className="mt-1 text-xs text-rose-500 font-medium">
                  {formatCurrency(Number(metrics.overdueAmount))} requiring follow-up
                </div>
              </div>
            </Card>
          </div>

          {/* Activity Section: Recent Invoices & Subscriptions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Invoices Table (7 cols) */}
            <div className="lg:col-span-7">
              <Card
                title="Recent Invoices"
                description="Latest recurring and ad-hoc billing statements."
                noPadding
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentInvoices.length > 0 ? (
                        recentInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-slate-900">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-800">
                              {inv.customerName}
                            </td>
                            <td className="py-3 px-4">{getInvoiceStatusBadge(inv.status)}</td>
                            <td className="py-3 px-4 text-slate-500">
                              {inv.dueDate ? inv.dueDate.substring(0, 10) : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-900 font-mono">
                              {formatCurrency(Number(inv.totalAmount))}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-700 font-mono">
                              {Number(inv.balanceDue) > 0 ? (
                                <span className="text-amber-600">{formatCurrency(Number(inv.balanceDue))}</span>
                              ) : (
                                <span className="text-emerald-600">$0.00</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No recent invoices recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Recent Subscription Activity (5 cols) */}
            <div className="lg:col-span-5">
              <Card
                title="Active Subscriptions"
                description="Status changes and upcoming renewals."
                noPadding
              >
                <div className="divide-y divide-slate-100">
                  {recentSubscriptions.length > 0 ? (
                    recentSubscriptions.map((sub: any) => (
                      <div key={sub.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{sub.customerName}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{sub.planName}</p>
                          </div>
                          {getSubStatusBadge(sub.status)}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-mono text-slate-400">{sub.subscriptionNumber}</span>
                          <span className="font-semibold text-slate-800 font-mono">
                            {formatCurrency(Number(sub.recurringAmount || sub.totalRecurringAmount || 0))} / cycle
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No subscriptions created yet.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
