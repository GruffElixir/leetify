import { test, expect } from '@playwright/test';
import { extension, replaceCode, chooseProblem, saved } from './helpers.js';
test('audit: exit and reenter three times returns the same original statement node', async ({
  page,
}) => {
  await extension(page);
  await page.evaluate(
    () => (window.originalStatement = document.querySelector('.lf-description .problem-statement'))
  );
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Exit workspace' }).click();
    await expect(page.locator('#content>.problem-statement')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.querySelector('#content>.problem-statement') === originalStatement
      )
    ).toBe(true);
    await page.evaluate(() => __leetifyTest.toggle());
    await expect(page.locator('.lf-description .problem-statement')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.querySelector('.lf-description .problem-statement') === originalStatement
      )
    ).toBe(true);
  }
});
test('audit: all grouped samples run and block lines are preserved', async ({ page }) => {
  await extension(page);
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2/2 ran');
  expect(await page.evaluate(() => __leetifyTest.executionRequests.map((r) => r.stdin))).toEqual([
    '8\n',
    '3\n',
  ]);
  await chooseProblem(page, 'B');
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(3);
  expect(await page.evaluate(() => __leetifyTest.executionRequests[2].stdin)).toBe('  1\n\n2  \n');
});
test('audit: cancel prevents case two and late results', async ({ page }) => {
  await extension(page);
  await page.evaluate(() => (__leetifyTest.holdRuns = true));
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await page.evaluate(() => __leetifyTest.resolveExecution(0));
  await expect(page.locator('.lf-test-summary')).toContainText('Cancelled');
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
  await expect(page.locator('.lf-case-tabs [data-status=passed]')).toHaveCount(0);
});
test('audit: changing source and language cannot mutate an active batch', async ({ page }) => {
  await extension(page);
  await replaceCode(page, 'captured source');
  await page.evaluate(() => (__leetifyTest.holdRuns = true));
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
  await replaceCode(page, 'changed source');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('python');
  await page.evaluate(() => __leetifyTest.resolveExecution(0));
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(2);
  expect(
    await page.evaluate(() =>
      __leetifyTest.executionRequests.map((r) => [r.language, r.files[0].content])
    )
  ).toEqual([
    ['c++', 'captured source'],
    ['c++', 'captured source'],
  ]);
  await page.evaluate(() => __leetifyTest.resolveExecution(1));
});
test('audit: discovery success followed by execute failure returns an actionable error', async ({
  page,
}) => {
  await extension(page);
  await page.evaluate(() => (__leetifyTest.executeNetworkFailure = true));
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2 failed');
  await expect(page.locator('[data-diagnostics]')).toContainText('Cannot reach');
});
test('navigation cancels a run and a late response cannot update the next problem', async ({
  page,
}) => {
  await extension(page);
  await page.evaluate(() => (__leetifyTest.holdRuns = true));
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
  await chooseProblem(page, 'B');
  await page.evaluate(() => __leetifyTest.resolveExecution(0));
  await expect(page.locator('.lf-test-summary')).toContainText('Ready to run');
  await expect(page.locator('.lf-case-tabs [data-status=passed]')).toHaveCount(0);
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
});
test('Ctrl+Enter in the editor runs the source without editing it', async ({ page }) => {
  await extension(page);
  const code = 'int main() {\n  return 0;\n}';
  await replaceCode(page, code);
  await saved(page, code);
  await page.evaluate(() => (__leetifyTest.holdRuns = true));
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
  expect(await page.evaluate(() => __leetifyTest.executionRequests[0].files[0].content)).toBe(code);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.cm-line')].map((line) => line.textContent).join('\n')
    )
  ).toBe(code);
  await page.evaluate(() => __leetifyTest.executionResolvers.splice(0).forEach((r) => r()));
});
test('Exit after navigating to another problem shows its native page after the reload', async ({
  page,
}) => {
  await extension(page);
  await chooseProblem(page, 'B');
  await page.getByRole('button', { name: 'Exit workspace' }).click();
  await page.waitForURL(/\/contest\/4\/problem\/B$/);
  const inject = async () => {
    await page.addStyleTag({ path: 'dist/styles.css' });
    await page.addScriptTag({ path: 'dist/content.js' });
    await page.evaluate(async () => {
      await __leetifyTest.snapshot();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  };
  await inject();
  await expect(page.locator('#content > .problem-statement')).toBeVisible();
  await expect(page.locator('#leetify-workspace')).toHaveCount(0);
  await page.reload();
  await inject();
  await expect(page.locator('#leetify-workspace')).toBeVisible();
});
test('history navigation after exiting loads the page for the new URL', async ({ page }) => {
  await extension(page);
  await chooseProblem(page, 'B');
  await page.goBack();
  await expect(page.locator('#leetify-workspace h1')).toContainText('A.');
  await page.getByRole('button', { name: 'Exit workspace' }).click();
  await expect(page.locator('#leetify-workspace')).toHaveCount(0);
  await page.evaluate(() => (window.beforeForward = true));
  await page.goForward();
  await expect(page).toHaveURL(/\/contest\/4\/problem\/B$/);
  await expect.poll(() => page.evaluate(() => window.beforeForward === true)).toBe(false);
  await page.addStyleTag({ path: 'dist/styles.css' });
  await page.addScriptTag({ path: 'dist/content.js' });
  await page.evaluate(async () => {
    await __leetifyTest.snapshot();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator('#content > .problem-statement')).toBeVisible();
  await expect(page.locator('#leetify-workspace')).toHaveCount(0);
});
test('auto-run reruns an edit made while an earlier auto-run is in flight', async ({ page }) => {
  await extension(page, { settings: { autoRunSamples: true } });
  await page.evaluate(() => (__leetifyTest.holdRuns = true));
  await replaceCode(page, 'version one');
  await expect.poll(() => page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(1);
  await page.keyboard.insertText(' plus version two');
  await page.waitForTimeout(2000);
  const release = () =>
    page.evaluate(() => __leetifyTest.executionResolvers.splice(0).forEach((r) => r()));
  const requests = () => page.evaluate(() => __leetifyTest.executionRequests.length);
  for (const count of [2, 3, 4]) {
    await release();
    await expect.poll(requests).toBe(count);
  }
  await release();
  await expect(page.locator('.lf-test-summary')).toContainText('2 passed');
  expect(
    await page.evaluate(() => __leetifyTest.executionRequests.map((r) => r.files[0].content))
  ).toEqual([
    'version one',
    'version one',
    'version one plus version two',
    'version one plus version two',
  ]);
});
