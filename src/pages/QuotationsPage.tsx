import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Plus,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { useQuotationTemplates, useCustomers, issueSubscriptionFromTemplate } from '../services/api';
import { DEMO_QUOTATION_TEMPLATES } from '../data/demoData';
import { QuotationTemplate } from '../types';

export const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { templates: apiTemplates, isLoading, error, refetch } = useQuotationTemplates();
  const { customers } = useCustomers({ page: 1, limit: 100 });

  const [useDemoFallback] = useState(false);
  const [selectedTemplateForIssue, setSelectedTemplateForIssue] = useState<QuotationTemplate | null>(null);

  // Issuance Dialog State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [paymentTerms, setPaymentTerms] = useState<string>('Immediate Payment');
  const [autoRenew, setAutoRenew] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [isIssuing, setIsIssuing] = useState<boolean>(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuedResult, setIssuedResult] = useState<{
    subId: number;
    subNumber: string;
    customerName: string;
    expiryDate: string;
  } | null>(null);

  const isLive = Boolean(apiTemplates && !useDemoFallback);
  const templateList: QuotationTemplate[] = isLive && apiTemplates
    ? apiTemplates
    : DEMO_QUOTATION_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        planId: 1,
        planName: t.planName,
        validityDays: t.validityDays,
        linesCount: t.linesCount,
        notes: t.notes,
        isActive: true,
      }));

  const handleOpenIssueModal = (tmpl: QuotationTemplate) => {
    setSelectedTemplateForIssue(tmpl);
    setSelectedCustomerId(customers && customers[0] ? customers[0].id : 0);
    setValidityDays(tmpl.validityDays || 30);
    setIssueError(null);
    setIssuedResult(null);
  };

  const handleConfirmIssuance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateForIssue) return;
    if (!selectedCustomerId) {
      setIssueError('Please select a customer profile.');
      return;
    }

    setIsIssuing(true);
    setIssueError(null);

    try {
      const res = await issueSubscriptionFromTemplate(selectedTemplateForIssue.id, {
        customerId: selectedCustomerId,
        startDate,
        customValidityDays: validityDays,
        paymentTerms,
        autoRenew,
        notes,
      });

      setIssuedResult({
        subId: res.data.id,
        subNumber: res.data.subscriptionNumber,
        customerName: res.data.customerName,
        expiryDate: res.data.expiryDate,
      });
    } catch (err: any) {
      setIssueError(err.message || 'Failed to issue quotation.');
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Templates & Proposals"
        description="Preset product bundles, default plans, and custom validities to quickly issue enterprise proposals."
        isDemo={!isLive}
        breadcrumbs={['Home', 'Quotations']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={refetch}
              title="Refresh from MySQL database"
            >
              Sync DB
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                if (templateList.length > 0) {
                  handleOpenIssueModal(templateList[0]);
                }
              }}
            >
              Issue Quotation
            </Button>
          </div>
        }
      />

      {error && !useDemoFallback && (
        <ErrorAlert
          title="Server Database Unreachable"
          message={`${error} (Falling back to preview demo templates. Run 'npm run db:seed' to populate local MySQL.)`}
          onRetry={refetch}
        />
      )}

      {/* Success Banner if recently issued */}
      {issuedResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong>Quotation Proposal Issued:</strong> Successfully created quotation{' '}
              <strong className="font-mono text-emerald-800">{issuedResult.subNumber}</strong> for{' '}
              {issuedResult.customerName}. Valid through {issuedResult.expiryDate}.
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/subscriptions')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            View in Subscriptions
          </Button>
        </div>
      )}

      {/* Grid of Templates */}
      {isLoading && !apiTemplates ? (
        <div className="p-12 text-center">
          <LoadingSpinner label="Loading quotation templates..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templateList.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-bold text-slate-900">{tmpl.name}</h3>
                  <Badge variant="brand" size="sm">
                    {tmpl.lines?.length ?? tmpl.linesCount} preset items
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 mb-4">{tmpl.notes}</p>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Associated Plan</span>
                    <span className="font-semibold text-slate-800">{tmpl.planName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Validity Window
                    </span>
                    <span className="font-mono font-medium text-slate-700">{tmpl.validityDays} Days</span>
                  </div>

                  {tmpl.lines && tmpl.lines.length > 0 && (
                    <div className="border-t border-slate-200/60 pt-2 space-y-1 mt-2">
                      <span className="font-semibold text-slate-700 text-[11px]">Included Products:</span>
                      {tmpl.lines.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between text-[11px] text-slate-600">
                          <span>
                            {l.productName} {l.variantName ? `(${l.variantName})` : ''} × {l.quantity}
                          </span>
                          <span className="font-mono">${(l.unitPrice * l.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {tmpl.isActive ? 'Active Template' : 'Archived'}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                  onClick={() => handleOpenIssueModal(tmpl)}
                >
                  Issue Proposal
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Information Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs text-indigo-900">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Quotation to Subscription:</strong> Issuing a proposal generates a unique contract number (
            <code>SUB-YYYY-XXXX</code>) in <code>Quotation</code> status. Once signed or confirmed by the client, it
            progresses automatically to <code>Confirmed</code> and <code>Active</code>.
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Quotation Issuance Dialog                                                 */}
      {/* ========================================================================= */}
      {selectedTemplateForIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Issue Quotation from {selectedTemplateForIssue.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pre-configured with {selectedTemplateForIssue.planName} tier and preset product lines.
                </p>
              </div>
              <button
                onClick={() => setSelectedTemplateForIssue(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {issueError && <ErrorAlert message={issueError} onDismiss={() => setIssueError(null)} />}

            {issuedResult ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Quotation Successfully Generated!
                  </div>
                  <div>
                    Subscription Number: <strong className="font-mono">{issuedResult.subNumber}</strong>
                  </div>
                  <div>Customer: {issuedResult.customerName}</div>
                  <div>Quotation Expiry Date: {issuedResult.expiryDate}</div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedTemplateForIssue(null)}>
                    Done
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/subscriptions')}>
                    Open in Subscriptions
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmIssuance} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Profile *</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Proposal Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Validity (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                    >
                      <option value="Immediate Payment">Immediate Payment</option>
                      <option value="Net 15">Net 15 Days</option>
                      <option value="Net 30">Net 30 Days</option>
                      <option value="Net 60">Net 60 Days</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRenew}
                        onChange={(e) => setAutoRenew(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span className="font-semibold text-slate-700">Auto-Renew on Expiry</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Proposal Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Quotation terms, SLA guarantees, or special pricing notes..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTemplateForIssue(null)}
                    disabled={isIssuing}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" isLoading={isIssuing}>
                    Issue Quotation Proposal
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
