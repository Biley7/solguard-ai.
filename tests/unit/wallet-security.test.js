import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { inspectWalletSecurity, WalletInspectionError } from '../../blockchain/src/inspection/wallet-security.js';
import { assessWalletRisk } from '../../blockchain/src/security/risk-assessment.js';
import { SOLANA_COMMITMENT, SOLANA_NETWORK } from '../../blockchain/src/config/network.js';
import { validateSchema } from '../../backend/src/validators/schema-validator.js';

const address = new PublicKey(new Uint8Array(32).fill(9)).toBase58();
const programOwner = new PublicKey(new Uint8Array(32).fill(8));

function accountInfo({ owner = SystemProgram.programId, executable = false } = {}) {
  return {
    lamports: 90_000_000n,
    owner,
    executable,
    space: 0n,
  };
}

function rpc(overrides = {}) {
  return {
    getBalance: async () => 90_000_000n,
    getAccountInfo: async () => accountInfo(),
    getSignaturesForAddress: async () => [],
    ...overrides,
  };
}

test('rejects invalid addresses before making any RPC requests', async () => {
  let calls = 0;
  await assert.rejects(
    inspectWalletSecurity('not-a-public-key', {
      getBalance: async () => { calls += 1; },
      getAccountInfo: async () => { calls += 1; },
      getSignaturesForAddress: async () => { calls += 1; },
    }),
    (error) => error instanceof WalletInspectionError && error.code === 'INVALID_ADDRESS',
  );
  assert.equal(calls, 0);
});

test('runs independent balance, account, and signature RPC reads concurrently', async () => {
  const called = [];
  const connection = rpc({
    getBalance: async (_address, commitment) => {
      called.push(['balance', commitment]);
      return 10n;
    },
    getAccountInfo: async (_address, commitment) => {
      called.push(['accountInfo', commitment]);
      return accountInfo();
    },
    getSignaturesForAddress: async (_address, options, commitment) => {
      called.push(['signatures', options.limit, commitment]);
      return [];
    },
  });

  const report = await inspectWalletSecurity(address, connection);
  assert.deepEqual(called, [
    ['balance', SOLANA_COMMITMENT],
    ['accountInfo', SOLANA_COMMITMENT],
    ['signatures', 20, SOLANA_COMMITMENT],
  ]);
  assert.equal(report.network, SOLANA_NETWORK);
  assert.equal(report.dataAvailability, 'available');
});

test('reports an empty-history, zero-balance address without treating it as suspicious', async () => {
  const report = await inspectWalletSecurity(address, rpc({
    getBalance: async () => 0n,
    getAccountInfo: async () => null,
    getSignaturesForAddress: async () => [],
  }));

  assert.equal(report.accountStatus, 'not_found');
  assert.equal(report.accountType, 'not_found');
  assert.equal(report.history.available, false);
  assert.equal(report.history.signaturesInspected, 0);
  assert.equal(report.riskAssessment.status, 'assessed');
  assert.equal(report.riskAssessment.score, 0);
  assert.equal(report.riskAssessment.category, 'low');
  assert.ok(report.riskAssessment.indicators.some(({ code }) => code === 'no_recent_history_observed'));
  assert.ok(report.riskAssessment.indicators.some(({ code }) => code === 'balance_observed'));
  assert.ok(report.riskAssessment.indicators.every(({ scoreContribution }) => scoreContribution === 0));
  assert.equal(validateSchema('WalletSecurityReport', report).valid, true);
});

test('reports an existing zero-balance system account with empty history as neutral evidence', async () => {
  const report = await inspectWalletSecurity(address, rpc({
    getBalance: async () => 0n,
    getSignaturesForAddress: async () => [],
  }));

  assert.equal(report.accountStatus, 'found');
  assert.equal(report.accountType, 'system_account');
  assert.equal(report.history.available, false);
  assert.equal(report.riskAssessment.status, 'assessed');
  assert.equal(report.riskAssessment.category, 'low');
  assert.ok(report.riskAssessment.indicators.every(({ scoreContribution }) => scoreContribution === 0));
});

test('classifies executable program accounts neutrally and includes recent signature evidence', async () => {
  const report = await inspectWalletSecurity(address, rpc({
    getAccountInfo: async () => accountInfo({ owner: programOwner, executable: true }),
    getSignaturesForAddress: async () => [{
      signature: 'sample-signature-from-rpc',
      slot: 123n,
      blockTime: 1_800_000_000n,
      err: null,
    }],
  }));

  assert.equal(report.accountType, 'program');
  assert.equal(report.accountInfo.owner, programOwner.toBase58());
  assert.equal(report.accountInfo.executable, true);
  assert.equal(report.history.available, true);
  assert.equal(report.history.signaturesInspected, 1);
  assert.equal(report.history.recentSignatures[0].failed, false);
  assert.equal(report.riskAssessment.category, 'low');
  assert.ok(report.riskAssessment.indicators.some(({ code }) => code === 'executable_program_account'));
  assert.equal(validateSchema('WalletSecurityReport', report).valid, true);
});

test('distinguishes system-owned and program-owned non-executable accounts', async () => {
  const systemReport = await inspectWalletSecurity(address, rpc());
  const programOwnedReport = await inspectWalletSecurity(address, rpc({
    getAccountInfo: async () => accountInfo({ owner: programOwner }),
  }));

  assert.equal(systemReport.accountType, 'system_account');
  assert.equal(programOwnedReport.accountType, 'program_owned_account');
  assert.equal(programOwnedReport.riskAssessment.status, 'unavailable');
  assert.equal(programOwnedReport.riskAssessment.score, null);
  assert.ok(programOwnedReport.riskAssessment.missingInformation.some((item) => item.includes('not decoded')));
});

test('returns unknown risk and missing fields when any core RPC read fails', async () => {
  const report = await inspectWalletSecurity(address, rpc({
    getBalance: async () => { throw new Error('provider details are not public'); },
  }));

  assert.equal(report.accountStatus, 'found');
  assert.equal(report.dataAvailability, 'partial');
  assert.deepEqual(report.rpcFailures, ['balance']);
  assert.equal(report.balanceLamports, null);
  assert.equal(report.riskAssessment.status, 'unavailable');
  assert.equal(report.riskAssessment.score, null);
  assert.equal(report.riskAssessment.category, 'unavailable');
  assert.deepEqual(report.riskAssessment.indicators, []);
  assert.ok(report.riskAssessment.missingInformation.some((item) => item.includes('balance')));
  assert.equal(validateSchema('WalletSecurityReport', report).valid, true);
});

test('returns unknown risk when signature history is unavailable, rather than calling it empty', async () => {
  const report = await inspectWalletSecurity(address, rpc({
    getSignaturesForAddress: async () => { throw new Error('RPC unavailable'); },
  }));

  assert.deepEqual(report.rpcFailures, ['signatures']);
  assert.equal(report.history.available, false);
  assert.equal(report.riskAssessment.status, 'unavailable');
  assert.equal(report.riskAssessment.score, null);
});

test('risk scoring is deterministic and does not penalize wallet age, balance, activity, or account type', () => {
  const observation = {
    accountType: 'program',
    accountInfo: { owner: programOwner.toBase58(), executable: true },
    balanceLamports: '0',
    historyAvailable: false,
    signaturesInspected: 0,
    rpcFailures: [],
    missingInformation: [],
  };
  const first = assessWalletRisk(observation, '2026-11-09T00:00:00.000Z');
  const second = assessWalletRisk(observation, '2026-11-09T00:00:00.000Z');

  assert.deepEqual(first, second);
  assert.equal(first.score, 0);
  assert.equal(first.category, 'low');
  assert.ok(first.indicators.every(({ scoreContribution }) => scoreContribution === 0));
  assert.match(first.recommendedAction, /verify the address/i);
});
