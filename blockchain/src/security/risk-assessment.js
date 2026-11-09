const DISCLAIMER = 'Heuristic information only; this assessment does not guarantee wallet safety.';

function categoryForScore(score) {
  if (score <= 29) return 'low';
  if (score <= 59) return 'moderate';
  if (score <= 79) return 'high';
  return 'critical';
}

function infoIndicator(code, summary, evidence) {
  return {
    code,
    severity: 'info',
    scoreContribution: 0,
    summary,
    evidence,
  };
}

export function assessWalletRisk(observation, assessedAt = new Date().toISOString()) {
  const missingInformation = [...(observation.missingInformation ?? [])];
  const failures = [...(observation.rpcFailures ?? [])];
  const unsupportedAccountType = observation.accountType === 'program_owned_account';
  const coreFactsPresent = typeof observation.historyAvailable === 'boolean'
    && typeof observation.signaturesInspected === 'number'
    && typeof observation.balanceLamports === 'string'
    && typeof observation.accountType === 'string';

  if (unsupportedAccountType) {
    missingInformation.push('The account is owned by a program, but its account data is not decoded by this wallet-focused heuristic.');
  }

  if (failures.length > 0 || !coreFactsPresent || unsupportedAccountType) {
    if (!coreFactsPresent && missingInformation.length === 0) {
      missingInformation.push('Required account, balance, or history evidence is incomplete.');
    }

    return {
      status: 'unavailable',
      score: null,
      category: 'unavailable',
      indicators: [],
      missingInformation,
      recommendedAction: 'Do not interpret this result as low risk. Retry the Devnet inspection or verify the recipient independently before any transfer.',
      assessedAt,
      disclaimer: DISCLAIMER,
    };
  }

  const indicators = [];
  if (observation.historyAvailable) {
    indicators.push(infoIndicator(
      'recent_history_observed',
      'Recent Devnet signatures were returned.',
      [`${observation.signaturesInspected} recent signature record(s) were inspected; this is not a complete transaction history.`],
    ));
  } else {
    indicators.push(infoIndicator(
      'no_recent_history_observed',
      'No Devnet signatures were returned for this address.',
      ['No history was returned in the queried recent-signature window; a new or inactive wallet is not inherently suspicious.'],
    ));
  }

  const balanceDescription = BigInt(observation.balanceLamports) === 0n
    ? 'A zero balance is an account fact and is not, by itself, a risk signal.'
    : `${observation.balanceLamports} lamports were returned by Devnet RPC. Balance alone is not a risk signal.`;
  indicators.push(infoIndicator(
    'balance_observed',
    `Account balance observed: ${observation.balanceLamports} lamports.`,
    [balanceDescription],
  ));

  const failedSignatures = observation.failedSignatures ?? 0;
  indicators.push(infoIndicator(
    'recent_activity_observed',
    observation.historyAvailable
      ? `${observation.signaturesInspected} recent transaction signature(s) observed.`
      : 'No recent transaction signatures were observed.',
    [
      `${failedSignatures} failed signature record(s) were present in the returned window.`,
      'Activity volume and failed transactions are not, by themselves, evidence of malicious intent.',
    ],
  ));

  if (observation.accountType === 'program') {
    indicators.push(infoIndicator(
      'executable_program_account',
      'The account is marked executable by Solana RPC.',
      ['Executable status describes account type; it does not establish that a program is malicious.'],
    ));
  } else if (observation.accountType === 'program_owned_account') {
    indicators.push(infoIndicator(
      'program_owned_account',
      'The account is owned by a program and is not executable.',
      [`Observed owner: ${observation.accountInfo.owner}. Program ownership alone is not a risk signal.`],
    ));
  } else if (observation.accountType === 'system_account') {
    indicators.push(infoIndicator(
      'system_account',
      'The account is owned by the Solana System Program.',
      ['System ownership describes account type and is not a safety guarantee.'],
    ));
  } else if (observation.accountType === 'not_found') {
    indicators.push(infoIndicator(
      'account_not_found',
      'Solana RPC returned no account data for this address.',
      ['A missing account is not evidence of malicious activity.'],
    ));
  }

  const score = Math.max(
    0,
    Math.min(100, indicators.reduce((total, indicator) => total + indicator.scoreContribution, 0)),
  );
  return {
    status: 'assessed',
    score,
    category: categoryForScore(score),
    indicators,
    missingInformation,
    recommendedAction: 'No risk signals are assessed by this limited metadata heuristic. Verify the address through a trusted channel and review the exact transaction before authorizing it.',
    assessedAt,
    disclaimer: DISCLAIMER,
  };
}
