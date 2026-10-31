import React from 'react';
import { FileSpreadsheet, Plus, Clock, Copy, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { DEMO_QUOTATION_TEMPLATES } from '../data/demoData';

export const QuotationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Templates & Proposals"
        description="Preset product bundles, default plans, and custom validities to quickly issue enterprise proposals."
        isDemo
        breadcrumbs={['Home', 'Quotations']}
        action={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => alert('Quotation builder will be wired in Phase 5.')}
          >
            New Quotation Template
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DEMO_QUOTATION_TEMPLATES.map((tmpl) => (
          <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-base font-bold text-slate-900">{tmpl.name}</h3>
              <Badge variant="brand" size="sm">
                {tmpl.linesCount} preset items
              </Badge>
            </div>

            <p className="text-xs text-slate-500 mb-4">{tmpl.notes}</p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Associated Plan</span>
                <span className="font-semibold text-slate-800">{tmpl.planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Validity Period
                </span>
                <span className="font-mono font-medium text-slate-700">{tmpl.validityDays} Days</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="w-3.5 h-3.5" />}
                onClick={() => alert(`Duplicate template: ${tmpl.name}`)}
              >
                Duplicate
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
                onClick={() => alert(`Launch proposal flow from ${tmpl.name} (Phase 5)`)}
              >
                Create Quotation
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="p-4 bg-indigo-50 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs text-indigo-900">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Quotation to Subscription:</strong> When a quotation is confirmed by the client or sales staff, it transitions automatically to <code>Confirmed</code> and then <code>Active</code> in the subscription lifecycle.
          </span>
        </div>
      </div>
    </div>
  );
};
