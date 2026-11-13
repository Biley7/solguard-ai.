import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  transactionConfirmationView,
  transactionExecutionProgressView,
  transactionExecutionView,
} from '../../frontend/src/components/transaction-confirmation.js';

const prepared = {
  preview: {
    payerAddress: '11111111111111111111111111111111',
    recipients: [{
      address: 'Vote111111111111111111111111111111111111111',
      amountLamports: '100000000',
    }],
    totalLamports: '100000000',
    feeLamports: '5000',
    memoText: 'SOLGUARD_V1 | OBSERVED_RISK: HIGH 70/100 | HEURISTIC',
  },
};

test('keeps high-risk warning visible and requires explicit acknowledgement before Phantom approval', () => {
  const markup = transactionConfirmationView(prepared, {
    category: 'high',
    score: 70,
    highOrCritical: true,
    summary: 'Review the observed recipient factors.',
    disclaimer: 'Heuristic information only.',
  });

  assert.match(markup, /HIGH observed-risk warning/);
  assert.match(markup, /data-risk-acknowledgement/);
  assert.match(markup, /data-action="approve-transfer" disabled/);
  assert.match(markup, /SOLANA DEVNET/);
  assert.match(markup, /SolGuard-generated heuristic record/);
});

test('renders the actual lifecycle state and marks the step that failed', () => {
  const confirming = transactionExecutionProgressView({
    status: 'confirming',
    awaiting: true,
    submitted: true,
    signature: 'devnet-signature',
  }, prepared.preview);
  assert.match(confirming, /data-execution-status="confirming"/);
  assert.match(confirming, /role="status" aria-live="polite"/);
  assert.match(confirming, /Confirming on Devnet/);
  assert.match(confirming, /explorer\.solana\.com\/tx\/devnet-signature/);
  assert.match(confirming, /execution-step is-done/);
  assert.match(confirming, /execution-step is-active/);

  const failed = transactionExecutionProgressView({
    status: 'failed',
    awaiting: true,
    submitted: false,
    failureStage: 'approval',
    message: 'Phantom could not sign the transaction.',
  }, prepared.preview);
  assert.match(failed, /data-execution-status="failed"/);
  assert.match(failed, /Approval failed/);
  assert.match(failed, /Phantom could not sign the transaction\./);
  assert.doesNotMatch(failed, /data-execution-status="confirmed"/);
});

test('shows memo verification as distinct from transaction confirmation', () => {
  const markup = transactionExecutionView({
    status: 'confirmed',
    signature: 'devnet-signature',
    explorerUrl: 'https://explorer.solana.com/tx/devnet-signature?cluster=devnet',
    memoVerification: 'unavailable',
  }, prepared.preview);

  assert.match(markup, /Confirmed on Solana Devnet/);
  assert.match(markup, /Could not verify from the transaction RPC/);
  assert.match(markup, /cluster=devnet/);
});
