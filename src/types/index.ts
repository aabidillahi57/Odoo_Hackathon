export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
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

export interface QuotationTemplate {
  id: number;
  name: string;
  planId?: number;
  planName?: string;
  validityDays: number;
  linesCount: number;
  notes?: string;
  isActive: boolean;
}

export type SubscriptionStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed';

export interface Subscription {
  id: number;
  subscriptionNumber: string;
  customerId: number;
  customerName: string;
  planId: number;
  planName: string;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate?: string;
  nextBillingDate: string;
  recurringAmount: number;
  autoRenew: boolean;
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
