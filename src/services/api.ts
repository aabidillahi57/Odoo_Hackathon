import { useState, useEffect, useCallback } from 'react';
import { Product, Plan, Customer, Subscription, QuotationTemplate, Tax, Invoice, BillingRunSummary, Payment, Discount, DashboardData } from '../types';

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  database: {
    connected: boolean;
    latencyMs?: number;
    host?: string;
    error?: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, any>;
  error?: string;
  code?: string;
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<{ data: T; meta?: Record<string, any> }> {
  try {
    const res = await fetch(`/api/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      ...options,
    });

    const json: ApiResponse<T> = await res.json();

    if (!res.ok || !json.success) {
      const errorMsg = json.error || `HTTP error ${res.status}`;
      const error = new Error(errorMsg) as Error & { code?: string; status?: number };
      error.code = json.code;
      error.status = res.status;
      throw error;
    }

    return { data: json.data as T, meta: json.meta };
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const netError = new Error('Netlify Functions server is not reachable. Ensure Netlify CLI is running or run with local demo fallback.') as Error & { code?: string };
      netError.code = 'NETWORK_ERROR';
      throw netError;
    }
    throw err;
  }
}

/**
 * Hook to monitor API and database health
 */
export function useApiHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<HealthStatus>('health');
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { health, isLoading, error, refetch: checkHealth };
}

/**
 * Hook to fetch active products
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<Product[]>('products');
      setProducts(data);
    } catch (err: any) {
      setError(err.message);
      setProducts(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: fetchProducts };
}

/**
 * Hook to fetch active plans
 */
export function usePlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<Plan[]>('plans');
      setPlans(data);
    } catch (err: any) {
      setError(err.message);
      setPlans(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { plans, isLoading, error, refetch: fetchPlans };
}

/**
 * Hook to fetch paginated customers
 */
export function useCustomers(params: { page: number; limit: number; search?: string }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        search: params.search || '',
      });

      const { data, meta } = await fetchApi<Customer[]>(`customers?${query.toString()}`);
      setCustomers(data);
      setMeta(meta as any);
    } catch (err: any) {
      setError(err.message);
      setCustomers(null);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [params.page, params.limit, params.search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, meta, isLoading, error, refetch: fetchCustomers };
}

/**
 * Hook to fetch paginated subscriptions with filters
 */
export function useSubscriptions(params: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  customerId?: number;
  planId?: number;
}) {
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [meta, setMeta] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    statusCounts: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        status: params.status || 'all',
        search: params.search || '',
      });
      if (params.customerId) query.set('customerId', String(params.customerId));
      if (params.planId) query.set('planId', String(params.planId));

      const { data, meta } = await fetchApi<Subscription[]>(`subscriptions?${query.toString()}`);
      setSubscriptions(data);
      setMeta(meta as any);
    } catch (err: any) {
      setError(err.message);
      setSubscriptions(null);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [params.page, params.limit, params.status, params.search, params.customerId, params.planId]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return { subscriptions, meta, isLoading, error, refetch: fetchSubscriptions };
}

/**
 * Hook to fetch single subscription detail by ID
 */
export function useSubscription(id: number | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!id) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<Subscription>(`subscriptions/${id}`);
      setSubscription(data);
    } catch (err: any) {
      setError(err.message);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return { subscription, isLoading, error, refetch: fetchSubscription };
}

/**
 * Hook to fetch active quotation templates
 */
export function useQuotationTemplates() {
  const [templates, setTemplates] = useState<QuotationTemplate[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<QuotationTemplate[]>('quotation-templates');
      setTemplates(data);
    } catch (err: any) {
      setError(err.message);
      setTemplates(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, isLoading, error, refetch: fetchTemplates };
}

/**
 * Mutation: Create a subscription
 */
export async function createSubscription(payload: {
  customerId: number;
  planId?: number;
  templateId?: number;
  status?: 'draft' | 'quotation';
  startDate: string;
  expiryDate?: string;
  paymentTerms?: string;
  autoRenew?: boolean;
  notes?: string;
  lines: Array<{
    productId: number;
    variantId?: number;
    quantity: number;
    taxId?: number;
    description?: string;
  }>;
}) {
  return fetchApi<{ id: number; subscriptionNumber: string; status: string; totalRecurringAmount: number }>('subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Update draft subscription
 */
export async function updateSubscription(
  id: number,
  payload: {
    startDate?: string;
    expiryDate?: string;
    paymentTerms?: string;
    autoRenew?: boolean;
    notes?: string;
    lines?: Array<{
      productId: number;
      variantId?: number;
      quantity: number;
      taxId?: number;
      description?: string;
    }>;
  }
) {
  return fetchApi<{ id: number; message: string }>(`subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Transition subscription status
 */
export async function transitionSubscription(id: number, targetStatus: string, reason?: string) {
  return fetchApi<{
    id: number;
    subscriptionNumber: string;
    previousStatus: string;
    newStatus: string;
    message: string;
  }>(`subscriptions/${id}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ targetStatus, reason }),
  });
}

/**
 * Mutation: Renew active subscription
 */
export async function renewSubscription(id: number, reason?: string) {
  return fetchApi<{
    id: number;
    subscriptionNumber: string;
    previousExpiryDate: string;
    newExpiryDate: string;
    message: string;
  }>(`subscriptions/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Mutation: Issue subscription from quotation template
 */
export async function issueSubscriptionFromTemplate(
  templateId: number,
  payload: {
    customerId: number;
    startDate?: string;
    customValidityDays?: number;
    paymentTerms?: string;
    autoRenew?: boolean;
    notes?: string;
    lineOverrides?: Array<{ productId: number; variantId?: number | null; quantity: number }>;
  }
) {
  return fetchApi<{
    id: number;
    subscriptionNumber: string;
    status: string;
    customerId: number;
    customerName: string;
    templateName: string;
    expiryDate: string;
    totalRecurringAmount: number;
    message: string;
  }>(`quotation-templates/${templateId}/issue`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Part 7: Tax Rules API Hooks & Mutations
// =============================================================================

/**
 * Hook to fetch configured tax rules
 */
export function useTaxes(activeOnly?: boolean) {
  const [taxes, setTaxes] = useState<Tax[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaxes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = activeOnly ? 'taxes?active_only=true' : 'taxes';
      const { data } = await fetchApi<{ taxes: Tax[]; count: number }>(endpoint);
      setTaxes(data.taxes);
    } catch (err: any) {
      setError(err.message);
      setTaxes(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchTaxes();
  }, [fetchTaxes]);

  return { taxes, isLoading, error, refetch: fetchTaxes };
}

/**
 * Mutation: Create a tax rule (Admin only)
 */
export async function createTax(payload: {
  name: string;
  ratePercentage: number;
  description?: string;
  isActive?: boolean;
}) {
  return fetchApi<{ message: string; tax: Tax }>('taxes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Update or deactivate a tax rule (Admin only)
 */
export async function updateTax(
  id: number,
  payload: {
    name?: string;
    ratePercentage?: number;
    description?: string;
    isActive?: boolean;
  }
) {
  return fetchApi<{ message: string; tax: Tax }>(`taxes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Part 7: Invoices & Billing Run API Hooks & Mutations
// =============================================================================

export interface InvoicesFilterParams {
  status?: string;
  search?: string;
  customerId?: number;
  subscriptionId?: number;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Hook to fetch paginated invoices with search and filters
 */
export function useInvoices(filters: InvoicesFilterParams = {}) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status, search, customerId, subscriptionId, overdue, page = 1, limit = 20 } = filters;

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      if (customerId) params.append('customer_id', customerId.toString());
      if (subscriptionId) params.append('subscription_id', subscriptionId.toString());
      if (overdue) params.append('overdue', 'true');
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const queryStr = params.toString();
      const endpoint = queryStr ? `invoices?${queryStr}` : 'invoices';
      const { data } = await fetchApi<{
        invoices: Invoice[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(endpoint);

      setInvoices(data.invoices);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
      setInvoices(null);
    } finally {
      setIsLoading(false);
    }
  }, [status, search, customerId, subscriptionId, overdue, page, limit]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, total, totalPages, page, limit, isLoading, error, refetch: fetchInvoices };
}

/**
 * Hook to fetch single invoice details
 */
export function useInvoiceDetail(id?: number | null) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!id) {
      setInvoice(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await fetchApi<{ invoice: Invoice }>(`invoices/${id}`);
      setInvoice(data.invoice);
    } catch (err: any) {
      setError(err.message);
      setInvoice(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  return { invoice, isLoading, error, refetch: fetchInvoice };
}

/**
 * Mutation: Confirm a draft invoice
 */
export async function confirmInvoice(id: number) {
  return fetchApi<{ message: string; status: string }>(`invoices/${id}/confirm`, {
    method: 'POST',
  });
}

/**
 * Mutation: Cancel an issued invoice with reason
 */
export async function cancelInvoice(id: number, reason: string) {
  return fetchApi<{ message: string; status: string }>(`invoices/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Mutation: Send invoice notification email via Brevo
 */
export async function sendInvoiceEmailDispatch(id: number) {
  return fetchApi<{
    message: string;
    deliveryStatus: string;
    devMode?: boolean;
    error?: string;
  }>(`invoices/${id}/send`, {
    method: 'POST',
  });
}

/**
 * Mutation: Create manual invoice
 */
export async function createManualInvoice(payload: {
  customerId: number;
  subscriptionId?: number | null;
  issueDate?: string;
  dueDate?: string;
  paymentTerms?: string;
  notes?: string;
  status?: 'draft' | 'confirmed';
  lines: Array<{
    productId: number;
    variantId?: number | null;
    description: string;
    quantity: number;
    unitPrice: number;
    taxId?: number | null;
    taxRate?: number;
    taxName?: string;
  }>;
}) {
  return fetchApi<{
    message: string;
    invoiceId: number;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  }>('invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Execute recurring billing run
 */
export async function triggerBillingRun(payload: { asOfDate?: string; batchLimit?: number } = {}) {
  return fetchApi<BillingRunSummary>('billing/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Query: Paginated and filterable discounts
 */
export function useDiscounts(filters?: {
  status?: string;
  type?: string;
  applies_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, any>>({});

  const fetchDiscounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters?.status) queryParams.set('status', filters.status);
      if (filters?.type) queryParams.set('type', filters.type);
      if (filters?.applies_to) queryParams.set('applies_to', filters.applies_to);
      if (filters?.search) queryParams.set('search', filters.search);
      if (filters?.page) queryParams.set('page', filters.page.toString());
      if (filters?.limit) queryParams.set('limit', filters.limit.toString());

      const res = await fetchApi<Discount[]>(`discounts?${queryParams.toString()}`);
      setDiscounts(res.data);
      if (res.meta) setMeta(res.meta);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch discounts');
    } finally {
      setIsLoading(false);
    }
  }, [filters?.status, filters?.type, filters?.applies_to, filters?.search, filters?.page, filters?.limit]);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  return { discounts, isLoading, error, meta, refetch: fetchDiscounts };
}

/**
 * Mutation: Create discount rule (Admin only)
 */
export async function createDiscount(payload: {
  code: string;
  name?: string;
  description?: string;
  discountType: 'fixed' | 'percentage';
  value: number;
  minPurchaseAmount?: number;
  minQuantity?: number;
  startDate?: string | null;
  endDate?: string | null;
  maxUses?: number | null;
  appliesTo: 'order' | 'product';
  applicableProductId?: number | null;
  applicableVariantId?: number | null;
  isActive?: boolean;
}) {
  return fetchApi<{ message: string; discountId: number; discount: Discount }>('discounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Update discount rule (Admin only)
 */
export async function updateDiscount(
  id: number,
  payload: {
    name?: string;
    description?: string;
    value?: number;
    minPurchaseAmount?: number;
    minQuantity?: number;
    startDate?: string | null;
    endDate?: string | null;
    maxUses?: number | null;
    appliesTo?: 'order' | 'product';
    applicableProductId?: number | null;
    applicableVariantId?: number | null;
    isActive?: boolean;
  }
) {
  return fetchApi<{ message: string; discountId: number; discount: Discount }>(`discounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Archive discount rule (Admin only)
 */
export async function archiveDiscount(id: number) {
  return fetchApi<{ message: string; discountId: number; isArchived: boolean }>(`discounts/${id}/archive`, {
    method: 'POST',
  });
}

/**
 * Query: Paginated and filterable recorded payments
 */
export function usePayments(filters?: {
  invoice_id?: number;
  customer_id?: number;
  method?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, any>>({});

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters?.invoice_id) queryParams.set('invoice_id', filters.invoice_id.toString());
      if (filters?.customer_id) queryParams.set('customer_id', filters.customer_id.toString());
      if (filters?.method) queryParams.set('method', filters.method);
      if (filters?.status) queryParams.set('status', filters.status);
      if (filters?.search) queryParams.set('search', filters.search);
      if (filters?.page) queryParams.set('page', filters.page.toString());
      if (filters?.limit) queryParams.set('limit', filters.limit.toString());

      const res = await fetchApi<Payment[]>(`payments?${queryParams.toString()}`);
      setPayments(res.data);
      if (res.meta) setMeta(res.meta);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setIsLoading(false);
    }
  }, [
    filters?.invoice_id,
    filters?.customer_id,
    filters?.method,
    filters?.status,
    filters?.search,
    filters?.page,
    filters?.limit,
  ]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, isLoading, error, meta, refetch: fetchPayments };
}

/**
 * Mutation: Record manual payment against an invoice (Admin/Staff)
 */
export async function recordPayment(payload: {
  invoiceId: number;
  amount: number;
  paymentMethod?: string;
  paymentDate?: string;
  transactionReference?: string;
  notes?: string;
}) {
  return fetchApi<{
    message: string;
    paymentId: number;
    paymentNumber: string;
    payment: Payment;
    invoice: {
      id: number;
      invoiceNumber: string;
      status: string;
      totalAmount: number;
      amountPaid: number;
      balanceDue: number;
    };
  }>('payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Mutation: Void a recorded payment with audited reason (Admin/Staff)
 */
export async function voidPayment(id: number, voidReason: string) {
  return fetchApi<{
    message: string;
    paymentId: number;
    status: string;
    reconciledInvoice: {
      id: number;
      status: string;
      totalAmount: number;
      amountPaid: number;
      balanceDue: number;
    };
  }>(`payments/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ voidReason }),
  });
}

/**
 * Query: Live dashboard executive overview metrics
 */
export function useDashboardMetrics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<DashboardData>('dashboard/metrics');
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { data, isLoading, error, refetch: fetchMetrics };
}

