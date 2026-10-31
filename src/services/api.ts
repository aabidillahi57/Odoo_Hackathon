import { useState, useEffect, useCallback } from 'react';
import { Product, Plan, Customer, Subscription, QuotationTemplate } from '../types';

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
