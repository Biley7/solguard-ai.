import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeTransactionRisk } from '../../blockchain/src/security/transaction-risk.js';

function report(address, category, score, status = 'assessed') {
  return {
    address,
    riskAssessment: { status, category, score },
  };
}

test('summarizes the maximum observed recipient score and surfaces high or critical warnings', () => {
  const high = summarizeTransactionRisk([
    report('recipient-low', 'low', 0),
    report('recipient-high', 'high', 67),
  ]);
  assert.equal(high.category, 'high');
  assert.equal(high.score, 67);
  assert.equal(high.highOrCritical, true);
  assert.match(high.summary, /HIGH/);
  assert.equal(high.scannedRecipients, 2);

  const critical = summarizeTransactionRisk([
    report('recipient-critical', 'critical', 90),
  ]);
  assert.equal(critical.category, 'critical');
  assert.equal(critical.highOrCritical, true);
});

test('blocks a transaction-level score when any recipient assessment is unavailable', () => {
  const result = summarizeTransactionRisk([
    report('recipient-ok', 'low', 0),
    report('recipient-unknown', 'unavailable', null, 'unavailable'),
  ]);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.score, null);
  assert.deepEqual(result.blockedRecipients, ['recipient-unknown']);
});
