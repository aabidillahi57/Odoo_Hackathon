#!/usr/bin/env node
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

console.log('===========================================================');
console.log('   Brightloop Software — Brevo Connection Diagnostic Tool');
console.log('===========================================================\n');

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || 'billing@brightloopsoftware.example.com';
const senderName = process.env.BREVO_SENDER_NAME || 'Brightloop Software';

if (!apiKey || apiKey.includes('placeholder') || apiKey.startsWith('xkeysib-your_brevo')) {
  console.error('❌ BREVO_API_KEY is not configured in your .env file.');
  console.log('\nTo connect Brevo:');
  console.log('1. Open your .env file.');
  console.log('2. Add your live Brevo API key:');
  console.log('   BREVO_API_KEY=xkeysib-your-key-here');
  console.log('   BREVO_SENDER_EMAIL=your-verified-email@domain.com');
  console.log('   BREVO_SENDER_NAME="Brightloop Software"');
  console.log('\n3. Re-run: npm run brevo:test\n');
  process.exit(1);
}

const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
console.log(`🔑 Testing API Key: ${maskedKey}`);
console.log(`📤 Configured Sender: "${senderName}" <${senderEmail}>`);
console.log('\nConnecting to Brevo REST API v3 (https://api.brevo.com/v3/account)...');

const req = https.request(
  {
    hostname: 'api.brevo.com',
    port: 443,
    path: '/v3/account',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'api-key': apiKey,
    },
    timeout: 10000,
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log('\n✅ SUCCESS: Brevo API connection verified successfully!');
          console.log('-----------------------------------------------------------');
          console.log(`Account Email:   ${parsed.email}`);
          console.log(`Company Name:    ${parsed.companyName || 'N/A'}`);
          console.log(`Owner:           ${parsed.firstName || ''} ${parsed.lastName || ''}`);
          if (parsed.plan && parsed.plan.length > 0) {
            console.log(`Active Plan:     ${parsed.plan.map((p) => `${p.type} (${p.credits} credits)`).join(', ')}`);
          }
          console.log('-----------------------------------------------------------');
          console.log('\n🎉 Your website backend is fully connected to Brevo.');
          console.log('Password reset links and invoice dispatch emails will send through this account.\n');

          // Check if --to argument was provided to send a live test email
          const toArg = process.argv.find((arg) => arg.startsWith('--to='));
          if (toArg) {
            const recipient = toArg.replace('--to=', '').trim();
            console.log(`Sending live test email to: ${recipient}...`);
            sendLiveTest(apiKey, senderEmail, senderName, recipient);
          } else {
            console.log('Tip: Run with --to=your-email@domain.com to send a test email:');
            console.log('     npm run brevo:test -- --to=your-email@domain.com\n');
          }
        } else {
          console.error(`\n❌ BREVO AUTHENTICATION FAILED (HTTP ${res.statusCode})`);
          console.error(`Message: ${parsed.message || data}`);
          console.log('\nPlease check that your BREVO_API_KEY in .env is an active v3 API key.');
          process.exit(1);
        }
      } catch (err) {
        console.error('\n❌ Failed to parse Brevo response:', data);
        process.exit(1);
      }
    });
  }
);

req.on('error', (err) => {
  console.error(`\n❌ Network error reaching Brevo: ${err.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error('\n❌ Connection to Brevo timed out.');
  process.exit(1);
});

req.end();

function sendLiveTest(apiKey, senderEmail, senderName, recipient) {
  const postData = JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: recipient, name: 'Brightloop Admin' }],
    subject: 'Brightloop Software — Brevo Connection Test Verified 🎉',
    htmlContent: `
      <h2>🎉 Brevo Connection Successful!</h2>
      <p>This email confirms that your Brightloop Subscription Management System is properly linked to Brevo.</p>
      <p>Dispatched at: ${new Date().toUTCString()}</p>
    `,
  });

  const sendReq = https.request(
    {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    },
    (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`\n📬 Live test email dispatched! Message ID: ${parsed.messageId}\n`);
          } else {
            console.error(`\n⚠️ Send failed (HTTP ${res.statusCode}): ${parsed.message || data}\n`);
          }
        } catch {
          console.error('Failed to parse send response:', data);
        }
      });
    }
  );

  sendReq.on('error', (err) => console.error('Send error:', err.message));
  sendReq.write(postData);
  sendReq.end();
}

