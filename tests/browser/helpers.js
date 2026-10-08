import { expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
let mocks;
export async function extension(page, config = {}) {
  if (!mocks)
    mocks = (
      await build({
        entryPoints: ['tests/browser/mocks.js'],
        bundle: true,
        format: 'iife',
        write: false,
        logLevel: 'silent',
      })
    ).outputFiles[0].text;
  const names = ['problem-multiple', 'problem-math', 'submit', 'login', 'challenge', 'status'];
  const fixtures = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await readFile(`tests/fixtures/${name}.html`, 'utf8')])
    )
  );
  await page.addInitScript({
    content: `window.__testConfig=${JSON.stringify(config)};window.__fixtures=${JSON.stringify(fixtures)};${mocks}`,
  });
  await page.route('https://codeforces.com/**', (route) =>
    route.fulfill(
      route.request().resourceType() === 'image'
        ? {
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect x="1" y="1" width="45" height="38" rx="4" fill="#586b59"/><rect x="50" y="1" width="109" height="38" rx="4" fill="#799579"/><g fill="white" font-size="14" font-family="sans-serif" text-anchor="middle"><text x="23" y="25">2</text><text x="104" y="25">6</text></g></svg>',
          }
        : { contentType: 'text/html', body: fixtures['problem-multiple'] }
    )
  );
  await page.goto('https://codeforces.com/problemset/problem/4/A');
  await page.addStyleTag({ path: 'dist/styles.css' });
  await page.addScriptTag({ path: 'dist/content.js' });
  await expect(page.locator('#leetify-workspace')).toBeVisible();
}
export async function chooseProblem(page, index) {
  await page.getByRole('button', { name: 'Problems', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('^' + index + '[.]') }).click();
  await expect(page.locator('#leetify-workspace h1')).toContainText(`${index}.`);
}
export async function saved(page, code, language = 'cpp', key = 'cf:4:A') {
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, language }) =>
          __leetifyTest.snapshot().then((state) => state.solutions[key]?.[language]?.code),
        { key, language }
      )
    )
    .toBe(code);
}
export async function components(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#leetify-workspace')).toBeVisible();
  return errors;
}
export async function replaceCode(page, code) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(code);
}
