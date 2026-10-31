import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Calendar,
  Search,
  PauseCircle,
  PlayCircle,
  XCircle,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  History,
  X,
  Building,
  User,
  Trash2,
  Edit2,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button, ButtonVariant } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import {
  useSubscriptions,
  useSubscription,
  useProducts,
  usePlans,
  useCustomers,
  useQuotationTemplates,
  createSubscription,
  updateSubscription,
  transitionSubscription,
  renewSubscription,
  issueSubscriptionFromTemplate,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Subscription, SubscriptionStatus, Product } from '../types';
import { DEMO_RECENT_SUBSCRIPTIONS } from '../data/demoData';

export const SubscriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff';

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState<number>(1);
  const [useDemoFallback] = useState<boolean>(false);

  // Detail Modal State
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);

  // Creation / Issuance Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createMode, setCreateMode] = useState<'scratch' | 'template'>('scratch');

  // Transition / Action Modal States
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    subId: number;
    subNumber: string;
    actionType: 'transition' | 'renew';
    targetStatus?: SubscriptionStatus;
    title: string;
    description: string;
    confirmText: string;
    confirmVariant?: ButtonVariant;
  } | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Queries
  const {
    subscriptions: apiSubscriptions,
    meta,
    isLoading,
    error: apiError,
    refetch: refetchSubscriptions,
  } = useSubscriptions({
    page,
    limit: 10,
    status: statusFilter,
    search: searchTerm,
    planId: planFilter,
  });

  const { subscription: selectedSubscription, isLoading: isLoadingDetail, error: detailError, refetch: refetchDetail } =
    useSubscription(selectedSubId);

  const { products } = useProducts();
  const { plans } = usePlans();
  const { customers } = useCustomers({ page: 1, limit: 100 });
  const { templates } = useQuotationTemplates();

  const isLive = Boolean(apiSubscriptions && !useDemoFallback);

  // Fallback demo data mapping
  const demoList: Subscription[] = DEMO_RECENT_SUBSCRIPTIONS.map((s) => ({
    id: s.id,
    subscriptionNumber: s.subscriptionNumber,
    customerId: s.customerId,
    customerName: s.customerName,
    planId: s.planId,
    planName: s.planName,
    status: s.status as SubscriptionStatus,
    startDate: s.startDate,
    expiryDate: s.expiryDate,
    nextBillingDate: s.nextBillingDate,
    recurringAmount: s.recurringAmount,
    totalRecurringAmount: s.recurringAmount,
    autoRenew: s.autoRenew,
    paymentTerms: 'Immediate Payment',
  })).filter((s) => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      s.subscriptionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const displayList: Subscription[] = isLive && apiSubscriptions ? apiSubscriptions : demoList;

  const getStatusBadge = (status: SubscriptionStatus | string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'quotation':
        return <Badge variant="warning">Quotation</Badge>;
      case 'draft':
        return <Badge variant="neutral">Draft</Badge>;
      case 'confirmed':
        return <Badge variant="brand">Confirmed</Badge>;
      case 'paused':
        return <Badge variant="neutral">Paused</Badge>;
      case 'closed':
        return <Badge variant="danger">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const handleOpenActionModal = (
    subId: number,
    subNumber: string,
    targetStatus: SubscriptionStatus,
    title: string,
    description: string,
    confirmText: string,
    variant: ButtonVariant = 'primary'
  ) => {
    setActionReason('');
    setActionError(null);
    setActionModal({
      isOpen: true,
      subId,
      subNumber,
      actionType: 'transition',
      targetStatus,
      title,
      description,
      confirmText,
      confirmVariant: variant,
    });
  };

  const handleOpenRenewModal = (subId: number, subNumber: string) => {
    setActionReason('');
    setActionError(null);
    setActionModal({
      isOpen: true,
      subId,
      subNumber,
      actionType: 'renew',
      title: `Renew Subscription ${subNumber}`,
      description: 'Extend this active contract for another plan billing cycle. Expiry and next billing dates will advance automatically.',
      confirmText: 'Confirm Renewal',
      confirmVariant: 'primary',
    });
  };

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    setIsSubmittingAction(true);
    setActionError(null);

    try {
      if (actionModal.actionType === 'renew') {
        await renewSubscription(actionModal.subId, actionReason);
      } else if (actionModal.targetStatus) {
        await transitionSubscription(actionModal.subId, actionModal.targetStatus, actionReason);
      }
      setActionModal(null);
      refetchSubscriptions();
      if (selectedSubId === actionModal.subId) {
        refetchDetail();
      }
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Contracts & Lifecycles"
        description="Monitor full contract lifecycles: Draft → Quotation → Confirmed → Active → Closed (with Paused & Renewal support)."
        isDemo={!isLive}
        breadcrumbs={['Home', 'Subscriptions']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={refetchSubscriptions}
              title="Refresh from database"
            >
              Sync DB
            </Button>
            {isStaffOrAdmin && (
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setCreateMode('scratch');
                  setIsCreateModalOpen(true);
                }}
              >
                New Subscription
              </Button>
            )}
          </div>
        }
      />

      {apiError && !useDemoFallback && (
        <ErrorAlert
          title="Server Database Unreachable"
          message={`${apiError} (Showing local preview demo data. Run 'npm run db:seed' to populate local MySQL.)`}
          onRetry={refetchSubscriptions}
        />
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search sub #, customer, company..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {plans && plans.length > 0 && (
            <select
              value={planFilter || ''}
              onChange={(e) => {
                setPlanFilter(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="hidden sm:block text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="">All Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Lifecycle Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {['all', 'draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'].map((status) => {
            const count = meta?.statusCounts ? meta.statusCounts[status] : undefined;
            return (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{status}</span>
                {count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      statusFilter === status ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subscriptions Table */}
      <Card noPadding>
        {isLoading && !apiSubscriptions ? (
          <div className="p-12 text-center">
            <LoadingSpinner label="Loading subscriptions from server..." />
          </div>
        ) : displayList.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Repeat className="w-8 h-8 text-slate-400" />}
              title="No subscriptions found"
              description={
                searchTerm || statusFilter !== 'all'
                  ? 'No subscriptions match your current filter parameters.'
                  : 'No subscription agreements recorded yet.'
              }
              actionLabel={isStaffOrAdmin ? 'Create First Subscription' : undefined}
              onAction={
                isStaffOrAdmin
                  ? () => {
                      setCreateMode('scratch');
                      setIsCreateModalOpen(true);
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Subscription #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Plan / Interval</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Start / Expiry</th>
                  <th className="py-3 px-4 text-right">Recurring Total</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayList.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Repeat className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold text-indigo-700 group-hover:underline">
                          {sub.subscriptionNumber}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{sub.customerName}</div>
                      {sub.companyName && <div className="text-[11px] text-slate-400">{sub.companyName}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">{sub.planName}</div>
                      <div className="text-[11px] text-slate-400 capitalize">
                        {sub.billingInterval ? `${sub.billingIntervalCount || 1} ${sub.billingInterval}` : 'Monthly'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{sub.startDate}</span>
                      </div>
                      {sub.expiryDate && (
                        <div className="text-[11px] text-slate-400 mt-0.5">Expires: {sub.expiryDate}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ${(sub.totalRecurringAmount ?? sub.recurringAmount ?? 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedSubId(sub.id)}
                          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                          title="View Subscription Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Quick Action Buttons for Staff */}
                        {isStaffOrAdmin && sub.status === 'draft' && (
                          <button
                            onClick={() =>
                              handleOpenActionModal(
                                sub.id,
                                sub.subscriptionNumber,
                                'quotation',
                                'Issue Quotation Proposal',
                                'Transition this draft subscription into an official quotation proposal for client review.',
                                'Issue Quotation'
                              )
                            }
                            className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[11px] font-semibold"
                          >
                            Quote
                          </button>
                        )}

                        {isStaffOrAdmin && sub.status === 'quotation' && (
                          <button
                            onClick={() =>
                              handleOpenActionModal(
                                sub.id,
                                sub.subscriptionNumber,
                                'confirmed',
                                'Confirm Quotation Agreement',
                                'Mark this quotation proposal as confirmed by the client or sales authorization.',
                                'Confirm Agreement'
                              )
                            }
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold"
                          >
                            Confirm
                          </button>
                        )}

                        {isStaffOrAdmin && sub.status === 'confirmed' && (
                          <button
                            onClick={() =>
                              handleOpenActionModal(
                                sub.id,
                                sub.subscriptionNumber,
                                'active',
                                'Activate Subscription Contract',
                                'Commence recurring contract lifecycle. Contract becomes active immediately.',
                                'Activate Contract'
                              )
                            }
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold"
                          >
                            Activate
                          </button>
                        )}

                        {isStaffOrAdmin && sub.status === 'active' && (
                          <button
                            onClick={() =>
                              handleOpenActionModal(
                                sub.id,
                                sub.subscriptionNumber,
                                'paused',
                                'Pause Subscription',
                                'Temporarily pause recurring service and billing. Can be resumed at any time if plan allows.',
                                'Pause Subscription',
                                'outline'
                              )
                            }
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                            title="Pause Subscription"
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                        )}

                        {isStaffOrAdmin && sub.status === 'paused' && (
                          <button
                            onClick={() =>
                              handleOpenActionModal(
                                sub.id,
                                sub.subscriptionNumber,
                                'active',
                                'Resume Subscription',
                                'Resume this paused subscription contract and restore regular active billing cycles.',
                                'Resume Subscription'
                              )
                            }
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Resume Subscription"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {meta && meta.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} subscriptions total)
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                icon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                icon={<ChevronRight className="w-3.5 h-3.5" />}
                iconPosition="right"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* Detail Modal View                                                        */}
      {/* ========================================================================= */}
      {selectedSubId && (
        <SubscriptionDetailModal
          subId={selectedSubId}
          subscription={selectedSubscription}
          products={products || []}
          isLoading={isLoadingDetail}
          error={detailError}
          isStaffOrAdmin={isStaffOrAdmin}
          onClose={() => setSelectedSubId(null)}
          onTransition={(targetStatus, title, desc, confirmText, variant) => {
            if (selectedSubscription) {
              handleOpenActionModal(
                selectedSubscription.id,
                selectedSubscription.subscriptionNumber,
                targetStatus,
                title,
                desc,
                confirmText,
                variant
              );
            }
          }}
          onRenew={() => {
            if (selectedSubscription) {
              handleOpenRenewModal(selectedSubscription.id, selectedSubscription.subscriptionNumber);
            }
          }}
          onUpdated={() => {
            refetchDetail();
            refetchSubscriptions();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* Create / Template Issuance Modal                                          */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <CreateSubscriptionModal
          mode={createMode}
          customers={customers || []}
          plans={plans || []}
          products={products || []}
          templates={templates || []}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(createdSub) => {
            setIsCreateModalOpen(false);
            refetchSubscriptions();
            setSelectedSubId(createdSub.id);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* Action / State Transition Prompt Modal                                    */}
      {/* ========================================================================= */}
      {actionModal && actionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{actionModal.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{actionModal.description}</p>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Internal Audit Note (Optional)
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="State reason for this lifecycle transition (e.g., Client signed enterprise addendum, seasonal downtime request)..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setActionModal(null)} disabled={isSubmittingAction}>
                Cancel
              </Button>
              <Button
                variant={actionModal.confirmVariant || 'primary'}
                size="sm"
                isLoading={isSubmittingAction}
                onClick={handleConfirmAction}
              >
                {actionModal.confirmText}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Helper Component: Subscription Detail Modal
// =============================================================================
interface DetailModalProps {
  subId: number;
  subscription: Subscription | null;
  products: Product[];
  isLoading: boolean;
  error: string | null;
  isStaffOrAdmin: boolean;
  onClose: () => void;
  onTransition: (
    target: SubscriptionStatus,
    title: string,
    desc: string,
    confirmText: string,
    variant?: ButtonVariant
  ) => void;
  onRenew: () => void;
  onUpdated: () => void;
}

const SubscriptionDetailModal: React.FC<DetailModalProps> = ({
  subId,
  subscription,
  products,
  isLoading,
  error,
  isStaffOrAdmin,
  onClose,
  onTransition,
  onRenew,
  onUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {subscription?.subscriptionNumber || `Subscription #${subId}`}
                </h2>
                {subscription && (
                  <Badge
                    variant={
                      subscription.status === 'active'
                        ? 'success'
                        : subscription.status === 'quotation'
                        ? 'warning'
                        : subscription.status === 'closed'
                        ? 'danger'
                        : 'neutral'
                    }
                  >
                    {subscription.status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Created: {subscription?.createdAt ? new Date(subscription.createdAt).toLocaleString() : 'Loading...'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner label="Loading complete subscription contract details..." />
            </div>
          ) : error || !subscription ? (
            <ErrorAlert message={error || 'Subscription could not be loaded.'} />
          ) : isEditing ? (
            <EditSubscriptionView
              subscription={subscription}
              products={products}
              onCancel={() => setIsEditing(false)}
              onSaved={() => {
                setIsEditing(false);
                onUpdated();
              }}
            />
          ) : (
            <>
              {/* Authorized Action Bar */}
              <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    Lifecycle State Machine Actions
                  </div>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Current Status: <strong className="capitalize">{subscription.status}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Allow editing when in Draft or Quotation status */}
                  {(subscription.status === 'draft' || subscription.status === 'quotation') && isStaffOrAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Terms & Lines
                    </Button>
                  )}

                  {subscription.status === 'draft' && isStaffOrAdmin && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          onTransition(
                            'quotation',
                            'Issue Quotation Proposal',
                            'Issue official quotation proposal to customer with preset validity days.',
                            'Issue Quotation'
                          )
                        }
                      >
                        Issue Quotation
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          onTransition(
                            'closed',
                            'Cancel Draft Agreement',
                            'Close and discard this draft subscription agreement.',
                            'Cancel Draft',
                            'danger'
                          )
                        }
                      >
                        Cancel
                      </Button>
                    </>
                  )}

                  {subscription.status === 'quotation' && isStaffOrAdmin && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          onTransition(
                            'confirmed',
                            'Confirm Proposal Agreement',
                            'Confirm client agreement to proceed with service activation.',
                            'Confirm Agreement'
                          )
                        }
                      >
                        Confirm Agreement
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          onTransition(
                            'closed',
                            'Close / Decline Quotation',
                            'Close this quotation proposal as declined or expired.',
                            'Decline Proposal',
                            'danger'
                          )
                        }
                      >
                        Decline
                      </Button>
                    </>
                  )}

                  {subscription.status === 'confirmed' && isStaffOrAdmin && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          onTransition(
                            'active',
                            'Activate Contract',
                            'Begin active software service and recurring contract billing schedule.',
                            'Activate Contract'
                          )
                        }
                      >
                        Activate Contract
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          onTransition(
                            'closed',
                            'Cancel Agreement',
                            'Cancel confirmed agreement prior to service commencement.',
                            'Cancel Agreement',
                            'danger'
                          )
                        }
                      >
                        Cancel
                      </Button>
                    </>
                  )}

                  {subscription.status === 'active' && (
                    <>
                      {/* Pause Allowed Check */}
                      {subscription.planPolicy?.pauseAllowed !== false ? (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                          onClick={() =>
                            onTransition(
                              'paused',
                              'Pause Subscription',
                              'Temporarily pause this subscription agreement. The plan allows pausing.',
                              'Pause Subscription',
                              'outline'
                            )
                          }
                        >
                          Pause
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          Pause Disallowed by Plan
                        </span>
                      )}

                      {isStaffOrAdmin && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<RefreshCw className="w-3.5 h-3.5" />}
                            onClick={onRenew}
                          >
                            Renew Contract
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<XCircle className="w-3.5 h-3.5" />}
                            onClick={() =>
                              onTransition(
                                'closed',
                                'Close Subscription',
                                'Terminate subscription contract. If closed early, plan early-close policy will be evaluated.',
                                'Close Contract',
                                'danger'
                              )
                            }
                          >
                            Close Contract
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  {subscription.status === 'paused' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<PlayCircle className="w-3.5 h-3.5" />}
                        onClick={() =>
                          onTransition(
                            'active',
                            'Resume Subscription',
                            'Resume subscription contract and return to active billing cycle.',
                            'Resume Active Status'
                          )
                        }
                      >
                        Resume Contract
                      </Button>
                      {isStaffOrAdmin && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            onTransition(
                              'closed',
                              'Close Paused Subscription',
                              'Permanently terminate this paused subscription contract.',
                              'Close Contract',
                              'danger'
                            )
                          }
                        >
                          Close Contract
                        </Button>
                      )}
                    </>
                  )}

                  {subscription.status === 'closed' && (
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                      Terminal State (Immutable)
                    </span>
                  )}
                </div>
              </div>

              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Customer Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <User className="w-4 h-4 text-indigo-600" />
                    Customer Profile
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{subscription.customerName}</div>
                    {subscription.companyName && (
                      <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3.5 h-3.5" />
                        {subscription.companyName}
                      </div>
                    )}
                    {subscription.customerEmail && (
                      <div className="text-slate-500 mt-0.5">{subscription.customerEmail}</div>
                    )}
                    {subscription.customerPhone && (
                      <div className="text-slate-500 mt-0.5">{subscription.customerPhone}</div>
                    )}
                  </div>
                </div>

                {/* Plan & Cycle Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Plan & Cycle Policy
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Plan Tier:</span>
                      <strong className="text-slate-800">{subscription.planName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Interval:</span>
                      <span className="capitalize font-medium text-slate-700">
                        {subscription.billingIntervalCount || 1} {subscription.billingInterval || 'Monthly'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Terms:</span>
                      <span className="font-medium text-slate-700">{subscription.paymentTerms || 'Immediate'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Auto Renew:</span>
                      <span className="font-semibold text-emerald-700">
                        {subscription.autoRenew ? 'Enabled' : 'Manual'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contract Dates & Financial Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Contract Dates
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Start Date:</span>
                      <strong className="text-slate-800">{subscription.startDate}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Expiry Date:</span>
                      <strong className="text-slate-800">{subscription.expiryDate || 'Open / No expiry'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Next Billing:</span>
                      <span className="text-slate-700">{subscription.nextBillingDate || 'Pending activation'}</span>
                    </div>
                    {subscription.templateName && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Source Template:</span>
                        <span className="text-indigo-600 font-medium truncate max-w-[140px]">
                          {subscription.templateName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Snapshot Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                    Contract Line Items Snapshot
                  </h3>
                  <span className="text-slate-400 text-[11px]">Authoritative Server Pricing</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Product / Service</th>
                        <th className="py-2.5 px-3">Description Snapshot</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Tax Rate</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subscription.lines && subscription.lines.length > 0 ? (
                        subscription.lines.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">{l.productName}</div>
                              {l.variantName && (
                                <div className="text-[11px] text-indigo-600 font-medium">{l.variantName}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{l.description}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-medium">{l.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              ${l.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500">
                              {l.taxRate > 0 ? `${l.taxRate}%` : '0%'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              ${l.subtotalAmount.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${l.totalAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400">
                            No line items recorded for this subscription.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={5} className="py-2 px-3 text-right font-semibold text-slate-600">
                          Subtotal Amount:
                        </td>
                        <td colSpan={2} className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                          ${(subscription.subtotalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="py-2 px-3 text-right font-semibold text-slate-600">
                          Tax Amount:
                        </td>
                        <td colSpan={2} className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                          ${(subscription.taxAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td colSpan={5} className="py-2.5 px-3 text-right font-bold text-slate-900 text-sm">
                          Total Recurring Contract Amount:
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 text-sm">
                          ${(subscription.totalRecurringAmount || subscription.recurringAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Staff / Admin Audit History Timeline */}
              {isStaffOrAdmin && subscription.history && subscription.history.length > 0 && (
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-indigo-600" />
                    Internal Audit & Lifecycle History
                  </h3>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    {subscription.history.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 text-xs border-b border-slate-200/60 pb-2.5 last:border-0 last:pb-0">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">
                              {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created in ${h.toStatus}`}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {new Date(h.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Actor: <strong>{h.actorName || 'System'}</strong> ({h.actorRole || 'system'})
                            {h.action && <span className="ml-2 font-mono text-slate-400">[{h.action}]</span>}
                          </div>
                          {h.reason && (
                            <div className="mt-1 text-slate-600 bg-white p-2 rounded border border-slate-200">
                              {h.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end rounded-b-2xl">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Helper Component: Edit Subscription View
// =============================================================================
interface EditSubscriptionViewProps {
  subscription: Subscription;
  products: Product[];
  onCancel: () => void;
  onSaved: () => void;
}

const EditSubscriptionView: React.FC<EditSubscriptionViewProps> = ({
  subscription,
  products,
  onCancel,
  onSaved,
}) => {
  const [startDate, setStartDate] = useState(subscription.startDate);
  const [expiryDate, setExpiryDate] = useState(subscription.expiryDate || '');
  const [paymentTerms, setPaymentTerms] = useState(subscription.paymentTerms || 'Immediate Payment');
  const [autoRenew, setAutoRenew] = useState(subscription.autoRenew);
  const [notes, setNotes] = useState(subscription.notes || '');

  const [lines, setLines] = useState(
    subscription.lines && subscription.lines.length > 0
      ? subscription.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId || undefined,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotal: l.subtotalAmount,
        }))
      : [
          {
            productId: products[0]?.id || 1,
            variantId: products[0]?.variants?.[0]?.id,
            quantity: 1,
            unitPrice: products[0]?.salesPrice || 450,
            subtotal: products[0]?.salesPrice || 450,
          },
        ]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleAddLine = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    setLines((prev) => [
      ...prev,
      {
        productId: firstProd.id,
        variantId: firstProd.variants?.[0]?.id,
        quantity: 1,
        unitPrice: firstProd.salesPrice,
        subtotal: firstProd.salesPrice,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, value: any) => {
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[idx] };

      if (field === 'productId') {
        const prod = products.find((p) => p.id === Number(value));
        line.productId = Number(value);
        line.variantId = prod?.variants?.[0]?.id;
        line.unitPrice = prod?.salesPrice || 0;
      } else if (field === 'variantId') {
        line.variantId = value ? Number(value) : undefined;
        const prod = products.find((p) => p.id === line.productId);
        const variant = prod?.variants?.find((v) => v.id === line.variantId);
        line.unitPrice = (prod?.salesPrice || 0) + (variant?.priceAdjustment || 0);
      } else if (field === 'quantity') {
        line.quantity = Math.max(1, parseInt(value, 10) || 1);
      }

      line.subtotal = line.quantity * line.unitPrice;
      copy[idx] = line;
      return copy;
    });
  };

  const calculatedSubtotal = lines.reduce((acc, l) => acc + l.subtotal, 0);
  const estimatedTax = calculatedSubtotal * 0.18;
  const estimatedTotal = calculatedSubtotal + estimatedTax;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setIsSaving(true);
    try {
      await updateSubscription(subscription.id, {
        startDate,
        expiryDate: expiryDate || undefined,
        paymentTerms,
        autoRenew,
        notes,
        lines: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });
      onSaved();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update subscription.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900">
        <span className="font-semibold text-xs flex items-center gap-1.5">
          <Edit2 className="w-4 h-4 text-amber-600" />
          Editing Draft / Quotation Contract Terms
        </span>
        <span className="text-[11px] text-amber-700">Authoritative server prices will be re-evaluated on save</span>
      </div>

      {editError && <ErrorAlert message={editError} onDismiss={() => setEditError(null)} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date (Optional)</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
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

      {/* Lines Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="font-semibold text-slate-700 text-xs">Contract Line Items</label>
          <button
            type="button"
            onClick={handleAddLine}
            className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>

        <div className="space-y-2">
          {lines.map((line, idx) => {
            const prod = products.find((p) => p.id === line.productId);
            return (
              <div
                key={idx}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2"
              >
                <div className="flex-1">
                  <select
                    value={line.productId}
                    onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.salesPrice})
                      </option>
                    ))}
                  </select>
                </div>

                {prod && prod.variants && prod.variants.length > 0 && (
                  <div className="w-40">
                    <select
                      value={line.variantId || ''}
                      onChange={(e) => handleLineChange(idx, 'variantId', e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="">No Variant</option>
                      {prod.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attributeValue} (+${v.priceAdjustment})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="w-16">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center"
                  />
                </div>

                <div className="w-20 font-mono text-right font-bold text-slate-800">
                  ${line.subtotal.toFixed(2)}
                </div>

                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Contract Notes (Optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
        />
      </div>

      <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl space-y-1 text-slate-700 text-xs">
        <div className="flex justify-between">
          <span>Estimated Subtotal:</span>
          <span className="font-mono">${calculatedSubtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Estimated Tax (Standard 18%):</span>
          <span className="font-mono">${estimatedTax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
          <span>Estimated Recurring Total:</span>
          <span className="font-mono text-indigo-700">${estimatedTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <Button variant="outline" size="sm" type="button" onClick={onCancel} disabled={isSaving}>
          Cancel Edit
        </Button>
        <Button variant="primary" size="sm" type="submit" isLoading={isSaving}>
          Save Changes
        </Button>
      </div>
    </form>
  );
};

// =============================================================================
// Helper Component: Create Subscription / Issue from Template Modal
// =============================================================================
interface CreateModalProps {
  mode: 'scratch' | 'template';
  customers: any[];
  plans: any[];
  products: Product[];
  templates: any[];
  onClose: () => void;
  onSuccess: (sub: any) => void;
}

const CreateSubscriptionModal: React.FC<CreateModalProps> = ({
  mode: initialMode,
  customers,
  plans,
  products,
  templates,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'scratch' | 'template'>(initialMode);

  // Form Fields
  const [customerId, setCustomerId] = useState<number>(customers[0]?.id || 0);
  const [planId, setPlanId] = useState<number>(plans[0]?.id || 0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('Immediate Payment');
  const [autoRenew, setAutoRenew] = useState<boolean>(true);
  const [status, setStatus] = useState<'draft' | 'quotation'>('draft');
  const [notes, setNotes] = useState<string>('');

  // Scratch Lines
  const [lines, setLines] = useState<
    Array<{
      productId: number;
      variantId?: number;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>
  >([
    {
      productId: products[0]?.id || 1,
      variantId: products[0]?.variants?.[0]?.id,
      quantity: 1,
      unitPrice: products[0]?.salesPrice || 450,
      subtotal: products[0]?.salesPrice || 450,
    },
  ]);

  // Template Issuance State
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(templates[0]?.id || 1);
  const [customValidityDays, setCustomValidityDays] = useState<number>(30);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleAddLine = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    setLines((prev) => [
      ...prev,
      {
        productId: firstProd.id,
        variantId: firstProd.variants?.[0]?.id,
        quantity: 1,
        unitPrice: firstProd.salesPrice,
        subtotal: firstProd.salesPrice,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, value: any) => {
    setLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[idx] };

      if (field === 'productId') {
        const prod = products.find((p) => p.id === Number(value));
        line.productId = Number(value);
        line.variantId = prod?.variants?.[0]?.id;
        line.unitPrice = prod?.salesPrice || 0;
      } else if (field === 'variantId') {
        line.variantId = value ? Number(value) : undefined;
        const prod = products.find((p) => p.id === line.productId);
        const variant = prod?.variants?.find((v) => v.id === line.variantId);
        line.unitPrice = (prod?.salesPrice || 0) + (variant?.priceAdjustment || 0);
      } else if (field === 'quantity') {
        line.quantity = Math.max(1, parseInt(value, 10) || 1);
      }

      line.subtotal = line.quantity * line.unitPrice;
      copy[idx] = line;
      return copy;
    });
  };

  const calculatedSubtotal = lines.reduce((acc, l) => acc + l.subtotal, 0);
  const estimatedTax = calculatedSubtotal * 0.18; // 18% standard GST
  const estimatedTotal = calculatedSubtotal + estimatedTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerId) {
      setFormError('Please select a customer profile.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (activeTab === 'template') {
        // Issuance from template workflow
        const res = await issueSubscriptionFromTemplate(selectedTemplateId, {
          customerId,
          startDate,
          customValidityDays,
          paymentTerms,
          autoRenew,
          notes,
        });
        onSuccess(res.data);
      } else {
        // Scratch creation
        const res = await createSubscription({
          customerId,
          planId: planId || undefined,
          status,
          startDate,
          expiryDate: expiryDate || undefined,
          paymentTerms,
          autoRenew,
          notes,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
        });
        onSuccess(res.data);
      }
    } catch (err: any) {
      setFormError(err.message || 'Creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Header with Mode Toggle */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-900">New Subscription Agreement</h2>
            <p className="text-xs text-slate-500">Configure contract terms, pricing, and lifecycle start.</p>
          </div>

          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('scratch')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === 'scratch' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Agreement
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('template')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === 'template' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              From Quotation Template
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {formError && <ErrorAlert message={formError} onDismiss={() => setFormError(null)} />}

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Profile *</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyName ? `(${c.companyName})` : ''} — {c.email}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'template' ? (
            /* ================================================================= */
            /* Template Issuance Mode                                            */
            /* ================================================================= */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Template Preset *</label>
                <select
                  required
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const tid = Number(e.target.value);
                    setSelectedTemplateId(tid);
                    const t = templates.find((x) => x.id === tid);
                    if (t) setCustomValidityDays(t.validityDays);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.validityDays} days validity, {t.linesCount || 0} items)
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-indigo-900">
                    <span>Associated Plan: {selectedTemplate.planName}</span>
                    <Badge variant="brand" size="sm">
                      {selectedTemplate.planInterval}
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">{selectedTemplate.notes}</p>

                  <div className="border-t border-indigo-200/60 pt-2 space-y-1">
                    <span className="font-semibold text-indigo-950 text-[11px]">Preset Line Items:</span>
                    {selectedTemplate.lines?.map((l: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px] text-slate-700">
                        <span>
                          {l.productName} {l.variantName ? `(${l.variantName})` : ''} × {l.quantity}
                        </span>
                        <span className="font-mono font-medium">${(l.unitPrice * l.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Proposal Start Date</label>
                  <input
                    type="date"
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
                    value={customValidityDays}
                    onChange={(e) => setCustomValidityDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* Custom Scratch Agreement Mode                                    */
            /* ================================================================= */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Tier</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  >
                    <option value="">-- Custom / No Preset Plan --</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price}/{p.billingInterval})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  >
                    <option value="draft">Draft (Internal preparation)</option>
                    <option value="quotation">Quotation (Ready for client)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Line Items Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-700 text-xs">Products & Variant Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold text-[11px] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {lines.map((line, idx) => {
                    const prod = products.find((p) => p.id === line.productId);
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2"
                      >
                        <div className="flex-1">
                          <select
                            value={line.productId}
                            onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (${p.salesPrice})
                              </option>
                            ))}
                          </select>
                        </div>

                        {prod && prod.variants && prod.variants.length > 0 && (
                          <div className="w-40">
                            <select
                              value={line.variantId || ''}
                              onChange={(e) => handleLineChange(idx, 'variantId', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                            >
                              <option value="">No Variant</option>
                              {prod.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.attributeValue} (+${v.priceAdjustment})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="w-16">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center"
                          />
                        </div>

                        <div className="w-20 font-mono text-right font-bold text-slate-800">
                          ${line.subtotal.toFixed(2)}
                        </div>

                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Common Details */}
          <div className="grid grid-cols-2 gap-3 pt-2">
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
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-700">Auto-Renew on Expiry</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Agreement Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal terms, service notes, or quotation special conditions..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
            />
          </div>

          {/* Pricing Summary Box */}
          {activeTab === 'scratch' && (
            <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl space-y-1 text-slate-700 text-xs">
              <div className="flex justify-between">
                <span>Estimated Subtotal:</span>
                <span className="font-mono">${calculatedSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Estimated Tax (Standard 18%):</span>
                <span className="font-mono">${estimatedTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                <span>Estimated Recurring Total:</span>
                <span className="font-mono text-indigo-700">${estimatedTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Submit Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              {activeTab === 'template' ? 'Issue Quotation' : 'Create Subscription'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
