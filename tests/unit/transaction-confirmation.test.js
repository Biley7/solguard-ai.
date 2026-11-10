import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transactionConfirmationView, transactionExecutionView } from '../../frontend/src/components/transaction-confirmation.js';

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
