import React, { useState } from 'react';
import {
  Plus,
  ArrowDownLeft,
  Search,
  Ban,
  CheckCircle2,
  X,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import {
  usePayments,
  useInvoices,
  recordPayment,
  voidPayment,
} from '../services/api';
import { Payment, PaymentMethod } from '../types';

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';

  // Filters & State
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all');
  const [page, setPage] = useState(1);

  // Live Query
  const { payments, isLoading, error, meta, refetch } = usePayments({
    method: methodFilter || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  // Query confirmed invoices with outstanding balance for recording payments
  const { invoices: confirmedInvoices, refetch: refetchInvoices } = useInvoices({
    status: 'confirmed',
    limit: 100,
  });

  // Action feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Record Payment Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [recordError, setRecordError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Void Modal
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  // Find selected invoice object
  const activeInvoice = confirmedInvoices?.find((inv) => inv.id === Number(selectedInvoiceId));

  const openRecordModal = () => {
    setSelectedInvoiceId('');
    setAmount('');
    setPaymentMethod('bank_transfer');
    setPaymentDate(new Date().toISOString().substring(0, 10));
    setTransactionReference('');
    setNotes('');
    setRecordError(null);
    setIsRecordModalOpen(true);
  };

  const handleInvoiceChange = (invIdStr: string) => {
    if (!invIdStr) {
      setSelectedInvoiceId('');
      setAmount('');
      return;
    }
    const invId = parseInt(invIdStr, 10);
    setSelectedInvoiceId(invId);
    const target = confirmedInvoices?.find((i) => i.id === invId);
    if (target) {
      setAmount(target.balanceDue);
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordError(null);

    if (!selectedInvoiceId) {
      setRecordError('Please select a target invoice.');
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setRecordError('Payment amount must be greater than zero.');
      return;
    }

    if (activeInvoice && numAmount > activeInvoice.balanceDue) {
      setRecordError(
        `Overpayment not permitted: amount ($${numAmount.toFixed(2)}) exceeds invoice balance due ($${activeInvoice.balanceDue.toFixed(2)}).`
      );
      return;
    }

    setIsRecording(true);
    try {
      const { data } = await recordPayment({
        invoiceId: Number(selectedInvoiceId),
        amount: numAmount,
        paymentMethod,
        paymentDate,
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setActionSuccess(
        `Payment ${data.paymentNumber} of $${numAmount.toFixed(2)} recorded. Invoice ${data.invoice.invoiceNumber} status is now "${data.invoice.status}".`
      );
      setIsRecordModalOpen(false);
      refetch();
      refetchInvoices();
    } catch (err: any) {
      setRecordError(err.message || 'Failed to record payment.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingPayment) return;
    setVoidError(null);

    if (!voidReason.trim()) {
      setVoidError('Please specify a valid reason for voiding this payment.');
      return;
    }

    setIsVoiding(true);
    try {
      const { data } = await voidPayment(voidingPayment.id, voidReason.trim());
      setActionSuccess(
        `Payment ${voidingPayment.paymentNumber} has been voided. Invoice balance recalculated to $${data.reconciledInvoice.balanceDue.toFixed(2)}.`
      );
      setVoidingPayment(null);
      setVoidReason('');
      refetch();
      refetchInvoices();
    } catch (err: any) {
      setVoidError(err.message || 'Failed to void payment.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorded Payments & Collections"
        description="Log payment receipts, reconcile balances against issued invoices, and track bank transfers."
        breadcrumbs={['Home', 'Payments']}
        action={
          !isCustomer && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={openRecordModal}
            >
              Record Payment
            </Button>
          )
        }
      />

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      <Card noPadding>
        {/* Filter Toolbar */}
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-3 border-b border-slate-100 text-xs">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search payment #, invoice #, customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-xs text-slate-900 focus:outline-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(['all', 'completed', 'voided'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Method selector */}
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="">All Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="lg" label="Loading payments..." />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Payments Recorded"
              description={
                search || methodFilter || statusFilter !== 'all'
                  ? 'No payments match your filter criteria.'
                  : 'No payment transactions recorded yet. Click "Record Payment" to log an incoming customer receipt.'
              }
              actionLabel={!isCustomer ? 'Record Payment' : undefined}
              onAction={!isCustomer ? openRecordModal : undefined}
            />
          </div>
        ) : (
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
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {!isCustomer && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => {
                  const isVoided = payment.status === 'voided';
                  return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoided ? 'bg-rose-50/20 text-slate-400' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium">
                        <div className="flex items-center gap-1.5">
                          <ArrowDownLeft
                            className={`w-3.5 h-3.5 ${
                              isVoided ? 'text-slate-400' : 'text-emerald-600'
                            }`}
                          />
                          <span className={isVoided ? 'line-through text-slate-500' : 'text-slate-900'}>
                            {payment.paymentNumber}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{payment.customerName}</div>
                        {payment.customerEmail && (
                          <div className="text-[11px] text-slate-400">{payment.customerEmail}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                        {payment.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <Badge variant="neutral" size="sm">
                          {(payment.paymentMethod || 'other').replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {payment.paymentDate ? payment.paymentDate.substring(0, 10) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {payment.transactionReference || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        <span
                          className={
                            isVoided
                              ? 'line-through text-slate-400'
                              : 'text-emerald-600 font-mono'
                          }
                        >
                          ${Number(payment.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isVoided ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md"
                            title={payment.voidReason ? `Reason: ${payment.voidReason}` : 'Voided'}
                          >
                            <Ban className="w-3 h-3" />
                            Voided
                          </span>
                        ) : (
                          <Badge variant="success" size="sm">
                            Completed
                          </Badge>
                        )}
                      </td>
                      {!isCustomer && (
                        <td className="py-3 px-4 text-right">
                          {!isVoided ? (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidError(null);
                                setVoidReason('');
                                setVoidingPayment(payment);
                              }}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                            >
                              Void
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {payment.voidReason ? `"${payment.voidReason}"` : 'Voided'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {meta && meta.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} payments)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ===================================================================== */}
      {/* RECORD PAYMENT MODAL                                                  */}
      {/* ===================================================================== */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Customer Payment</h3>
                  <p className="text-[11px] text-slate-500">
                    Apply funds against an issued invoice and reconcile balance due
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {recordError && <ErrorAlert message={recordError} onDismiss={() => setRecordError(null)} />}

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              {/* Invoice Selector */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Target Confirmed Invoice <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono text-xs"
                >
                  <option value="">Select an invoice to reconcile...</option>
                  {confirmedInvoices &&
                    confirmedInvoices
                      .filter((inv) => inv.balanceDue > 0)
                      .map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — {inv.customerName} (Bal: ${inv.balanceDue.toFixed(2)} of ${inv.totalAmount.toFixed(2)})
                        </option>
                      ))}
                </select>
              </div>

              {/* Invoice Summary Card */}
              {activeInvoice && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-indigo-950 flex items-center justify-between">
                    <span>Invoice Details ({activeInvoice.invoiceNumber})</span>
                    <Badge variant={activeInvoice.isOverdue ? 'warning' : 'info'} size="sm">
                      {activeInvoice.isOverdue ? 'Overdue' : 'Confirmed'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Total Invoiced</span>
                      <span className="font-mono font-bold text-slate-800">
                        ${activeInvoice.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Already Paid</span>
                      <span className="font-mono text-emerald-600 font-semibold">
                        ${activeInvoice.amountPaid.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Balance Due</span>
                      <span className="font-mono font-bold text-indigo-700">
                        ${activeInvoice.balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Amount and Payment Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Amount ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={activeInvoice ? activeInvoice.balanceDue : undefined}
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono font-bold text-sm"
                  />
                  {activeInvoice && (
                    <button
                      type="button"
                      onClick={() => setAmount(activeInvoice.balanceDue)}
                      className="text-[10px] text-indigo-600 font-semibold mt-1 hover:underline"
                    >
                      Pay full balance (${activeInvoice.balanceDue.toFixed(2)})
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Payment Method and Transaction Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                  >
                    <option value="bank_transfer">Bank Transfer / Wire</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash / Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WIRE-89302194, Check #104"
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Internal Notes / Memo
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context or collection memo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={isRecording}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isRecording}
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                >
                  Record Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VOID PAYMENT MODAL                                                    */}
      {/* ===================================================================== */}
      {voidingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                Void Payment {voidingPayment.paymentNumber}
              </h3>
            </div>

            {voidError && <ErrorAlert message={voidError} onDismiss={() => setVoidError(null)} />}

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-rose-950">
              <div className="font-semibold flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-rose-600" />
                Audited Void Action
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Voiding this payment of <strong>${Number(voidingPayment.amount).toFixed(2)}</strong> will immediately restore the balance due on invoice <strong>{voidingPayment.invoiceNumber}</strong>. If the invoice was marked paid, its status will be reverted to <strong>confirmed</strong>.
              </p>
            </div>

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Void Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Bounced cheque, chargeback, entered wrong invoice..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setVoidingPayment(null)}
                  disabled={isVoiding}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  type="submit"
                  isLoading={isVoiding}
                >
                  Confirm Void
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
