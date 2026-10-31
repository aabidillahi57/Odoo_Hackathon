import React, { useState } from 'react';
import { Settings, Shield, Mail, UserCheck, Plus } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'taxes' | 'staff' | 'email'>('general');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & System Governance"
        description="Administer organization profiles, tax rate tables, internal staff permissions, and Brevo email parameters."
        isDemo
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
            <Button variant="primary" onClick={() => alert('Settings save will be wired to backend in Phase 3')}>
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
              onClick={() => alert('Add Tax Rate Modal (Phase 4)')}
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
        <Card
          title="Internal Staff Accounts (Admin Only)"
          description="Only Admins can invite or manage internal staff members. Staff cannot add accounts or create discount rules."
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => alert('Staff member creation form (Phase 3)')}
            >
              Add Staff Member
            </Button>
          }
        >
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-4">
            <p className="font-semibold text-slate-800">Password Policy Requirements:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
              <li>Length must be strictly greater than 8 characters</li>
              <li>Must contain at least one uppercase letter (A-Z)</li>
              <li>Must contain at least one lowercase letter (a-z)</li>
              <li>Must contain at least one special character (!@#$%^&*)</li>
            </ul>
          </div>
        </Card>
      )}

      {/* Tab 4: Email Integration */}
      {activeTab === 'email' && (
        <Card
          title="Brevo Transactional Email Service"
          description="Delivers secure password reset links, invoice notifications, and payment receipts."
        >
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">Configuration Status</span>
                <span className="text-slate-500">Configured via server-side environment variables</span>
              </div>
              <Badge variant="neutral" size="sm">Dev Mock Mode</Badge>
            </div>
            <p className="text-slate-500 text-[11px]">
              During development, emails are mocked safely in the serverless functions log. The production API key will be injected via Netlify Environment Variables in Phase 10.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
