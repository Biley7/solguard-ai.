const MAX_RECORDS = 12;
const RISK_CATEGORIES = new Set(['low', 'moderate', 'high', 'critical']);
const DISTRIBUTION_KEYS = ['low', 'moderate', 'high', 'critical', 'unavailable'];

let scans = [];
let nextId = 1;

function clone(scan) {
  return { ...scan };
}

function normalizeSource(source) {
  return typeof source === 'string' && source.trim()
    ? source.trim().slice(0, 48)
    : 'Security Scanner';
}

export function recordWalletScan(report, source = 'Security Scanner') {
  if (!report || typeof report.address !== 'string' || !report.address) return null;

  const assessment = report.riskAssessment;
  const assessed = assessment?.status === 'assessed'
    && RISK_CATEGORIES.has(assessment.category);
  const category = assessed ? assessment.category : 'unavailable';
  const score = assessed && Number.isInteger(assessment.score)
    && assessment.score >= 0
    && assessment.score <= 100
    ? assessment.score
    : null;
  const observedAt = typeof report.observedAt === 'string'
    ? report.observedAt
    : new Date().toISOString();

  const scan = {
    id: nextId++,
    address: report.address,
    category,
    score,
    observedAt,
    source: normalizeSource(source),
    dataAvailability: report.dataAvailability === 'available' ? 'available' : 'partial',
  };

  scans = [scan, ...scans].slice(0, MAX_RECORDS);
  return clone(scan);
}

export function getWalletScans() {
  return scans.map(clone);
}

export function getRiskDistribution(records = getWalletScans()) {
  const counts = Object.fromEntries(DISTRIBUTION_KEYS.map((key) => [key, 0]));
  for (const scan of records) {
    const key = DISTRIBUTION_KEYS.includes(scan.category) ? scan.category : 'unavailable';
    counts[key] += 1;
  }

  return {
    total: records.length,
    counts,
  };
}
