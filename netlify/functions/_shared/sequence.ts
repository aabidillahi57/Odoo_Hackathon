import { PoolConnection } from 'mysql2/promise';

/**
 * Concurrency-Safe Subscription Number Generator
 *
 * Implements requirement: SUB-YYYY-XXXX (e.g., SUB-2026-0001)
 *
 * Characteristics:
 * 1. Uses the current calendar year (or supplied year).
 * 2. Generated entirely on the server; never trusts client-supplied numbers.
 * 3. Concurrency-safe: uses row-level locking (`FOR UPDATE`) within an active database transaction.
 * 4. Strictly avoids MAX(id) + 1 patterns which cause race conditions under concurrent requests.
 * 5. Sequence numbers are permanently consumed; closed or deleted subscriptions do not cause reuse.
 */
export async function generateSubscriptionNumber(
  connection: PoolConnection,
  customYear?: number
): Promise<string> {
  const year = customYear || new Date().getFullYear();

  // 1. Lock the sequence record for the current year
  const [rows]: any = await connection.execute(
    'SELECT last_number FROM subscription_sequences WHERE sequence_year = ? FOR UPDATE;',
    [year]
  );

  let seqNumber = 1;

  if (rows && rows.length > 0) {
    seqNumber = Number(rows[0].last_number) + 1;
    await connection.execute(
      'UPDATE subscription_sequences SET last_number = ?, updated_at = NOW() WHERE sequence_year = ?;',
      [seqNumber, year]
    );
  } else {
    // First sequence generated for this calendar year
    await connection.execute(
      'INSERT INTO subscription_sequences (sequence_year, last_number, updated_at) VALUES (?, 1, NOW());',
      [year]
    );
    seqNumber = 1;
  }

  // Format as SUB-YYYY-XXXX (4-digit zero padded, expanding if count exceeds 9999)
  const formattedSeq = String(seqNumber).padStart(4, '0');
  return `SUB-${year}-${formattedSeq}`;
}

/**
 * Concurrency-Safe Invoice Number Generator
 *
 * Implements requirement: INV-YYYY-XXXX (e.g., INV-2026-0001)
 *
 * Characteristics:
 * 1. Uses the current calendar year (or supplied year).
 * 2. Generated entirely on the server; never trusts client-supplied numbers.
 * 3. Concurrency-safe: uses row-level locking (`FOR UPDATE`) within an active database transaction.
 * 4. Strictly avoids MAX(id) + 1 patterns which cause race conditions under concurrent requests.
 * 5. Sequence numbers are permanently consumed; cancelled or deleted invoices do not cause reuse.
 */
export async function generateInvoiceNumber(
  connection: PoolConnection,
  customYear?: number
): Promise<string> {
  const year = customYear || new Date().getFullYear();

  // 1. Lock the sequence record for the current year
  const [rows]: any = await connection.execute(
    'SELECT last_number FROM invoice_sequences WHERE sequence_year = ? FOR UPDATE;',
    [year]
  );

  let seqNumber = 1;

  if (rows && rows.length > 0) {
    seqNumber = Number(rows[0].last_number) + 1;
    await connection.execute(
      'UPDATE invoice_sequences SET last_number = ?, updated_at = NOW() WHERE sequence_year = ?;',
      [seqNumber, year]
    );
  } else {
    // First sequence generated for this calendar year
    await connection.execute(
      'INSERT INTO invoice_sequences (sequence_year, last_number, updated_at) VALUES (?, 1, NOW());',
      [year]
    );
    seqNumber = 1;
  }

  // Format as INV-YYYY-XXXX (4-digit zero padded, expanding if count exceeds 9999)
  const formattedSeq = String(seqNumber).padStart(4, '0');
  return `INV-${year}-${formattedSeq}`;
}


