import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDevnetConnection } from '../../blockchain/src/rpc/devnet-connection.js';

const enabled = process.env.RUN_DEVNET_TESTS === '1';

test(
  'live Devnet RPC returns a usable finalized blockhash and block height (read-only)',
  { skip: enabled ? false : 'Set RUN_DEVNET_TESTS=1 to run the read-only Devnet check.' },
  async () => {
    const connection = getDevnetConnection();
    const [{ blockhash, lastValidBlockHeight }, blockHeight] = await Promise.all([
      connection.getLatestBlockhash('finalized'),
      connection.getBlockHeight('finalized'),
    ]);

    assert.match(blockhash, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    assert.ok(['number', 'bigint'].includes(typeof lastValidBlockHeight));
    assert.ok(BigInt(lastValidBlockHeight) > 0n);
    assert.ok(['number', 'bigint'].includes(typeof blockHeight));
    assert.ok(Number.isInteger(Number(blockHeight)));
    assert.ok(BigInt(blockHeight) > 0n);
  },
);
