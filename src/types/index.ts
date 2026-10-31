export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  customerId?: number | null;
}

export interface AuthenticatedUser extends User {}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export interface CreateStaffData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface Customer {
  id: number;
  userId?: number;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  activeSubscriptionsCount: number;
  totalBilled: number;
  createdAt: string;
}

export type ProductType = 'software' | 'service' | 'addon';

export interface ProductVariant {
  id: number;
  productId: number;
  attributeName: string;
  attributeValue: string;
  priceAdjustment: number;
  sku?: string;
}

export interface Product {
  id: number;
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice: number;
  notes?: string;
  isActive: boolean;
  variants?: ProductVariant[];
}

export type BillingInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EarlyClosePolicy = 'allowed' | 'fee_applies' | 'not_allowed';
export type RenewalPolicy = 'auto_renew' | 'manual_renew' | 'expire_on_end';

export interface Plan {
  id: number;
  name: string;
  billingInterval: BillingInterval;
  billingIntervalCount: number;
  price: number;
  minQuantity: number;
  autoClose: boolean;
  earlyClosePolicy: EarlyClosePolicy;
  pauseAllowed: boolean;
  renewalPolicy: RenewalPolicy;
  isActive: boolean;
}

export interface QuotationTemplateLine {
  id: number;
  productId: number;
  productName: string;
  productType?: string;
  variantId?: number | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  taxId?: number | null;
  taxName?: string | null;
  taxRate?: number;
}

export interface QuotationTemplate {
  id: number;
  name: string;
  planId?: number;
  planName?: string;
  planInterval?: BillingInterval;
  validityDays: number;
  linesCount: number;
  notes?: string;
  isActive: boolean;
  lines?: QuotationTemplateLine[];
}

export type SubscriptionStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed';

export interface SubscriptionLine {
  id: number;
  subscriptionId: number;
  productId: number;
  productName: string;
  productType?: string;
  variantId?: number | null;
  variantName?: string | null;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxId?: number | null;
  taxName?: string | null;
  taxRate: number;
  taxAmount: number;
  subtotalAmount: number;
  totalAmount: number;
}

export interface SubscriptionHistoryEntry {
  id: number;
  subscriptionId: number;
  fromStatus: SubscriptionStatus | null;
  toStatus: SubscriptionStatus;
  action: string;
  actorUserId?: number | null;
  actorName?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface Subscription {
  id: number;
  subscriptionNumber: string;
  customerId: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  companyName?: string;
  planId?: number;
  planName: string;
  templateId?: number | null;
  templateName?: string | null;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate?: string | null;
  nextBillingDate?: string | null;
  paymentTerms?: string;
  billingInterval?: BillingInterval;
  billingIntervalCount?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalRecurringAmount?: number;
  recurringAmount: number; // Backwards compatible with demoData & OverviewPage
  autoRenew: boolean;
  pausedAt?: string | null;
  resumedAt?: string | null;
  closedAt?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  planPolicy?: {
    pauseAllowed: boolean;
    earlyClosePolicy: EarlyClosePolicy;
    renewalPolicy: RenewalPolicy;
  } | null;
  lines?: SubscriptionLine[];
  history?: SubscriptionHistoryEntry[];
}

export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';

export interface Invoice {
  id: number;
  invoiceNumber: string;
  subscriptionId?: number;
  subscriptionNumber?: string;
  customerId: number;
  customerName: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
}

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash' | 'other';

export interface Payment {
  id: number;
  paymentNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference?: string;
}

export type DiscountType = 'fixed' | 'percentage';

export interface Discount {
  id: number;
  code: string;
  description?: string;
  discountType: DiscountType;
  value: number;
  minPurchaseAmount: number;
  usedCount: number;
  maxUses?: number;
  appliesTo: 'order' | 'product';
  isActive: boolean;
}

export interface DashboardMetrics {
  activeSubscriptions: number;
  activeSubscriptionsChange: string;
  revenueReceived: number;
  revenueReceivedPeriod: string;
  outstandingBalance: number;
  outstandingInvoicesCount: number;
  overdueInvoices: number;
  overdueAmount: number;
}
