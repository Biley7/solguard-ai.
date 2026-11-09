import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSchema } from '../../backend/src/validators/schema-validator.js';

test('risk assessments cannot claim an unavailable score or category', () => {
  const base = {
    status: 'unavailable',
    score: null,
    category: 'unavailable',
    indicators: [],
    missingInformation: ['Balance could not be retrieved.'],
    recommendedAction: 'Retry the inspection.',
    assessedAt: '2026-11-08T00:00:00Z',
    disclaimer: 'Heuristic information only; this assessment does not guarantee wallet safety.',
  };

  assert.equal(validateSchema('RiskAssessment', base).valid, true);
  assert.equal(
    validateSchema('RiskAssessment', { ...base, score: 0 }).valid,
    false,
  );
  assert.equal(
    validateSchema('RiskAssessment', { ...base, indicators: [{ code: 'x' }] }).valid,
    false,
  );
});

test('transaction results require status-consistent signatures and confirmation states', () => {
  const confirmed = {
    status: 'confirmed',
    signature: 'test-signature',
    confirmationStatus: 'finalized',
    explorerUrl: 'https://explorer.solana.com/tx/test-signature?cluster=devnet',
    errorCode: null,
  };
  const rejected = {
    status: 'rejected',
    signature: null,
    confirmationStatus: null,
    explorerUrl: null,
    errorCode: 'USER_REJECTED',
  };

  assert.equal(validateSchema('TransactionResult', confirmed).valid, true);
  assert.equal(
    validateSchema('TransactionResult', { ...confirmed, signature: null }).valid,
    false,
  );
  assert.equal(validateSchema('TransactionResult', rejected).valid, true);
  assert.equal(
    validateSchema('TransactionResult', { ...rejected, signature: 'unexpected' }).valid,
    false,
  );
});
