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
