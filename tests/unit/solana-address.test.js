import assert from 'node:assert/strict';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { test } from 'node:test';
import { isCanonicalSolanaAddress } from '../../frontend/src/utils/solana-address.js';

test('accepts canonical 32-byte Solana public keys without loading web3.js', async () => {
  for (let index = 0; index < 20; index += 1) {
    const keypair = await Keypair.generate();
    assert.equal(isCanonicalSolanaAddress(keypair.publicKey.toBase58()), true);
  }
  assert.equal(isCanonicalSolanaAddress(SystemProgram.programId.toBase58()), true);
  assert.equal(isCanonicalSolanaAddress('Stake11111111111111111111111111111111111111'), true);
});

test('rejects malformed, non-canonical, and wrong-length addresses', () => {
  for (const value of [
    '',
    'not-a-public-key',
    '0OIl',
    '1'.repeat(31),
    '1'.repeat(33),
    '11111111111111111111111111111111 ',
    ' 11111111111111111111111111111111',
    null,
    undefined,
    42,
  ]) {
    assert.equal(isCanonicalSolanaAddress(value), false);
  }
});
