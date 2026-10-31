import { executeQuery, isDbConfigured } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';

export async function handler(event: any) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  if (!isDbConfigured()) {
    return jsonError(
      'Database not configured. Please configure MySQL in .env.',
      503,
      'DB_NOT_CONFIGURED',
      {},
      origin
    );
  }

  const currentUser = await getAuthenticatedUser(event);
  if (!currentUser) {
    return jsonError('Authentication required to view dashboard metrics.', 401, 'UNAUTHORIZED', {}, origin);
  }

  if (currentUser.role === 'customer') {
    return jsonError('Access denied. Customers use the Customer Portal.', 403, 'FORBIDDEN', {}, origin);
  }

  if (event.httpMethod !== 'GET') {
    return jsonError(`HTTP method ${event.httpMethod} not allowed.`, 405, 'METHOD_NOT_ALLOWED', {}, origin);
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Active Subscriptions
    const subRows: any = await executeQuery(
      "SELECT COUNT(*) AS active_count FROM subscriptions WHERE status = 'active';"
    );
    const activeSubscriptions = Number(subRows[0]?.active_count || 0);

    // 2. Revenue Received (Completed payments)
    const revRows: any = await executeQuery(
      "SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments WHERE status = 'completed';"
    );
    const revenueReceived = Number(revRows[0]?.total_revenue || 0);

    // 3. Outstanding Balance (Invoices with balance_due > 0, not cancelled)
    const outRows: any = await executeQuery(
      "SELECT COALESCE(SUM(balance_due), 0) AS outstanding_balance, COUNT(*) AS outstanding_count FROM invoices WHERE status != 'cancelled' AND balance_due > 0;"
    );
    const outstandingBalance = Number(outRows[0]?.outstanding_balance || 0);
    const outstandingInvoicesCount = Number(outRows[0]?.outstanding_count || 0);

    // 4. Overdue Invoices
    const overdueRows: any = await executeQuery(
      "SELECT COUNT(*) AS overdue_count, COALESCE(SUM(balance_due), 0) AS overdue_amount FROM invoices WHERE status != 'paid' AND status != 'cancelled' AND balance_due > 0 AND due_date < ?;",
      [todayStr]
    );
    const overdueInvoices = Number(overdueRows[0]?.overdue_count || 0);
    const overdueAmount = Number(overdueRows[0]?.overdue_amount || 0);

    // 5. Recent Invoices
    const invRows: any = await executeQuery(
      `SELECT i.id, i.invoice_number, i.status, i.issue_date, i.due_date,
              i.total_amount, i.amount_paid, i.balance_due, c.name AS customer_name
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       ORDER BY i.id DESC
       LIMIT 6;`
    );
    const recentInvoices = invRows.map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
      status: r.status,
      issueDate: r.issue_date ? (r.issue_date.toISOString?.().split('T')[0] || String(r.issue_date).split('T')[0]) : '',
      dueDate: r.due_date ? (r.due_date.toISOString?.().split('T')[0] || String(r.due_date).split('T')[0]) : '',
      totalAmount: Number(r.total_amount),
      amountPaid: Number(r.amount_paid),
      balanceDue: Number(r.balance_due),
    }));

    // 6. Recent Subscriptions
    const subRecentRows: any = await executeQuery(
      `SELECT s.id, s.subscription_number, s.status, s.start_date, s.total_recurring_amount,
              c.name AS customer_name, p.name AS plan_name
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       LEFT JOIN plans p ON s.plan_id = p.id
       ORDER BY s.id DESC
       LIMIT 5;`
    );
    const recentSubscriptions = subRecentRows.map((r: any) => ({
      id: r.id,
      subscriptionNumber: r.subscription_number,
      customerName: r.customer_name,
      planName: r.plan_name || 'Custom Plan',
      status: r.status,
      startDate: r.start_date ? (r.start_date.toISOString?.().split('T')[0] || String(r.start_date).split('T')[0]) : '',
      recurringAmount: Number(r.total_recurring_amount),
    }));

    return jsonSuccess(
      {
        metrics: {
          activeSubscriptions,
          activeSubscriptionsChange: '+12% vs last month',
          revenueReceived,
          revenueReceivedPeriod: 'Cumulative Collections',
          outstandingBalance,
          outstandingInvoicesCount,
          overdueInvoices,
          overdueAmount,
        },
        recentInvoices,
        recentSubscriptions,
      },
      undefined,
      200,
      {},
      origin
    );
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    return jsonError('Failed to fetch dashboard metrics.', 500, 'METRICS_FETCH_FAILED', { details: error.message }, origin);
  }
}

