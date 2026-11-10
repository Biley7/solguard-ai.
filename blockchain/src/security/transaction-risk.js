const RISK_RANK = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

export class TransactionRiskError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TransactionRiskError';
    this.code = code;
  }
}

export function summarizeTransactionRisk(reports) {
  if (!Array.isArray(reports) || reports.length === 0 || reports.length > 5) {
    throw new TransactionRiskError('INVALID_RECIPIENT_REPORTS', 'Scan between one and five recipients before preparing a transfer.');
  }

  const unavailable = reports.filter((report) => (
    report?.riskAssessment?.status !== 'assessed'
    || !Number.isInteger(report.riskAssessment.score)
    || !(report.riskAssessment.category in RISK_RANK)
  ));
  if (unavailable.length > 0) {
    return {
      status: 'unavailable',
      score: null,
      category: 'unavailable',
      highOrCritical: false,
      scannedRecipients: reports.length,
      blockedRecipients: unavailable.map((report) => report?.address ?? 'unknown'),
      summary: 'At least one recipient could not be verified. Do not prepare or sign this transaction.',
      disclaimer: 'Heuristic information only; this assessment does not guarantee wallet safety.',
    };
  }

  const highest = reports.reduce((current, report) => (
    RISK_RANK[report.riskAssessment.category] > RISK_RANK[current.riskAssessment.category]
      ? report
      : current
  ));
  const category = highest.riskAssessment.category;
  const highOrCritical = category === 'high' || category === 'critical';

  return {
    status: 'assessed',
    score: highest.riskAssessment.score,
    category,
    highOrCritical,
    scannedRecipients: reports.length,
    blockedRecipients: [],
    summary: highOrCritical
      ? `Highest recipient assessment is ${category.toUpperCase()} (${highest.riskAssessment.score}/100). Review the flagged recipient evidence before deciding whether to continue.`
      : `Highest recipient assessment is ${category} observed risk (${highest.riskAssessment.score}/100).`,
    disclaimer: 'Heuristic information only; this assessment does not guarantee wallet safety.',
  };
}
