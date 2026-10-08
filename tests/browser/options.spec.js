import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extension } from './helpers.js';
async function options(page) {
  await extension(page);
  await page.goto('/dist/options.html');
  await expect(page.locator('.leetify-options')).toBeVisible();
  await expect(page.locator('[data-save-status]')).toContainText('Saved');
}
async function file(page, backup) {
  await page.getByLabel('Backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
}
test('settings patch preserves another tab preference and fresh export includes a later draft', async ({
  page,
}) => {
  await options(page);
  await page.evaluate(() => __leetifyTest.patchSettings({ fontSize: 18 }));
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('light');
  await expect
    .poll(() => page.evaluate(() => __leetifyTest.snapshot().then((s) => s.settings.theme)))
    .toBe('light');
  expect(await page.evaluate(() => __leetifyTest.snapshot().then((s) => s.settings.fontSize))).toBe(
    18
  );
  await page.evaluate(() =>
    __leetifyTest.externalSave({
      key: 'cf:4:A',
      language: 'cpp',
      code: 'newer source',
      expectedRevision: 0,
    })
  );
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON backup', exact: true }).click();
  const download = await downloading;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.state.solutions['cf:4:A'].cpp.code).toBe('newer source');
});
test('invalid import has no writes and merge preserves the active draft', async ({ page }) => {
  await options(page);
  await page.evaluate(() =>
    __leetifyTest.externalSave({
      key: 'cf:4:A',
      language: 'cpp',
      code: 'active source',
      expectedRevision: 0,
    })
  );
  const writes = await page.evaluate(() => __leetifyTest.writes);
  await file(page, { bad: true });
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await expect(page.locator('[data-backup-status]')).toContainText('valid');
  expect(await page.evaluate(() => __leetifyTest.writes)).toBe(writes);
  const backup = await page.evaluate(() => __leetifyTest.export());
  backup.state.solutions['cf:4:A'].cpp.code = 'imported source';
  await file(page, backup);
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await expect(page.locator('[data-backup-status]')).toContainText('merged');
  expect(
    await page.evaluate(() => __leetifyTest.snapshot().then((s) => s.solutions['cf:4:A'].cpp.code))
  ).toBe('active source');
  expect(
    await page.evaluate(() =>
      __leetifyTest
        .snapshot()
        .then((s) => s.recoveredDrafts.some((d) => d.code === 'imported source'))
    )
  ).toBe(true);
});
test('replacement requires confirmation and the previous snapshot can be restored', async ({
  page,
}) => {
  await options(page);
  await page.evaluate(() =>
    __leetifyTest.externalSave({
      key: 'cf:4:A',
      language: 'cpp',
      code: 'before replacement',
      expectedRevision: 0,
    })
  );
  const backup = await page.evaluate(() => __leetifyTest.export());
  backup.state.solutions['cf:4:A'].cpp.code = 'replacement';
  await file(page, backup);
  await page.getByRole('button', { name: 'Replace from backup', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Replace local data?' })).toBeVisible();
  expect(
    await page.evaluate(() => __leetifyTest.snapshot().then((s) => s.solutions['cf:4:A'].cpp.code))
  ).toBe('before replacement');
  await page.getByRole('button', { name: 'Replace local data', exact: true }).click();
  await expect(page.locator('[data-backup-status]')).toContainText('replaced');
  await page.getByRole('button', { name: 'Restore snapshot', exact: true }).click();
  await page.getByRole('button', { name: 'Restore local data', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => __leetifyTest.snapshot().then((s) => s.solutions['cf:4:A'].cpp.code))
    )
    .toBe('before replacement');
});
test('runner grant denial and empty runtimes are actionable without sending source', async ({
  page,
}) => {
  await options(page);
  await page.evaluate(() => (__leetifyTest.denyPermission = true));
  await page.getByRole('button', { name: 'Grant runner access', exact: true }).click();
  await expect(page.locator('[data-runner-status]')).toContainText('denied');
  await page.evaluate(() => {
    __leetifyTest.denyPermission = false;
    __leetifyTest.emptyRuntimes = true;
  });
  await page.getByRole('button', { name: 'Check connection', exact: true }).click();
  await expect(page.locator('[data-runner-status]')).toContainText('no runtimes');
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(0);
});
