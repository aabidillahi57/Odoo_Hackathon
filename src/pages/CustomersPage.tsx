import React, { useState } from 'react';
import { UserPlus, Search, Building2, Mail, Phone, ExternalLink, Database, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { DEMO_CUSTOMERS } from '../data/demoData';
import { useCustomers } from '../services/api';

export const CustomersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [useDemoFallback, setUseDemoFallback] = useState(false);

  const { customers: apiCustomers, meta, isLoading, error, refetch } = useCustomers({
    page,
    limit: 10,
    search: searchTerm,
  });

  const isLive = Boolean(apiCustomers && !useDemoFallback);
  const customerList = isLive && apiCustomers ? apiCustomers : DEMO_CUSTOMERS.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Directory"
        description="Maintain customer billing records, contact profiles, and subscription assignments."
        isDemo={!isLive}
        breadcrumbs={['Home', 'Customers']}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={refetch}
              title="Refresh from MySQL API"
            >
              Sync DB
            </Button>
            <Button
              variant="primary"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => alert('Customer creation dialog will be activated in Phase 5.')}
            >
              Add Customer
            </Button>
          </div>
        }
      />

      {/* Database Connection Notice / Error State */}
      {error && !useDemoFallback && (
        <ErrorAlert
          title="Server Database Unreachable"
          message={`${error} (Falling back to preview demo customer list. Run 'npm run db:seed' to populate local MySQL.)`}
          onRetry={refetch}
          className="mb-4"
        />
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by customer name, company, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Data Source:</span>
            {isLive ? (
              <Badge variant="success" size="sm" className="gap-1 items-center">
                <Database className="w-3 h-3 text-emerald-600" />
                Live MySQL DB ({meta?.total || customerList.length} records)
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" className="gap-1 items-center">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Demo Data Preview
              </Badge>
            )}
          </div>

          {apiCustomers && (
            <button
              onClick={() => setUseDemoFallback(!useDemoFallback)}
              className="text-[11px] text-indigo-600 hover:underline"
            >
              {useDemoFallback ? 'Switch to Live DB' : 'View Demo'}
            </button>
          )}
        </div>
      </div>

      {/* Customer List Card */}
      {isLoading ? (
        <LoadingSpinner label="Querying customer records from MySQL database via Netlify Functions..." />
      ) : customerList.length === 0 ? (
        <EmptyState
          title="No customer records match your filter"
          description="Try adjusting your search criteria or add a new customer to the database."
          actionLabel="Clear Search"
          onAction={() => setSearchTerm('')}
        />
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Customer & Company</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Active Subs</th>
                  <th className="py-3 px-4 text-right">Total Billed</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerList.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{customer.name}</div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{customer.companyName || 'Individual Customer'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{customer.email}</span>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {customer.city ? `${customer.city}, ` : ''}{customer.country || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={Number(customer.activeSubscriptionsCount) > 0 ? 'success' : 'neutral'} size="sm">
                        {customer.activeSubscriptionsCount} active
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      ${Number(customer.totalBilled).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ExternalLink className="w-3.5 h-3.5" />}
                        onClick={() => alert(`Customer detail view for ${customer.name} will be wired in Phase 5.`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {isLive && meta && meta.totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing page <strong className="text-slate-800">{meta.page}</strong> of <strong className="text-slate-800">{meta.totalPages}</strong> ({meta.total} total customers)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(page + 1)}
                  icon={<ChevronRight className="w-3.5 h-3.5" />}
                  iconPosition="right"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
