const buildEnvironment = import.meta.env ?? {};
const configuredNetwork = String(buildEnvironment.VITE_SOLANA_NETWORK ?? 'devnet').trim();
const configuredRpcUrl = String(
  buildEnvironment.VITE_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
).trim();

if (configuredNetwork !== 'devnet') {
  throw new Error('SolGuard is Devnet-only. Mainnet configuration is not available.');
}
if (buildEnvironment.VITE_ENABLE_MAINNET === 'true') {
  throw new Error('Mainnet is disabled until the production gates are separately approved.');
}

let parsedRpcUrl;
try {
  parsedRpcUrl = new URL(configuredRpcUrl);
} catch {
  throw new Error('VITE_SOLANA_RPC_URL must be a valid URL.');
}
if (parsedRpcUrl.protocol !== 'https:') {
  throw new Error('VITE_SOLANA_RPC_URL must use HTTPS.');
}
if (/mainnet/i.test(parsedRpcUrl.hostname) || /mainnet/i.test(parsedRpcUrl.pathname)) {
  throw new Error('Mainnet RPC endpoints are blocked. Use a Devnet endpoint.');
}

export const SOLANA_NETWORK = 'devnet';
export const SOLANA_RPC_URL = parsedRpcUrl.toString().replace(/\/$/, '');
export const SOLANA_COMMITMENT = 'confirmed';
export const LAMPORTS_PER_SOL = 1_000_000_000n;
