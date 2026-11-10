import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretNaturalLanguage } from '../../backend/src/services/gemini/intent-interpreter.js';

const firstAddress = '11111111111111111111111111111111';
const secondAddress = 'Stake11111111111111111111111111111111111111';

function candidate(overrides = {}) {
  return {
    status: 'ready',
    intent: 'transfer',
    distribution: 'explicit',
    totalAmountSol: '0.25',
    recipients: [{ address: firstAddress, amountSol: '0.25' }],
    memo: '',
    explanation: 'Send 0.25 SOL to the stated recipient.',
    missingInformation: [],
    clarificationQuestion: '',
    ...overrides,
  };
}

function geminiFetch(data) {
  return async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
  }), { status: 200 });
}

test('uses deterministic fallback for a grounded single transfer when Gemini is not configured', async () => {
  const result = await interpretNaturalLanguage(
    `Send 0.25 SOL to ${firstAddress} for graphic design work.`,
    { apiKey: '' },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'fallback');
  assert.equal(result.fallbackReason, 'not_configured');
  assert.deepEqual(result.intent.recipients, [{
    address: firstAddress,
    amountLamports: '250000000',
  }]);
});

test('fallback performs exact equal splits for explicit addresses', async () => {
  const result = await interpretNaturalLanguage(
    `Split 0.6 SOL equally between ${firstAddress} and ${secondAddress}.`,
    { apiKey: '' },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.distribution, 'equal');
  assert.equal(result.totalLamports, '600000000');
  assert.deepEqual(result.intent.recipients.map(({ amountLamports }) => amountLamports), [
    '300000000',
    '300000000',
  ]);
});

test('fallback validates an explicitly stated total for individually priced recipients', async () => {
  const result = await interpretNaturalLanguage(
    `Send 1 SOL total: 0.4 SOL to ${firstAddress} and 0.6 SOL to ${secondAddress}.`,
    { apiKey: '' },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.totalLamports, '1000000000');
  assert.deepEqual(result.intent.recipients.map(({ amountLamports }) => amountLamports), [
    '400000000',
    '600000000',
  ]);
});

test('Gemini structured output is accepted only when recipient and amounts are grounded', async () => {
  const result = await interpretNaturalLanguage(
    `Split 0.6 SOL equally between ${firstAddress} and ${secondAddress}.`,
    {
      apiKey: 'test-key',
      fetchImpl: geminiFetch(candidate({
        distribution: 'equal',
        totalAmountSol: '0.6',
        recipients: [
          { address: firstAddress, amountSol: '0.3' },
          { address: secondAddress, amountSol: '0.3' },
        ],
      })),
    },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'gemini');
  assert.deepEqual(result.intent.recipients.map(({ amountLamports }) => amountLamports), [
    '300000000',
    '300000000',
  ]);
});

test('replaces a Gemini-invented recipient with the grounded fallback result', async () => {
  const result = await interpretNaturalLanguage(
    `Send 0.25 SOL to ${firstAddress}.`,
    {
      apiKey: 'test-key',
      fetchImpl: geminiFetch(candidate({
        recipients: [{ address: secondAddress, amountSol: '0.25' }],
      })),
    },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'fallback');
  assert.equal(result.intent.recipients[0].address, firstAddress);
});

test('recomputes invalid equal-split arithmetic using the deterministic fallback', async () => {
  const result = await interpretNaturalLanguage(
    `Split 0.6 SOL equally between ${firstAddress} and ${secondAddress}.`,
    {
      apiKey: 'test-key',
      fetchImpl: geminiFetch(candidate({
        distribution: 'equal',
        totalAmountSol: '0.6',
        recipients: [
          { address: firstAddress, amountSol: '0.2' },
          { address: secondAddress, amountSol: '0.4' },
        ],
      })),
    },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.intent.recipients.map(({ amountLamports }) => amountLamports), [
    '300000000',
    '300000000',
  ]);
});

test('requests missing addresses instead of inventing recipients', async () => {
  const result = await interpretNaturalLanguage(
    'Split 0.6 SOL equally between two wallets.',
    { apiKey: '' },
  );

  assert.equal(result.status, 'clarification');
  assert.equal(result.intent, null);
  assert.ok(result.missingInformation.some((item) => item.includes('address')));
});

test('does not extract an address from inside a longer Base58 token', async () => {
  const result = await interpretNaturalLanguage(
    `Send 0.25 SOL to ${'A'.repeat(14)}${firstAddress}.`,
    { apiKey: '' },
  );

  assert.equal(result.status, 'clarification');
  assert.ok(result.missingInformation.some((item) => item.includes('address')));
});

test('falls back transparently when Gemini cannot be reached', async () => {
  const result = await interpretNaturalLanguage(
    `Send 0.25 SOL to ${firstAddress}.`,
    { apiKey: 'test-key', fetchImpl: async () => { throw new Error('offline'); } },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'fallback');
  assert.equal(result.fallbackReason, 'provider_unavailable_or_response_unusable');
});

test('does not accept a model-created memo that is absent from the prompt', async () => {
  const result = await interpretNaturalLanguage(
    `Send 0.25 SOL to ${firstAddress}.`,
    {
      apiKey: 'test-key',
      fetchImpl: geminiFetch(candidate({ memo: 'Invoice payment' })),
    },
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'fallback');
  assert.equal(result.memo, null);
});
