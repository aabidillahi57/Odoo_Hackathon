import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  ArrowLeft,
  Repeat,
  Receipt,
  ShieldCheck,
  Zap,
  KeyRound,
  LogOut,
  User,
  ArrowRight,
  PauseCircle,
  PlayCircle,
  X,
  Printer,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import {
  useSubscriptions,
  useSubscription,
  transitionSubscription,
  useInvoices,
  useInvoiceDetail,
} from '../../services/api';

export const CustomerPortalPage: React.FC = () => {
  const { user, login, logout, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Customer Selected Subscription Detail Modal
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [actionPrompt, setActionPrompt] = useState<{
    subId: number;
    subNumber: string;
    targetStatus: 'paused' | 'active';
    title: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Subscriptions Query (strictly isolated by server session)
  const {
    subscriptions: customerSubs,
    isLoading: isLoadingSubs,
    refetch: refetchSubs,
  } = useSubscriptions({
    page: 1,
    limit: 20,
    status: 'all',
  });

  const { subscription: selectedSub, isLoading: isLoadingDetail, refetch: refetchDetail } =
    useSubscription(selectedSubId);

  // Invoices Query (strictly isolated by server session)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const { invoices: customerInvoices, isLoading: isLoadingInvoices } = useInvoices({
    page: 1,
    limit: 50,
  });
  const { invoice: selectedInvoice, isLoading: isLoadingInvoiceDetail } =
    useInvoiceDetail(selectedInvoiceId);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!email || !password) {
      setLoginError('Please enter both your email address and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      await login({ email, password });
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCustomerTransition = async () => {
    if (!actionPrompt) return;
    setIsSubmittingAction(true);
    setActionError(null);

    try {
      await transitionSubscription(actionPrompt.subId, actionPrompt.targetStatus, actionReason);
      setActionPrompt(null);
      refetchSubs();
      if (selectedSubId === actionPrompt.subId) {
        refetchDetail();
      }
    } catch (err: any) {
      setActionError(err.message || 'Self-service action failed.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'quotation':
        return <Badge variant="warning">Quotation</Badge>;
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Portal Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">Brightloop Software</span>
              <Badge variant="success" size="sm">
                Customer Self-Service
              </Badge>
            </div>
            <p className="text-xs text-slate-500">Subscription & Invoicing Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              icon={<LogOut className="w-3.5 h-3.5" />}
              onClick={() => logout()}
            >
              Sign Out
            </Button>
          )}

          {(!isAuthenticated || user?.role !== 'customer') && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Internal Team Portal
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Security / Stage Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Customer Data Privacy & Isolation Boundary</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Customers can only access records tied to their authenticated account. Session credentials are securely managed via server-side HttpOnly cookies.
            </p>
          </div>
        </div>

        {isAuthenticated && user ? (
          /* Authenticated Customer View */
          <div className="space-y-6 animate-in fade-in">
            {/* Customer Profile Banner */}
            <Card className="bg-gradient-to-r from-emerald-50 to-white border-emerald-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {user.firstName ? user.firstName[0].toUpperCase() : <User className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        Welcome, {user.firstName || user.email.split('@')[0]}!
                      </h2>
                      <Badge variant="success" size="sm">
                        {user.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Account: <strong className="text-slate-700">{user.email}</strong>{' '}
                      {user.customerId ? `(Customer #${user.customerId})` : ''}
                    </p>
                  </div>
                </div>

                {user.role !== 'customer' && (
                  <div className="text-right">
                    <span className="text-[11px] text-amber-700 font-semibold bg-amber-100 px-2 py-1 rounded">
                      Staff/Admin Role Preview
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subscriptions Card Shell — Live Customer Agreements */}
              <Card
                title="My Subscriptions"
                description="View your active software licenses, plan cycles, and renewal dates."
              >
                {isLoadingSubs ? (
                  <div className="p-8 text-center">
                    <LoadingSpinner label="Loading your subscriptions..." />
                  </div>
                ) : customerSubs && customerSubs.length > 0 ? (
                  <div className="space-y-3">
                    {customerSubs.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubId(sub.id)}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Repeat className="w-3.5 h-3.5 text-emerald-600" />
                            <strong className="font-mono text-slate-900">{sub.subscriptionNumber}</strong>
                            {getStatusBadge(sub.status)}
                          </div>
                          <div className="text-slate-600 font-medium">{sub.planName}</div>
                          <div className="text-[11px] text-slate-400">
                            Valid through: {sub.expiryDate || 'Continuous'}
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            ${(sub.totalRecurringAmount ?? sub.recurringAmount ?? 0).toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubId(sub.id);
                            }}
                            className="text-emerald-700 font-semibold text-[11px] hover:underline"
                          >
                            Details →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                      <Repeat className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No Subscriptions Active</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      No active subscription agreements linked to your account yet. Contact our sales team to activate an agreement.
                    </p>
                  </div>
                )}
              </Card>

              {/* Invoices Card Shell */}
              <Card
                title="My Invoices & Receipts"
                description="Download previous statements, view balance due, and track payments."
              >
                {isLoadingInvoices ? (
                  <div className="p-8 text-center">
                    <LoadingSpinner label="Loading your invoices..." />
                  </div>
                ) : customerInvoices && customerInvoices.length > 0 ? (
                  <div className="space-y-3">
                    {customerInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                            <strong className="font-mono text-slate-900">{inv.invoiceNumber}</strong>
                            <Badge
                              variant={
                                inv.status === 'paid'
                                  ? 'success'
                                  : inv.status === 'confirmed'
                                  ? 'info'
                                  : inv.status === 'cancelled'
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {inv.status}
                            </Badge>
                            {inv.isOverdue && (
                              <Badge variant="warning" size="sm">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Issued: {inv.issueDate} &bull; Due: {inv.dueDate}
                          </div>
                          {inv.subscriptionNumber && (
                            <div className="text-[11px] text-slate-400">
                              Sub: {inv.subscriptionNumber}
                            </div>
                          )}
                        </div>

                        <div className="text-right space-y-1">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            ${inv.totalAmount.toFixed(2)}
                          </div>
                          <div className="text-[11px]">
                            {inv.balanceDue > 0 ? (
                              <span className="text-amber-700 font-semibold">
                                Balance: ${inv.balanceDue.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">Paid in full</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoiceId(inv.id);
                            }}
                            className="text-emerald-700 font-semibold text-[11px] hover:underline"
                          >
                            View Statement →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                      <Receipt className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800">No Invoices Issued</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      No invoices have been issued to your customer account yet. When recurring cycles process, your official receipts will appear here.
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* Permitted Self-Service Changes */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Customer Self-Service Actions: Pause subscription, inspect active software seats, review terms.</span>
              </div>
              <span className="font-semibold text-emerald-600">Strictly Isolated</span>
            </div>
          </div>
        ) : (
          /* Unauthenticated Customer Portal Shell (Login / Register Entry Point) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Sign-in Form */}
            <div className="lg:col-span-5">
              <Card
                title="Customer Portal Sign In"
                description="Access your subscriptions, invoices, and payment receipts."
              >
                {loginError && <ErrorAlert message={loginError} onDismiss={() => setLoginError(null)} className="mb-4" />}

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="portal-email">
                      Account Email
                    </label>
                    <input
                      id="portal-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700" htmlFor="portal-password">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-[11px] text-emerald-700 font-medium hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      id="portal-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isLoggingIn || isLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
                    icon={<KeyRound className="w-4 h-4" />}
                  >
                    Sign In to Customer Portal
                  </Button>

                  <div className="pt-2 text-center text-xs text-slate-500">
                    New customer?{' '}
                    <Link to="/signup" className="font-semibold text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1">
                      Register account <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </form>
              </Card>
            </div>

            {/* Right Column: Portal Feature Shells (Protected View Preview) */}
            <div className="lg:col-span-7 space-y-4">
              <Card
                title="My Subscriptions"
                description="View your active software licenses, plan cycles, and renewal dates."
              >
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">Authentication Required</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Once signed in, you will be able to review your license tier, pause or resume subscriptions, and inspect addon configurations.
                  </p>
                </div>
              </Card>

              <Card
                title="My Invoices & Receipts"
                description="Download previous statements, view balance due, and track payments."
              >
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">No Invoices Visible</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Your billing receipts and outstanding balances are protected. Sign in with your customer account to download official statements.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Customer Subscription Detail Modal                                        */}
      {/* ========================================================================= */}
      {selectedSubId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 my-auto text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedSub?.subscriptionNumber || 'Subscription Detail'}
                    </h3>
                    {selectedSub && getStatusBadge(selectedSub.status)}
                  </div>
                  <p className="text-slate-500 text-[11px]">Contract terms & active licenses</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSubId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-12 text-center">
                <LoadingSpinner label="Loading subscription agreement..." />
              </div>
            ) : selectedSub ? (
              <div className="space-y-4">
                {/* Plan and Cycle Policy */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500">Plan Tier:</span>
                    <div className="font-bold text-slate-900">{selectedSub.planName}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Billing Interval:</span>
                    <div className="font-semibold text-slate-800 capitalize">
                      {selectedSub.billingInterval || 'Monthly'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Start Date:</span>
                    <div className="font-medium text-slate-800">{selectedSub.startDate}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Expiry / Renewal:</span>
                    <div className="font-medium text-slate-800">{selectedSub.expiryDate || 'Continuous'}</div>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="font-bold text-slate-900 mb-2">Licensed Products & Add-ons</div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSub.lines?.map((line) => (
                          <tr key={line.id}>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-800">{line.productName}</span>
                              {line.variantName && (
                                <div className="text-[11px] text-emerald-700">{line.variantName}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">{line.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">${line.unitPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              ${line.totalAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="py-2 px-3 text-right font-bold text-slate-900">
                            Total Recurring Amount:
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                            ${(selectedSub.totalRecurringAmount || selectedSub.recurringAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Permitted Self-Service Customer Actions */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-950">Self-Service Actions</span>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      {selectedSub.status === 'active'
                        ? 'Pause subscription if taking temporary time off.'
                        : selectedSub.status === 'paused'
                        ? 'Resume service and re-enable active subscription.'
                        : 'Contact Brightloop support for additional lifecycle assistance.'}
                    </p>
                  </div>

                  {selectedSub.status === 'active' && selectedSub.planPolicy?.pauseAllowed !== false && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                      onClick={() =>
                        setActionPrompt({
                          subId: selectedSub.id,
                          subNumber: selectedSub.subscriptionNumber,
                          targetStatus: 'paused',
                          title: `Pause Subscription ${selectedSub.subscriptionNumber}`,
                        })
                      }
                    >
                      Pause Subscription
                    </Button>
                  )}

                  {selectedSub.status === 'paused' && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<PlayCircle className="w-3.5 h-3.5" />}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() =>
                        setActionPrompt({
                          subId: selectedSub.id,
                          subNumber: selectedSub.subscriptionNumber,
                          targetStatus: 'active',
                          title: `Resume Subscription ${selectedSub.subscriptionNumber}`,
                        })
                      }
                    >
                      Resume Subscription
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedSubId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Customer Action Prompt Dialog                                             */}
      {/* ========================================================================= */}
      {actionPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">{actionPrompt.title}</h3>
            {actionError && <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />}

            <p className="text-xs text-slate-500">
              {actionPrompt.targetStatus === 'paused'
                ? 'Your software license will be temporarily held. You can resume at any time.'
                : 'Your software license will be reactivated immediately.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Note for Brightloop Support (Optional)
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Reason for change..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionPrompt(null)}
                disabled={isSubmittingAction}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmittingAction}
                onClick={handleCustomerTransition}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Customer Invoice Detail & Receipt Modal                                   */}
      {/* ========================================================================= */}
      {selectedInvoiceId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 my-auto text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedInvoice?.invoiceNumber || `Invoice #${selectedInvoiceId}`}
                    </h3>
                    {selectedInvoice && (
                      <Badge
                        variant={
                          selectedInvoice.status === 'paid'
                            ? 'success'
                            : selectedInvoice.status === 'confirmed'
                            ? 'info'
                            : 'neutral'
                        }
                      >
                        {selectedInvoice.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">Official Billing Receipt & Statement</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Printer className="w-3.5 h-3.5" />}
                  onClick={() => window.print()}
                >
                  Print Receipt
                </Button>
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isLoadingInvoiceDetail ? (
              <div className="py-12 text-center">
                <LoadingSpinner label="Loading invoice receipt..." />
              </div>
            ) : selectedInvoice ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500">Issue Date:</span>
                    <div className="font-bold text-slate-900">{selectedInvoice.issueDate}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Due Date:</span>
                    <div className="font-bold text-slate-900">{selectedInvoice.dueDate}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Payment Terms:</span>
                    <div className="font-medium text-slate-800">{selectedInvoice.paymentTerms || 'Immediate Payment'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Subscription Ref:</span>
                    <div className="font-mono text-emerald-700">{selectedInvoice.subscriptionNumber || 'Ad-hoc'}</div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Tax</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.lines?.map((line) => (
                        <tr key={line.id}>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-800">{line.description}</span>
                            {line.variantName && (
                              <div className="text-[11px] text-emerald-700">{line.variantName}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">{line.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">${line.unitPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">${line.taxAmount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            ${line.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs">
                      <tr>
                        <td colSpan={4} className="py-1.5 px-3 text-right text-slate-500">
                          Subtotal (Pre-Tax):
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                          ${(selectedInvoice.subtotalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-1.5 px-3 text-right text-slate-500">
                          Total Taxes:
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-800">
                          ${(selectedInvoice.taxAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="font-bold border-t border-slate-200">
                        <td colSpan={4} className="py-2 px-3 text-right text-slate-900">
                          Total Due:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 text-sm">
                          ${selectedInvoice.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
