import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const DIST = 'dist';
const TEXT_EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg', '.txt', '.map']);
const SECRET_PATTERNS = [
  { name: 'google_api_key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'private_key_block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'vercel_token', pattern: /\bVERCEL_TOKEN\b/ },
  { name: 'render_api_key', pattern: /\bRENDER_API_KEY\b/ },
  { name: 'gemini_key_name', pattern: /\bGEMINI_API_KEY\b/ },
  { name: 'metrics_token_name', pattern: /\bMETRICS_TOKEN\b/ },
];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('dist/ does not exist. Run npm run build first.');
  process.exit(1);
}

const findings = [];
let scanned = 0;
for (const file of files) {
  if (!TEXT_EXTENSIONS.has(extname(file))) continue;
  const content = readFileSync(file, 'utf8');
  scanned += 1;
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) findings.push({ file: relative(DIST, file), pattern: name });
  }
}

// Never print the secret value. Compare only to detect accidental bundling.
for (const envName of ['GEMINI_API_KEY', 'METRICS_TOKEN']) {
  const value = process.env[envName]?.trim();
  if (!value || value.length < 12) continue;
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;
    if (readFileSync(file, 'utf8').includes(value)) {
      findings.push({ file: relative(DIST, file), pattern: `${envName}_value` });
    }
  }
}

if (findings.length > 0) {
  console.error(JSON.stringify({ scanned, findings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ scanned, findings: [] }, null, 2));
