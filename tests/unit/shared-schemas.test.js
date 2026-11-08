import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const schemaDirectory = new URL('../../shared/schemas/', import.meta.url);
const schemaNames = [
  'IntentCandidate',
  'Recipient',
  'TransactionIntent',
  'RiskAssessment',
  'WalletSecurityReport',
  'TransactionPreview',
  'TransactionResult',
];

test('shared JSON schemas parse and declare closed object contracts', async () => {
  for (const name of schemaNames) {
    const source = await readFile(new URL(`${name}.schema.json`, schemaDirectory), 'utf8');
    const schema = JSON.parse(source);

    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.title, name);
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});

test('SOL amounts in shared contracts use canonical integer lamport strings', async () => {
  const source = await readFile(
    new URL('Recipient.schema.json', schemaDirectory),
    'utf8',
  );
  const schema = JSON.parse(source);

  assert.equal(schema.properties.amountLamports.type, 'string');
  assert.equal(schema.properties.amountLamports.pattern, '^[1-9][0-9]*$');
});

test('AI candidate amounts are decimal strings, never JSON numbers', async () => {
  const source = await readFile(
    new URL('IntentCandidate.schema.json', schemaDirectory),
    'utf8',
  );
  const schema = JSON.parse(source);
  const amountSchema = schema.properties.recipients.items.properties.amountSol;

  assert.equal(amountSchema.type, 'string');
  assert.equal(amountSchema.pattern, '^(?:0|[1-9][0-9]*)(?:\\.[0-9]{1,9})?$');
});

test('transaction intent and preview cap batches at five recipients', async () => {
  for (const name of ['TransactionIntent', 'TransactionPreview']) {
    const source = await readFile(new URL(`${name}.schema.json`, schemaDirectory), 'utf8');
    const schema = JSON.parse(source);

    assert.equal(schema.properties.recipients.minItems, 1);
    assert.equal(schema.properties.recipients.maxItems, 5);
  }
});

test('local schema references resolve to declared shared contracts', async () => {
  for (const name of schemaNames) {
    const source = await readFile(new URL(`${name}.schema.json`, schemaDirectory), 'utf8');
    const schema = JSON.parse(source);
    const references = JSON.stringify(schema).matchAll(/"\$ref":"([^"]+)"/g);

    for (const [, reference] of references) {
      assert.equal(reference.includes('://'), false, `${name} must not use a remote schema`);
      const referencedName = reference.split(':').at(-1);
      assert.ok(schemaNames.includes(referencedName), `${name} references an unknown schema`);
      await readFile(new URL(`${referencedName}.schema.json`, schemaDirectory), 'utf8');
    }
  }
});
