import { Connection } from '@solana/web3.js';
import {
  SOLANA_COMMITMENT,
  SOLANA_RPC_URL,
} from '../config/network.js';

let connection;

export function getDevnetConnection() {
  if (!connection) {
    connection = new Connection(SOLANA_RPC_URL, SOLANA_COMMITMENT);
  }
  return connection;
}
