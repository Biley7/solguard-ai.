import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IntentValidationError,
  validateIntentCandidate,
  validateTransactionIntent,
} from '../../backend/src/validators/intent.js';

const publicKey = '11111111111111111111111111111111';

test('converts exact decimal SOL strings to integer lamports', () => {
  const intent = validateIntentCandidate({
    recipients: [{ address: publicKey, amountSol: '0.000000001' }],
  });

  assert.deepEqual(intent, {
    network: 'devnet',
    recipients: [{ address: publicKey, amountLamports: '1' }],
  });
});

test('rejects numeric, zero, over-precision, and out-of-range AI amounts', () => {
  for (const amountSol of [0.1, '0', '0.0000000001', '18446744073.709551616']) {
    assert.throws(
      () => validateIntentCandidate({ recipients: [{ address: publicKey, amountSol }] }),
      IntentValidationError,
    );
  }
});

test('rejects malformed or non-canonical recipient public keys', () => {
  assert.throws(
    () => validateIntentCandidate({
      recipients: [{ address: '0'.repeat(32), amountSol: '1' }],
    }),
    IntentValidationError,
  );
});

test('accepts five recipients and rejects six', () => {
  const recipients = Array.from({ length: 5 }, () => ({
    address: publicKey,
    amountSol: '1',
  }));
  assert.equal(validateIntentCandidate({ recipients }).recipients.length, 5);
  assert.throws(
    () => validateIntentCandidate({ recipients: [...recipients, recipients[0]] }),
    IntentValidationError,
  );
});

test('rejects aggregate transfer amounts above u64 lamports', () => {
  const recipients = [
    { address: publicKey, amountSol: '18446744073.709551615' },
    { address: publicKey, amountSol: '0.000000001' },
  ];

  assert.throws(
    () => validateIntentCandidate({ recipients }),
    (error) => error instanceof IntentValidationError
      && error.issues[0]?.reason === 'total_amount_out_of_range',
  );
});

test('rejects non-Devnet and semantically invalid normalized intents', () => {
  assert.throws(
    () => validateTransactionIntent({
      network: 'mainnet-beta',
      recipients: [{ address: publicKey, amountLamports: '1' }],
    }),
    IntentValidationError,
  );
  assert.throws(
    () => validateTransactionIntent({
      network: 'devnet',
      recipients: [{ address: publicKey, amountLamports: '18446744073709551616' }],
    }),
    IntentValidationError,
  );
});
