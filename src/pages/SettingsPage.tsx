import React, { useState } from 'react';
import { Settings, Shield, Mail, UserCheck, Plus, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { useAuth } from '../context/AuthContext';
import { evaluatePasswordPolicy } from '../utils/passwordPolicy';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'general' | 'taxes' | 'staff' | 'email'>('general');

  // Staff creation form state
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffFirstName, setStaffFirstName] = useState('');
  const [staffLastName, setStaffLastName] = useState('');
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  const policy = evaluatePasswordPolicy(staffPassword);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setStaffSuccess(null);

    if (!staffEmail || !staffPassword) {
      setStaffError('Staff email address and password are required.');
      return;
    }

    if (!policy.isValid) {
      setStaffError(policy.errorMessage || 'Password does not meet the security policy.');
      return;
    }

    setIsCreatingStaff(true);
    try {
      const res = await fetch('/api/auth/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: staffEmail,
          password: staffPassword,
          firstName: staffFirstName,
          lastName: staffLastName,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create staff account.');
      }

      setStaffSuccess(`Successfully created staff account for ${staffEmail}.`);
      setStaffEmail('');
      setStaffPassword('');
      setStaffFirstName('');
      setStaffLastName('');
      setShowStaffForm(false);
    } catch (err: any) {
      setStaffError(err.message || 'Error creating staff account.');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Governance"
        description="Administer organization profiles, tax rate tables, internal staff permissions, and Brevo email parameters."
        breadcrumbs={['Home', 'Settings']}
      />

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'general', label: 'Company Profile', icon: Settings },
          { id: 'taxes', label: 'Tax Rules', icon: Shield },
          { id: 'staff', label: 'Staff Accounts', icon: UserCheck },
          { id: 'email', label: 'Email Integration', icon: Mail },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Company Profile */}
      {activeTab === 'general' && (
        <Card title="Company Information" description="Organization details used on customer invoices and quotations.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Company Name</label>
              <input
                type="text"
                defaultValue="Brightloop Software Inc."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Support Email</label>
              <input
                type="email"
                defaultValue="billing@brightloopsoftware.example.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Currency</label>
              <input
                type="text"
                defaultValue="USD ($)"
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Default Payment Terms</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                <option>Immediate Payment</option>
                <option>Net 15</option>
                <option>Net 30</option>
              </select>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
            <Button variant="primary" onClick={() => alert('Settings save will be wired to backend in future stage')}>
              Save Changes
            </Button>
          </div>
        </Card>
      )}

      {/* Tab 2: Taxes */}
      {activeTab === 'taxes' && (
        <Card
          title="Tax Rates"
          description="Admin-configured percentage rates automatically added to subscription invoice line items."
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => alert('Add Tax Rate Modal (Phase 5)')}
            >
              Add Tax Rate
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase">
                  <th className="py-2.5">Tax Name</th>
                  <th className="py-2.5">Rate (%)</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-semibold text-slate-800">GST Standard</td>
                  <td className="py-3 font-mono font-medium text-slate-900">18.00%</td>
                  <td className="py-3">
                    <Badge variant="success" size="sm">Active</Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold text-slate-800">Zero-Rated Export</td>
                  <td className="py-3 font-mono font-medium text-slate-900">0.00%</td>
                  <td className="py-3">
                    <Badge variant="neutral" size="sm">Active</Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Staff Accounts */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <Card
            title="Internal Staff Accounts (Admin Only)"
            description="Only Admins can invite or manage internal staff members. Staff cannot add other accounts or create discount rules."
            action={
              isAdmin ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setShowStaffForm(!showStaffForm)}
                >
                  {showStaffForm ? 'Cancel' : 'Add Staff Member'}
                </Button>
              ) : undefined
            }
          >
            {staffSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{staffSuccess}</span>
              </div>
            )}

            {staffError && <ErrorAlert message={staffError} onDismiss={() => setStaffError(null)} className="mb-4" />}

            {!isAdmin ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Permission Restricted to Administrators</p>
                  <p className="mt-0.5 text-amber-700">
                    Your current role is <strong>{user?.role || 'Staff'}</strong>. Internal Staff accounts have read/operational access to customers, invoices, and subscriptions, but are barred from adding staff members.
                  </p>
                </div>
              </div>
            ) : showStaffForm ? (
              <form onSubmit={handleCreateStaff} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
                <h4 className="font-bold text-slate-900 text-sm">Create New Internal Staff Account</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={staffFirstName}
                      onChange={(e) => setStaffFirstName(e.target.value)}
                      placeholder="Alex"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={staffLastName}
                      onChange={(e) => setStaffLastName(e.target.value)}
                      placeholder="Rivera"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Staff Email Address <span className="text-rose-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="alex@brightloop.local"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Temporary Password <span className="text-rose-500">*</span></label>
                  <input
                    type="password"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                {staffPassword.length > 0 && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
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

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowStaffForm(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" isLoading={isCreatingStaff}>
                    Create Staff Member
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-4">
                <p className="font-semibold text-slate-800">Password Policy Requirements:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
                  <li>Length must be strictly greater than 8 characters (at least 9)</li>
                  <li>Must contain at least one uppercase letter (A-Z)</li>
                  <li>Must contain at least one lowercase letter (a-z)</li>
                  <li>Must contain at least one special character (!@#$%^&* etc.)</li>
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Email Integration */}
      {activeTab === 'email' && (
        <Card
          title="Brevo Transactional Email Service"
          description="Delivers secure password reset links, invoice notifications, and payment receipts via Brevo REST API v3."
        >
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Serverless Integration Mode</span>
                <span className="text-slate-500">Netlify Function endpoint (`/api/auth/forgot-password`)</span>
              </div>
              <Badge variant="brand" size="sm">Brevo REST v3</Badge>
            </div>
            <p className="text-slate-600 text-xs">
              When a user submits a password reset request, a single-use cryptographically random token is generated. The hash is recorded in MySQL, and the recovery link is dispatched via Brevo without ever exposing API keys to the browser.
            </p>
            <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-500 text-[11px] space-y-1">
              <div className="font-semibold text-slate-700">Required Environment Variables:</div>
              <div><code>BREVO_API_KEY</code> — Your Brevo API v3 key (e.g. <code>xkeysib-...</code>)</div>
              <div><code>BREVO_SENDER_EMAIL</code> — Your verified Brevo sender email address</div>
              <div><code>BREVO_SENDER_NAME</code> — Sender display name (e.g. <code>"Brightloop Software"</code>)</div>
              <div><code>APP_BASE_URL</code> — Public application URL for constructing the reset link</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
