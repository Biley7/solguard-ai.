import assert from 'node:assert/strict';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { test } from 'node:test';
import {
  MEMO_PROGRAM_ADDRESS,
  prepareSolTransferTransaction,
} from '../../blockchain/src/transactions/transaction-builder.js';
import { executePreparedTransfer } from '../../blockchain/src/transactions/transaction-executor.js';

const SIGNATURE = '1'.repeat(64);
const MEMO_TEXT = 'SOLGUARD_V1 | OBSERVED_RISK: LOW 0/100 | HEURISTIC';

function recipientReport(address, { available = true } = {}) {
  return {
    address,
    riskAssessment: available
      ? { status: 'assessed', category: 'low', score: 0 }
      : { status: 'unavailable', category: 'unavailable', score: null },
  };
}

function createConnection({ simulationFails = false } = {}) {
  const calls = [];
  const simulations = [];
  const state = { simulationFails };
  return {
    calls,
    simulations,
    state,
    async getAccountInfo() {
      calls.push(['getAccountInfo']);
      return null;
    },
    async getBalance() {
      calls.push(['getBalance']);
      return 10_000_000_000;
    },
    async getLatestBlockhash() {
      calls.push(['getLatestBlockhash']);
      return {
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 500,
      };
    },
    async getFeeForMessage() {
      calls.push(['getFeeForMessage']);
      return { value: 5000 };
    },
    async getBlockHeight() {
      calls.push(['getBlockHeight']);
      return 1;
    },
    async simulateTransaction(transaction) {
      assert.ok(transaction instanceof Transaction);
      calls.push(['simulateTransaction']);
      simulations.push(transaction);
      if (state.simulationFails) {
        return { value: { err: { InstructionError: [0, 'Custom'] }, logs: ['Program failed'] } };
      }
      return { value: { err: null, logs: [] } };
    },
    async sendRawTransaction(raw) {
      calls.push(['sendRawTransaction', raw]);
      return SIGNATURE;
    },
    async confirmTransaction() {
      calls.push(['confirmTransaction']);
      return { context: { slot: 2 }, value: { err: null } };
    },
    async getParsedTransaction() {
      calls.push(['getParsedTransaction']);
      return {
        meta: { err: null },
        transaction: {
          message: { instructions: [{ program: 'spl-memo', parsed: MEMO_TEXT }] },
        },
      };
    },
  };
}

async function prepare({ connection, recipientCount, reportOptions = {} }) {
  const payer = await Keypair.generate();
  const recipients = await Promise.all(
    Array.from({ length: recipientCount }, async () => Keypair.generate()),
  );
  const intent = {
    network: 'devnet',
    recipients: recipients.map(({ publicKey }) => ({
      address: publicKey.toBase58(),
      amountLamports: '1000000',
    })),
  };
  const recipientReports = intent.recipients.map(({ address }, index) => (
    recipientReport(address, reportOptions[index] ?? {})
  ));
  const prepared = await prepareSolTransferTransaction({
    intent,
    payerAddress: payer.publicKey.toBase58(),
    recipientReports,
    connection,
  });
  return { payer, recipients, prepared };
}

for (const recipientCount of [2, 3, 5]) {
  test(`executes one confirmed atomic transaction for ${recipientCount} recipients`, async () => {
    const connection = createConnection();
    const { payer, recipients, prepared } = await prepare({ connection, recipientCount });

    assert.equal(prepared.preview.recipients.length, recipientCount);
    assert.equal(prepared.preview.totalLamports, String(recipientCount * 1_000_000));
    assert.equal(prepared.transaction.instructions.length, recipientCount + 1);
    assert.equal(
      prepared.transaction.instructions.filter(
        ({ programId }) => programId.equals(SystemProgram.programId),
      ).length,
      recipientCount,
    );
    assert.equal(
      prepared.transaction.instructions.at(-1).programId.toBase58(),
      MEMO_PROGRAM_ADDRESS,
    );
    assert.equal(prepared.transaction.signature, null);

    let approvedInstructions;
    const result = await executePreparedTransfer(prepared, {
      connection,
      signTransaction: async (transaction) => {
        approvedInstructions = [...transaction.instructions];
        await transaction.partialSign(payer);
        return transaction;
      },
    });

    assert.equal(result.status, 'confirmed');
    assert.equal(result.signature, SIGNATURE);
    assert.equal(result.memoVerification, 'verified');
    assert.equal(connection.calls.filter(([name]) => name === 'sendRawTransaction').length, 1);
    assert.equal(connection.calls.filter(([name]) => name === 'confirmTransaction').length, 1);
    assert.equal(connection.simulations.length, 2);
    for (const transaction of connection.simulations) {
      assert.equal(transaction.instructions.length, recipientCount + 1);
    }

    const transferAddresses = approvedInstructions
      .filter(({ programId }) => programId.equals(SystemProgram.programId))
      .map((instruction) => instruction.keys[1].pubkey.toBase58());
    assert.deepEqual(transferAddresses, recipients.map(({ publicKey }) => publicKey.toBase58()));
  });
}

test('does not prepare or submit an atomic transfer when one recipient risk is unavailable', async () => {
  const connection = createConnection();
  await assert.rejects(
    prepare({
      connection,
      recipientCount: 5,
      reportOptions: { 2: { available: false } },
    }),
    (error) => error.code === 'RISK_UNAVAILABLE',
  );

  assert.equal(connection.calls.some(([name]) => name === 'simulateTransaction'), false);
  assert.equal(connection.calls.some(([name]) => name === 'sendRawTransaction'), false);
});

test('does not request a signature or submit when execution simulation fails', async () => {
  const connection = createConnection();
  const { payer, prepared } = await prepare({ connection, recipientCount: 3 });
  connection.state.simulationFails = true;
  let signCalls = 0;

  await assert.rejects(
    executePreparedTransfer(prepared, {
      connection,
      signTransaction: async (transaction) => {
        signCalls += 1;
        await transaction.partialSign(payer);
        return transaction;
      },
    }),
    (error) => error.code === 'SIMULATION_FAILED',
  );
  assert.equal(signCalls, 0);
  assert.equal(connection.calls.some(([name]) => name === 'sendRawTransaction'), false);
  assert.equal(connection.calls.some(([name]) => name === 'confirmTransaction'), false);
});
