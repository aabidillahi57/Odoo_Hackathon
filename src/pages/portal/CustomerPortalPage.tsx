import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  ArrowLeft,
  Repeat,
  Receipt,
  ShieldAlert,
  Zap,
  KeyRound,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';

export const CustomerPortalPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoAttempted, setDemoAttempted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoAttempted(true);
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

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Internal Team Portal
        </Link>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Security / Stage Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Customer Data Privacy & Isolation Boundary</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Customers can only access records tied to their authenticated account. No customer data or sensitive billing details are exposed in this UI shell preview until backend JWT authentication is enforced in Stage 3.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Sign-in Form Placeholder */}
          <div className="lg:col-span-5">
            <Card
              title="Customer Portal Sign In"
              description="Access your subscriptions, invoices, and payment receipts."
            >
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    <span className="text-[11px] text-emerald-700 font-medium cursor-not-allowed">
                      Forgot password?
                    </span>
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
                  icon={<KeyRound className="w-4 h-4" />}
                >
                  Sign In to Customer Portal
                </Button>

                {demoAttempted && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 animate-in fade-in">
                    <p className="font-semibold">Authentication Not Yet Connected</p>
                    <p className="mt-0.5 text-amber-700">
                      Sign-in endpoints and JWT sessions will be implemented in Phase 3. Live customer data remains strictly guarded on the backend.
                    </p>
                  </div>
                )}

                <div className="pt-2 text-center text-xs text-slate-400">
                  Password recovery powered by Brevo transactional service (Configured in Phase 10)
                </div>
              </form>
            </Card>
          </div>

          {/* Right Column: Portal Feature Shells (Protected View Preview) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Subscriptions Card Shell */}
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

            {/* Invoices Card Shell */}
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

            {/* Permitted Self-Service Changes */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Self-service changes permitted: Pause subscription, update contact details, print invoices.</span>
              </div>
              <span className="font-semibold text-slate-400">Strictly Scoped</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
