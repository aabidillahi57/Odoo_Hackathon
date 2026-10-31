export type SubscriptionStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed';

export interface PlanPolicy {
  id: number;
  name: string;
  billingInterval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  billingIntervalCount: number;
  pauseAllowed: boolean;
  earlyClosePolicy: 'allowed' | 'fee_applies' | 'not_allowed';
  renewalPolicy: 'auto_renew' | 'manual_renew' | 'expire_on_end';
  autoClose: boolean;
}

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
  requiresReason?: boolean;
  warningNote?: string;
}

/**
 * Valid state transitions mapping
 */
export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  draft: ['quotation', 'closed'],
  quotation: ['confirmed', 'closed'],
  confirmed: ['active', 'closed'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [], // Terminal state
};

/**
 * Validates a lifecycle transition considering role, current state, and plan policy.
 */
export function validateTransition(
  currentStatus: SubscriptionStatus,
  targetStatus: SubscriptionStatus,
  userRole: 'admin' | 'staff' | 'customer',
  plan?: PlanPolicy | null,
  expiryDate?: string | null
): TransitionValidationResult {
  if (currentStatus === targetStatus) {
    return { valid: false, error: `Subscription is already in '${currentStatus}' status.` };
  }

  // Check state machine matrix
  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    return {
      valid: false,
      error: `Invalid lifecycle transition from '${currentStatus}' to '${targetStatus}'. Allowed target states are: ${
        allowedTargets.length > 0 ? allowedTargets.join(', ') : 'none (terminal state)'
      }.`,
    };
  }

  // Role permissions
  if (userRole === 'customer') {
    // Customers cannot confirm, activate, or close subscriptions
    if (['confirmed', 'active', 'closed'].includes(targetStatus) && currentStatus !== 'paused') {
      return {
        valid: false,
        error: `Customers are not permitted to transition subscriptions to '${targetStatus}'. Please contact Brightloop sales/support.`,
      };
    }

    // Customers can only pause active subscriptions or resume paused subscriptions
    if (currentStatus === 'active' && targetStatus !== 'paused') {
      return {
        valid: false,
        error: `Customers may only request a pause on active subscriptions.`,
      };
    }
  }

  // Plan-specific policy enforcement: Pause
  if (targetStatus === 'paused') {
    if (plan && plan.pauseAllowed === false) {
      return {
        valid: false,
        error: `Subscription pause is not permitted under the '${plan.name}' plan policy.`,
      };
    }
  }

  // Plan-specific policy enforcement: Early Close
  if (targetStatus === 'closed' && currentStatus === 'active' && plan && expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const isEarly = now < expiry;

    if (isEarly) {
      if (plan.earlyClosePolicy === 'not_allowed') {
        return {
          valid: false,
          error: `Early termination is strictly prohibited under the '${plan.name}' plan contract policy (valid through ${expiryDate}).`,
        };
      }
      if (plan.earlyClosePolicy === 'fee_applies') {
        return {
          valid: true,
          warningNote: `Early termination fee applies under '${plan.name}' policy.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Calculates a new expiry date when renewing a subscription.
 */
export function calculateRenewalExpiryDate(
  currentExpiryDate: string | Date | null | undefined,
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
  intervalCount = 1
): string {
  const baseDate = currentExpiryDate ? new Date(currentExpiryDate) : new Date();
  const target = isNaN(baseDate.getTime()) ? new Date() : new Date(baseDate);

  switch (interval) {
    case 'daily':
      target.setDate(target.getDate() + intervalCount);
      break;
    case 'weekly':
      target.setDate(target.getDate() + 7 * intervalCount);
      break;
    case 'monthly':
      target.setMonth(target.getMonth() + intervalCount);
      break;
    case 'yearly':
      target.setFullYear(target.getFullYear() + intervalCount);
      break;
    default:
      target.setMonth(target.getMonth() + 1);
  }

  return target.toISOString().split('T')[0];
}

/**
 * Calculates next billing date from start date and billing interval
 */
export function calculateNextBillingDate(
  startDate: string | Date,
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
  intervalCount = 1
): string {
  return calculateRenewalExpiryDate(startDate, interval, intervalCount);
}

export interface BillingPeriodResult {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  nextBillingDate: string; // YYYY-MM-DD
}

/**
 * Calculates accurate billing period start, end, and next billing date
 * with robust calendar month-end clamping (e.g. Jan 31 -> Feb 28/29).
 */
export function calculateBillingPeriodAndNextDate(
  periodStartStr: string,
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
  intervalCount = 1
): BillingPeriodResult {
  const parts = periodStartStr.split('-');
  const startYear = parseInt(parts[0], 10);
  const startMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const startDay = parseInt(parts[2], 10);

  const startDate = new Date(Date.UTC(startYear, startMonth, startDay));
  let nextDate: Date;

  if (interval === 'daily') {
    nextDate = new Date(Date.UTC(startYear, startMonth, startDay + intervalCount));
  } else if (interval === 'weekly') {
    nextDate = new Date(Date.UTC(startYear, startMonth, startDay + 7 * intervalCount));
  } else if (interval === 'monthly') {
    const totalMonths = startMonth + intervalCount;
    const targetYear = startYear + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(startDay, daysInTargetMonth);
    nextDate = new Date(Date.UTC(targetYear, targetMonth, clampedDay));
  } else if (interval === 'yearly') {
    const targetYear = startYear + intervalCount;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, startMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(startDay, daysInTargetMonth);
    nextDate = new Date(Date.UTC(targetYear, startMonth, clampedDay));
  } else {
    // Default monthly fallback
    const totalMonths = startMonth + 1;
    const targetYear = startYear + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(startDay, daysInTargetMonth);
    nextDate = new Date(Date.UTC(targetYear, targetMonth, clampedDay));
  }

  // Period end is 1 day before the next billing date
  const periodEndDate = new Date(nextDate.getTime() - 24 * 60 * 60 * 1000);
  const formatUtc = (d: Date) => d.toISOString().split('T')[0];

  return {
    periodStart: formatUtc(startDate),
    periodEnd: formatUtc(periodEndDate),
    nextBillingDate: formatUtc(nextDate),
  };
}


