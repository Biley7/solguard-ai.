import assert from 'node:assert/strict';
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { test } from 'node:test';
import {
  MEMO_PROGRAM_ADDRESS,
  TransactionPreparationError,
  prepareSolTransferTransaction,
} from '../../blockchain/src/transactions/transaction-builder.js';

const payer = '11111111111111111111111111111111';
const recipientOne = 'Stake11111111111111111111111111111111111111';
const recipientTwo = 'Vote111111111111111111111111111111111111111';
function recipientReport(address, { category = 'low', score = 0, status = 'assessed' } = {}) {
  return { address, riskAssessment: { status, category, score } };
}

function reportsFor(recipients) {
  return recipients.map(({ address }) => recipientReport(address));
}

function fakeConnection({
  balance = 1_000_000_000,
  fee = 5_000,
  accountInfo = null,
  simulationError = null,
  simulationReject = null,
} = {}) {
  const calls = [];
  return {
    calls,
    async getAccountInfo(address) {
      calls.push(['accountInfo', address.toBase58()]);
      return typeof accountInfo === 'function' ? accountInfo(address) : accountInfo;
    },
    async getBalance(address) {
      calls.push(['balance', address.toBase58()]);
      return balance;
    },
    async getBlockHeight() {
      calls.push(['blockHeight']);
      return 100;
    },
    async getLatestBlockhash() {
      calls.push(['blockhash']);
      return {
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 123,
      };
    },
    async getFeeForMessage(message) {
      calls.push(['fee', message]);
      return { value: fee };
    },
    async simulateTransaction(message, options) {
      calls.push(['simulate', message, options]);
      if (simulationReject) throw simulationReject;
      return { value: { err: simulationError, logs: simulationError ? ['Program failed'] : [] } };
    },
  };
}

function transferIntent(recipients = [{ address: recipientOne, amountLamports: '250000000' }]) {
  return { network: 'devnet', recipients };
}

test('builds one unsigned atomic transaction containing all transfers and the compact audit memo', async () => {
  const connection = fakeConnection();
  const prepared = await prepareSolTransferTransaction({
    intent: transferIntent([
      { address: recipientOne, amountLamports: '100000001' },
      { address: recipientTwo, amountLamports: '200000002' },
    ]),
    payerAddress: payer,
    recipientReports: reportsFor(transferIntent([
      { address: recipientOne, amountLamports: '100000001' },
      { address: recipientTwo, amountLamports: '200000002' },
    ]).recipients),
    connection,
    now: () => new Date('2026-11-10T00:00:00.000Z'),
  });

  assert.ok(prepared.transaction instanceof Transaction);
  assert.equal(prepared.transaction.instructions.length, 4);
  assert.deepEqual(
    prepared.transaction.instructions.map((instruction) => instruction.programId.toBase58()),
    [
      ComputeBudgetProgram.programId.toBase58(),
      SystemProgram.programId.toBase58(),
      SystemProgram.programId.toBase58(),
      MEMO_PROGRAM_ADDRESS,
    ],
  );
  assert.equal(prepared.transaction.instructions[3].programId.toBase58(), MEMO_PROGRAM_ADDRESS);
  assert.equal(new TextDecoder().decode(prepared.transaction.instructions[3].data), prepared.preview.memoText);
  assert.match(prepared.preview.memoText, /^SOLGUARD_V1 \| OBSERVED_RISK: LOW 0\/100 \| HEURISTIC$/);
  assert.equal(prepared.preview.totalLamports, '300000003');
  assert.equal(prepared.preview.feeLamports, '5000');
  assert.equal(prepared.preview.simulationStatus, 'passed');
  assert.equal(prepared.preview.network, 'devnet');
  assert.equal(prepared.transaction.signature, null);
  const simulationCall = connection.calls.find(([name]) => name === 'simulate');
  assert.ok(simulationCall);
  assert.ok(simulationCall[1] instanceof Transaction);
});

test('derives the memo risk from the actual recipient reports rather than a caller-supplied summary', async () => {
  const intent = transferIntent([
    { address: recipientOne, amountLamports: '100000001' },
    { address: recipientTwo, amountLamports: '200000002' },
  ]);
  const prepared = await prepareSolTransferTransaction({
    intent,
    payerAddress: payer,
    recipientReports: [
      recipientReport(recipientOne, { category: 'high', score: 72 }),
      recipientReport(recipientTwo, { category: 'low', score: 0 }),
    ],
    connection: fakeConnection(),
  });

  assert.equal(prepared.riskSummary.category, 'high');
  assert.equal(prepared.riskSummary.score, 72);
  assert.match(prepared.preview.memoText, /OBSERVED_RISK: HIGH 72\/100/);
});

test('rejects missing, mismatched, or unassessed recipient reports before building a transaction', async () => {
  const intent = transferIntent([
    { address: recipientOne, amountLamports: '1' },
    { address: recipientTwo, amountLamports: '2' },
  ]);

  for (const recipientReports of [
    undefined,
    [recipientReport(recipientOne)],
    [recipientReport(recipientTwo), recipientReport(recipientOne)],
    [
      recipientReport(recipientOne, { status: 'unavailable', category: 'unavailable', score: null }),
      recipientReport(recipientTwo),
    ],
  ]) {
    await assert.rejects(
      prepareSolTransferTransaction({
        intent,
        payerAddress: payer,
        recipientReports,
        connection: fakeConnection(),
      }),
      (error) => error.code === 'RISK_UNAVAILABLE',
    );
  }
});

test('normalizes bigint blockhash expiry returned by web3.js v3', async () => {
  const connection = fakeConnection();
  connection.getLatestBlockhash = async () => ({
    blockhash: '11111111111111111111111111111111',
    lastValidBlockHeight: 123n,
  });
  const prepared = await prepareSolTransferTransaction({
    intent: transferIntent(),
    payerAddress: payer,
    recipientReports: reportsFor(transferIntent().recipients),
    connection,
  });

  assert.equal(prepared.lastValidBlockHeight, 123);
  assert.equal(prepared.transaction.lastValidBlockHeight, 123);
});

test('supports a one-recipient transfer and rejects malformed network, quantities, recipients, and self-transfer', async () => {
  const prepared = await prepareSolTransferTransaction({
    intent: transferIntent(),
    payerAddress: payer,
    recipientReports: reportsFor(transferIntent().recipients),
    connection: fakeConnection(),
  });
  assert.equal(prepared.transaction.instructions.length, 3);
  assert.equal(prepared.transaction.instructions[0].programId.toBase58(), ComputeBudgetProgram.programId.toBase58());

  for (const intent of [
    { ...transferIntent(), network: 'mainnet-beta' },
    transferIntent([{ address: recipientOne, amountLamports: '0' }]),
    transferIntent([{ address: recipientOne, amountLamports: '01' }]),
    transferIntent(Array.from({ length: 6 }, () => ({ address: recipientOne, amountLamports: '1' }))),
    transferIntent([{ address: payer, amountLamports: '1' }]),
    transferIntent([
      { address: recipientOne, amountLamports: '1' },
      { address: recipientOne, amountLamports: '2' },
    ]),
  ]) {
    await assert.rejects(
      prepareSolTransferTransaction({
        intent,
        payerAddress: payer,
        recipientReports: reportsFor(intent.recipients),
        connection: fakeConnection(),
      }),
      TransactionPreparationError,
    );
  }
});

test('checks sender funds including the estimated fee before simulation', async () => {
  const connection = fakeConnection({ balance: 250_004_999, fee: 5_000 });
  await assert.rejects(
    prepareSolTransferTransaction({
      intent: transferIntent(),
      payerAddress: payer,
      recipientReports: reportsFor(transferIntent().recipients),
      connection,
    }),
    (error) => error.code === 'INSUFFICIENT_FUNDS',
  );
  assert.equal(connection.calls.some(([name]) => name === 'simulate'), false);
});

test('rejects program-owned destination accounts', async () => {
  const connection = fakeConnection({
    accountInfo: {
      owner: new PublicKey('Stake11111111111111111111111111111111111111'),
      executable: false,
    },
  });
  await assert.rejects(
    prepareSolTransferTransaction({
      intent: transferIntent(),
      payerAddress: payer,
      recipientReports: reportsFor(transferIntent().recipients),
      connection,
    }),
    (error) => error.code === 'UNSUPPORTED_DESTINATION',
  );
});

test('refuses unavailable risk or a failed simulation before a signing request can be prepared', async () => {
  await assert.rejects(
    prepareSolTransferTransaction({
      intent: transferIntent(),
      payerAddress: payer,
      recipientReports: [recipientReport(recipientOne, { status: 'unavailable', category: 'unavailable', score: null })],
      connection: fakeConnection(),
    }),
    (error) => error.code === 'RISK_UNAVAILABLE',
  );

  await assert.rejects(
    prepareSolTransferTransaction({
      intent: transferIntent(),
      payerAddress: payer,
      recipientReports: reportsFor(transferIntent().recipients),
      connection: fakeConnection({ simulationError: { InstructionError: [0, 'Custom'] } }),
    }),
    (error) => error.code === 'SIMULATION_FAILED',
  );
});

test('requires a current fee estimate and successful RPC simulation', async () => {
  await assert.rejects(
    prepareSolTransferTransaction({
      intent: transferIntent(),
      payerAddress: payer,
      recipientReports: reportsFor(transferIntent().recipients),
      connection: fakeConnection({ fee: null }),
    }),
    (error) => error.code === 'FEE_UNAVAILABLE',
  );
  await assert.rejects(
    prepareSolTransferTransaction({
      intent: transferIntent(),
      payerAddress: payer,
      recipientReports: reportsFor(transferIntent().recipients),
      connection: fakeConnection({ simulationReject: new Error('RPC offline') }),
    }),
    (error) => error.code === 'SIMULATION_UNAVAILABLE',
  );
});
