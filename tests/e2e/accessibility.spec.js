import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { Keypair } from '@solana/web3.js';
import {
  connectPhantom,
  installRpcMock,
  installWalletMock,
  prepareTransfer,
} from './fixtures.js';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function axeViolations(page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    return result.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
  });
}

test('transaction review and discard dialog are accessible and return focus', async ({ page }) => {
  const recipient = (await Keypair.generate()).publicKey.toBase58();
  await installWalletMock(page);
  await installRpcMock(page);
  await connectPhantom(page);
  await prepareTransfer(page, recipient);

  expect(await axeViolations(page)).toEqual([]);

  const cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  await cancelButton.click();
  const dialog = page.locator('dialog[data-cancel-dialog]');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: /discard this prepared transaction/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /keep review/i })).toBeFocused();

  expect(await axeViolations(page)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(cancelButton).toBeFocused();
});

test('offline interpretation fails safely without claiming an AI response', async ({ page, context }) => {
  await installWalletMock(page);
  await installRpcMock(page);
  await page.goto('/#copilot');
  await context.setOffline(true);
  await page.locator('#copilot-prompt').fill('Send 0.25 SOL to a valid address.');
  await page.getByRole('button', { name: /interpret request/i }).click();

  await expect(page.locator('[data-feedback="copilot"]')).toContainText(/offline/i);
  await expect(page.locator('[data-intent-result="ready"]')).toHaveCount(0);
  await expect(page.locator('.transaction-confirmation')).toHaveCount(0);
});
