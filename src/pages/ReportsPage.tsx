import React, { useState } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export const ReportsPage: React.FC = () => {
  const [reportRange, setReportRange] = useState('monthly');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Subscription Intelligence"
        description="Comprehensive analytics covering Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and invoice aging."
        isDemo
        breadcrumbs={['Home', 'Reports']}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
              <select
                value={reportRange}
                onChange={(e) => setReportRange(e.target.value)}
                className="bg-transparent border-none text-slate-700 font-medium focus:ring-0 cursor-pointer pr-3"
              >
                <option value="weekly">Weekly View</option>
                <option value="monthly">Monthly View</option>
                <option value="quarterly">Quarterly View</option>
              </select>
            </div>
            <Button
              variant="outline"
              icon={<Download className="w-4 h-4" />}
              onClick={() => alert(`Exporting ${reportRange} report as CSV (Phase 8)`)}
            >
              Export Report
            </Button>
          </div>
        }
      />

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Estimated MRR</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">$24,850.00</div>
          <p className="mt-1 text-xs text-slate-500">Normalized recurring monthly run-rate (Demo)</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Projected ARR</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">$298,200.00</div>
          <p className="mt-1 text-xs text-slate-500">Annualized active contract commitments (Demo)</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Accounts Receivable</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">$12,400.00</div>
          <p className="mt-1 text-xs text-slate-500">Outstanding across 9 open statements (Demo)</p>
        </Card>
      </div>

      {/* Aging & Segment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Accounts Receivable Aging" description="Overdue invoice distribution">
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Current (Not Yet Due)</span>
                <span className="font-bold text-slate-900">$9,150.00 (74%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '74%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>1 - 30 Days Overdue</span>
                <span className="font-bold text-amber-700">$2,300.00 (18%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '18%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>31+ Days Overdue</span>
                <span className="font-bold text-rose-700">$950.00 (8%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full" style={{ width: '8%' }} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Plan Distribution" description="Active subscriptions by recurring interval">
          <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium text-slate-700">Enterprise Yearly</span>
              <span className="font-bold text-slate-900">64 subscriptions (50%)</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200">
              <span className="font-medium text-slate-700">Pro Monthly</span>
              <span className="font-bold text-slate-900">48 subscriptions (38%)</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="font-medium text-slate-700">Starter Weekly</span>
              <span className="font-bold text-slate-900">16 subscriptions (12%)</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
