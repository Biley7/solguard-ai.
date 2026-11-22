import assert from 'node:assert/strict';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { test } from 'node:test';
import {
  executePreparedTransfer,
  TransactionExecutionError,
} from '../../blockchain/src/transactions/transaction-executor.js';

async function createPreparedTransaction({ recipientCount = 1 } = {}) {
  const payer = await Keypair.generate();
  const recipients = await Promise.all(
    Array.from({ length: recipientCount }, async () => Keypair.generate()),
  );
  const memoText = 'SOLGUARD_V1 | OBSERVED_RISK: LOW 0/100 | HEURISTIC';
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    blockhash: '11111111111111111111111111111111',
    lastValidBlockHeight: 123,
  });
  transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0n }));
  for (const recipient of recipients) {
    transaction.add(SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1n,
    }));
  }
  transaction.add(new TransactionInstruction({
    keys: [],
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    data: new TextEncoder().encode(memoText),
  }));
  return {
    payer,
    prepared: {
      transaction,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight: 123,
      preview: {
        network: 'devnet',
        payerAddress: payer.publicKey.toBase58(),
        recipients: recipients.map(({ publicKey }) => ({
          address: publicKey.toBase58(),
          amountLamports: '1',
        })),
        totalLamports: String(recipientCount),
        feeLamports: '1',
        memoText,
      },
    },
  };
}

async function signedCopy(transaction, payer) {
  const signed = new Transaction();
  signed.feePayer = transaction.feePayer;
  signed.recentBlockhash = transaction.recentBlockhash;
  signed.lastValidBlockHeight = transaction.lastValidBlockHeight;
  signed.instructions = [...transaction.instructions];
  await signed.partialSign(payer);
  return signed;
}

function fakeConnection({ confirmation, sendError } = {}) {
  const calls = [];
  return {
    calls,
    async getBlockHeight() {
      calls.push(['blockHeight']);
      return 100;
    },
    async getBalance() {
      calls.push(['balance']);
      return 1_000_000_000;
    },
    async simulateTransaction(message, options) {
      calls.push(['simulate', message, options]);
      return { value: { err: null } };
    },
    async sendRawTransaction(raw, options) {
      if (raw instanceof Promise || typeof raw?.then === 'function') {
        throw new TypeError('sendRawTransaction expected raw bytes, received a Promise');
      }
      if (!(raw instanceof Uint8Array)) {
        throw new TypeError('sendRawTransaction expected Uint8Array or Buffer');
      }
      calls.push(['send', raw, options]);
      if (sendError) throw sendError;
      return 'devnet-signature';
    },
    async confirmTransaction(strategy, commitment) {
      calls.push(['confirm', strategy, commitment]);
      if (confirmation instanceof Error) throw confirmation;
      if (typeof confirmation === 'function') return confirmation();
      return confirmation ?? { context: { slot: 1 }, value: { err: null } };
    },
    async getParsedTransaction(signature, options) {
      calls.push(['getParsedTransaction', signature, options]);
      return null;
    },
  };
}

test('submits only the exact Phantom-signed transaction to the injected Devnet RPC and confirms it', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const connection = fakeConnection();
  connection.getParsedTransaction = async (signature, options) => {
    connection.calls.push(['getParsedTransaction', signature, options]);
    return {
      meta: { err: null },
      transaction: {
        message: {
          instructions: [{
            program: 'spl-memo',
            parsed: prepared.preview.memoText,
          }],
        },
      },
    };
  };
  const result = await executePreparedTransfer(prepared, {
    signTransaction: async (transaction) => signedCopy(transaction, payer),
    connection,
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.memoVerification, 'verified');
  assert.equal(result.signature, 'devnet-signature');
  assert.equal(result.explorerUrl, 'https://explorer.solana.com/tx/devnet-signature?cluster=devnet');
  assert.equal(connection.calls.filter(([name]) => name === 'send').length, 1);
  assert.equal(connection.calls.filter(([name]) => name === 'confirm').length, 1);
  assert.equal(connection.calls.filter(([name]) => name === 'simulate').length, 1);
  assert.ok(connection.calls.find(([name]) => name === 'simulate')[1] instanceof Transaction);
  assert.equal(connection.calls.filter(([name]) => name === 'getParsedTransaction').length, 1);
});

test('reports memo mismatch and unavailable RPC verification without changing the confirmed result', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const mismatchConnection = fakeConnection();
  mismatchConnection.getParsedTransaction = async () => ({
    meta: { err: null },
    transaction: {
      message: { instructions: [{ program: 'spl-memo', parsed: 'different memo' }] },
    },
  });
  const mismatch = await executePreparedTransfer(prepared, {
    signTransaction: async (transaction) => signedCopy(transaction, payer),
    connection: mismatchConnection,
  });
  assert.equal(mismatch.status, 'confirmed');
  assert.equal(mismatch.memoVerification, 'not_verified');

  const unavailableConnection = fakeConnection();
  unavailableConnection.getParsedTransaction = async () => {
    throw new Error('RPC unavailable');
  };
  const unavailable = await executePreparedTransfer(prepared, {
    signTransaction: async (transaction) => signedCopy(transaction, payer),
    connection: unavailableConnection,
  });
  assert.equal(unavailable.status, 'confirmed');
  assert.equal(unavailable.memoVerification, 'unavailable');
});

test('does not submit when Phantom signing is rejected', async () => {
  const { prepared } = await createPreparedTransaction();
  const connection = fakeConnection();
  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async () => { throw Object.assign(new Error('Rejected by user'), { code: 4001 }); },
      connection,
    }),
    (error) => error instanceof TransactionExecutionError && error.code === 'USER_REJECTED',
  );
  assert.equal(connection.calls.some(([name]) => name === 'send'), false);
});

test('rejects a prepared transaction mutated after the preview was reviewed', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const extraRecipient = await Keypair.generate();
  let signCalls = 0;
  prepared.transaction.add(SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: extraRecipient.publicKey,
    lamports: 1n,
  }));

  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async () => { signCalls += 1; },
      connection: fakeConnection(),
    }),
    (error) => error.code === 'TRANSACTION_PREVIEW_MISMATCH',
  );
  assert.equal(signCalls, 0);
});

test('rejects a preview whose total no longer matches its recipients before signing', async () => {
  const { prepared } = await createPreparedTransaction();
  let signCalls = 0;
  prepared.preview.totalLamports = '2';

  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async () => { signCalls += 1; },
      connection: fakeConnection(),
    }),
    (error) => error.code === 'INVALID_EXECUTION_REQUEST',
  );
  assert.equal(signCalls, 0);
});

test('does not submit if the wallet modifies the reviewed message', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const connection = fakeConnection();
  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async (transaction) => {
        const signed = new Transaction();
        signed.feePayer = transaction.feePayer;
        signed.recentBlockhash = transaction.recentBlockhash;
        signed.lastValidBlockHeight = transaction.lastValidBlockHeight;
        signed.instructions = [...transaction.instructions];
        const newRecipient = await Keypair.generate();
        signed.add(SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: newRecipient.publicKey,
          lamports: 2n,
        }));
        await signed.partialSign(payer);
        return signed;
      },
      connection,
    }),
    (error) => error.code === 'TRANSACTION_MODIFIED',
  );
  assert.equal(connection.calls.some(([name]) => name === 'send'), false);
});

test('does not request a Phantom signature after the prepared blockhash expires', async () => {
  const { prepared } = await createPreparedTransaction();
  let signCalls = 0;
  const connection = fakeConnection();
  connection.getBlockHeight = async () => 123;
  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async () => { signCalls += 1; },
      connection,
    }),
    (error) => error.code === 'BLOCKHASH_EXPIRED',
  );
  assert.equal(signCalls, 0);
});

test('reports atomic multi-recipient failure with its signature and Devnet Explorer proof', async () => {
  const { payer, prepared } = await createPreparedTransaction({ recipientCount: 2 });
  assert.equal(prepared.transaction.instructions.filter(
    ({ programId }) => programId.equals(SystemProgram.programId),
  ).length, 2);
  const result = await executePreparedTransfer(prepared, {
    signTransaction: async (transaction) => signedCopy(transaction, payer),
    connection: fakeConnection({
      confirmation: { context: { slot: 1 }, value: { err: { InstructionError: [0, 'Custom'] } } },
    }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.signature, 'devnet-signature');
  assert.equal(result.confirmationStatus, 'failed');
  assert.equal(result.errorCode, 'TRANSACTION_FAILED');
  assert.equal(result.memoVerification, 'not_verified');
});

test('emits only real lifecycle checkpoints in execution order', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const events = [];
  const result = await executePreparedTransfer(prepared, {
    signTransaction: async (transaction) => signedCopy(transaction, payer),
    connection: fakeConnection(),
    onProgress: (event) => events.push(event.status),
  });

  assert.equal(result.status, 'confirmed');
  assert.deepEqual(events, [
    'preparing',
    'awaiting_approval',
    'submitted',
    'confirming',
    'confirmed',
  ]);
});

test('reports a rejected approval without claiming submission and isolates presentation errors', async () => {
  const { prepared } = await createPreparedTransaction();
  const connection = fakeConnection();
  const events = [];
  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async () => { throw Object.assign(new Error('Rejected by user'), { code: 4001 }); },
      connection,
      onProgress: (event) => {
        events.push(event.status);
        throw new Error('presentation failed');
      },
    }),
    (error) => error.code === 'USER_REJECTED',
  );

  assert.deepEqual(events, ['preparing', 'awaiting_approval', 'rejected']);
  assert.equal(connection.calls.some(([name]) => name === 'send'), false);
});

test('reports pending submission on confirmation timeout and safe submission failures', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const pending = await executePreparedTransfer(prepared, {
    signTransaction: async (transaction) => signedCopy(transaction, payer),
    connection: fakeConnection({ confirmation: () => new Promise(() => {}) }),
    timeoutMs: 1,
  });
  assert.equal(pending.status, 'submitted');
  assert.equal(pending.errorCode, 'CONFIRMATION_TIMEOUT');

  await assert.rejects(
    executePreparedTransfer(prepared, {
      signTransaction: async (transaction) => signedCopy(transaction, payer),
      connection: fakeConnection({ sendError: new Error('RPC unavailable') }),
    }),
    (error) => error.code === 'SUBMISSION_FAILED',
  );
});

test('accepts cross-bundle signed transaction that fails instanceof Transaction', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  const connection = fakeConnection();

  const result = await executePreparedTransfer(prepared, {
    signTransaction: async (tx) => {
      const realSigned = await signedCopy(tx, payer);
      const crossBundleTx = Object.assign(Object.create(null), {
        signature: realSigned.signature,
        signatures: realSigned.signatures,
        serializeMessage: () => realSigned.serializeMessage(),
        serialize: (config) => realSigned.serialize(config),
      });
      assert.equal(crossBundleTx instanceof Transaction, false);
      return crossBundleTx;
    },
    connection,
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.signature, 'devnet-signature');
});

test('properly awaits async serialize and supplies raw Uint8Array bytes to sendRawTransaction', async () => {
  const { payer, prepared } = await createPreparedTransaction();
  let sentBytes;
  const connection = fakeConnection();
  const originalSend = connection.sendRawTransaction;
  connection.sendRawTransaction = async (raw, options) => {
    assert.ok(!(raw instanceof Promise));
    assert.ok(raw instanceof Uint8Array);
    sentBytes = raw;
    return originalSend(raw, options);
  };

  const result = await executePreparedTransfer(prepared, {
    signTransaction: async (tx) => signedCopy(tx, payer),
    connection,
  });

  assert.equal(result.status, 'confirmed');
  assert.ok(sentBytes instanceof Uint8Array);
  assert.ok(sentBytes.length > 0);
});
