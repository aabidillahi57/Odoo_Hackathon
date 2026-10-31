#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isSeed = process.argv.includes('--seed');

async function runMigration() {
  console.log('---------------------------------------------------------');
  console.log('Brightloop Software - Database Schema Migration Runner');
  console.log('---------------------------------------------------------');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'brightloop_subscriptions';
  const ssl = process.env.DB_SSL === 'true';

  if (!process.env.DB_PASSWORD && !process.env.DATABASE_URL) {
    console.warn('⚠️  Notice: DB_PASSWORD is not set in your .env file.');
    console.warn('   If your MySQL requires a password, add DB_PASSWORD to your .env file.');
  }

  console.log(`Connecting to MySQL at ${host}:${port} as '${user}'...`);

  let connection;
  try {
    // 1. Initial connection without database selection to ensure database exists
    const initialConfig = process.env.DATABASE_URL
      ? process.env.DATABASE_URL
      : {
          host,
          port,
          user,
          password,
          ssl: ssl ? { rejectUnauthorized: true } : undefined,
          multipleStatements: true,
        };

    connection = await mysql.createConnection(initialConfig);
    console.log('✓ Successfully connected to MySQL server.');

    // Ensure database exists
    if (!process.env.DATABASE_URL) {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      console.log(`✓ Database '${database}' verified/created.`);
      await connection.changeUser({ database });
    }

    // 2. Read and apply schema.sql
    const schemaPath = path.join(rootDir, 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }

    console.log('Applying database schema from database/schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(schemaSql);
    console.log('✓ Schema applied successfully.');

    // 2b. Apply incremental column updates for existing databases (repeatable & safe)
    console.log('Checking and applying schema migrations...');
    const [subCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions';
    `);
    const subColNames = subCols.map((c) => c.COLUMN_NAME);

    if (!subColNames.includes('billing_interval')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN billing_interval ENUM('daily', 'weekly', 'monthly', 'yearly') NULL;");
    }
    if (!subColNames.includes('billing_interval_count')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN billing_interval_count INT NOT NULL DEFAULT 1;");
    }
    if (!subColNames.includes('paused_at')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN paused_at DATETIME NULL;");
    }
    if (!subColNames.includes('resumed_at')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN resumed_at DATETIME NULL;");
    }
    if (!subColNames.includes('closed_at')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN closed_at DATETIME NULL;");
    }
    if (!subColNames.includes('cancellation_reason')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN cancellation_reason TEXT NULL;");
    }
    if (!subColNames.includes('created_by')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN created_by INT NULL;");
    }
    if (!subColNames.includes('updated_by')) {
      await connection.query("ALTER TABLE subscriptions ADD COLUMN updated_by INT NULL;");
    }

    // Ensure plan_id and next_billing_date allow NULL for draft/custom subscriptions
    try {
      await connection.query("ALTER TABLE subscriptions MODIFY COLUMN plan_id INT NULL;");
      await connection.query("ALTER TABLE subscriptions MODIFY COLUMN next_billing_date DATE NULL;");
    } catch {
      // Ignore if already modified or constraint exists
    }

    const [lineCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_lines';
    `);
    const lineColNames = lineCols.map((c) => c.COLUMN_NAME);

    if (!lineColNames.includes('description')) {
      await connection.query("ALTER TABLE subscription_lines ADD COLUMN description VARCHAR(255) NULL;");
    }
    if (!lineColNames.includes('tax_rate')) {
      await connection.query("ALTER TABLE subscription_lines ADD COLUMN tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00;");
    }

    // Part 7: Invoicing & Taxes incremental migrations
    const [taxCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'taxes';
    `);
    const taxColNames = taxCols.map((c) => c.COLUMN_NAME);
    if (!taxColNames.includes('description')) {
      await connection.query("ALTER TABLE taxes ADD COLUMN description VARCHAR(255) NULL;");
    }

    const [invCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices';
    `);
    const invColNames = invCols.map((c) => c.COLUMN_NAME);
    if (!invColNames.includes('delivery_status')) {
      await connection.query("ALTER TABLE invoices ADD COLUMN delivery_status ENUM('pending', 'sent', 'failed') NULL DEFAULT NULL;");
    }
    if (!invColNames.includes('delivery_error')) {
      await connection.query("ALTER TABLE invoices ADD COLUMN delivery_error VARCHAR(255) NULL;");
    }
    if (!invColNames.includes('cancellation_reason')) {
      await connection.query("ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT NULL;");
    }
    if (!invColNames.includes('confirmed_at')) {
      await connection.query("ALTER TABLE invoices ADD COLUMN confirmed_at DATETIME NULL;");
    }
    if (!invColNames.includes('cancelled_at')) {
      await connection.query("ALTER TABLE invoices ADD COLUMN cancelled_at DATETIME NULL;");
    }
    if (!invColNames.includes('created_by')) {
      await connection.query("ALTER TABLE invoices ADD COLUMN created_by INT NULL;");
      try {
        await connection.query("ALTER TABLE invoices ADD CONSTRAINT fk_invoices_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;");
      } catch {
        // Ignore if constraint exists
      }
    }

    // Add unique constraint for subscription idempotency if not present
    try {
      const [invIndexes] = await connection.query(`
        SHOW INDEX FROM invoices WHERE Key_name = 'uq_invoice_subscription_period';
      `);
      if (invIndexes.length === 0) {
        await connection.query("ALTER TABLE invoices ADD CONSTRAINT uq_invoice_subscription_period UNIQUE (subscription_id, billing_period_start, billing_period_end);");
      }
    } catch {
      // Ignore if index exists
    }

    const [invLineCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice_lines';
    `);
    const invLineColNames = invLineCols.map((c) => c.COLUMN_NAME);
    if (!invLineColNames.includes('tax_name')) {
      await connection.query("ALTER TABLE invoice_lines ADD COLUMN tax_name VARCHAR(100) NULL;");
    }

    // Part 8: Discounts & Payments incremental migrations
    const [discountCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'discounts';
    `);
    const discountColNames = discountCols.map((c) => c.COLUMN_NAME);
    if (!discountColNames.includes('name')) {
      await connection.query("ALTER TABLE discounts ADD COLUMN name VARCHAR(255) NULL;");
    }
    if (!discountColNames.includes('archived_at')) {
      await connection.query("ALTER TABLE discounts ADD COLUMN archived_at DATETIME NULL;");
    }

    const [usageCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'discount_usages';
    `);
    const usageColNames = usageCols.map((c) => c.COLUMN_NAME);
    if (!usageColNames.includes('status')) {
      await connection.query("ALTER TABLE discount_usages ADD COLUMN status ENUM('reserved', 'redeemed', 'released') NOT NULL DEFAULT 'redeemed';");
    }
    if (!usageColNames.includes('released_at')) {
      await connection.query("ALTER TABLE discount_usages ADD COLUMN released_at DATETIME NULL;");
    }

    const [paymentCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments';
    `);
    const paymentColNames = paymentCols.map((c) => c.COLUMN_NAME);
    if (!paymentColNames.includes('status')) {
      await connection.query("ALTER TABLE payments ADD COLUMN status ENUM('completed', 'voided') NOT NULL DEFAULT 'completed';");
    }
    if (!paymentColNames.includes('recorded_by')) {
      await connection.query("ALTER TABLE payments ADD COLUMN recorded_by INT NULL;");
      try {
        await connection.query("ALTER TABLE payments ADD CONSTRAINT fk_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL;");
      } catch {
        // Ignore if constraint exists
      }
    }
    if (!paymentColNames.includes('voided_at')) {
      await connection.query("ALTER TABLE payments ADD COLUMN voided_at DATETIME NULL;");
    }
    if (!paymentColNames.includes('voided_by')) {
      await connection.query("ALTER TABLE payments ADD COLUMN voided_by INT NULL;");
      try {
        await connection.query("ALTER TABLE payments ADD CONSTRAINT fk_payments_voided_by FOREIGN KEY (voided_by) REFERENCES users (id) ON DELETE SET NULL;");
      } catch {
        // Ignore if constraint exists
      }
    }
    if (!paymentColNames.includes('void_reason')) {
      await connection.query("ALTER TABLE payments ADD COLUMN void_reason TEXT NULL;");
    }

    // Ensure payment_sequences table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_sequences (
        sequence_year INT PRIMARY KEY,
        last_number INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✓ Incremental schema migrations verified.');

    // 3. Optional Seed Data
    if (isSeed) {
      const seedPath = path.join(rootDir, 'database', 'seed.sql');
      if (fs.existsSync(seedPath)) {
        console.log('Applying development seed data from database/seed.sql...');
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await connection.query(seedSql);
        console.log('✓ Development seed data inserted successfully.');
      }
    }

    // Verify created tables
    const [rows] = await connection.query('SHOW TABLES;');
    const tableNames = rows.map((r) => Object.values(r)[0]);
    console.log(`✓ Verified ${tableNames.length} tables in database:`);
    console.log(`  ${tableNames.join(', ')}`);

    console.log('---------------------------------------------------------');
    console.log('🎉 Migration completed successfully!');
    console.log('---------------------------------------------------------');
  } catch (error) {
    console.error('\n❌ Migration failed:');
    if (error.code === 'ECONNREFUSED') {
      console.error(`Could not connect to MySQL at ${host}:${port}. Is MySQL running locally?`);
      console.error('To start MySQL:');
      console.error('  macOS (Homebrew): brew services start mysql');
      console.error('  Docker: docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=yourpass mysql:8.0');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`Access denied for user '${user}'. Please check DB_USER and DB_PASSWORD in your .env file.`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
