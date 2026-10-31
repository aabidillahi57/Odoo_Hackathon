import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductsPage } from './pages/ProductsPage';
import { PlansPage } from './pages/PlansPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { DiscountsPage } from './pages/DiscountsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomerPortalPage } from './pages/portal/CustomerPortalPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer Self-Service Portal Entry Point (Isolated Route) */}
        <Route path="/portal" element={<CustomerPortalPage />} />

        {/* Internal Operations Navigation Shell */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="discounts" element={<DiscountsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback to Overview */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
