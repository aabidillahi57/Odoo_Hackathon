import React from 'react';
import { Plus, ShieldAlert, Percent, DollarSign } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DEMO_DISCOUNTS } from '../data/demoData';

export const DiscountsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Discount Rules & Promotions"
        description="Admin-only rules for fixed amounts or percentages, maximum redemption limits, and product or order applicability."
        isDemo
        breadcrumbs={['Home', 'Discounts']}
        action={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => alert('Discount creation modal (Admin Only - Phase 7)')}
          >
            Create Discount Rule
          </Button>
        }
      />

      {/* Admin Permission Notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-indigo-900">
        <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
        <span>
          <strong>Role-Based Permission:</strong> Only <code>Admin</code> accounts are authorized to create or modify discount rules. Internal Staff accounts have read-only access to select active discounts on quotations.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DEMO_DISCOUNTS.map((discount) => (
          <Card key={discount.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  {discount.discountType === 'percentage' ? (
                    <Percent className="w-4 h-4" />
                  ) : (
                    <DollarSign className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                    {discount.code}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{discount.description}</p>
                </div>
              </div>
              <Badge variant={discount.isActive ? 'success' : 'neutral'} size="sm">
                {discount.isActive ? 'Active' : 'Expired'}
              </Badge>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Discount Value</span>
                <span className="font-bold text-slate-800 text-sm">
                  {discount.discountType === 'percentage'
                    ? `${discount.value}% Off`
                    : `$${discount.value.toFixed(2)} Off`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Applies To</span>
                <span className="font-semibold text-slate-700 capitalize">
                  {discount.appliesTo === 'order' ? 'Entire Subscription' : 'Specific Product'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Usage Limits</span>
                <span className="font-mono font-medium text-slate-700">
                  {discount.usedCount} / {discount.maxUses || 'Unlimited'} uses
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Min Purchase</span>
                <span className="font-semibold text-slate-700">
                  ${discount.minPurchaseAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
