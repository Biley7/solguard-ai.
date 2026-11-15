import { expect } from '@playwright/test';

const MEMO_TEXT = 'SOLGUARD_V1 | OBSERVED_RISK: LOW 0/100 | HEURISTIC';
const SIGNATURE = '1'.repeat(64);

export async function installWalletMock(page, { rejectConnect = false } = {}) {
  const { Keypair } = await import('@solana/web3.js');
  const payer = await Keypair.generate();
  const address = payer.publicKey.toBase58();
  const seed = Array.from(payer.secretKey.slice(0, 32));

  await page.addInitScript(({ address, seed, rejectConnect }) => {
    const state = {
      behavior: rejectConnect ? 'reject-connect' : 'approve',
    };
    window.__solguardE2E = state;

    const handlers = new Map();
    const publicKey = { toBase58: () => address };

    class MockWebSocket {
      constructor() {
        this.readyState = 0;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.({});
        }, 0);
      }

      send(raw) {
        let message;
        try {
          message = JSON.parse(raw);
        } catch {
          return;
        }
        if (message.method === 'signatureSubscribe') {
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ jsonrpc: '2.0', id: message.id, result: 1 }),
            });
          }, 0);
        }
      }

      close() {
        this.readyState = 3;
        this.onclose?.({});
      }

      addEventListener(type, handler) {
        if (type === 'open') this.onopen = handler;
        if (type === 'message') this.onmessage = handler;
        if (type === 'error') this.onerror = handler;
        if (type === 'close') this.onclose = handler;
      }
    }
    window.WebSocket = MockWebSocket;

    const provider = {
      isPhantom: true,
      publicKey,
      async connect(options) {
        if (state.behavior === 'reject-connect' || options?.onlyIfTrusted) {
          throw Object.assign(new Error('User rejected the request'), { code: 4001 });
        }
        return { publicKey };
      },
      async disconnect() {},
      on(event, handler) {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(handler);
      },
      async signTransaction(transaction) {
        if (state.behavior === 'reject-sign') {
          throw Object.assign(new Error('User rejected the request'), { code: 4001 });
        }

        const pkcs8Prefix = Uint8Array.from([
            0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03,
            0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
          ]);
          const pkcs8 = new Uint8Array(pkcs8Prefix.length + seed.length);
          pkcs8.set(pkcs8Prefix, 0);
          pkcs8.set(seed, pkcs8Prefix.length);
        const key = await crypto.subtle.importKey(
          'pkcs8',
          pkcs8,
          { name: 'Ed25519' },
          false,
          ['sign'],
        );
        const signature = new Uint8Array(await crypto.subtle.sign(
          { name: 'Ed25519' },
          key,
          transaction.serializeMessage(),
        ));
        transaction.addSignature(transaction.feePayer, signature);
        return transaction;
      },
    };

    window.phantom = { solana: provider };
  }, { address, seed, rejectConnect });

  return { payer, address };
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

export async function installRpcMock(page, {
  balance = 10_000_000_000,
  failAll = false,
  failMethods = [],
  transactionFails = false,
} = {}) {
  const state = { sent: false, failAll, failMethods, transactionFails, balance };

  await page.route('https://api.devnet.solana.com/**', async (route) => {
    const request = route.request();
    let payload;
    try {
      payload = JSON.parse(request.postData() || '{}');
    } catch {
      await route.fulfill({ status: 400, body: 'invalid JSON-RPC request' });
      return;
    }

    const handle = (body) => {
      const { id, method } = body;
      if (state.failAll || state.failMethods.includes(method)) {
        return { jsonrpc: '2.0', id, error: { code: -32000, message: 'mock RPC failure' } };
      }

      if (method === 'getBalance') {
        return rpcResult(id, { context: { slot: 1 }, value: state.balance });
      }
      if (method === 'getAccountInfo') {
        return rpcResult(id, { context: { slot: 1 }, value: null });
      }
      if (method === 'getSignaturesForAddress') {
        return rpcResult(id, []);
      }
      if (method === 'getLatestBlockhash') {
        return rpcResult(id, {
          context: { slot: 1 },
          value: {
            blockhash: '11111111111111111111111111111111',
            lastValidBlockHeight: 500,
          },
        });
      }
      if (method === 'getFeeForMessage') {
        return rpcResult(id, { context: { slot: 1 }, value: 5000 });
      }
      if (method === 'getBlockHeight') {
        return rpcResult(id, state.sent ? 600 : 1);
      }
      if (method === 'simulateTransaction') {
        return rpcResult(id, {
          context: { slot: 1 },
          value: { err: null, logs: [], accounts: null, unitsConsumed: 0, returnData: null },
        });
      }
      if (method === 'sendTransaction') {
        state.sent = true;
        return rpcResult(id, SIGNATURE);
      }
      if (method === 'getSignatureStatuses') {
        const value = state.sent
          ? [{
            slot: 2,
            confirmations: 1,
            err: state.transactionFails ? { InstructionError: [0, 'Custom'] } : null,
            confirmationStatus: 'confirmed',
          }]
          : [null];
        return rpcResult(id, { context: { slot: 2 }, value });
      }
      if (method === 'getTransaction' || method === 'getParsedTransaction') {
        return rpcResult(id, {
          blockTime: 1_800_000_000,
          meta: { err: null },
          slot: 2,
          transaction: {
            message: {
              instructions: [{ program: 'spl-memo', parsed: MEMO_TEXT }],
            },
          },
        });
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `unmocked method ${method}` } };
    };

    const body = Array.isArray(payload)
      ? payload.map(handle)
      : handle(payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  return state;
}

export async function connectPhantom(page) {
  await page.goto('/#copilot');
  await page.getByRole('button', { name: /connect phantom/i }).click();
  await expect(page.locator('[data-wallet-label]')).toContainText(/…/);
}

export async function prepareTransfer(page, recipientAddress, amount = '0.25') {
  await page.locator('#copilot-prompt').fill(`Send ${amount} SOL to ${recipientAddress}.`);
  await page.getByRole('button', { name: /interpret request/i }).click();
  await expect(page.locator('[data-intent-result="ready"]')).toBeVisible();
  await page.getByRole('button', { name: /continue to security review/i }).click();
  await expect(page.locator('.transaction-confirmation')).toBeVisible();
}

export async function setPhantomBehavior(page, behavior) {
  await page.evaluate((next) => {
    window.__solguardE2E.behavior = next;
  }, behavior);
}

export { MEMO_TEXT, SIGNATURE };
