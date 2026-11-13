import { PublicKey, Transaction } from '@solana/web3.js';
import { getDevnetConnection } from '../rpc/devnet-connection.js';
import { SOLANA_COMMITMENT } from '../config/network.js';
import { MEMO_PROGRAM_ADDRESS } from './transaction-builder.js';

export const TRANSACTION_CONFIRMATION_TIMEOUT_MS = 60_000;

export class TransactionExecutionError extends Error {
  constructor(code, message, { signature = null, cause } = {}) {
    super(message, { cause });
    this.name = 'TransactionExecutionError';
    this.code = code;
    this.signature = signature;
  }
}

function explorerUrl(signature) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

function signatureFromSignedTransaction(signedTransaction) {
  if (!(signedTransaction instanceof Transaction) || !signedTransaction.signature) {
    throw new TransactionExecutionError(
      'INVALID_WALLET_RESPONSE',
      'Phantom did not return a signed Solana transaction.',
    );
  }
  return signedTransaction;
}

function sameBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function delay(milliseconds) {
  let timer;
  const promise = new Promise((resolve) => {
    timer = setTimeout(() => resolve('timeout'), milliseconds);
  });
  return { promise, clear: () => clearTimeout(timer) };
}

function reportProgress(onProgress, status, details = {}) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress({ status, ...details });
  } catch {
    // Presentation progress must never interrupt the transaction security flow.
  }
}

async function verifyOnChainMemo(connection, signature, expectedMemo) {
  let transaction;
  try {
    transaction = await connection.getParsedTransaction(signature, {
      commitment: SOLANA_COMMITMENT,
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return 'unavailable';
  }
  if (!transaction || transaction.meta?.err) return 'unavailable';

  const memoInstruction = transaction.transaction?.message?.instructions?.find((instruction) => (
    instruction.programId?.toBase58?.() === MEMO_PROGRAM_ADDRESS
    || instruction.program === 'spl-memo'
  ));
  if (!memoInstruction) return 'not_verified';
  if (typeof memoInstruction.parsed !== 'string') return 'unavailable';
  return memoInstruction.parsed === expectedMemo ? 'verified' : 'not_verified';
}

export async function executePreparedTransfer(prepared, {
  signTransaction,
  connection = getDevnetConnection(),
  timeoutMs = TRANSACTION_CONFIRMATION_TIMEOUT_MS,
  onProgress = null,
} = {}) {
  if (!prepared?.transaction || typeof signTransaction !== 'function') {
    throw new TransactionExecutionError('INVALID_EXECUTION_REQUEST', 'A prepared transaction and Phantom signer are required.');
  }

  if (
    prepared.transaction.feePayer?.toBase58?.() !== prepared.preview?.payerAddress
    || prepared.transaction.recentBlockhash !== prepared.blockhash
    || !Number.isInteger(timeoutMs)
    || timeoutMs < 1
  ) {
    throw new TransactionExecutionError('INVALID_EXECUTION_REQUEST', 'The prepared transaction no longer matches its reviewed Devnet preview.');
  }

  reportProgress(onProgress, 'preparing');

  try {
    const [currentBlockHeight, currentBalance] = await Promise.all([
      connection.getBlockHeight(SOLANA_COMMITMENT),
      connection.getBalance(new PublicKey(prepared.preview.payerAddress), SOLANA_COMMITMENT),
    ]);
    if (BigInt(currentBlockHeight) >= BigInt(prepared.lastValidBlockHeight)) {
      throw new TransactionExecutionError(
        'BLOCKHASH_EXPIRED',
        'The Devnet blockhash expired before wallet approval. Re-scan, rebuild, and simulate the transaction.',
      );
    }
    if (
      BigInt(currentBalance)
      < BigInt(prepared.preview.totalLamports) + BigInt(prepared.preview.feeLamports)
    ) {
      throw new TransactionExecutionError(
        'INSUFFICIENT_FUNDS',
        'The sender balance changed and no longer covers the transfers and estimated fee.',
      );
    }
  } catch (error) {
    reportProgress(onProgress, 'failed', { stage: 'preparing', message: error?.message });
    if (error instanceof TransactionExecutionError) throw error;
    throw new TransactionExecutionError(
      'RPC_ERROR',
      'Could not verify the Devnet blockhash before requesting wallet approval.',
      { cause: error },
    );
  }

  try {
    const simulation = await connection.simulateTransaction(prepared.transaction.compileMessage(), {
      commitment: SOLANA_COMMITMENT,
      replaceRecentBlockhash: true,
    });
    if (simulation?.value?.err) {
      throw new TransactionExecutionError(
        'SIMULATION_FAILED',
        'The final Devnet simulation failed. No Phantom signing request was made.',
      );
    }
  } catch (error) {
    reportProgress(onProgress, 'failed', { stage: 'preparing', message: error?.message });
    if (error instanceof TransactionExecutionError) throw error;
    throw new TransactionExecutionError(
      'SIMULATION_UNAVAILABLE',
      'Final Devnet simulation could not be completed. No Phantom signing request was made.',
      { cause: error },
    );
  }

  reportProgress(onProgress, 'awaiting_approval');

  let signedTransaction;
  try {
    signedTransaction = signatureFromSignedTransaction(
      await signTransaction(prepared.transaction),
    );
  } catch (error) {
    if (error instanceof TransactionExecutionError) throw error;
    if (
      error?.code === 4001
      || error?.code === 'USER_REJECTED'
      || /reject|declin|cancel/i.test(error?.message ?? '')
    ) {
      reportProgress(onProgress, 'rejected', { stage: 'approval' });
      throw new TransactionExecutionError('USER_REJECTED', 'The Phantom signing request was rejected.', { cause: error });
    }
    reportProgress(onProgress, 'failed', { stage: 'approval', message: error?.message });
    throw new TransactionExecutionError(
      'SIGNING_FAILED',
      'Phantom could not sign the transaction. No Devnet submission was made.',
      { cause: error },
    );
  }

  if (!sameBytes(prepared.transaction.serializeMessage(), signedTransaction.serializeMessage())) {
    reportProgress(onProgress, 'failed', { stage: 'approval' });
    throw new TransactionExecutionError(
      'TRANSACTION_MODIFIED',
      'The signed transaction message differs from the reviewed transaction. It was not submitted.',
    );
  }

  let rawTransaction;
  try {
    rawTransaction = signedTransaction.serialize({ requireAllSignatures: true, verifySignatures: true });
  } catch (error) {
    reportProgress(onProgress, 'failed', { stage: 'approval' });
    throw new TransactionExecutionError(
      'INVALID_WALLET_SIGNATURE',
      'The Phantom signature could not be verified. No Devnet submission was made.',
      { cause: error },
    );
  }

  let signature;
  try {
    signature = await connection.sendRawTransaction(rawTransaction, {
      preflightCommitment: SOLANA_COMMITMENT,
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (error) {
    reportProgress(onProgress, 'failed', { stage: 'submitted', message: error?.message });
    if (/insufficient funds/i.test(error?.message ?? '')) {
      throw new TransactionExecutionError('INSUFFICIENT_FUNDS', 'Devnet rejected the transaction because the sender balance is insufficient.', { cause: error });
    }
    if (/blockhash not found|expired/i.test(error?.message ?? '')) {
      throw new TransactionExecutionError('BLOCKHASH_EXPIRED', 'The Devnet blockhash expired before submission. Rebuild and simulate the transaction.', { cause: error });
    }
    throw new TransactionExecutionError('SUBMISSION_FAILED', 'Devnet did not accept the signed transaction.', { cause: error });
  }

  reportProgress(onProgress, 'submitted', { signature });
  reportProgress(onProgress, 'confirming', { signature });

  const confirmation = delay(timeoutMs);
  try {
    const result = await Promise.race([
      connection.confirmTransaction({
        signature,
        blockhash: prepared.blockhash,
        lastValidBlockHeight: prepared.lastValidBlockHeight,
      }, SOLANA_COMMITMENT),
      confirmation.promise,
    ]);
    if (result === 'timeout') {
      return {
        status: 'submitted',
        signature,
        confirmationStatus: null,
        explorerUrl: explorerUrl(signature),
        errorCode: 'CONFIRMATION_TIMEOUT',
        memoVerification: 'unavailable',
      };
    }
    if (result?.value?.err) {
      reportProgress(onProgress, 'failed', { stage: 'confirmation', signature });
      return {
        status: 'failed',
        signature,
        confirmationStatus: 'failed',
        explorerUrl: explorerUrl(signature),
        errorCode: 'TRANSACTION_FAILED',
        memoVerification: 'not_verified',
      };
    }
    const memoVerification = await verifyOnChainMemo(
      connection,
      signature,
      prepared.preview.memoText,
    );
    reportProgress(onProgress, 'confirmed', { signature });
    return {
      status: 'confirmed',
      signature,
      confirmationStatus: result?.context?.confirmationStatus === 'finalized' ? 'finalized' : 'confirmed',
      explorerUrl: explorerUrl(signature),
      errorCode: null,
      memoVerification,
    };
  } catch (error) {
    return {
      status: 'submitted',
      signature,
      confirmationStatus: null,
      explorerUrl: explorerUrl(signature),
      errorCode: /expired|block height exceeded/i.test(error?.message ?? '')
        ? 'BLOCKHASH_EXPIRED'
        : 'CONFIRMATION_UNAVAILABLE',
      memoVerification: 'unavailable',
    };
  } finally {
    confirmation.clear();
  }
}
