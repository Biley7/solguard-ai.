import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { validateIntentSemantics } from '../../../shared/validation/transaction-intent.js';
import { SOLANA_COMMITMENT, SOLANA_NETWORK } from '../config/network.js';
import { getDevnetConnection } from '../rpc/devnet-connection.js';

export const MEMO_PROGRAM_ADDRESS = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const MAX_TRANSFER_RECIPIENTS = 5;

export class TransactionPreparationError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'TransactionPreparationError';
    this.code = code;
  }
}

function canonicalPublicKey(address, field) {
  try {
    const publicKey = new PublicKey(address);
    if (publicKey.toBase58() !== address) throw new Error('Public key is not canonical.');
    return publicKey;
  } catch (error) {
    throw new TransactionPreparationError(
      'INVALID_INTENT',
      `The ${field} public key is malformed.`,
      error,
    );
  }
}

function unsignedInteger(value, field) {
  try {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Unsafe number.');
    const result = typeof value === 'bigint' ? value : BigInt(value);
    if (result < 0n) throw new Error('Negative number.');
    return result;
  } catch (error) {
    throw new TransactionPreparationError('INVALID_RPC_RESPONSE', `Devnet RPC returned an invalid ${field}.`, error);
  }
}

function makeAuditMemo(risk) {
  if (
    risk?.status !== 'assessed'
    || !Number.isInteger(risk.score)
    || risk.score < 0
    || risk.score > 100
    || !['low', 'moderate', 'high', 'critical'].includes(risk.category)
  ) {
    throw new TransactionPreparationError(
      'RISK_UNAVAILABLE',
      'A verified recipient risk summary is required before building an audit memo.',
    );
  }
  return `SOLGUARD_V1 | OBSERVED_RISK: ${risk.category.toUpperCase()} ${risk.score}/100 | HEURISTIC`;
}

function validateTransferIntent(intent) {
  if (
    !intent
    || typeof intent !== 'object'
    || Array.isArray(intent)
    || Object.keys(intent).length !== 2
    || intent.network !== SOLANA_NETWORK
    || !Array.isArray(intent.recipients)
    || intent.recipients.length < 1
    || intent.recipients.length > MAX_TRANSFER_RECIPIENTS
    || intent.recipients.some((recipient) => (
      !recipient
      || typeof recipient !== 'object'
      || Array.isArray(recipient)
      || Object.keys(recipient).length !== 2
      || typeof recipient.address !== 'string'
      || typeof recipient.amountLamports !== 'string'
      || !/^[1-9][0-9]*$/.test(recipient.amountLamports)
    ))
  ) {
    throw new TransactionPreparationError('INVALID_INTENT', 'The transfer intent does not match the supported Devnet schema.');
  }
  try {
    return validateIntentSemantics(intent);
  } catch (error) {
    throw new TransactionPreparationError('INVALID_INTENT', 'The transfer intent contains invalid addresses or amounts.', error);
  }
}

function assertSupportedDestination(address, accountInfo) {
  if (!accountInfo) return;
  const isSystemOwned = accountInfo.owner?.equals?.(SystemProgram.programId)
    ?? accountInfo.owner?.toBase58?.() === SystemProgram.programId.toBase58();
  if (!isSystemOwned || accountInfo.executable) {
    throw new TransactionPreparationError(
      'UNSUPPORTED_DESTINATION',
      `Recipient ${address} is an executable or program-owned account; only system wallet addresses are supported.`,
    );
  }
}

function simulationMessage(error, logs = []) {
  const serializedError = typeof error === 'string' ? error : JSON.stringify(error ?? {});
  const combined = `${serializedError} ${logs.join(' ')}`;
  if (/insufficient funds|insufficient lamports/i.test(combined)) {
    return 'Devnet simulation reports insufficient sender funds for this transfer and its fee.';
  }
  if (/account not found|invalid account/i.test(combined)) {
    return 'Devnet simulation could not resolve one of the transaction accounts.';
  }
  const relevantLog = logs.filter((line) => /failed|error|insufficient/i.test(line)).at(-1);
  return relevantLog
    ? `Devnet rejected the unsigned transaction during simulation: ${relevantLog.slice(0, 240)}`
    : 'Devnet rejected the unsigned transaction during simulation. No signing request was made.';
}

export async function prepareSolTransferTransaction({
  intent,
  payerAddress,
  riskSummary,
  connection = getDevnetConnection(),
  now = () => new Date(),
}) {
  const normalizedIntent = validateTransferIntent(intent);

  const payer = canonicalPublicKey(payerAddress, 'sender');
  if (normalizedIntent.recipients.length > MAX_TRANSFER_RECIPIENTS) {
    throw new TransactionPreparationError('INVALID_INTENT', 'A transfer may contain at most five recipients.');
  }

  const recipients = normalizedIntent.recipients.map((recipient, index) => {
    const publicKey = canonicalPublicKey(recipient.address, `recipient ${index + 1}`);
    if (publicKey.equals(payer)) {
      throw new TransactionPreparationError('INVALID_INTENT', 'The sender address cannot also be a recipient.');
    }
    return { ...recipient, publicKey };
  });
  if (new Set(recipients.map(({ address }) => address)).size !== recipients.length) {
    throw new TransactionPreparationError('INVALID_INTENT', 'Duplicate recipient addresses are not supported.');
  }
  if (riskSummary?.status !== 'assessed') {
    throw new TransactionPreparationError('RISK_UNAVAILABLE', 'Recipient security inspection is incomplete. Do not sign this transfer.');
  }

  let accountInfos;
  let balance;
  let latestBlockhash;
  try {
    [accountInfos, balance, latestBlockhash] = await Promise.all([
      Promise.all(recipients.map(({ publicKey }) => connection.getAccountInfo(publicKey, SOLANA_COMMITMENT))),
      connection.getBalance(payer, SOLANA_COMMITMENT),
      connection.getLatestBlockhash(SOLANA_COMMITMENT),
    ]);
  } catch (error) {
    throw new TransactionPreparationError(
      'RPC_ERROR',
      'Could not retrieve destination account data, sender balance, and a fresh Devnet blockhash.',
      error,
    );
  }

  for (const [index, accountInfo] of accountInfos.entries()) {
    assertSupportedDestination(recipients[index].address, accountInfo);
  }

  const transferLamports = recipients.reduce(
    (total, recipient) => total + BigInt(recipient.amountLamports),
    0n,
  );
  const transaction = new Transaction({
    feePayer: payer,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  for (const recipient of recipients) {
    transaction.add(SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient.publicKey,
      lamports: BigInt(recipient.amountLamports),
    }));
  }

  const memoText = makeAuditMemo(riskSummary);
  transaction.add(new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ADDRESS),
    data: new TextEncoder().encode(memoText),
  }));

  const message = transaction.compileMessage();
  let feeResponse;
  try {
    feeResponse = await connection.getFeeForMessage(message, SOLANA_COMMITMENT);
  } catch (error) {
    throw new TransactionPreparationError('RPC_ERROR', 'Could not estimate the Devnet transaction fee.', error);
  }
  const feeValue = feeResponse?.value;
  if (feeValue === null || feeValue === undefined) {
    throw new TransactionPreparationError('FEE_UNAVAILABLE', 'Devnet did not provide a fee estimate. No signing request was made.');
  }
  const feeLamports = unsignedInteger(feeValue, 'transaction fee');
  const senderBalance = unsignedInteger(balance, 'sender balance');
  if (transferLamports + feeLamports > senderBalance) {
    throw new TransactionPreparationError(
      'INSUFFICIENT_FUNDS',
      'The sender balance does not cover the transfers and estimated transaction fee.',
    );
  }

  const previewId = globalThis.crypto?.randomUUID?.();
  if (!previewId) {
    throw new TransactionPreparationError('SECURE_CONTEXT_REQUIRED', 'A secure browser context is required to prepare a transaction preview.');
  }

  let simulation;
  try {
    simulation = await connection.simulateTransaction(message, {
      commitment: SOLANA_COMMITMENT,
      replaceRecentBlockhash: true,
    });
  } catch (error) {
    throw new TransactionPreparationError(
      'SIMULATION_UNAVAILABLE',
      'Devnet transaction simulation could not be completed. No signing request was made.',
      error,
    );
  }
  if (simulation?.value?.err) {
    throw new TransactionPreparationError(
      'SIMULATION_FAILED',
      simulationMessage(simulation.value.err, simulation.value.logs ?? []),
    );
  }

  return {
    transaction,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    preview: {
      previewId,
      network: SOLANA_NETWORK,
      payerAddress: payer.toBase58(),
      recipients: recipients.map(({ address, amountLamports }) => ({ address, amountLamports })),
      totalLamports: transferLamports.toString(),
      feeLamports: feeLamports.toString(),
      memoText,
      simulationStatus: 'passed',
      createdAt: now().toISOString(),
    },
  };
}
