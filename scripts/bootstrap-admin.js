#!/usr/bin/env node
import readline from 'readline';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  if (password.length <= 8) {
    return 'Password must be longer than 8 characters (at least 9).';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[!@#$%^&*(),.?":{}|<>\-_+=\/\\~`[\]]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&* etc.).';
  }
  return null;
}

function promptQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function runBootstrap() {
  console.log('===============================================================');
  console.log('Brightloop Software — First Admin Account Bootstrap');
  console.log('===============================================================');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'brightloop_subscriptions';
  const ssl = process.env.DB_SSL === 'true';

  let connection;
  try {
    const config = process.env.DATABASE_URL
      ? process.env.DATABASE_URL
      : {
          host,
          port,
          user,
          password,
          database,
          ssl: ssl ? { rejectUnauthorized: true } : undefined,
        };

    connection = await mysql.createConnection(config);
  } catch (err) {
    console.error(`❌ Could not connect to MySQL database '${database}'.`);
    console.error(`   Ensure MySQL is running and DB_USER/DB_PASSWORD in .env are correct.`);
    process.exit(1);
  }

  // Parse args if provided: --email=... --password=...
  const args = process.argv.slice(2);
  let emailArg = args.find((a) => a.startsWith('--email='))?.split('=')[1];
  let passArg = args.find((a) => a.startsWith('--password='))?.split('=')[1];
  let firstName = args.find((a) => a.startsWith('--first-name='))?.split('=')[1] || 'System';
  let lastName = args.find((a) => a.startsWith('--last-name='))?.split('=')[1] || 'Admin';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    let email = emailArg;
    if (!email) {
      email = await promptQuestion(rl, 'Enter Admin Email Address: ');
    }
    email = email.trim().toLowerCase();

    if (!validateEmail(email)) {
      console.error('❌ Invalid email address format.');
      process.exit(1);
    }

    let pass = passArg;
    if (!pass) {
      pass = await promptQuestion(rl, 'Enter Admin Password (min 9 chars, 1 uppercase, 1 lowercase, 1 special char): ');
    }

    const passError = validatePassword(pass);
    if (passError) {
      console.error(`❌ ${passError}`);
      process.exit(1);
    }

    // Check if user already exists
    const [existing] = await connection.query('SELECT id, role FROM users WHERE email = ?', [email]);
    const passwordHash = await bcrypt.hash(pass, 12);

    if (existing.length > 0) {
      // Elevate or update password
      await connection.query(
        'UPDATE users SET password_hash = ?, role = "admin", is_active = TRUE, first_name = ?, last_name = ? WHERE email = ?',
        [passwordHash, firstName, lastName, email]
      );
      console.log(`✓ Existing user account for '${email}' updated and elevated to Admin role.`);
    } else {
      // Create new Admin
      await connection.query(
        'INSERT INTO users (email, password_hash, role, first_name, last_name, is_active) VALUES (?, ?, "admin", ?, ?, TRUE)',
        [email, passwordHash, firstName, lastName]
      );
      console.log(`✓ Created new Admin user account for '${email}'.`);
    }

    console.log('===============================================================');
    console.log('🎉 Admin account setup complete! You can now log in.');
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ Failed to bootstrap admin user:', err.message);
  } finally {
    rl.close();
    await connection.end();
  }
}

runBootstrap();
