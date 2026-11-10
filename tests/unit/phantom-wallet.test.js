import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  createPhantomWallet,
  getPhantomProvider,
  PhantomWalletError,
} from '../../frontend/src/services/wallet/phantom-wallet.js';

const firstAddress = new PublicKey(new Uint8Array(32).fill(1)).toBase58();
const secondAddress = new PublicKey(new Uint8Array(32).fill(2)).toBase58();

function createProvider(overrides = {}) {
  const events = new EventEmitter();
  return {
    isPhantom: true,
    publicKey: new PublicKey(firstAddress),
    connect: async () => ({ publicKey: new PublicKey(firstAddress) }),
    disconnect: async () => {},
    on: events.on.bind(events),
    emit: events.emit.bind(events),
    ...overrides,
  };
}

test('detects current and legacy Phantom provider locations without accepting other wallets', () => {
  const provider = createProvider();
  assert.equal(getPhantomProvider({ phantom: { solana: provider } }), provider);
  assert.equal(getPhantomProvider({ solana: provider }), provider);
  assert.equal(getPhantomProvider({ solana: { isPhantom: false } }), undefined);
  assert.equal(getPhantomProvider({}), undefined);
});

test('connects and returns the canonical public key', async () => {
  const provider = createProvider();
  const wallet = createPhantomWallet({ providerLookup: () => provider });
  const state = await wallet.connect();

  assert.deepEqual(state, { status: 'connected', address: firstAddress });
});

test('reports Phantom unavailable and wallet connection rejection distinctly', async () => {
  const missingWallet = createPhantomWallet({ providerLookup: () => undefined });
  await assert.rejects(missingWallet.connect(), { code: 'PROVIDER_UNAVAILABLE' });

  const rejectedProvider = createProvider({
    connect: async () => {
      throw Object.assign(new Error('User rejected'), { code: 4001 });
    },
  });
  const rejectedWallet = createPhantomWallet({ providerLookup: () => rejectedProvider });
  await assert.rejects(rejectedWallet.connect(), (error) => (
    error instanceof PhantomWalletError && error.code === 'USER_REJECTED'
  ));
});

test('restores a previously trusted connection without prompting for first-time approval', async () => {
  let connectOptions;
  const provider = createProvider({
    connect: async (options) => {
      connectOptions = options;
      return { publicKey: new PublicKey(firstAddress) };
    },
  });
  const wallet = createPhantomWallet({ providerLookup: () => provider });

  assert.deepEqual(await wallet.restore(), { status: 'connected', address: firstAddress });
  assert.deepEqual(connectOptions, { onlyIfTrusted: true });

  const notTrusted = createPhantomWallet({
    providerLookup: () => createProvider({
      connect: async () => {
        throw Object.assign(new Error('Not trusted'), { code: 4001 });
      },
    }),
  });
  assert.equal(await notTrusted.restore(), null);
});

test('publishes account changes and wallet disconnection events', async () => {
  const provider = createProvider();
  const wallet = createPhantomWallet({ providerLookup: () => provider });
  const states = [];
  wallet.subscribe((state) => states.push(state));
  await wallet.connect();

  provider.emit('accountChanged', new PublicKey(secondAddress));
  provider.emit('disconnect');

  assert.deepEqual(states, [
    { status: 'connected', address: firstAddress },
    { status: 'connected', address: secondAddress },
    { status: 'disconnected', address: null },
  ]);
});

test('disconnect invokes only Phantom disconnect and clears the connection state', async () => {
  let disconnectCalls = 0;
  const provider = createProvider({
    disconnect: async () => {
      disconnectCalls += 1;
    },
  });
  const wallet = createPhantomWallet({ providerLookup: () => provider });

  await wallet.connect();
  assert.deepEqual(await wallet.disconnect(), { status: 'disconnected', address: null });
  assert.equal(disconnectCalls, 1);
});

test('signs only when explicitly requested and bound to the currently connected account', async () => {
  let signedTransaction;
  const provider = createProvider({
    signTransaction: async (transaction) => {
      signedTransaction = transaction;
      return transaction;
    },
  });
  const wallet = createPhantomWallet({ providerLookup: () => provider });
  await wallet.connect();

  const transaction = { message: 'unsigned transaction' };
  assert.equal(await wallet.signTransaction(transaction, firstAddress), transaction);
  assert.equal(signedTransaction, transaction);
  await assert.rejects(wallet.signTransaction(transaction, secondAddress), {
    code: 'ACCOUNT_CHANGED',
  });
});

test('reports Phantom signing rejection and missing signing capability', async () => {
  const rejectingWallet = createPhantomWallet({
    providerLookup: () => createProvider({
      signTransaction: async () => {
        throw Object.assign(new Error('User rejected the request'), { code: 4001 });
      },
    }),
  });
  await rejectingWallet.connect();
  await assert.rejects(rejectingWallet.signTransaction({}, firstAddress), {
    code: 'USER_REJECTED',
  });

  const unsupportedWallet = createPhantomWallet({ providerLookup: () => createProvider() });
  await unsupportedWallet.connect();
  await assert.rejects(unsupportedWallet.signTransaction({}, firstAddress), {
    code: 'SIGNING_UNAVAILABLE',
  });
});
