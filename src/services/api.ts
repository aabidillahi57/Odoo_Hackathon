import { useState, useEffect, useCallback } from 'react';
import { Product, Plan, Customer } from '../types';

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
