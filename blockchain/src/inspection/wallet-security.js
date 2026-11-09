import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getDevnetConnection } from '../rpc/devnet-connection.js';
import { SOLANA_COMMITMENT, SOLANA_NETWORK } from '../config/network.js';
import { assessWalletRisk } from '../security/risk-assessment.js';

export const SIGNATURE_INSPECTION_LIMIT = 20;

const RPC_OPERATIONS = ['balance', 'accountInfo', 'signatures'];

export class WalletInspectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WalletInspectionError';
    this.code = code;
  }
}

function toUnsignedBigIntString(value, field) {
  try {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      throw new Error('Value is not a safe integer.');
    }
    if (
      typeof value !== 'bigint'
      && typeof value !== 'number'
      && !(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value))
    ) {
      throw new Error('Value is not an unsigned integer.');
    }
    const parsed = typeof value === 'bigint' ? value : BigInt(value);
    if (parsed < 0n) throw new Error('Value cannot be negative.');
    return parsed.toString();
  } catch {
    throw new WalletInspectionError('INVALID_RPC_RESPONSE', `Devnet RPC returned an invalid ${field}.`);
  }
}

function classifyAccount(accountInfo) {
  if (!accountInfo) return 'not_found';
  if (accountInfo.executable) return 'program';
  if (accountInfo.owner === SystemProgram.programId.toBase58()) return 'system_account';
  return 'program_owned_account';
}

function safeNumber(value) {
  if (typeof value === 'bigint') {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(value);
  }
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeSignature(signature) {
  const slot = safeNumber(signature?.slot);
  if (!signature || typeof signature.signature !== 'string' || slot === null) {
    throw new WalletInspectionError('INVALID_RPC_RESPONSE', 'Devnet RPC returned an invalid signature record.');
  }

  const blockTimeSeconds = safeNumber(signature.blockTime);
  const blockTime = blockTimeSeconds === null
    ? null
    : new Date(blockTimeSeconds * 1000).toISOString();

  return {
    signature: signature.signature,
    slot,
    blockTime,
    failed: signature.err !== null && signature.err !== undefined,
  };
}

function accountInfoOperation(connection, publicKey) {
  return connection.getAccountInfo(publicKey, SOLANA_COMMITMENT).then((accountInfo) => {
    if (accountInfo === null) return null;
    if (
      typeof accountInfo.owner?.toBase58 !== 'function'
      || typeof accountInfo.executable !== 'boolean'
    ) {
      throw new WalletInspectionError('INVALID_RPC_RESPONSE', 'Devnet RPC returned invalid account metadata.');
    }

    return {
      lamports: toUnsignedBigIntString(accountInfo.lamports, 'account lamports'),
      owner: accountInfo.owner.toBase58(),
      executable: accountInfo.executable,
      space: toUnsignedBigIntString(accountInfo.space ?? 0, 'account data size'),
    };
  });
}

export async function inspectWalletSecurity(address, connection = getDevnetConnection()) {
  let publicKey;
  try {
    publicKey = new PublicKey(address);
    if (publicKey.toBase58() !== address) throw new Error('Public key is not canonical.');
  } catch {
    throw new WalletInspectionError('INVALID_ADDRESS', 'Enter a valid canonical Solana public address.');
  }

  const operations = [
    () => connection.getBalance(publicKey, SOLANA_COMMITMENT),
    () => accountInfoOperation(connection, publicKey),
    () => connection.getSignaturesForAddress(
      publicKey,
      { limit: SIGNATURE_INSPECTION_LIMIT },
      SOLANA_COMMITMENT,
    ),
  ];

  const results = await Promise.allSettled(
    operations.map((operation) => Promise.resolve().then(operation)),
  );
  const rpcFailures = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') rpcFailures.push(RPC_OPERATIONS[index]);
  }

  let balanceLamports = null;
  let accountInfo = null;
  let signatures = [];
  const normalizedResults = [
    () => {
      if (results[0].status === 'fulfilled') {
        balanceLamports = toUnsignedBigIntString(results[0].value, 'wallet balance');
      }
    },
    () => {
      if (results[1].status === 'fulfilled') accountInfo = results[1].value;
    },
    () => {
      if (results[2].status === 'fulfilled') {
        if (!Array.isArray(results[2].value)) {
          throw new WalletInspectionError('INVALID_RPC_RESPONSE', 'Devnet RPC returned invalid signature data.');
        }
        signatures = results[2].value.map(normalizeSignature);
      }
    },
  ];
  for (const [index, normalize] of normalizedResults.entries()) {
    try {
      normalize();
    } catch {
      if (!rpcFailures.includes(RPC_OPERATIONS[index])) rpcFailures.push(RPC_OPERATIONS[index]);
      if (index === 0) balanceLamports = null;
      if (index === 1) accountInfo = null;
      if (index === 2) signatures = [];
    }
  }
  const accountType = rpcFailures.includes('accountInfo')
    ? 'unknown'
    : classifyAccount(accountInfo);
  const missingInformation = [
    'Account age and complete transaction history cannot be established from a query limited to 20 recent signatures.',
    ...rpcFailures.map((operation) => {
    if (operation === 'balance') return 'Devnet RPC did not return the account balance.';
    if (operation === 'accountInfo') return 'Devnet RPC did not return account owner or executable metadata.';
    return 'Devnet RPC did not return recent transaction signature data.';
    }),
  ];
  const dataAvailability = rpcFailures.length === 0 ? 'available' : 'partial';
  const accountStatus = rpcFailures.includes('accountInfo')
    ? 'unavailable'
    : accountInfo ? 'found' : 'not_found';
  const observedAt = new Date().toISOString();
  const historyAvailable = signatures.length > 0;

  const riskAssessment = assessWalletRisk({
    accountType,
    accountInfo,
    balanceLamports,
    historyAvailable,
    signaturesInspected: signatures.length,
    failedSignatures: signatures.filter((signature) => signature.failed).length,
    rpcFailures,
    missingInformation,
  }, observedAt);

  return {
    address: publicKey.toBase58(),
    network: SOLANA_NETWORK,
    source: 'solana-rpc',
    accountStatus,
    dataAvailability,
    observedAt,
    balanceLamports,
    accountInfo,
    accountType,
    history: {
      available: historyAvailable,
      signaturesInspected: signatures.length,
      limit: SIGNATURE_INSPECTION_LIMIT,
      recentSignatures: signatures,
    },
    rpcFailures,
    missingInformation,
    riskAssessment,
  };
}
