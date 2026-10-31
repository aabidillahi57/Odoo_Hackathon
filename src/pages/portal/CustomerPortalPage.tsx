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
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { useAuth } from '../../context/AuthContext';

export const CustomerPortalPage: React.FC = () => {
  const { user, login, logout, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
                      Account: <strong className="text-slate-700">{user.email}</strong> {user.customerId ? `(Customer #${user.customerId})` : ''}
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
              {/* Subscriptions Card Shell */}
              <Card
                title="My Subscriptions"
                description="View your active software licenses, plan cycles, and renewal dates."
              >
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                    <Repeat className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">Your Subscription Ledger</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Your authenticated account is verified. Live subscription records will display here as agreements are activated in Phase 6.
                  </p>
                </div>
              </Card>

              {/* Invoices Card Shell */}
              <Card
                title="My Invoices & Receipts"
                description="Download previous statements, view balance due, and track payments."
              >
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">Your Billing Receipts</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Official statements and payment histories will populate here automatically upon generation in Phase 7.
                  </p>
                </div>
              </Card>
            </div>

            {/* Permitted Self-Service Changes */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Customer Self-Service Actions: Pause subscription, update contact details, print statements.</span>
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
    </div>
  );
};
