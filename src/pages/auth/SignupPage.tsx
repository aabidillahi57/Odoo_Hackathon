import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, UserPlus, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { evaluatePasswordPolicy } from '../../utils/passwordPolicy';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, error: contextError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const policy = evaluatePasswordPolicy(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError('Please complete all required fields.');
      return;
    }

    if (!policy.isValid) {
      setLocalError(policy.errorMessage || 'Please ensure your password satisfies the security policy.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        companyName,
      });
      navigate('/portal', { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || contextError;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
          <Zap className="w-6 h-6 fill-white" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Customer Portal Registration
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Create an account to manage your Brightloop subscriptions and invoices
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <Card className="shadow-lg border-slate-200">
          {displayError && (
            <ErrorAlert
              message={displayError}
              onDismiss={() => {
                setLocalError(null);
                clearError();
              }}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="signup-fn">
                  First Name
                </label>
                <input
                  id="signup-fn"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="signup-ln">
                  Last Name
                </label>
                <input
                  id="signup-ln"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="signup-company">
                Company Name (Optional)
              </label>
              <input
                id="signup-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="signup-email">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="signup-password">
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="signup-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Interactive Password Policy Feedback */}
            {password.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5 text-xs animate-in fade-in">
                <span className="font-semibold text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                  Password Security Requirements:
                </span>
                {policy.rules.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    {r.met ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    )}
                    <span className={r.met ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="signup-confirm-password">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 mt-2"
              icon={<UserPlus className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-800">
              Sign in here
            </Link>
          </div>
        </Card>

        <div className="mt-4 text-center">
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to portal landing
          </Link>
        </div>
      </div>
    </div>
  );
};
