import React, { useState, useEffect } from 'react';
import { Settings, Shield, Mail, UserCheck, Plus, CheckCircle2, XCircle, ShieldAlert, Edit2, X, Send, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { evaluatePasswordPolicy } from '../utils/passwordPolicy';
import { useTaxes, createTax, updateTax, fetchBrevoStatus, sendBrevoTestEmail, BrevoStatusResponse } from '../services/api';
import { Tax } from '../types';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'general' | 'taxes' | 'staff' | 'email'>('general');

  // Tax Rules state
  const { taxes, isLoading: isLoadingTaxes, error: taxesError, refetch: refetchTaxes } = useTaxes();
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [taxName, setTaxName] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [taxDescription, setTaxDescription] = useState('');
  const [taxIsActive, setTaxIsActive] = useState(true);
  const [isSavingTax, setIsSavingTax] = useState(false);
  const [taxActionError, setTaxActionError] = useState<string | null>(null);
  const [taxActionSuccess, setTaxActionSuccess] = useState<string | null>(null);

  // Brevo Integration state
  const [brevoStatus, setBrevoStatus] = useState<BrevoStatusResponse | null>(null);
  const [isLoadingBrevo, setIsLoadingBrevo] = useState(false);
  const [brevoError, setBrevoError] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState(user?.email || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const loadBrevoStatus = async () => {
    setIsLoadingBrevo(true);
    setBrevoError(null);
    try {
      const res = await fetchBrevoStatus();
      setBrevoStatus(res.data);
    } catch (err: any) {
      setBrevoError(err.message || 'Failed to check Brevo status');
    } finally {
      setIsLoadingBrevo(false);
    }
  };

  // Automatically check Brevo connectivity when the Email Integration tab is opened
  useEffect(() => {
    if (activeTab === 'email') {
      loadBrevoStatus();
    }
  }, [activeTab]);

  // Keep test recipient in sync with current user email once loaded
  useEffect(() => {
    if (user?.email && !testRecipient) {
      setTestRecipient(user.email);
    }
  }, [user?.email, testRecipient]);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) return;
    setIsSendingTest(true);
    setTestSuccess(null);
    setTestError(null);
    try {
      const res = await sendBrevoTestEmail(testRecipient);
      setTestSuccess(res.data.message);
    } catch (err: any) {
      setTestError(err.message || 'Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };

  const openCreateTaxModal = () => {
    setEditingTax(null);
    setTaxName('');
    setTaxRate('18.00');
    setTaxDescription('');
    setTaxIsActive(true);
    setTaxActionError(null);
    setShowTaxModal(true);
  };

  const openEditTaxModal = (tax: Tax) => {
    setEditingTax(tax);
    setTaxName(tax.name);
    setTaxRate(tax.ratePercentage.toString());
    setTaxDescription(tax.description || '');
    setTaxIsActive(tax.isActive);
    setTaxActionError(null);
    setShowTaxModal(true);
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaxActionError(null);
    setTaxActionSuccess(null);

    const name = taxName.trim();
    if (!name) {
      setTaxActionError('Tax rule name is required.');
      return;
    }

    const rate = parseFloat(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setTaxActionError('Tax rate percentage must be a number between 0.00% and 100.00%.');
      return;
    }

    setIsSavingTax(true);
    try {
      if (editingTax) {
        await updateTax(editingTax.id, {
          name,
          ratePercentage: rate,
          description: taxDescription.trim() || undefined,
          isActive: taxIsActive,
        });
        setTaxActionSuccess(`Tax rule "${name}" updated successfully.`);
      } else {
        await createTax({
          name,
          ratePercentage: rate,
          description: taxDescription.trim() || undefined,
          isActive: taxIsActive,
        });
        setTaxActionSuccess(`Tax rule "${name}" created successfully.`);
      }
      setShowTaxModal(false);
      refetchTaxes();
    } catch (err: any) {
      setTaxActionError(err.message || 'Failed to save tax rule.');
    } finally {
      setIsSavingTax(false);
    }
  };

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
        <div className="space-y-4">
          {taxActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center justify-between">
              <span>{taxActionSuccess}</span>
              <button onClick={() => setTaxActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">×</button>
            </div>
          )}

          {taxesError && <ErrorAlert message={taxesError} />}

          <Card
            title="Tax Rules & Rates"
            description="Configured percentage rates applied to pre-tax prices on recurring subscriptions and invoices. Rates are snapshotted on issuance."
            action={
              isAdmin ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={openCreateTaxModal}
                >
                  Add Tax Rule
                </Button>
              ) : (
                <Badge variant="neutral">Staff View-Only</Badge>
              )
            }
          >
            {isLoadingTaxes ? (
              <div className="py-8 text-center">
                <LoadingSpinner label="Loading tax rules..." />
              </div>
            ) : taxes && taxes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5">Tax Name</th>
                      <th className="py-2.5">Rate (%)</th>
                      <th className="py-2.5">Description</th>
                      <th className="py-2.5">Status</th>
                      {isAdmin && <th className="py-2.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {taxes.map((tax) => (
                      <tr key={tax.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-semibold text-slate-800">{tax.name}</td>
                        <td className="py-3 font-mono font-medium text-slate-900">{tax.ratePercentage.toFixed(2)}%</td>
                        <td className="py-3 text-slate-500">{tax.description || '—'}</td>
                        <td className="py-3">
                          <Badge variant={tax.isActive ? 'success' : 'neutral'} size="sm">
                            {tax.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Edit2 className="w-3 h-3" />}
                              onClick={() => openEditTaxModal(tax)}
                            >
                              Edit
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                No tax rules configured yet.
              </div>
            )}
          </Card>
        </div>
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
        <div className="space-y-4">
          <Card
            title="Brevo Transactional Email Service"
            description="Delivers secure password reset links, invoice notifications, and payment receipts via Brevo REST API v3."
            action={
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingBrevo ? 'animate-spin' : ''}`} />}
                onClick={loadBrevoStatus}
                disabled={isLoadingBrevo}
              >
                Check Status
              </Button>
            }
          >
            {brevoError && <ErrorAlert message={brevoError} className="mb-4" />}

            {isLoadingBrevo && !brevoStatus ? (
              <div className="p-8 flex justify-center">
                <LoadingSpinner size="md" label="Checking Brevo API connection..." />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Live Status Banner */}
                {brevoStatus?.connected ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-emerald-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        Connected to Brevo REST API v3
                      </div>
                      <Badge variant="success" size="sm">Active & Verified</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-emerald-200/60">
                      <div>
                        <span className="text-emerald-700 block text-[11px] font-medium">Account Email</span>
                        <span className="font-semibold text-slate-900">{brevoStatus.account?.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block text-[11px] font-medium">Organization / Owner</span>
                        <span className="font-semibold text-slate-900">
                          {[brevoStatus.account?.companyName, `${brevoStatus.account?.firstName || ''} ${brevoStatus.account?.lastName || ''}`.trim()].filter(Boolean).join(' • ') || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block text-[11px] font-medium">Configured Sender Address</span>
                        <span className="font-mono text-slate-900">{brevoStatus.senderEmail}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block text-[11px] font-medium">Sender Display Name</span>
                        <span className="font-medium text-slate-900">{brevoStatus.senderName}</span>
                      </div>
                      {brevoStatus.account?.plan && Array.isArray(brevoStatus.account.plan) && brevoStatus.account.plan[0] && (
                        <div className="sm:col-span-2 bg-emerald-100/70 border border-emerald-200/70 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="text-emerald-800 text-[11px] font-medium">Plan & Monthly Credits</span>
                          <span className="font-bold text-emerald-950 text-xs">
                            {brevoStatus.account.plan[0].type.toUpperCase()} Plan — {brevoStatus.account.plan[0].credits} credits remaining
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : brevoStatus?.configured ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-rose-950">
                    <div className="flex items-center justify-between font-bold text-sm text-rose-900">
                      <span>Brevo Connection Failed</span>
                      <Badge variant="danger" size="sm">Authentication Error</Badge>
                    </div>
                    <p className="text-xs text-rose-800">
                      {brevoStatus.error || 'The Brevo API rejected the configured credentials. Please check your BREVO_API_KEY in .env.'}
                    </p>
                  </div>
                ) : brevoStatus ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-950">
                    <div className="flex items-center justify-between font-bold text-sm text-amber-900">
                      <span>Local Dev Simulation Mode</span>
                      <Badge variant="warning" size="sm">Unconfigured</Badge>
                    </div>
                    <p className="text-xs text-amber-800">
                      No live Brevo API key is detected in your <code>.env</code> file. Transactional emails (password reset links and invoice dispatches) are currently logged safely to your terminal output.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 flex justify-center">
                    <LoadingSpinner size="md" label="Loading email configuration..." />
                  </div>
                )}

                {/* Send Live Test Email Form (Admin Only) */}
                {isAdmin && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Dispatch Test Email</h4>
                        <p className="text-[11px] text-slate-500">
                          Sends a live transactional verification email through your connected Brevo account
                        </p>
                      </div>
                    </div>

                    {testSuccess && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{testSuccess}</span>
                      </div>
                    )}

                    {testError && <ErrorAlert message={testError} onDismiss={() => setTestError(null)} />}

                    <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="email"
                        required
                        placeholder="recipient@example.com"
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        className="w-full sm:flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isSendingTest}
                        icon={<Send className="w-3.5 h-3.5" />}
                      >
                        Send Test Email
                      </Button>
                    </form>
                  </div>
                )}

                {/* How to Connect Brevo Instructions */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-slate-600 text-xs">
                  <h4 className="font-bold text-slate-900">How to Connect Brevo to Your Website</h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>
                      Create a free account at{' '}
                      <a href="https://app.brevo.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium">
                        app.brevo.com
                      </a>.
                    </li>
                    <li>
                      In Brevo, go to <strong>Senders &amp; Domains</strong> and add your sender email address (e.g. <code>billing@yourcompany.com</code>).
                    </li>
                    <li>
                      In Brevo, go to <strong>Settings &rarr; API Keys</strong> and generate a new REST API v3 key (starts with <code>xkeysib-</code>).
                    </li>
                    <li>
                      Add the keys to your local <code>.env</code> file (or Netlify Environment Variables in production):
                      <div className="mt-1 p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg space-y-0.5">
                        <div>BREVO_API_KEY=xkeysib-your-real-key-here</div>
                        <div>BREVO_SENDER_EMAIL=your-verified-email@domain.com</div>
                        <div>BREVO_SENDER_NAME="Brightloop Software"</div>
                      </div>
                    </li>
                    <li>
                      Verify the connection anytime in your terminal by running:
                      <div className="mt-1 p-2 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-lg">
                        npm run brevo:test
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tax Rule Create / Edit Modal (Admin Only) */}
      {showTaxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingTax ? `Edit Tax Rule: ${editingTax.name}` : 'Create New Tax Rule'}
              </h3>
              <button
                onClick={() => setShowTaxModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {taxActionError && <ErrorAlert message={taxActionError} onDismiss={() => setTaxActionError(null)} />}

            <form onSubmit={handleSaveTax} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Tax Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GST Standard, VAT Standard, Sales Tax"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Rate Percentage (%) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="18.00"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900 pr-8"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Applied to pre-tax unit prices during billing runs.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Applicable to domestic SaaS transactions"
                  value={taxDescription}
                  onChange={(e) => setTaxDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tax-active-checkbox"
                  checked={taxIsActive}
                  onChange={(e) => setTaxIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="tax-active-checkbox" className="font-semibold text-slate-700 cursor-pointer">
                  Tax rule is active and available for billing
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setShowTaxModal(false)}
                  disabled={isSavingTax}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSavingTax}>
                  {editingTax ? 'Update Tax Rule' : 'Create Tax Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
