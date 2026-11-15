import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SOURCE_DIRECTORIES = [
  'backend',
  'blockchain',
  'frontend',
  'scripts',
  'shared',
  'tests',
];
const ROOT_FILES = [
  'playwright.config.js',
  'vite.config.js',
];
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const SECRET_PATTERNS = [
  {
    name: 'Google API key',
    pattern: /AIza[0-9A-Za-z_-]{30,}/,
  },
  {
    name: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'browser-exposed Gemini configuration',
    pattern: /VITE_[A-Z0-9_]*GEMINI/,
  },
  {
    name: 'assigned Gemini key',
    pattern: /GEMINI_API_KEY\s*[:=]\s*['"]?(?!replace_with)[A-Za-z0-9_-]{20,}/,
  },
  {
    name: 'hard-coded Mainnet RPC endpoint',
    pattern: /api\.mainnetbeta\.solana\.com/,
  },
];

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...walk(join(directory, entry.name)));
      continue;
    }
    if (entry.isFile()) files.push(join(directory, entry.name));
  }
  return files;
}

const files = [
  ...SOURCE_DIRECTORIES.flatMap((directory) => walk(join(ROOT, directory))),
  ...ROOT_FILES.map((file) => join(ROOT, file)),
];
const codeFiles = files.filter((file) => CODE_EXTENSIONS.has(extname(file)));
const textFiles = files.filter((file) => !/\.(?:png|jpe?g|gif|webp|ico|woff2?|zip)$/i.test(file));

const failures = [];

for (const file of codeFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${relative(ROOT, file)}: syntax check failed\n${result.stderr.trim()}`);
  }
}

for (const file of textFiles) {
  const relativePath = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(source)) failures.push(`${relativePath}: possible ${name}`);
  }
}

if (failures.length > 0) {
  console.error(`Lint failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lint passed: ${codeFiles.length} JavaScript files parsed, ${textFiles.length} files scanned for secrets and unsafe endpoints.`);
