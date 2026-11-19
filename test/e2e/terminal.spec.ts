import { expect, test } from './fixtures.js';

test.use({ terminal: true });

test('retains independent shells while the bottom panel is hidden', async ({ page, repo }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const output: string[] = [];
  page.on('websocket', (socket) => {
    if (!new URL(socket.url()).pathname.endsWith('/api/terminal/socket')) return;
    const i = output.push('') - 1;
    socket.on('framereceived', ({ payload }) => {
      output[i] += payload.toString();
    });
  });
  const panel = page.getByRole('region', { name: 'Terminal panel' });
  const run = async (command: string) => {
    await page.evaluate((text) => navigator.clipboard.writeText(text), command);
    await page.keyboard.press('Control+Shift+V');
    await page.keyboard.press('Enter');
  };

  await page.getByRole('button', { name: 'Terminal', exact: true }).click();
  await expect(panel.locator('canvas').first()).toBeVisible();
  await expect.poll(() => output[0]?.length ?? 0).toBeGreaterThan(0);
  await run('printf "<cwd>%s</cwd>\\n" "$PWD"');
  await expect.poll(() => output[0]).toContain(`<cwd>${repo}</cwd>`);
  await run('export DIFFLE_TAB_TEST=first');

  await panel.getByRole('button', { name: 'New terminal' }).click();
  await expect.poll(() => output[1]?.length ?? 0).toBeGreaterThan(0);
  await run('printf "<tab>%s</tab>\\n" "${DIFFLE_TAB_TEST:-second}"');
  await expect.poll(() => output[1]).toContain('<tab>second</tab>');

  await page.keyboard.press('Control+Backquote');
  await expect(panel).toBeHidden();
  await page.keyboard.press('Control+Backquote');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Terminal 1', exact: true }).click();
  await run('printf "<tab>%s</tab>\\n" "$DIFFLE_TAB_TEST"');
  await expect.poll(() => output[0]).toContain('<tab>first</tab>');

  await panel.getByRole('button', { name: 'Close terminal 2', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Terminal 2', exact: true })).toHaveCount(0);
});
