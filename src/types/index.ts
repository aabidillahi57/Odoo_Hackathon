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

export interface Tax {
  id: number;
  name: string;
  ratePercentage: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

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

export interface InvoiceLine {
  id: number;
  invoiceId: number;
  productId: number;
  productName: string;
  variantId?: number | null;
  variantName?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxId?: number | null;
  taxName?: string | null;
  taxRate: number;
  taxAmount: number;
  discountAmount?: number;
  subtotalAmount: number;
  totalAmount: number;
}

export interface InvoiceCustomer {
  id: number;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  subscriptionId?: number | null;
  subscriptionNumber?: string | null;
  customerId: number;
  customerName: string;
  companyName?: string | null;
  customerEmail?: string;
  customer?: InvoiceCustomer;
  status: InvoiceStatus;
  isOverdue?: boolean;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  subtotalAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  sentAt?: string | null;
  deliveryStatus?: 'pending' | 'sent' | 'failed' | null;
  deliveryError?: string | null;
  cancellationReason?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines?: InvoiceLine[];
  payments?: Payment[];
  discountUsage?: {
    id: number;
    discountId: number;
    code: string;
    name?: string;
    discountType: DiscountType;
    value: number;
    amountApplied: number;
    status: 'reserved' | 'redeemed' | 'released';
  } | null;
}

export interface BillingRunResultDetail {
  subscriptionId: number;
  subscriptionNumber: string;
  invoiceId?: number;
  invoiceNumber?: string;
  period?: string;
  amount?: number;
  nextBillingDate?: string;
  status: 'created' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
}

export interface BillingRunSummary {
  runNumber: string;
  asOfDate: string;
  status: 'completed' | 'partial' | 'failed';
  processedCount: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  totalInvoicedAmount: number;
  details: BillingRunResultDetail[];
}

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash' | 'other';
export type PaymentStatus = 'completed' | 'voided';

export interface Payment {
  id: number;
  paymentNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId?: number;
  customerName: string;
  customerEmail?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference?: string | null;
  status?: PaymentStatus;
  notes?: string | null;
  recordedBy?: number | null;
  recordedByName?: string | null;
  voidedAt?: string | null;
  voidedBy?: number | null;
  voidedByName?: string | null;
  voidReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  invoiceTotal?: number;
  invoiceBalanceDue?: number;
}

export type DiscountType = 'fixed' | 'percentage';

export interface Discount {
  id: number;
  code: string;
  name?: string;
  description?: string;
  discountType: DiscountType;
  value: number;
  minPurchaseAmount: number;
  minQuantity?: number;
  startDate?: string | null;
  endDate?: string | null;
  maxUses?: number | null;
  usedCount: number;
  appliesTo: 'order' | 'product';
  applicableProductId?: number | null;
  applicableProductName?: string | null;
  applicableVariantId?: number | null;
  isActive: boolean;
  isArchived?: boolean;
  archivedAt?: string | null;
  remainingUses?: number | null;
  createdAt?: string;
  updatedAt?: string;
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

export interface DashboardData {
  metrics: DashboardMetrics;
  recentInvoices: Invoice[];
  recentSubscriptions: any[];
}
