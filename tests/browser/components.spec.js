import { test, expect } from '@playwright/test';
import { components, replaceCode } from './helpers.js';
test('editor supports undo, redo, search, comments, indent and silent restoration', async ({
  page,
}) => {
  const errors = await components(page);
  await replaceCode(page, 'hello');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => testApp.editor.getCode())).not.toBe('hello');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect(await page.evaluate(() => testApp.editor.getCode())).toBe('hello');
  await page.keyboard.press('ControlOrMeta+/');
  expect(await page.evaluate(() => testApp.editor.getCode())).toContain('//');
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => testApp.editor.getCode())).toMatch(/^\s/);
  await page.keyboard.press('ControlOrMeta+f');
  await expect(page.locator('.cm-search')).toBeVisible();
  await page.keyboard.press('Escape');
  const before = await page.evaluate(() => testApp.changes.length);
  await page.evaluate(() => {
    testApp.editor.setDocument({ key: 'B', language: 'python', code: 'print(1)' });
    testApp.editor.configure({ ...testApp.settings, fontSize: 17, wrap: true });
  });
  expect(await page.evaluate(() => testApp.changes.length)).toBe(before);
  expect(errors).toEqual([]);
});
test('100 KB source remains editable and documents preserve independent undo', async ({ page }) => {
  const errors = await components(page);
  await page.evaluate(() =>
    testApp.editor.setDocument({
      key: 'big',
      language: 'cpp',
      code: '// a long source line\n'.repeat(5000),
    })
  );
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('tail');
  expect(await page.evaluate(() => testApp.editor.getCode().endsWith('tail'))).toBe(true);
  await page.evaluate(() => {
    window.bigCode = testApp.editor.getCode();
    testApp.editor.setDocument({ key: 'B', language: 'java', code: 'class Main {}' });
    testApp.editor.setDocument({ key: 'big', language: 'cpp', code: window.bigCode });
  });
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await page.evaluate(() => testApp.editor.getCode().endsWith('tail'))).toBe(false);
  expect(errors).toEqual([]);
});
test('dialogs trap focus, close with Escape and restore focus', async ({ page }) => {
  await components(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).focus();
  await page.evaluate(() => {
    const content = document.createElement('div');
    content.innerHTML = '<button>First</button><button>Last</button>';
    testApp.openDialog({ title: 'Example', content, returnFocus: document.activeElement });
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Last', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
});
test('splitters respond to keyboard and result selection uses the selected case', async ({
  page,
}) => {
  await components(page);
  const splitter = page.getByRole('separator', { name: 'Resize description' });
  await splitter.focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => testApp.settings.paneWidth)).toBe(46);
  await page.keyboard.press('Home');
  expect(await page.evaluate(() => testApp.settings.paneWidth)).toBe(20);
  await page.keyboard.press('End');
  expect(await page.evaluate(() => testApp.settings.paneWidth)).toBe(75);
  await page.evaluate(() => {
    testApp.panel.setResult({
      id: '1',
      status: 'passed',
      actual: 'YES',
      expected: 'YES',
      diagnostics: [],
    });
    testApp.panel.setResult({
      id: '2',
      status: 'error',
      actual: '',
      expected: 'NO',
      diagnostics: [{ stage: 'compile', text: 'compiler failed' }],
    });
  });
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('button', { name: /Sample 2/ }).click();
  await expect(page.locator('[data-diagnostics]')).toContainText('compiler failed');
  await expect(page.locator('[data-actual]')).not.toContainText('compiler failed');
});
test('case selection and result redraws keep keyboard focus', async ({ page }) => {
  await components(page);
  const caseButton = (name) => page.locator('.lf-case-tabs').getByRole('button', { name });
  await caseButton('Sample 2').focus();
  await page.keyboard.press('Enter');
  await expect(caseButton('Sample 2')).toHaveAttribute('aria-pressed', 'true');
  await expect(caseButton('Sample 2')).toBeFocused();
  const result = (id) =>
    page.evaluate(
      (id) => testApp.panel.setResult({ id, status: 'passed', actual: 'YES', diagnostics: [] }),
      id
    );
  await result('1');
  await expect(caseButton('Sample 2')).toBeFocused();
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  const run = page.getByRole('button', { name: 'Run selected', exact: true });
  await run.focus();
  await result('2');
  await expect(run).toBeFocused();
});
for (const [width, height] of [
  [1440, 900],
  [820, 900],
  [390, 844],
])
  test(`workspace fits ${width} pixels and keeps primary actions visible`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await components(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await expect(page.getByRole('button', { name: 'Run all', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeVisible();
    await page.screenshot({
      path: `test-results/components-${width}-${test.info().project.name}.png`,
    });
    expect(errors).toEqual([]);
  });
test('templates save, delete, reset and recovered drafts require explicit choices', async ({
  page,
}) => {
  await components(page);
  await page.evaluate(() => {
    window.templateActions = [];
    testApp.openTemplates({
      state: {
        templates: { cpp: [{ id: 'one', name: 'Starter', code: 'template' }] },
        recoveredDrafts: [{ id: 'r1', language: 'cpp', code: 'recovered', reason: 'Conflict' }],
      },
      language: 'cpp',
      getCode: () => testApp.editor.getCode(),
      onSave: async (template) => {
        templateActions.push('save');
        return { ...template, id: 'new' };
      },
      onDelete: async () => templateActions.push('delete'),
      onReset: async () => templateActions.push('reset'),
      onRecover: async () => templateActions.push('recover'),
    });
  });
  await page.getByRole('textbox', { name: 'Template name' }).fill('New starter');
  await page.getByRole('button', { name: 'Save current code as template' }).click();
  await expect(page.getByText('Template saved.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Starter', exact: true }).click();
  expect(await page.evaluate(() => templateActions)).toEqual(['save']);
  await page.getByRole('button', { name: 'Delete template', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete Starter', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore draft r1' }).click();
  expect(await page.evaluate(() => templateActions)).toEqual(['save', 'delete']);
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  expect(await page.evaluate(() => templateActions)).toEqual(['save', 'delete', 'recover']);
});
test('compact Code view shows the editor without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await components(page);
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/components-mobile-code-${test.info().project.name}.png`,
  });
});
test('persisted focus mode cannot hide the statement on compact layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await components(page);
  await page.evaluate(() => testApp.shell.configure({ ...testApp.settings, focus: true }));
  const statement = page.locator('.lf-description-pane');
  const code = page.locator('.lf-code-pane');
  await expect(statement).toBeVisible();
  await expect(code).toBeHidden();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(statement).toBeHidden();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await page.getByRole('tab', { name: 'Description', exact: true }).first().click();
  await expect(statement).toBeVisible();
  await expect(code).toBeHidden();
  await page.setViewportSize({ width: 820, height: 900 });
  await expect(statement).toBeVisible();
  await expect(code).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(statement).toBeHidden();
  await expect(page.getByRole('button', { name: 'Focus mode', exact: true })).toBeVisible();
});
