import { readFileSync } from 'node:fs';

const failures = [];
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const render = readFileSync('render.yaml', 'utf8');
const examples = [
  '.env.example',
  'config/environments/local.env.example',
  'config/environments/staging.env.example',
  'config/environments/production.env.example',
];

const allHeaders = (vercel.headers ?? []).flatMap((entry) => entry.headers ?? []);
const header = (name) => allHeaders.find((entry) => entry.key.toLowerCase() === name.toLowerCase())?.value ?? '';
const csp = header('Content-Security-Policy');

if (!csp.includes("frame-ancestors 'none'")) failures.push('Vercel CSP must deny framing.');
if (!csp.includes("script-src 'self'")) failures.push("Vercel CSP must restrict scripts to 'self'.");
if (csp.includes("'unsafe-eval'")) failures.push('Vercel CSP must not allow unsafe-eval.');
if (!header('Strict-Transport-Security').includes('max-age=')) failures.push('Vercel must send HSTS.');
if (!header('X-Content-Type-Options').includes('nosniff')) failures.push('Vercel must send nosniff.');
if (vercel.outputDirectory !== 'dist') failures.push('Vercel outputDirectory must be dist.');

for (const required of [
  'solguard-api-staging',
  'solguard-api-production',
  'healthCheckPath: /api/health',
  'autoDeployTrigger: off',
  'ENABLE_MAINNET',
]) {
  if (!render.includes(required)) failures.push(`render.yaml is missing: ${required}`);
}
if (/ENABLE_MAINNET[\s\S]{0,40}value:\s*"?true"?/i.test(render)) {
  failures.push('render.yaml must not enable Mainnet.');
}

for (const file of examples) {
  const content = readFileSync(file, 'utf8');
  if (/^\s*(?:ENABLE_MAINNET|VITE_ENABLE_MAINNET)\s*=\s*true\s*$/im.test(content)) {
    failures.push(`${file} must not enable Mainnet.`);
  }
  if (/GEMINI_API_KEY\s*=\s*[^\s#]+/.test(content) && !/GEMINI_API_KEY\s*=\s*(?:$|set-in-)/im.test(content)) {
    failures.push(`${file} contains a non-placeholder Gemini credential.`);
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checks: ['vercel security headers', 'render services and health checks', 'Devnet-only templates'],
}, null, 2));
