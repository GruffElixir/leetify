import { test, expect } from '@playwright/test';
import { extension, replaceCode, chooseProblem, saved } from './helpers.js';
test('navigate A to B and browser Back/Forward restores language drafts and formulas', async ({
  page,
}) => {
  await extension(page);
  await replaceCode(page, 'A cpp draft');
  await saved(page, 'A cpp draft');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('python');
  await replaceCode(page, 'A python draft');
  await saved(page, 'A python draft', 'python');
  await chooseProblem(page, 'B');
  await expect(page.locator('.lf-description .katex')).toHaveCount(2);
  await expect(page.locator('.lf-description .MathJax')).toContainText('existing rendered formula');
  await expect(page.locator('.lf-description img').first()).toHaveAttribute(
    'src',
    'https://codeforces.com/contest/4/diagram.svg'
  );
  await replaceCode(page, 'B python draft');
  await saved(page, 'B python draft', 'python', 'cf:4:B');
  await page.goBack();
  await expect(page.locator('h1')).toContainText('A.');
  await expect(page.locator('.cm-content')).toContainText('A python draft');
  await page.goForward();
  await expect(page.locator('h1')).toContainText('B.');
  await expect(page.locator('.cm-content')).toContainText('B python draft');
});
test('failed navigation leaves the current problem and draft intact', async ({ page }) => {
  await extension(page);
  await replaceCode(page, 'keep me');
  await saved(page, 'keep me');
  await page.evaluate(() => (__leetifyTest.failNavigation = true));
  await page.getByRole('button', { name: 'Problems', exact: true }).click();
  await page.getByRole('button', { name: /^B\./ }).click();
  await expect(page.locator('[data-status=message]')).toContainText('verification');
  await expect(page.locator('h1')).toContainText('A.');
  await expect(page.locator('.cm-content')).toContainText('keep me');
  expect(page.url()).toContain('/problem/4/A');
});
test('save errors remain unsaved and retry succeeds without losing source', async ({ page }) => {
  await extension(page);
  await page.evaluate(() => (__leetifyTest.failWrites = true));
  await replaceCode(page, 'unsaved source');
  await expect(page.locator('[data-status=save]')).toContainText('Unsaved');
  await page.evaluate(() => (__leetifyTest.failWrites = false));
  await page.locator('[data-status=save]').click();
  await saved(page, 'unsaved source');
  await expect(page.locator('[data-status=save]')).toContainText('Saved');
});
test('external tab conflict preserves both drafts and offers review', async ({ page }) => {
  await extension(page);
  await page.evaluate(() => (__leetifyTest.failWrites = true));
  await replaceCode(page, 'my draft');
  await expect(page.locator('[data-status=save]')).toContainText('Unsaved');
  await page.evaluate(async () => {
    __leetifyTest.failWrites = false;
    await __leetifyTest.externalSave({
      key: 'cf:4:A',
      language: 'cpp',
      code: 'other tab',
      expectedRevision: 0,
    });
  });
  await expect(page.locator('[data-status=save]')).toContainText('Conflict');
  expect(
    await page.evaluate(() => __leetifyTest.snapshot().then((s) => s.solutions['cf:4:A'].cpp.code))
  ).toBe('other tab');
  expect(
    await page.evaluate(() =>
      __leetifyTest.snapshot().then((s) => s.recoveredDrafts.some((d) => d.code === 'my draft'))
    )
  ).toBe(true);
  await page.locator('[data-status=save]').click();
  await expect(page.getByRole('dialog', { name: 'Resolve draft conflict' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my draft', exact: true }).click();
  await saved(page, 'my draft');
});
test('custom cases persist and restoration does not trigger opt-in auto-run', async ({ page }) => {
  await extension(page);
  await page.getByRole('button', { name: 'Add custom case' }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('custom input');
  await expect
    .poll(() =>
      page.evaluate(() => __leetifyTest.snapshot().then((s) => s.cases['cf:4:A']?.[0]?.input))
    )
    .toBe('custom input');
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(0);
  await page.getByRole('button', { name: 'Exit workspace' }).click();
  await page.evaluate(() => __leetifyTest.toggle());
  await expect(page.getByRole('button', { name: 'Custom 1', exact: true })).toBeVisible();
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(0);
});
test('logged-out submission offers a native fallback and sends no POST', async ({ page }) => {
  await extension(page);
  await page.evaluate(() => (__leetifyTest.submitPage = 'login'));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Submit on Codeforces' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open native Submit' })).toHaveAttribute(
    'href',
    'https://codeforces.com/problemset/submit'
  );
  expect(await page.evaluate(() => __leetifyTest.posts)).toBe(0);
});
test('a pasted alias origin stays in the current Codeforces origin', async ({ page }) => {
  await extension(page);
  await page.getByRole('button', { name: 'Problems', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Problem URL' })
    .fill('https://www.codeforces.com/contest/4/problem/B');
  await page.getByRole('button', { name: 'Open problem', exact: true }).click();
  await expect(page.locator('h1')).toContainText('B.');
  expect(new URL(page.url()).origin).toBe('https://codeforces.com');
  expect(new URL(page.url()).pathname).toBe('/contest/4/problem/B');
  await expect(page.locator('[data-status=message]')).toBeEmpty();
});
test('auto-run only follows an actual edit and return navigation preserves original math', async ({
  page,
}) => {
  await extension(page, { settings: { autoRunSamples: true } });
  await expect(page.locator('.lf-test-summary')).toContainText('Ready');
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(0);
  await replaceCode(page, 'edit triggers run');
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(2);
  await page.evaluate(
    () => (window.original = document.querySelector('.lf-description .problem-statement'))
  );
  await chooseProblem(page, 'B');
  await page.goBack();
  await expect(page.locator('h1')).toContainText('A.');
  expect(
    await page.evaluate(
      () => document.querySelector('.lf-description .problem-statement') === window.original
    )
  ).toBe(true);
});
test('first-run consent works with the restricted content-script API surface', async ({ page }) => {
  await extension(page, { settings: { runnerConsentOrigin: '' } });
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Allow runner access' })).toBeVisible();
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(0);
  await page.getByRole('button', { name: 'Allow runner', exact: true }).click();
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
