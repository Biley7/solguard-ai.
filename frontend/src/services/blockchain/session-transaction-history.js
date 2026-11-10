let transactions = [];
let nextId = 1;

const SESSION_STATUSES = new Set([
  'pending',
  'submitted',
  'confirmed',
  'failed',
  'rejected',
]);

export function recordSessionTransaction(preview, riskSummary, startedAt = new Date().toISOString()) {
  if (!preview || !Array.isArray(preview.recipients) || !riskSummary) {
    throw new TypeError('A reviewed transaction preview and risk summary are required.');
  }

  const entry = {
    id: nextId++,
    timestamp: startedAt,
    payerAddress: preview.payerAddress,
    recipients: preview.recipients.map(({ address, amountLamports }) => ({ address, amountLamports })),
    totalLamports: preview.totalLamports,
    riskScore: Number.isInteger(riskSummary.score) ? riskSummary.score : null,
    status: 'pending',
    signature: null,
    explorerUrl: null,
  };
  transactions = [entry, ...transactions];
  return entry.id;
}

export function updateSessionTransaction(id, result) {
  if (!SESSION_STATUSES.has(result?.status)) {
    throw new TypeError('The session transaction status is invalid.');
  }
  const index = transactions.findIndex((entry) => entry.id === id);
  if (index === -1) throw new RangeError('The session transaction does not exist.');

  transactions[index] = {
    ...transactions[index],
    status: result.status,
    signature: typeof result.signature === 'string' ? result.signature : null,
    explorerUrl: typeof result.explorerUrl === 'string' ? result.explorerUrl : null,
  };
}

export function getSessionTransactions() {
  return transactions.map((entry) => ({
    ...entry,
    recipients: entry.recipients.map((recipient) => ({ ...recipient })),
  }));
}
