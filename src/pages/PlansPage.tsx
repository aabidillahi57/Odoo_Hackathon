import React, { useState } from 'react';
import { Layers, Plus, Calendar, ShieldCheck, CheckCircle2, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { DEMO_PLANS } from '../data/demoData';
import { usePlans } from '../services/api';

export const PlansPage: React.FC = () => {
  const [useDemoFallback, setUseDemoFallback] = useState(false);
  const { plans: apiPlans, isLoading, error, refetch } = usePlans();

  const activePlansList = apiPlans && !useDemoFallback ? apiPlans : DEMO_PLANS;
  const isLive = Boolean(apiPlans && !useDemoFallback);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Plans"
        description="Configure billing frequencies (daily, weekly, monthly, yearly), minimum commitments, and lifecycle automation rules."
        isDemo={!isLive}
        breadcrumbs={['Home', 'Plans']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={refetch}
              title="Refresh from MySQL API"
            >
              Sync DB
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => alert('Plan creation wizard will be implemented in Phase 4.')}
            >
              Create Plan
            </Button>
          </div>
        }
      />

      {/* Database Connection Notice / Error State */}
      {error && !useDemoFallback && (
        <ErrorAlert
          title="Server Database Unreachable"
          message={`${error} (Falling back to preview demo plans. Start local MySQL and run 'npm run db:seed' to populate live plans.)`}
          onRetry={refetch}
          className="mb-4"
        />
      )}

      {/* DataSource Banner */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Data Source:</span>
          {isLive ? (
            <Badge variant="success" size="sm" className="gap-1 items-center">
              <Database className="w-3 h-3 text-emerald-600" />
              Live MySQL DB ({apiPlans?.length} plans)
            </Badge>
          ) : (
            <Badge variant="warning" size="sm" className="gap-1 items-center">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Demo Data Preview
            </Badge>
          )}
        </div>

        {apiPlans && (
          <button
            onClick={() => setUseDemoFallback(!useDemoFallback)}
            className="text-[11px] text-indigo-600 hover:underline"
          >
            {useDemoFallback ? 'Switch to Live DB' : 'View Demo'}
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner label="Querying billing plans from MySQL database via Netlify Functions..." />
      ) : activePlansList.length === 0 ? (
        <EmptyState
          title="No subscription plans found"
          description="There are currently no active plans in the database. Run 'npm run db:seed' to load standard recurring tiers."
          actionLabel="Seed Plans"
          onAction={() => alert("Run 'npm run db:seed' in your terminal")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activePlansList.map((plan) => (
            <Card key={plan.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="brand" size="sm">
                    {plan.billingInterval}
                  </Badge>
                  <Badge variant={plan.isActive ? 'success' : 'neutral'} size="sm">
                    {plan.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    ${Number(plan.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/{plan.billingInterval}</span>
                </div>

                {/* Lifecycle & Policy Badges */}
                <div className="mt-5 space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Min Quantity
                    </span>
                    <span className="font-semibold text-slate-800">{plan.minQuantity} seat(s)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Renewal Policy
                    </span>
                    <span className="font-mono font-medium text-slate-700 capitalize">
                      {plan.renewalPolicy?.replace('_', ' ') || 'Auto renew'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      Early Termination
                    </span>
                    <span className="font-medium text-slate-700 capitalize">
                      {plan.earlyClosePolicy?.replace('_', ' ') || 'Allowed'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Customer Pausing</span>
                    <span className={plan.pauseAllowed ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                      {plan.pauseAllowed ? 'Allowed' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">PLAN-00{plan.id}</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Layers className="w-3.5 h-3.5" />}
                  onClick={() => alert(`Edit Plan ${plan.name} (Phase 4)`)}
                >
                  Edit Plan
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
