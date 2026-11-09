import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  fetchDevnetBalance,
  formatLamportsAsSol,
  WalletBalanceError,
} from '../../frontend/src/services/blockchain/wallet-balance.js';
import {
  SOLANA_COMMITMENT,
  SOLANA_NETWORK,
  SOLANA_RPC_URL,
} from '../../blockchain/src/config/network.js';

const address = new PublicKey(new Uint8Array(32).fill(7)).toBase58();

test('Solana network configuration is fixed to the Devnet endpoint', () => {
  assert.equal(SOLANA_NETWORK, 'devnet');
  assert.equal(SOLANA_RPC_URL, 'https://api.devnet.solana.com');
  assert.equal(SOLANA_COMMITMENT, 'confirmed');
});

test('formats lamports into exact SOL decimal text', () => {
  assert.equal(formatLamportsAsSol(1_250_000_001n), '1.250000001');
  assert.equal(formatLamportsAsSol(1_250_000_001), '1.250000001');
  assert.equal(formatLamportsAsSol(2_000_000_000), '2');
  assert.equal(formatLamportsAsSol(0), '0');
});

test('queries actual balance using the canonical public key at confirmed commitment', async () => {
  let args;
  const result = await fetchDevnetBalance(address, {
    getBalance: async (...callArgs) => {
      args = callArgs;
      return 1_234_000_000;
    },
  });

  assert.equal(args[0].toBase58(), address);
  assert.equal(args[1], SOLANA_COMMITMENT);
  assert.equal(result.lamports, 1_234_000_000n);
  assert.equal(result.sol, '1.234');
  assert.equal(result.network, 'devnet');
  assert.ok(Number.isFinite(Date.parse(result.observedAt)));
});

test('surfaces RPC failure and rejects invalid addresses or balances', async () => {
  await assert.rejects(
    fetchDevnetBalance(address, { getBalance: async () => { throw new Error('RPC offline'); } }),
    (error) => error instanceof WalletBalanceError && error.code === 'BALANCE_UNAVAILABLE',
  );
  await assert.rejects(
    fetchDevnetBalance('not-a-public-key', { getBalance: async () => 0 }),
    WalletBalanceError,
  );
  assert.throws(() => formatLamportsAsSol(-1n), WalletBalanceError);
  assert.throws(() => formatLamportsAsSol((1n << 64n)), WalletBalanceError);
  assert.throws(() => formatLamportsAsSol(Number.MAX_SAFE_INTEGER + 1), WalletBalanceError);
});
