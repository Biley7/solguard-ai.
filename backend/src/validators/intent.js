import { validateSchema } from './schema-validator.js';
import {
  assertCanonicalPublicKey,
  IntentValidationError,
  solAmountToLamports,
  validateIntentSemantics,
} from '../../../shared/validation/transaction-intent.js';

export { IntentValidationError };

export function validateIntentCandidate(candidate) {
  const result = validateSchema('IntentCandidate', candidate);
  if (!result.valid) {
    throw new IntentValidationError('AI intent candidate does not match the supported schema.', result.errors);
  }

  const intent = {
    network: 'devnet',
    recipients: candidate.recipients.map((recipient, index) => {
      assertCanonicalPublicKey(recipient.address, `/recipients/${index}/address`);
      return {
        address: recipient.address,
        amountLamports: solAmountToLamports(
          recipient.amountSol,
          `/recipients/${index}/amountSol`,
        ).toString(),
      };
    }),
  };

  return validateTransactionIntent(intent);
}

export function validateTransactionIntent(intent) {
  const result = validateSchema('TransactionIntent', intent);
  if (!result.valid) {
    throw new IntentValidationError('Transaction intent does not match the supported schema.', result.errors);
  }

  return validateIntentSemantics(intent);
}
