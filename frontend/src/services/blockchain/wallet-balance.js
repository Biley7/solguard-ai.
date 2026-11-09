import { PublicKey } from '@solana/web3.js';
import { getDevnetConnection } from '../../../../blockchain/src/rpc/devnet-connection.js';
import {
  LAMPORTS_PER_SOL,
  SOLANA_COMMITMENT,
  SOLANA_NETWORK,
} from '../../../../blockchain/src/config/network.js';

export class WalletBalanceError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'WalletBalanceError';
    this.code = 'BALANCE_UNAVAILABLE';
  }
}

export function formatLamportsAsSol(lamports) {
  const isValidNumber = Number.isSafeInteger(lamports) && lamports >= 0;
  const isValidBigInt = typeof lamports === 'bigint'
    && lamports >= 0n
    && lamports <= ((1n << 64n) - 1n);
  if (!isValidNumber && !isValidBigInt) {
    throw new WalletBalanceError('The Devnet RPC returned an invalid lamport balance.');
  }

  const amount = BigInt(lamports);
  const wholeSol = amount / LAMPORTS_PER_SOL;
  const fractionalLamports = amount % LAMPORTS_PER_SOL;
  const fraction = fractionalLamports.toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${wholeSol}.${fraction}` : wholeSol.toString();
}

export async function fetchDevnetBalance(address, connection = getDevnetConnection()) {
  try {
    const publicKey = new PublicKey(address);
    if (publicKey.toBase58() !== address) {
      throw new Error('Wallet address is not canonical.');
    }

    const lamports = await connection.getBalance(publicKey, SOLANA_COMMITMENT);
    const balanceLamports = BigInt(lamports);
    return {
      lamports: balanceLamports,
      sol: formatLamportsAsSol(balanceLamports),
      network: SOLANA_NETWORK,
      observedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof WalletBalanceError) throw error;
    throw new WalletBalanceError('Could not load the wallet balance from Solana Devnet.', error);
  }
}
