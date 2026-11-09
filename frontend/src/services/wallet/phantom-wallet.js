import { PublicKey } from '@solana/web3.js';

const REJECTED_CODES = new Set([4001, 4100]);

export class PhantomWalletError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'PhantomWalletError';
    this.code = code;
  }
}

export function getPhantomProvider(windowRef = globalThis.window) {
  const provider = windowRef?.phantom?.solana
    ?? (windowRef?.solana?.isPhantom ? windowRef.solana : undefined);
  return provider?.isPhantom ? provider : undefined;
}

function normalizePublicKey(value) {
  try {
    const address = typeof value?.toBase58 === 'function' ? value.toBase58() : String(value);
    const publicKey = new PublicKey(address);
    if (publicKey.toBase58() !== address) throw new Error('Non-canonical public key.');
    return address;
  } catch (error) {
    throw new PhantomWalletError(
      'INVALID_WALLET_RESPONSE',
      'Phantom returned an invalid wallet address.',
      error,
    );
  }
}

function isRejected(error) {
  return REJECTED_CODES.has(error?.code)
    || error?.name === 'WalletSignTransactionError'
    || error?.name === 'WalletConnectionError' && /reject|declin/i.test(error.message ?? '');
}

function mapWalletError(error) {
  if (error instanceof PhantomWalletError) return error;
  if (isRejected(error)) {
    return new PhantomWalletError('USER_REJECTED', 'The wallet connection request was rejected.', error);
  }
  return new PhantomWalletError('CONNECTION_FAILED', 'Could not connect to Phantom.', error);
}

export function createPhantomWallet({ providerLookup = getPhantomProvider } = {}) {
  let provider;
  const listeners = new Set();
  let boundProvider;
  let connectedAddress;

  function emit(state) {
    for (const listener of listeners) listener(state);
  }

  function setConnected(address) {
    if (connectedAddress === address) return { status: 'connected', address };
    connectedAddress = address;
    const state = { status: 'connected', address };
    emit(state);
    return state;
  }

  function setDisconnected() {
    if (!connectedAddress) return { status: 'disconnected', address: null };
    connectedAddress = null;
    const state = { status: 'disconnected', address: null };
    emit(state);
    return state;
  }

  function bindProviderEvents() {
    if (boundProvider === provider || typeof provider?.on !== 'function') return;
    boundProvider = provider;
    provider.on('accountChanged', (publicKey) => {
      if (!publicKey) {
        setDisconnected();
        return;
      }

      try {
        setConnected(normalizePublicKey(publicKey));
      } catch {
        connectedAddress = null;
        emit({ status: 'error', address: null, code: 'INVALID_WALLET_RESPONSE' });
      }
    });
    provider.on('disconnect', setDisconnected);
    provider.on('connect', (publicKey) => {
      try {
        setConnected(normalizePublicKey(publicKey ?? provider.publicKey));
      } catch {
        connectedAddress = null;
        emit({ status: 'error', address: null, code: 'INVALID_WALLET_RESPONSE' });
      }
    });
  }

  function getAvailableProvider() {
    const detectedProvider = providerLookup();
    if (detectedProvider !== provider) {
      provider = detectedProvider;
      boundProvider = undefined;
    }
    if (!provider) {
      throw new PhantomWalletError(
        'PROVIDER_UNAVAILABLE',
        'Phantom was not detected. Install or enable the Phantom browser extension.',
      );
    }
    bindProviderEvents();
    return provider;
  }

  async function connect() {
    const wallet = getAvailableProvider();
    try {
      const response = await wallet.connect();
      const address = normalizePublicKey(response?.publicKey ?? wallet.publicKey);
      return setConnected(address);
    } catch (error) {
      throw mapWalletError(error);
    }
  }

  async function restore() {
    let wallet;
    try {
      wallet = getAvailableProvider();
    } catch (error) {
      if (error.code === 'PROVIDER_UNAVAILABLE') return null;
      throw error;
    }

    try {
      const response = await wallet.connect({ onlyIfTrusted: true });
      return setConnected(normalizePublicKey(response?.publicKey ?? wallet.publicKey));
    } catch (error) {
      if (isRejected(error)) return null;
      throw mapWalletError(error);
    }
  }

  async function disconnect() {
    const wallet = provider ?? getAvailableProvider();
    try {
      await wallet.disconnect();
      return setDisconnected();
    } catch (error) {
      throw new PhantomWalletError('DISCONNECT_FAILED', 'Could not disconnect Phantom.', error);
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    connect,
    disconnect,
    restore,
    subscribe,
    isInstalled: () => Boolean(providerLookup()),
  };
}
