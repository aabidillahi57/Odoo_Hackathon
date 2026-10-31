import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

export interface SendPasswordResetParams {
  recipientEmail: string;
  recipientName?: string;
  resetToken: string;
}

export interface BrevoResult {
  success: boolean;
  messageId?: string;
  devMode?: boolean;
  devResetUrl?: string;
  error?: string;
}

/**
 * Checks whether Brevo credentials are fully configured in the environment
 */
export function isBrevoConfigured(): boolean {
  const key = process.env.BREVO_API_KEY;
  if (!key || key.includes('placeholder') || key.startsWith('xkeysib-your_brevo')) {
    return false;
  }
  return true;
}

/**
 * Sends a transactional password reset email via Brevo REST API v3
 */
export async function sendPasswordResetEmail({
  recipientEmail,
  recipientName = 'Valued Customer',
  resetToken,
}: SendPasswordResetParams): Promise<BrevoResult> {
  const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:8888';
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;

  // If Brevo is not configured with a real API key:
  if (!isBrevoConfigured()) {
    console.log('---------------------------------------------------------');
    console.log('📧 [BREVO LOCAL DEV NOTICE]');
    console.log(`   Brevo API key is not configured or is a placeholder.`);
    console.log(`   Recipient: ${recipientEmail}`);
    console.log(`   Simulated Reset URL: ${resetUrl}`);
    console.log('   (In production, this email is dispatched via Brevo API v3)');
    console.log('---------------------------------------------------------');

    return {
      success: false,
      devMode: true,
      devResetUrl: resetUrl,
      error: 'BREVO_NOT_CONFIGURED',
    };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@brightloopsoftware.example.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Brightloop Software';

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail,
        name: recipientName,
      },
    ],
    subject: 'Brightloop Software — Password Reset Request',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { font-size: 20px; font-weight: 700; color: #4f46e5; }
          .button { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Brightloop Software</div>
            <p style="font-size: 14px; color: #64748b; margin-top: 4px;">Subscription Management System</p>
          </div>
          <h2>Reset Your Password</h2>
          <p>Hello ${recipientName},</p>
          <p>We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>1 hour</strong> and can only be used once.</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">If you did not request a password reset, you can safely ignore this email. Your existing password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; word-break: break-all;">
            If the button doesn't work, copy and paste this link in your browser:<br/>
            ${resetUrl}
          </p>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Brightloop Software Inc. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              messageId: parsed.messageId,
            });
          } else {
            resolve({
              success: false,
              error: parsed.message || `Brevo API error HTTP ${res.statusCode}`,
            });
          }
        } catch (e: any) {
          resolve({
            success: false,
            error: 'Failed to parse Brevo API response',
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message || 'Network error reaching Brevo API',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Brevo API request timed out',
      });
    });

    req.write(postData);
    req.end();
  });
}



export interface SendInvoiceEmailParams {
  recipientEmail: string;
  recipientName?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  subtotalAmount?: number | string;
  taxAmount?: number | string;
  totalAmount: number | string;
  balanceDue: number | string;
  lines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number | string;
    totalAmount: number | string;
  }>;
}

/**
 * Sends a transactional invoice notification email via Brevo REST API v3
 */
export async function sendInvoiceEmail({
  recipientEmail,
  recipientName = 'Valued Customer',
  invoiceNumber,
  issueDate,
  dueDate,
  paymentTerms = 'Immediate Payment',
  subtotalAmount = '0.00',
  taxAmount = '0.00',
  totalAmount,
  balanceDue,
  lines = [],
}: SendInvoiceEmailParams): Promise<BrevoResult> {
  const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:8888';
  const portalUrl = `${baseUrl.replace(/\/$/, '')}/portal`;

  const formattedTotal = Number(totalAmount).toFixed(2);
  const formattedBalance = Number(balanceDue).toFixed(2);
  const formattedSubtotal = Number(subtotalAmount).toFixed(2);
  const formattedTax = Number(taxAmount).toFixed(2);

  // If Brevo is not configured with a live key:
  if (!isBrevoConfigured()) {
    console.log('---------------------------------------------------------');
    console.log('📧 [BREVO LOCAL DEV NOTICE]');
    console.log(`   Brevo API key is not configured or is a placeholder.`);
    console.log(`   Simulating transactional invoice dispatch:`);
    console.log(`   Recipient: ${recipientEmail} (${recipientName})`);
    console.log(`   Invoice: ${invoiceNumber} | Total: $${formattedTotal} | Due: ${dueDate}`);
    console.log(`   Portal URL: ${portalUrl}`);
    console.log('   (In production, this email is dispatched via Brevo API v3)');
    console.log('---------------------------------------------------------');

    return {
      success: true,
      devMode: true,
      messageId: `simulated-brevo-${Date.now()}`,
    };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'billing@brightloopsoftware.example.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Brightloop Billing Team';

  // Build line items rows
  const lineRowsHtml = lines.length > 0
    ? lines.map((l) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; font-size: 14px; color: #1e293b;">${l.description}</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: center; color: #64748b;">${l.quantity}</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: right; color: #64748b;">$${Number(l.unitPrice).toFixed(2)}</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: right; font-weight: 600; color: #1e293b;">$${Number(l.totalAmount).toFixed(2)}</td>
        </tr>
      `).join('')
    : `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; font-size: 14px; color: #1e293b;">Subscription Services</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: center; color: #64748b;">1</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: right; color: #64748b;">$${formattedSubtotal}</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: right; font-weight: 600; color: #1e293b;">$${formattedSubtotal}</td>
        </tr>
      `;

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail,
        name: recipientName,
      },
    ],
    subject: `Brightloop Software — Invoice ${invoiceNumber} Issued ($${formattedTotal})`,
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { font-size: 22px; font-weight: 700; color: #4f46e5; }
          .badge { background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
          .meta-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; display: table; width: 100%; box-sizing: border-box; }
          .meta-col { display: table-cell; width: 50%; vertical-align: top; }
          .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          .table th { background: #f8fafc; padding: 8px; font-size: 12px; text-transform: uppercase; color: #64748b; text-align: left; }
          .button { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="logo">Brightloop Software</div>
            <p style="font-size: 13px; color: #64748b; margin-top: 4px;">Billing & Subscription Management</p>
          </div>

          <h2 style="margin-bottom: 4px; color: #0f172a;">Invoice ${invoiceNumber}</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Dear ${recipientName}, here is the invoice for your active subscription cycle.</p>

          <div class="meta-box">
            <div class="meta-col">
              <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Issue Date</strong><br/>
              <span style="font-size: 14px; font-weight: 600;">${issueDate}</span><br/><br/>
              <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Payment Terms</strong><br/>
              <span style="font-size: 14px;">${paymentTerms}</span>
            </div>
            <div class="meta-col" style="text-align: right;">
              <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Due Date</strong><br/>
              <span style="font-size: 14px; font-weight: 600; color: #dc2626;">${dueDate}</span><br/><br/>
              <strong style="font-size: 12px; color: #64748b; text-transform: uppercase;">Balance Due</strong><br/>
              <span style="font-size: 18px; font-weight: 700; color: #4f46e5;">$${formattedBalance}</span>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineRowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: right;">
            <p style="margin: 4px 0; font-size: 13px; color: #64748b;">Subtotal: <strong style="color: #1e293b;">$${formattedSubtotal}</strong></p>
            <p style="margin: 4px 0; font-size: 13px; color: #64748b;">Tax: <strong style="color: #1e293b;">$${formattedTax}</strong></p>
            <h3 style="margin: 8px 0; font-size: 18px; color: #0f172a;">Total: $${formattedTotal}</h3>
          </div>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${portalUrl}" class="button" target="_blank">View in Customer Portal</a>
          </div>

          <p style="font-size: 12px; color: #64748b; text-align: center;">
            You can view your receipts, manage subscriptions, or download PDF versions directly from your portal account.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <div class="footer">
            &copy; ${new Date().getFullYear()} Brightloop Software Inc. All rights reserved.<br/>
            Questions? Contact billing at billing@brightloopsoftware.example.com
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              messageId: parsed.messageId,
            });
          } else {
            resolve({
              success: false,
              error: parsed.message || `Brevo API error HTTP ${res.statusCode}`,
            });
          }
        } catch (e: any) {
          resolve({
            success: false,
            error: 'Failed to parse Brevo API response',
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message || 'Network error reaching Brevo API',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Brevo API request timed out',
      });
    });

    req.write(postData);
    req.end();
  });
}




/**
 * Checks Brevo API connection and fetches authenticated account details
 */
export async function checkBrevoAccount(): Promise<{
  success: boolean;
  configured: boolean;
  email?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  plan?: any[];
  error?: string;
}> {
  if (!isBrevoConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'Brevo API key is not configured or is a placeholder in .env.',
    };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/account',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY as string,
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              configured: true,
              email: parsed.email,
              companyName: parsed.companyName,
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              plan: parsed.plan,
            });
          } else {
            resolve({
              success: false,
              configured: true,
              error: parsed.message || `Brevo API returned HTTP ${res.statusCode}`,
            });
          }
        } catch (e: any) {
          resolve({
            success: false,
            configured: true,
            error: 'Failed to parse Brevo API response',
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        configured: true,
        error: err.message || 'Network error reaching Brevo API',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        configured: true,
        error: 'Brevo API request timed out (10s)',
      });
    });

    req.end();
  });
}

/**
 * Sends a live test email verifying Brevo transactional sending
 */
export async function sendTestBrevoEmail(recipientEmail: string): Promise<BrevoResult> {
  if (!isBrevoConfigured()) {
    return {
      success: false,
      devMode: true,
      error: 'BREVO_NOT_CONFIGURED',
    };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'billing@brightloopsoftware.example.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Brightloop Software';

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: recipientEmail,
        name: 'Brightloop Administrator',
      },
    ],
    subject: 'Brightloop Software — Brevo Connection Test Succeeded 🎉',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px;">
          <h2 style="color: #4f46e5; margin-top: 0;">🎉 Brevo Connection Verified!</h2>
          <p>Hello,</p>
          <p>This is a live transactional test email confirming that <strong>Brevo REST API v3</strong> has been successfully connected to your <strong>Brightloop Subscription Management System</strong>.</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 13px;">
            <div><strong>Sender:</strong> ${senderName} &lt;${senderEmail}&gt;</div>
            <div><strong>Timestamp:</strong> ${new Date().toUTCString()}</div>
            <div><strong>Engine:</strong> Brevo Transactional Email Engine (REST API v3)</div>
          </div>
          <p style="color: #64748b; font-size: 13px;">Password reset recovery links and customer invoice statements are configured to dispatch through this channel.</p>
        </div>
      </body>
      </html>
    `,
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY as string,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              messageId: parsed.messageId,
            });
          } else {
            resolve({
              success: false,
              error: parsed.message || `Brevo API error HTTP ${res.statusCode}`,
            });
          }
        } catch (e: any) {
          resolve({
            success: false,
            error: 'Failed to parse Brevo API response',
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message || 'Network error reaching Brevo API',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Brevo API request timed out (10s)',
      });
    });

    req.write(postData);
    req.end();
  });
}
