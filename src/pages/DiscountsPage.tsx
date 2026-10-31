import React, { useState } from 'react';
import {
  Plus,
  ShieldAlert,
  Percent,
  DollarSign,
  Search,
  CheckCircle2,
  Edit2,
  Archive,
  X,
  AlertCircle,
  Clock,
  Tag,
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
  useDiscounts,
  useProducts,
  createDiscount,
  updateDiscount,
  archiveDiscount,
} from '../services/api';
import { Discount } from '../types';

export const DiscountsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [appliesToFilter, setAppliesToFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Live Query
  const { discounts, isLoading, error, meta, refetch } = useDiscounts({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter || undefined,
    applies_to: appliesToFilter || undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  const { products } = useProducts();

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState<number>(10);
  const [minPurchaseAmount, setMinPurchaseAmount] = useState<number>(0);
  const [minQuantity, setMinQuantity] = useState<number>(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxUses, setMaxUses] = useState<string>('');
  const [appliesTo, setAppliesTo] = useState<'order' | 'product'>('order');
  const [applicableProductId, setApplicableProductId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Archive Confirmation
  const [archivingDiscount, setArchivingDiscount] = useState<Discount | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingDiscount(null);
    setCode('');
    setName('');
    setDescription('');
    setDiscountType('percentage');
    setValue(10);
    setMinPurchaseAmount(0);
    setMinQuantity(1);
    setStartDate('');
    setEndDate('');
    setMaxUses('');
    setAppliesTo('order');
    setApplicableProductId('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (discount: Discount) => {
    setEditingDiscount(discount);
    setCode(discount.code);
    setName(discount.name || '');
    setDescription(discount.description || '');
    setDiscountType(discount.discountType);
    setValue(discount.value);
    setMinPurchaseAmount(discount.minPurchaseAmount || 0);
    setMinQuantity(discount.minQuantity || 1);
    setStartDate(discount.startDate ? discount.startDate.substring(0, 10) : '');
    setEndDate(discount.endDate ? discount.endDate.substring(0, 10) : '');
    setMaxUses(discount.maxUses !== null && discount.maxUses !== undefined ? String(discount.maxUses) : '');
    setAppliesTo(discount.appliesTo);
    setApplicableProductId(discount.applicableProductId ? String(discount.applicableProductId) : '');
    setIsActive(discount.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (value <= 0) {
      setFormError('Discount value must be greater than 0.');
      return;
    }
    if (discountType === 'percentage' && value > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }
    if (minPurchaseAmount < 0) {
      setFormError('Minimum purchase amount cannot be negative.');
      return;
    }
    if (minQuantity < 1) {
      setFormError('Minimum quantity must be at least 1.');
      return;
    }
    if (appliesTo === 'product' && !applicableProductId) {
      setFormError('Please select the applicable product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        discountType,
        value: Number(value),
        minPurchaseAmount: Number(minPurchaseAmount),
        minQuantity: Number(minQuantity),
        startDate: startDate ? startDate : null,
        endDate: endDate ? endDate : null,
        maxUses: maxUses ? parseInt(maxUses, 10) : null,
        appliesTo,
        applicableProductId: appliesTo === 'product' && applicableProductId ? parseInt(applicableProductId, 10) : null,
        isActive,
      };

      if (editingDiscount) {
        await updateDiscount(editingDiscount.id, payload);
        setActionSuccess(`Discount rule ${editingDiscount.code} updated successfully.`);
      } else {
        payload.code = code.trim().toUpperCase();
        await createDiscount(payload);
        setActionSuccess(`Discount rule ${payload.code} created successfully.`);
      }

      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save discount rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archivingDiscount) return;
    setIsArchiving(true);
    setArchiveError(null);
    try {
      await archiveDiscount(archivingDiscount.id);
      setActionSuccess(`Discount ${archivingDiscount.code} has been archived.`);
      setArchivingDiscount(null);
      refetch();
    } catch (err: any) {
      setArchiveError(err.message || 'Failed to archive discount rule.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discount Rules & Promotions"
        description="Admin-only rules for fixed amounts or percentages, maximum redemption limits, and automatic billing application."
        breadcrumbs={['Home', 'Discounts']}
        action={
          isAdmin && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Create Discount Rule
            </Button>
          )
        }
      />

      {/* Role Notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-indigo-900">
        <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
        <span>
          <strong>Role-Based Permission:</strong>{' '}
          {isAdmin ? (
            <span>You have <strong>Admin</strong> privileges to create, configure, update, and archive discount rules.</span>
          ) : (
            <span>Internal <strong>Staff</strong> have view-only access to discount rules. Only Admins can modify rules or change quotas.</span>
          )}
        </span>
      </div>

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

      {/* Filters Bar */}
      <Card noPadding>
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-3 border-b border-slate-100 text-xs">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, name, or description..."
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
              {(['all', 'active', 'inactive', 'archived'] as const).map((st) => (
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

            {/* Type selector */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="">All Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount ($)</option>
            </select>

            {/* Scope selector */}
            <select
              value={appliesToFilter}
              onChange={(e) => {
                setAppliesToFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
            >
              <option value="">All Scopes</option>
              <option value="order">Entire Subscription</option>
              <option value="product">Specific Product</option>
            </select>
          </div>
        </div>

        {/* Discounts List */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="lg" label="Loading discount rules..." />
          </div>
        ) : discounts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Discount Rules Found"
              description={
                search || statusFilter !== 'all' || typeFilter || appliesToFilter
                  ? 'No discount rules match your current filter parameters.'
                  : 'No discount rules have been configured yet. Create a promotional rule to apply to upcoming invoices.'
              }
              actionLabel={isAdmin ? 'Create Rule' : undefined}
              onAction={isAdmin ? openCreateModal : undefined}
            />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {discounts.map((discount) => {
              const remaining = discount.remainingUses;
              const isExhausted = discount.maxUses !== null && discount.maxUses !== undefined && discount.usedCount >= discount.maxUses;

              return (
                <div
                  key={discount.id}
                  className={`p-4 rounded-xl border transition-all ${
                    discount.isArchived
                      ? 'bg-slate-50/80 border-slate-200 opacity-70'
                      : !discount.isActive
                      ? 'bg-amber-50/30 border-amber-200'
                      : 'bg-white border-slate-200 shadow-xs hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
                        discount.discountType === 'percentage'
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {discount.discountType === 'percentage' ? (
                          <Percent className="w-4 h-4" />
                        ) : (
                          <DollarSign className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                            {discount.code}
                          </h3>
                          {discount.isArchived ? (
                            <Badge variant="neutral" size="sm">Archived</Badge>
                          ) : isExhausted ? (
                            <Badge variant="danger" size="sm">Quota Reached</Badge>
                          ) : discount.isActive ? (
                            <Badge variant="success" size="sm">Active</Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">Inactive</Badge>
                          )}
                        </div>
                        {discount.name && (
                          <div className="text-xs font-medium text-slate-700">{discount.name}</div>
                        )}
                        {discount.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{discount.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && !discount.isArchived && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(discount)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                          title="Edit discount rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setArchiveError(null);
                            setArchivingDiscount(discount);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors"
                          title="Archive discount rule"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Detail Grid */}
                  <div className="mt-3 p-3 bg-slate-50/70 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Discount Value</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {discount.discountType === 'percentage'
                          ? `${Number(discount.value)}% Off`
                          : `$${Number(discount.value).toFixed(2)} Off`}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scope</span>
                      <span className="font-semibold text-slate-700 capitalize">
                        {discount.appliesTo === 'order'
                          ? 'Entire Subscription'
                          : `Product: ${discount.applicableProductName || `#${discount.applicableProductId}`}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Redemption / Quota</span>
                      <span className="font-mono font-medium text-slate-700">
                        {discount.usedCount} / {discount.maxUses !== null && discount.maxUses !== undefined ? discount.maxUses : 'Unlimited'} used
                        {remaining !== null && remaining !== undefined && (
                          <span className="text-[11px] text-indigo-600 ml-1">({remaining} left)</span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Min Thresholds</span>
                      <span className="font-medium text-slate-700">
                        ${Number(discount.minPurchaseAmount || 0).toFixed(2)} min spend
                        {Number(discount.minQuantity || 1) > 1 && ` &bull; ${discount.minQuantity} qty`}
                      </span>
                    </div>

                    {(discount.startDate || discount.endDate) && (
                      <div className="col-span-2 text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200/50">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          Valid: {discount.startDate ? discount.startDate.substring(0, 10) : 'Anytime'} &rarr;{' '}
                          {discount.endDate ? discount.endDate.substring(0, 10) : 'Ongoing'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {meta && meta.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} rules)
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
      {/* CREATE / EDIT DISCOUNT MODAL                                          */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingDiscount ? `Edit Discount Rule: ${editingDiscount.code}` : 'Create New Discount Rule'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configures promotional rates and automated billing eligibility
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && <ErrorAlert message={formError} onDismiss={() => setFormError(null)} />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Code */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Discount Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingDiscount}
                    placeholder="e.g. SUMMER2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono font-bold uppercase disabled:bg-slate-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Unique coupon identifier</p>
                </div>

                {/* Friendly Name */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Early Bird Summer Promo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Terms, customer eligibility notes, or promotion details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                />
              </div>

              {/* Type and Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Calculation Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Dollar Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Value {discountType === 'percentage' ? '(%)' : '($)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={discountType === 'percentage' ? '100' : undefined}
                    required
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {discountType === 'percentage' ? 'Applied pre-tax as % discount' : 'Subtracted pre-tax from price'}
                  </p>
                </div>
              </div>

              {/* Scope & Applicable Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Scope <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={appliesTo}
                    onChange={(e) => setAppliesTo(e.target.value as 'order' | 'product')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-medium"
                  >
                    <option value="order">Entire Subscription (Order)</option>
                    <option value="product">Specific Product Line</option>
                  </select>
                </div>

                {appliesTo === 'product' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Target Product <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={applicableProductId}
                      onChange={(e) => setApplicableProductId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                    >
                      <option value="">Select a Product...</option>
                      {products?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.salesPrice.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Minimum Purchase and Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Min Purchase Subtotal ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minPurchaseAmount}
                    onChange={(e) => setMinPurchaseAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Order must meet this subtotal before discount applies</p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Min Item Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Dates & Max Usages */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Max Usages Quota</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave blank for unlimited</p>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-800">
                    Rule is Active & Eligible for Invoicing
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  isLoading={isSubmitting}
                >
                  {editingDiscount ? 'Save Changes' : 'Create Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ARCHIVE CONFIRMATION MODAL                                            */}
      {/* ===================================================================== */}
      {archivingDiscount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Archive Discount Rule</h3>
            </div>

            {archiveError && <ErrorAlert message={archiveError} onDismiss={() => setArchiveError(null)} />}

            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to archive discount rule <strong>{archivingDiscount.code}</strong>?
              Archived rules will no longer be applied to recurring billing runs or available on quotations. Historical invoices will maintain their snapshots.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArchivingDiscount(null)}
                disabled={isArchiving}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isArchiving}
                onClick={handleArchive}
              >
                Archive Rule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
