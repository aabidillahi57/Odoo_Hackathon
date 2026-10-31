import https from 'https';

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
