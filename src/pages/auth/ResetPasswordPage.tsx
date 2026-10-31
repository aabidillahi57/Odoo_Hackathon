import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Zap, KeyRound, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { evaluatePasswordPolicy } from '../../utils/passwordPolicy';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const policy = evaluatePasswordPolicy(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing reset token. Please use the exact link sent to your email.');
      return;
    }

    if (!policy.isValid) {
      setError(policy.errorMessage || 'Please ensure your new password satisfies the policy.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update password.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-md">
          <Zap className="w-6 h-6 fill-white" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Create New Password
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter your new password to regain access to your Brightloop account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="shadow-lg border-slate-200">
          {error && <ErrorAlert message={error} onDismiss={() => setError(null)} className="mb-5" />}

          {!token ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-slate-600">
                Invalid or missing password reset token. Please request a new recovery link.
              </p>
              <Link to="/forgot-password">
                <Button variant="primary">Request Password Reset</Button>
              </Link>
            </div>
          ) : success ? (
            <div className="text-center py-6 space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Password Updated!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your password has been securely updated and all previous sessions have been revoked.
                </p>
              </div>
              <div className="pt-3">
                <Button variant="primary" className="w-full" onClick={() => navigate('/login')}>
                  Sign In with New Password
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Password Policy feedback */}
              {newPassword.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5 text-xs">
                  <span className="font-semibold text-slate-700 block text-[11px] uppercase tracking-wider mb-1">
                    Password Requirements:
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
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="confirm-new-password">
                  Confirm New Password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full mt-2"
                icon={<KeyRound className="w-4 h-4" />}
              >
                Reset Password
              </Button>

              <div className="text-center pt-3 border-t border-slate-100">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
