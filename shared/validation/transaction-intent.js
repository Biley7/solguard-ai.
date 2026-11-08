import { PublicKey } from '@solana/web3.js';

export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const MAX_U64 = (1n << 64n) - 1n;
const SOL_AMOUNT_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,9})?$/;

export class IntentValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'IntentValidationError';
    this.code = 'INVALID_INTENT';
    this.issues = issues;
  }
}

export function assertCanonicalPublicKey(address, field) {
  try {
    if (new PublicKey(address).toBase58() !== address) {
      throw new Error('Public key is not canonical.');
    }
  } catch {
    throw new IntentValidationError('Intent contains an invalid public key.', [
      { field, reason: 'invalid_public_key' },
    ]);
  }
}

export function solAmountToLamports(amountSol, field) {
  if (typeof amountSol !== 'string' || !SOL_AMOUNT_PATTERN.test(amountSol)) {
    throw new IntentValidationError('Intent contains an invalid SOL amount.', [
      { field, reason: 'invalid_decimal_amount' },
    ]);
  }

  const [whole, fraction = ''] = amountSol.split('.');
  const fractionalLamports = BigInt((fraction + '000000000').slice(0, 9));
  const amountLamports = BigInt(whole) * LAMPORTS_PER_SOL + fractionalLamports;

  if (amountLamports <= 0n || amountLamports > MAX_U64) {
    throw new IntentValidationError('Intent contains an out-of-range SOL amount.', [
      { field, reason: 'amount_out_of_range' },
    ]);
  }

  return amountLamports;
}

export function validateIntentSemantics(intent) {
  let totalLamports = 0n;

  for (const [index, recipient] of intent.recipients.entries()) {
    assertCanonicalPublicKey(recipient.address, `/recipients/${index}/address`);

    const amount = BigInt(recipient.amountLamports);
    if (amount <= 0n || amount > MAX_U64) {
      throw new IntentValidationError('Intent contains an out-of-range lamport amount.', [
        { field: `/recipients/${index}/amountLamports`, reason: 'amount_out_of_range' },
      ]);
    }
    totalLamports += amount;
  }

  if (totalLamports > MAX_U64) {
    throw new IntentValidationError('The combined transfer amount is out of range.', [
      { field: '/recipients', reason: 'total_amount_out_of_range' },
    ]);
  }

  return intent;
}
