import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { extension, replaceCode } from './helpers.js';
const directory = path.resolve(process.env.LEETIFY_PREVIEW_DIR || 'test-results/previews');
const source =
  '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    int weight;\n    cin >> weight;\n    cout << (weight > 2 && weight % 2 == 0 ? "YES" : "NO") << "\\n";\n    return 0;\n}\n';
test('preview built workspace and settings at desktop and compact sizes', async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await extension(page);
  await replaceCode(page, source);
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2 passed');
  await expect(page.locator('.lf-save-status')).toContainText('Saved');
  await page.screenshot({
    path: path.join(directory, `leetify-desktop-${test.info().project.name}.png`),
  });
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await expect(page.locator('#leetify-workspace')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({
    path: path.join(directory, `leetify-light-${test.info().project.name}.png`),
  });
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await page.screenshot({
    path: path.join(directory, `leetify-mobile-${test.info().project.name}.png`),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/dist/options.html');
  await expect(page.locator('[data-save-status]')).toContainText('Saved');
  await page.screenshot({
    path: path.join(directory, `leetify-settings-${test.info().project.name}.png`),
  });
  expect(errors).toEqual([]);
});
