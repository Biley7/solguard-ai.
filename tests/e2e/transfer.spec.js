import { expect, test } from '@playwright/test';
import { Keypair } from '@solana/web3.js';
import {
  connectPhantom,
  installRpcMock,
  installWalletMock,
  prepareTransfer,
  setPhantomBehavior,
} from './fixtures.js';

async function recipientAddress() {
  return (await Keypair.generate()).publicKey.toBase58();
}

test('happy path: connect, interpret, scan, review, approve, confirm, and open Explorer', async ({ page }) => {
  const recipient = await recipientAddress();
  await installWalletMock(page);
  await installRpcMock(page);
  await connectPhantom(page);
  await prepareTransfer(page, recipient);

  const confirmation = page.locator('.transaction-confirmation');
  await expect(confirmation.getByText(recipient, { exact: false })).toBeVisible();
  await expect(confirmation.getByText('0.25 SOL', { exact: false }).first()).toBeVisible();
  await expect(confirmation.getByText('Provenance memo')).toBeVisible();

  await page.getByRole('button', { name: /approve with phantom/i }).click();
  await expect(page.getByRole('heading', { name: /confirmed on solana devnet/i })).toBeVisible();
  await expect(page.locator('.execution-actions a')).toHaveAttribute('href', /explorer\.solana\.com\/tx\//);
  await expect(page.locator('.execution-actions a')).toHaveAttribute('target', '_blank');
});

test('rejects a wallet connection without entering the review flow', async ({ page }) => {
  await installWalletMock(page, { rejectConnect: true });
  await installRpcMock(page);
  await page.goto('/#copilot');
  await page.getByRole('button', { name: /connect phantom/i }).click();

  await expect(page.locator('#toast-region')).toContainText(/rejected/i);
  await expect(page.locator('[data-wallet-label]')).toHaveText(/connect phantom/i);
  await expect(page.locator('.transaction-confirmation')).toHaveCount(0);
});

test('rejects an invalid recipient before any RPC scan', async ({ page }) => {
  await installWalletMock(page);
  await installRpcMock(page);
  await page.goto('/#scanner');
  await page.locator('#scanner-address').fill('not-a-public-key');
  await page.getByRole('button', { name: /scan wallet/i }).click();

  await expect(page.locator('[data-feedback="scanner"]')).toContainText(/valid canonical solana public address/i);
  await expect(page.locator('#scanner-result')).toContainText(/No address inspected/i);
});

test('shows a safe error when Gemini or the interpretation endpoint fails', async ({ page }) => {
  await installWalletMock(page);
  await installRpcMock(page);
  await page.route('**/api/ai/interpret', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message: 'AI service unavailable.' } }),
    });
  });
  await page.goto('/#copilot');
  await page.locator('#copilot-prompt').fill('Send 0.25 SOL to a valid address.');
  await page.getByRole('button', { name: /interpret request/i }).click();

  await expect(page.locator('[data-intent-result="error"]')).toContainText(/AI service unavailable/i);
  await expect(page.locator('.transaction-confirmation')).toHaveCount(0);
});

test('blocks preparation when recipient RPC evidence is unavailable', async ({ page }) => {
  await installWalletMock(page);
  await installRpcMock(page, { failAll: true });
  await connectPhantom(page);
  await prepareTransfer(page, await recipientAddress()).catch(() => {});

  await expect(page.locator('#intent-review-stage')).toContainText(/could not be verified|could not be safely prepared/i);
  await expect(page.locator('.transaction-confirmation')).toHaveCount(0);
});

test('blocks preparation when the sender balance is insufficient', async ({ page }) => {
  await installWalletMock(page);
  await installRpcMock(page, { balance: 1 });
  await connectPhantom(page);
  await prepareTransfer(page, await recipientAddress()).catch(() => {});

  await expect(page.locator('#intent-review-stage')).toContainText(/balance|insufficient funds/i);
  await expect(page.locator('.transaction-confirmation')).toHaveCount(0);
});

test('reports Phantom signing rejection without claiming submission', async ({ page }) => {
  await installWalletMock(page);
  await installRpcMock(page);
  await connectPhantom(page);
  await prepareTransfer(page, await recipientAddress());
  await setPhantomBehavior(page, 'reject-sign');
  await page.getByRole('button', { name: /approve with phantom/i }).click();

  await expect(page.getByRole('heading', { name: /phantom signing was rejected/i })).toBeVisible();
  await expect(page.locator('.execution-actions a')).toHaveCount(0);
});

test('reports a failed confirmed transaction with its signature and Explorer link', async ({ page }) => {
  await installWalletMock(page);
  await installRpcMock(page, { transactionFails: true });
  await connectPhantom(page);
  await prepareTransfer(page, await recipientAddress());
  await page.getByRole('button', { name: /approve with phantom/i }).click();

  await expect(page.getByRole('heading', { name: /transaction failed on solana devnet/i })).toBeVisible();
  await expect(page.locator('.execution-actions a')).toHaveAttribute('href', /explorer\.solana\.com\/tx\//);
});
