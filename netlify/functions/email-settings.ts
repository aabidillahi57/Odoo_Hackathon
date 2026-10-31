import { getAuthenticatedUser } from './_shared/auth';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { isBrevoConfigured, checkBrevoAccount, sendTestBrevoEmail } from './_shared/brevo';

export async function handler(event: any) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  const user = await getAuthenticatedUser(event);
  const path = (event.path || '').replace(/.*\/api\/email\/?/, '').replace(/.*\/email-settings\/?/, '');

  // 1. GET status: Check Brevo configuration and live connectivity
  if (event.httpMethod === 'GET' || path === 'status' || path === '') {
    const isConfigured = isBrevoConfigured();
    const accountCheck = await checkBrevoAccount();

    return jsonSuccess({
      configured: isConfigured,
      connected: accountCheck.success,
      senderEmail: process.env.BREVO_SENDER_EMAIL || 'billing@brightloopsoftware.example.com',
      senderName: process.env.BREVO_SENDER_NAME || 'Brightloop Software',
      account: accountCheck.success ? {
        email: accountCheck.email,
        companyName: accountCheck.companyName,
        firstName: accountCheck.firstName,
        lastName: accountCheck.lastName,
        plan: accountCheck.plan,
      } : null,
      error: accountCheck.error,
    }, undefined, 200, {}, origin);
  }

  // 2. POST test email: Admin-only live dispatch
  if (event.httpMethod === 'POST' && (path === 'test' || path.includes('test'))) {
    if (!user) {
      return jsonError('Authentication required to send test emails.', 401, 'UNAUTHENTICATED', {}, origin);
    }
    if (user.role !== 'admin') {
      return jsonError('Only administrators can send test emails.', 403, 'FORBIDDEN', {}, origin);
    }

    let recipientEmail = user.email;
    try {
      if (event.body) {
        const parsed = JSON.parse(event.body);
        if (parsed.recipientEmail && typeof parsed.recipientEmail === 'string' && parsed.recipientEmail.includes('@')) {
          recipientEmail = parsed.recipientEmail.trim();
        }
      }
    } catch {
      // fallback to user.email
    }

    const testResult = await sendTestBrevoEmail(recipientEmail);
    if (!testResult.success && !testResult.devMode) {
      return jsonError(testResult.error || 'Failed to dispatch test email via Brevo.', 400, 'BREVO_SEND_FAILED', {}, origin);
    }

    return jsonSuccess({
      message: testResult.devMode
        ? 'Brevo is running in local dev mode (API key not configured in .env).'
        : `Test email successfully dispatched to ${recipientEmail} via Brevo REST API v3.`,
      messageId: testResult.messageId,
      devMode: testResult.devMode,
    }, undefined, 200, {}, origin);
  }

  return jsonError('Not found', 404, 'NOT_FOUND', {}, origin);
};
