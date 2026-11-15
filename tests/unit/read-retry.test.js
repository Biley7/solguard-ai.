import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retryRead } from '../../blockchain/src/rpc/read-retry.js';

test('retries a transient read failure once and returns the successful value', async () => {
  let attempts = 0;
  const result = await retryRead(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('transient RPC failure');
    return 'balance';
  }, { baseDelayMs: 0 });

  assert.equal(result, 'balance');
  assert.equal(attempts, 2);
});

test('stops after the bounded attempt count and rethrows the last error', async () => {
  let attempts = 0;
  await assert.rejects(
    retryRead(async () => {
      attempts += 1;
      throw new Error(`failure ${attempts}`);
    }, { attempts: 3, baseDelayMs: 0 }),
    /failure 3/,
  );
  assert.equal(attempts, 3);
});

test('rejects invalid retry configuration before invoking the operation', async () => {
  for (const options of [
    { attempts: 0 },
    { attempts: 4 },
    { baseDelayMs: -1 },
  ]) {
    let calls = 0;
    await assert.rejects(
      retryRead(async () => { calls += 1; }, options),
      RangeError,
    );
    assert.equal(calls, 0);
  }
});
