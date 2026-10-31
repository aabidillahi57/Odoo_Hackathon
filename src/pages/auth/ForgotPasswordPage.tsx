import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Mail, ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ErrorAlert } from '../../components/common/ErrorAlert';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit password reset request.');
      }

      setSubmitted(true);
      if (json.data?.devResetUrl) {
        setDevResetUrl(json.data.devResetUrl);
      }
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
          Reset Your Password
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter your registered email and we'll dispatch a secure recovery link
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="shadow-lg border-slate-200">
          {error && <ErrorAlert message={error} onDismiss={() => setError(null)} className="mb-5" />}

          {submitted ? (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Recovery Link Sent</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  If an account matches <strong>{email}</strong>, password reset instructions have been dispatched via Brevo transactional service.
                </p>
              </div>

              {devResetUrl && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-left text-xs text-amber-900 space-y-1">
                  <p className="font-semibold text-amber-950">Dev Mode Simulated Reset Link:</p>
                  <p className="text-[11px] text-amber-800">
                    Brevo credentials are not yet configured in .env. Click below to test the reset flow locally:
                  </p>
                  <a
                    href={devResetUrl}
                    className="inline-flex items-center gap-1 font-mono text-indigo-700 underline text-[11px] mt-1 break-all"
                  >
                    Open Reset Password Screen <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="forgot-email">
                  Registered Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full mt-2"
                icon={<Mail className="w-4 h-4" />}
              >
                Send Reset Link
              </Button>

              <div className="text-center pt-3 border-t border-slate-100">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600"
                >
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
