import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaNames = [
  'IntentCandidate',
  'Recipient',
  'RiskAssessment',
  'TransactionIntent',
  'TransactionPreview',
  'TransactionResult',
  'WalletSecurityReport',
];

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

for (const name of schemaNames) {
  const schemaUrl = new URL(`../../../shared/schemas/${name}.schema.json`, import.meta.url);
  const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
  ajv.addSchema(schema);
}

export function validateSchema(name, value) {
  const validate = ajv.getSchema(`urn:solguard:schema:${name}`);
  if (!validate) {
    throw new Error(`Unknown schema: ${name}`);
  }

  const valid = validate(value);
  return {
    valid,
    errors: (validate.errors ?? []).map(({ instancePath, keyword, message }) => ({
      instancePath,
      keyword,
      message,
    })),
  };
}
