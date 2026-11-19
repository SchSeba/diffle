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

test.describe('startup terminals and splits', () => {
  test.use({ args: ["--terminal=printf '<startup>%s</startup>\\n' codex; exec /bin/sh", '--terminal'] });

  test('opens ordered tabs and moves focus between tabs and splits', async ({ page }) => {
    const output = new Map<string | null, string>();
    page.on('websocket', (socket) => {
      const url = new URL(socket.url());
      if (!url.pathname.endsWith('/api/terminal/socket')) return;
      const startup = url.searchParams.get('startup');
      output.set(startup, '');
      socket.on('framereceived', ({ payload }) => {
        output.set(startup, (output.get(startup) ?? '') + payload.toString());
      });
    });
    await page.reload();
    const panel = page.getByRole('region', { name: 'Terminal panel' });
    const first = panel.getByRole('button', { name: 'Terminal 1', exact: true });
    const second = panel.getByRole('button', { name: 'Terminal 2', exact: true });
    const pane = (id: number) => panel.locator(`[data-terminal-pane="${id}"]`);
    const focused = (id: number) => pane(id).locator(':focus');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    await expect(focused(1)).toHaveCount(1);
    await expect.poll(() => output.get('0')).toContain('<startup>codex</startup>');
    await expect.poll(() => output.get('1')?.length ?? 0).toBeGreaterThan(0);
    expect(output.get('1')).not.toContain('<startup>');

    await page.keyboard.press('Alt+Shift+J');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(focused(2)).toHaveCount(1);
    await panel.getByRole('button', { name: 'Split terminal right' }).click();
    await expect(focused(3)).toHaveCount(1);
    const left = await pane(2).boundingBox();
    const right = await pane(3).boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x);

    await page.keyboard.press('Alt+Shift+H');
    await expect(focused(2)).toHaveCount(1);
    await page.keyboard.press('Alt+Shift+L');
    await expect(focused(3)).toHaveCount(1);
    await page.keyboard.press('Alt+Shift+K');
    await expect(focused(1)).toHaveCount(1);
    await page.keyboard.press('Alt+Shift+J');
    await expect(focused(3)).toHaveCount(1);
    await page.keyboard.press('Control+Backquote');
    await expect(panel).toBeHidden();
    await page.keyboard.press('Alt+Shift+G');
    await expect(panel).toBeVisible();
    await expect(focused(3)).toHaveCount(1);
    await second.focus();
    await page.keyboard.press('Alt+Shift+G');
    await expect(focused(3)).toHaveCount(1);
    await panel.getByRole('button', { name: 'Close active terminal pane' }).click();
    await expect(pane(3)).toHaveCount(0);
    await expect(focused(2)).toHaveCount(1);
  });
});
