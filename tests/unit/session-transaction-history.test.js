import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSessionTransactions,
  recordSessionTransaction,
  updateSessionTransaction,
} from '../../frontend/src/services/blockchain/session-transaction-history.js';
import { activityRows } from '../../frontend/src/components/activity-table.js';

test('records only initiated session transactions and updates observed result fields', () => {
  const preview = {
    payerAddress: '11111111111111111111111111111111',
    recipients: [
      { address: 'Vote111111111111111111111111111111111111111', amountLamports: '250000000' },
      { address: 'Stake11111111111111111111111111111111111111', amountLamports: '350000000' },
    ],
    totalLamports: '600000000',
  };
  const id = recordSessionTransaction(
    preview,
    { score: 30 },
    '2026-11-10T00:00:00.000Z',
  );
  updateSessionTransaction(id, {
    status: 'confirmed',
    signature: 'devnet-signature',
    explorerUrl: 'https://explorer.solana.com/tx/devnet-signature?cluster=devnet',
  });

  const [record] = getSessionTransactions();
  assert.equal(record.timestamp, '2026-11-10T00:00:00.000Z');
  assert.equal(record.recipients.length, 2);
  assert.equal(record.totalLamports, '600000000');
  assert.equal(record.riskScore, 30);
  assert.equal(record.status, 'confirmed');
  assert.equal(record.signature, 'devnet-signature');
  assert.match(activityRows([record]), /0\.6 SOL/);
  assert.match(activityRows([record]), /devnet-signature/);
  assert.match(activityRows([record], { status: 'failed' }), /No matching session transactions/);
});

test('exposes defensive copies and rejects unknown transaction updates', () => {
  const record = getSessionTransactions()[0];
  record.recipients[0].address = 'mutated';
  assert.notEqual(getSessionTransactions()[0].recipients[0].address, 'mutated');
  assert.throws(() => updateSessionTransaction(-1, { status: 'failed' }), /does not exist/);
  assert.throws(() => updateSessionTransaction(getSessionTransactions()[0].id, { status: 'unknown' }), /status is invalid/);
});

test('shows filter-specific empty feedback even before the first transaction', () => {
  assert.match(activityRows([], { search: 'recipient' }), /No matching session transactions/);
  assert.match(activityRows([], { status: 'rejected' }), /No matching session transactions/);
});
