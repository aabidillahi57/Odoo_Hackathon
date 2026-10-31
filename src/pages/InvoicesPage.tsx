import React, { useState } from 'react';
import {
  Receipt,
  Printer,
  Send,
  Zap,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Ban,
  Check,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  useInvoices,
  useInvoiceDetail,
  confirmInvoice,
  cancelInvoice,
  sendInvoiceEmailDispatch,
  triggerBillingRun,
} from '../services/api';
import { DEMO_RECENT_INVOICES } from '../data/demoData';
import { Invoice, BillingRunSummary } from '../types';

export const InvoicesPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Detail Modal State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Billing Run Modal State
  const [showBillingModal, setShowBillingModal] = useState<boolean>(false);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isRunningBilling, setIsRunningBilling] = useState<boolean>(false);
  const [billingResult, setBillingResult] = useState<BillingRunSummary | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Action status messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Live query
  const {
    invoices: liveInvoices,
    total,
    totalPages,
    isLoading,
    error: loadError,
    refetch,
  } = useInvoices({
    status: statusFilter,
    search: searchTerm,
    overdue: overdueOnly,
    page,
    limit: 20,
  });

  // Single Invoice Detail Query
  const {
    invoice: activeInvoice,
    isLoading: isLoadingDetail,
    refetch: refetchDetail,
  } = useInvoiceDetail(selectedInvoiceId);

  // Fallback data when API returns empty or offline
  const displayedInvoices: Invoice[] =
    liveInvoices && liveInvoices.length > 0
      ? liveInvoices
      : (!liveInvoices && !isLoading) || (liveInvoices && liveInvoices.length === 0 && !searchTerm && statusFilter === 'all' && !overdueOnly)
      ? (DEMO_RECENT_INVOICES as Invoice[])
      : (liveInvoices || []);

  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {status === 'paid' && <Badge variant="success">Paid</Badge>}
        {status === 'confirmed' && <Badge variant="info">Confirmed</Badge>}
        {status === 'draft' && <Badge variant="neutral">Draft</Badge>}
        {status === 'cancelled' && <Badge variant="danger">Cancelled</Badge>}
        {isOverdue && status !== 'paid' && status !== 'cancelled' && (
          <Badge variant="warning" size="sm">
            Overdue
          </Badge>
        )}
      </div>
    );
  };

  const getDeliveryBadge = (deliveryStatus?: string | null, sentAt?: string | null) => {
    if (deliveryStatus === 'sent') {
      return (
        <Badge variant="success" size="sm">
          Sent
        </Badge>
      );
    }
    if (deliveryStatus === 'failed') {
      return (
        <Badge variant="danger" size="sm">
          Failed
        </Badge>
      );
    }
    if (sentAt) {
      return (
        <Badge variant="info" size="sm">
          Sent
        </Badge>
      );
    }
    return (
      <span className="text-[11px] text-slate-400">Unsent</span>
    );
  };

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleRunBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunningBilling(true);
    setBillingError(null);
    setBillingResult(null);

    try {
      const { data } = await triggerBillingRun({ asOfDate });
      setBillingResult(data);
      refetch();
    } catch (err: any) {
      setBillingError(err.message || 'Billing run failed.');
    } finally {
      setIsRunningBilling(false);
    }
  };

  const handleConfirm = async (id: number) => {
    setIsConfirming(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await confirmInvoice(id);
      setActionSuccess(`Invoice #${id} confirmed successfully.`);
      refetch();
      if (selectedInvoiceId === id) refetchDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm invoice.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingInvoice) return;

    if (!cancelReason.trim()) {
      setCancelError('Please specify a cancellation reason.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    try {
      await cancelInvoice(cancellingInvoice.id, cancelReason.trim());
      setActionSuccess(`Invoice ${cancellingInvoice.invoiceNumber} has been cancelled.`);
      setCancellingInvoice(null);
      setCancelReason('');
      refetch();
      if (selectedInvoiceId === cancellingInvoice.id) refetchDetail();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel invoice.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSendEmail = async (id: number, invNumber: string) => {
    setIsSendingEmail(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const { data } = await sendInvoiceEmailDispatch(id);
      if (data.devMode) {
        setActionSuccess(`Simulated email for ${invNumber} dispatched in local dev mode (see server logs).`);
      } else {
        setActionSuccess(`Invoice ${invNumber} sent to customer via Brevo API v3.`);
      }
      refetch();
      if (selectedInvoiceId === id) refetchDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to dispatch email via Brevo.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Printable CSS style rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <PageHeader
        title="Invoices & Recurring Billing"
        description="Automated billing engine, tax snapshotting, concurrency-safe invoice sequences, and Brevo delivery."
        breadcrumbs={['Home', 'Invoices']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => {
                if (displayedInvoices.length > 0) {
                  setSelectedInvoiceId(displayedInvoices[0].id);
                  setTimeout(() => window.print(), 400);
                }
              }}
            >
              Print Statements
            </Button>

            <Button
              variant="primary"
              icon={<Zap className="w-4 h-4" />}
              onClick={() => {
                setBillingResult(null);
                setBillingError(null);
                setShowBillingModal(true);
              }}
            >
              Run Billing Engine
            </Button>
          </div>
        }
      />

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {actionError && (
        <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />
      )}
      {loadError && (
        <ErrorAlert message={loadError} />
      )}

      {/* Filters Toolbar */}
      <Card noPadding>
        <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/50">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'All Invoices' },
              { id: 'draft', label: 'Draft' },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'paid', label: 'Paid' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Overdue Toggle */}
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium select-none bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => {
                  setOverdueOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-amber-700 font-semibold">Overdue Only</span>
            </label>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search invoice or customer..."
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        {isLoading ? (
          <div className="py-12 text-center">
            <LoadingSpinner label="Fetching invoices from database..." />
          </div>
        ) : displayedInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Delivery</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="group-hover:text-indigo-600 transition-colors">
                          {inv.invoiceNumber}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      <div>{inv.customerName}</div>
                      {inv.companyName && (
                        <div className="text-[11px] text-slate-400">{inv.companyName}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {inv.subscriptionNumber ? (
                        <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {inv.subscriptionNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">Ad-hoc</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(inv.status, inv.isOverdue)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{inv.issueDate}</td>
                    <td className="py-3.5 px-4">
                      <span className={inv.isOverdue ? 'text-amber-700 font-bold' : 'text-slate-600'}>
                        {inv.dueDate}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      ${inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      {inv.balanceDue > 0 ? (
                        <span className={inv.isOverdue ? 'text-rose-600' : 'text-amber-600'}>
                          ${inv.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-emerald-600">$0.00</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getDeliveryBadge(inv.deliveryStatus, inv.sentAt)}
                    </td>
                    <td
                      className="py-3.5 px-4 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Send invoice via Brevo"
                          onClick={() => handleSendEmail(inv.id, inv.invoiceNumber)}
                          disabled={inv.status === 'cancelled' || isSendingEmail}
                        >
                          <Send className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          title="Print / View Invoice"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No invoices match the selected filter</p>
            <p className="text-slate-400 mt-1">
              Trigger a recurring billing run or adjust your search filters.
            </p>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {displayedInvoices.length} of {total} invoices
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ===================================================================== */}
      {/* 1. RUN BILLING ENGINE MODAL                                           */}
      {/* ===================================================================== */}
      {showBillingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Execute Recurring Billing Run</h3>
                  <p className="text-[11px] text-slate-500">
                    Processes due active subscriptions and advances next billing dates
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBillingModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {billingError && <ErrorAlert message={billingError} onDismiss={() => setBillingError(null)} />}

            {!billingResult ? (
              <form onSubmit={handleRunBilling} className="space-y-4">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 text-indigo-950">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    Recurring Billing Engine Guarantee
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Evaluates all <strong>Active</strong> subscriptions with <code>next_billing_date &le; as_of_date</code>.
                    Idempotent: duplicate invoices are prevented by a database unique constraint.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    As-of Execution Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Subscriptions scheduled on or prior to this date will be invoiced.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setShowBillingModal(false)}
                    disabled={isRunningBilling}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    isLoading={isRunningBilling}
                    icon={<Zap className="w-3.5 h-3.5" />}
                  >
                    Start Billing Run
                  </Button>
                </div>
              </form>
            ) : (
              /* Billing Results Summary */
              <div className="space-y-4 animate-in fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[11px] text-slate-500">Processed</div>
                    <div className="text-base font-bold text-slate-900">{billingResult.processedCount}</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[11px] text-emerald-700 font-medium">Created</div>
                    <div className="text-base font-bold text-emerald-800">{billingResult.createdCount}</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-[11px] text-amber-700 font-medium">Skipped</div>
                    <div className="text-base font-bold text-amber-800">{billingResult.skippedCount}</div>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                    <div className="text-[11px] text-rose-700 font-medium">Failed</div>
                    <div className="text-base font-bold text-rose-800">{billingResult.failedCount}</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Total Invoiced Amount:</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    ${billingResult.totalInvoicedAmount.toFixed(2)}
                  </span>
                </div>

                {billingResult.details && billingResult.details.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-[11px]">
                    {billingResult.details.map((d, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between">
                        <div>
                          <strong className="font-mono text-slate-800">{d.subscriptionNumber}</strong>
                          {d.invoiceNumber && (
                            <span className="ml-2 text-indigo-600 font-mono">→ {d.invoiceNumber}</span>
                          )}
                          {d.reason && <p className="text-slate-400">{d.reason}</p>}
                          {d.error && <p className="text-rose-600">{d.error}</p>}
                        </div>
                        <Badge
                          variant={
                            d.status === 'created'
                              ? 'success'
                              : d.status === 'skipped'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {d.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button variant="primary" size="sm" onClick={() => setShowBillingModal(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. INVOICE DETAIL & PRINTABLE MODAL                                    */}
      {/* ===================================================================== */}
      {selectedInvoiceId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 my-auto text-xs">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 no-print">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {activeInvoice?.invoiceNumber || `Invoice #${selectedInvoiceId}`}
                    </h3>
                    {activeInvoice && getStatusBadge(activeInvoice.status, activeInvoice.isOverdue)}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Created {activeInvoice?.createdAt ? new Date(activeInvoice.createdAt).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Printer className="w-3.5 h-3.5" />}
                  onClick={handlePrint}
                >
                  Print
                </Button>
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isLoadingDetail ? (
              <div className="py-12 text-center no-print">
                <LoadingSpinner label="Loading invoice lines and tax snapshot..." />
              </div>
            ) : activeInvoice ? (
              <div id="printable-invoice" className="space-y-5">
                {/* Printable Brand Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-indigo-700">Brightloop Software Inc.</h2>
                    <p className="text-[11px] text-slate-500">Subscription Billing & Invoicing Engine</p>
                    <p className="text-[11px] text-slate-500">billing@brightloopsoftware.example.com</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-base font-bold font-mono text-slate-900">
                      {activeInvoice.invoiceNumber}
                    </h3>
                    <div className="mt-1">{getStatusBadge(activeInvoice.status, activeInvoice.isOverdue)}</div>
                  </div>
                </div>

                {/* Overdue Alert if applicable */}
                {activeInvoice.isOverdue && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      This invoice is past due ({activeInvoice.dueDate}). Outstanding balance: $
                      {activeInvoice.balanceDue.toFixed(2)}.
                    </span>
                  </div>
                )}

                {/* Bill To & Metadata Grid */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                      Billed To:
                    </span>
                    <strong className="text-slate-900 font-bold block text-sm">
                      {activeInvoice.customer?.name || activeInvoice.customerName}
                    </strong>
                    {activeInvoice.customer?.companyName && (
                      <div className="text-slate-600">{activeInvoice.customer.companyName}</div>
                    )}
                    <div className="text-slate-500 text-[11px]">
                      {activeInvoice.customer?.email || activeInvoice.customerEmail}
                    </div>
                    {activeInvoice.customer?.addressLine1 && (
                      <div className="text-slate-500 text-[11px] mt-1">
                        {activeInvoice.customer.addressLine1}
                        {activeInvoice.customer.city && `, ${activeInvoice.customer.city}`}
                        {activeInvoice.customer.country && `, ${activeInvoice.customer.country}`}
                      </div>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <div>
                      <span className="text-slate-500">Issue Date:</span>{' '}
                      <strong className="text-slate-800">{activeInvoice.issueDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Due Date:</span>{' '}
                      <strong className={activeInvoice.isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                        {activeInvoice.dueDate}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Payment Terms:</span>{' '}
                      <span className="text-slate-700">{activeInvoice.paymentTerms || 'Immediate Payment'}</span>
                    </div>
                    {activeInvoice.subscriptionNumber && (
                      <div>
                        <span className="text-slate-500">Subscription:</span>{' '}
                        <span className="font-mono text-indigo-700">{activeInvoice.subscriptionNumber}</span>
                      </div>
                    )}
                    {activeInvoice.billingPeriodStart && activeInvoice.billingPeriodEnd && (
                      <div>
                        <span className="text-slate-500">Billing Period:</span>{' '}
                        <span className="font-mono text-slate-700 text-[11px]">
                          {activeInvoice.billingPeriodStart} to {activeInvoice.billingPeriodEnd}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items Table with Tax Snapshots */}
                <div>
                  <div className="font-bold text-slate-900 mb-2">Itemized Charges & Tax Snapshots</div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Tax Snapshot</th>
                          <th className="py-2.5 px-3 text-right">Tax ($)</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeInvoice.lines && activeInvoice.lines.length > 0 ? (
                          activeInvoice.lines.map((line) => (
                            <tr key={line.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-800">{line.description}</span>
                                {line.variantName && (
                                  <div className="text-[11px] text-indigo-600 font-medium">
                                    Variant: {line.variantName}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">{line.quantity}</td>
                              <td className="py-2.5 px-3 text-right font-mono">${line.unitPrice.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="text-slate-600 text-[11px]">
                                  {line.taxName || 'Standard'} ({line.taxRate.toFixed(2)}%)
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                ${line.taxAmount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ${line.totalAmount.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-500">
                              No itemized lines recorded for this invoice.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary Totals */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Pre-Tax):</span>
                      <span className="font-mono font-medium">${(activeInvoice.subtotalAmount ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Tax Amount:</span>
                      <span className="font-mono font-medium">${(activeInvoice.taxAmount ?? 0).toFixed(2)}</span>
                    </div>
                    {(activeInvoice.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount:</span>
                        <span className="font-mono font-medium">-${(activeInvoice.discountAmount ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                      <span>Total Invoiced:</span>
                      <span className="font-mono text-indigo-700">${activeInvoice.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>Amount Paid:</span>
                      <span className="font-mono">${activeInvoice.amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-slate-900">
                      <span>Balance Due:</span>
                      <span className={`font-mono ${activeInvoice.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        ${activeInvoice.balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery & Dispatch Metadata */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <div>
                    <span>Delivery Status:</span>{' '}
                    {getDeliveryBadge(activeInvoice.deliveryStatus, activeInvoice.sentAt)}
                    {activeInvoice.sentAt && (
                      <span className="ml-2">
                        Last dispatched on {new Date(activeInvoice.sentAt).toLocaleString()}
                      </span>
                    )}
                    {activeInvoice.deliveryError && (
                      <span className="ml-2 text-rose-600">({activeInvoice.deliveryError})</span>
                    )}
                  </div>
                  {activeInvoice.cancellationReason && (
                    <div className="text-rose-600">
                      <strong>Cancellation Reason:</strong> {activeInvoice.cancellationReason}
                    </div>
                  )}
                </div>

                {/* Printable Footer */}
                <div className="text-center text-[10px] text-slate-400 border-t border-slate-200 pt-3">
                  Thank you for your business. For wire payments or billing questions, please contact billing@brightloopsoftware.example.com.
                </div>
              </div>
            ) : null}

            {/* Modal Lifecycle Action Buttons (no-print) */}
            {activeInvoice && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 no-print">
                <div className="flex items-center gap-2">
                  {/* Confirm Draft */}
                  {activeInvoice.status === 'draft' && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Check className="w-3.5 h-3.5" />}
                      isLoading={isConfirming}
                      onClick={() => handleConfirm(activeInvoice.id)}
                    >
                      Confirm Invoice
                    </Button>
                  )}

                  {/* Send via Brevo */}
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Send className="w-3.5 h-3.5" />}
                    isLoading={isSendingEmail}
                    disabled={activeInvoice.status === 'cancelled'}
                    onClick={() => handleSendEmail(activeInvoice.id, activeInvoice.invoiceNumber)}
                  >
                    Send via Brevo
                  </Button>

                  {/* Cancel Invoice */}
                  {activeInvoice.status !== 'cancelled' && activeInvoice.amountPaid === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Ban className="w-3.5 h-3.5 text-rose-600" />}
                      onClick={() => {
                        setCancelReason('');
                        setCancelError(null);
                        setCancellingInvoice(activeInvoice);
                      }}
                    >
                      Cancel Invoice
                    </Button>
                  )}
                </div>

                <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceId(null)}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. CANCEL INVOICE REASON MODAL                                        */}
      {/* ===================================================================== */}
      {cancellingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Cancel Invoice {cancellingInvoice.invoiceNumber}
            </h3>

            {cancelError && <ErrorAlert message={cancelError} onDismiss={() => setCancelError(null)} />}

            <p className="text-slate-500">
              Issued financial records are permanently preserved and marked as cancelled. Enter the audit reason below:
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Invoiced under incorrect billing cycle or client renegotiation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setCancellingInvoice(null)}
                  disabled={isCancelling}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isCancelling}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
