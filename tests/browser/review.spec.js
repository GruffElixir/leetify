import { test, expect } from '@playwright/test';
import { extension, replaceCode, saved } from './helpers.js';

test('review: disabled auto-activation retains the visible native statement', async ({ page }) => {
  await extension(page, { settings: { autoActivate: false } });
  await expect(page.locator('#content > .problem-statement')).toBeVisible();
  await expect(page.locator('#leetify-workspace')).toHaveCount(0);
  await page.evaluate(() => __leetifyTest.toggle());
  await expect(page.locator('.lf-description .problem-statement')).toBeVisible();
  await page.getByRole('button', { name: 'Exit workspace' }).click();
  await expect(page.locator('#content > .problem-statement')).toBeVisible();
});

test('review: conflict resolution preserves later edits and failed recovery retains the dialog', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await extension(page);
  await replaceCode(page, 'original');
  await saved(page, 'original');
  await replaceCode(page, 'first local');
  await page.evaluate(async () => {
    const state = await __leetifyTest.snapshot();
    await __leetifyTest.externalSave({
      key: 'cf:4:A',
      language: 'cpp',
      code: 'other tab',
      expectedRevision: state.solutions['cf:4:A'].cpp.revision,
    });
  });
  await expect(page.locator('.lf-save-status')).toContainText('Conflict');
  await replaceCode(page, 'later local');
  await page.locator('.lf-save-status').click();
  await page.evaluate(() => (__leetifyTest.failWrites = true));
  await page.getByRole('button', { name: 'Use other tab draft', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Resolve draft conflict' })).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('later local');
  await page.evaluate(() => (__leetifyTest.failWrites = false));
  await page.getByRole('button', { name: 'Use other tab draft', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.cm-content')).toContainText('other tab');
  expect(
    await page.evaluate(() =>
      __leetifyTest
        .snapshot()
        .then((state) => state.recoveredDrafts.some((draft) => draft.code === 'later local'))
    )
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('review: replacement synchronizes deleted clean drafts and imported/deleted cases', async ({
  page,
}) => {
  await extension(page);
  await replaceCode(page, 'saved original');
  await saved(page, 'saved original');
  await page.getByRole('button', { name: 'Add custom case' }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('old input');
  await expect
    .poll(() =>
      page.evaluate(() =>
        __leetifyTest.snapshot().then((state) => state.cases['cf:4:A']?.[0]?.input)
      )
    )
    .toBe('old input');
  await page.evaluate(async () => {
    const backup = await __leetifyTest.export();
    backup.state.solutions = {};
    backup.state.cases['cf:4:A'] = [
      {
        id: 'imported',
        name: 'Imported case',
        input: 'new input',
        expected: '',
        hasExpected: false,
        custom: true,
      },
    ];
    await __leetifyTest.import(backup, 'replace');
  });
  await expect(page.locator('.cm-content')).not.toContainText('saved original');
  await expect(page.getByRole('button', { name: 'Custom 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Imported case', exact: true }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('edited imported input');
  await expect
    .poll(() =>
      page.evaluate(() =>
        __leetifyTest.snapshot().then((state) => state.cases['cf:4:A']?.[0]?.input)
      )
    )
    .toBe('edited imported input');
  expect(
    await page.evaluate(() =>
      __leetifyTest.snapshot().then((state) => state.cases['cf:4:A'].length)
    )
  ).toBe(1);
  await page.evaluate(async () => {
    const backup = await __leetifyTest.export();
    backup.state.cases = {};
    await __leetifyTest.import(backup, 'replace');
  });
  await expect(page.getByRole('button', { name: 'Imported case', exact: true })).toHaveCount(0);
});

test('review: deletion retains dirty source and exposes a recoverable conflict', async ({
  page,
}) => {
  await extension(page);
  await replaceCode(page, 'saved original');
  await saved(page, 'saved original');
  await replaceCode(page, 'pending local source');
  await page.evaluate(async () => {
    const backup = await __leetifyTest.export();
    backup.state.solutions = {};
    await __leetifyTest.import(backup, 'replace');
  });
  await expect(page.locator('.lf-save-status')).toContainText('Conflict');
  await expect(page.locator('.cm-content')).toContainText('pending local source');
  await page.locator('.lf-save-status').click();
  await page.getByRole('button', { name: 'Use other tab draft', exact: true }).click();
  await expect(page.locator('.cm-content')).not.toContainText('pending local source');
  expect(
    await page.evaluate(() =>
      __leetifyTest
        .snapshot()
        .then((state) =>
          state.recoveredDrafts.some((draft) => draft.code === 'pending local source')
        )
    )
  ).toBe(true);
});

test('review: native SVG and KaTeX radical/arrow geometry survives toggling', async ({ page }) => {
  await extension(page);
  await page.evaluate(() => {
    const statement = document.querySelector('.lf-description .problem-statement');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '180');
    svg.setAttribute('height', '28');
    svg.classList.add('MathJax_SVG');
    statement.append(svg);
    const math = document.createElement('p');
    math.textContent = '$$$\\sqrt{x} + \\overrightarrow{AB}$$$';
    statement.append(math);
  });
  await page.getByRole('button', { name: 'Exit workspace' }).click();
  await page.evaluate(() => __leetifyTest.toggle());
  const native = page.locator('.lf-description .MathJax_SVG');
  expect((await native.boundingBox()).width).toBeCloseTo(180, 1);
  expect((await native.boundingBox()).height).toBeCloseTo(28, 1);
  const geometry = await page.locator('.lf-description .katex svg').evaluateAll((svgs) =>
    svgs.map((svg) => ({
      height: parseFloat(getComputedStyle(svg).height),
      parentHeight: parseFloat(getComputedStyle(svg.parentElement).height),
    }))
  );
  expect(geometry.length).toBeGreaterThanOrEqual(2);
  for (const svg of geometry) {
    expect(svg.height).toBeGreaterThan(0);
    expect(Math.abs(svg.height - svg.parentHeight)).toBeLessThan(1);
  }
});

test('review: incoming custom cases preserve pending edits with colliding IDs', async ({
  page,
}) => {
  await extension(page);
  await page.getByRole('button', { name: 'Add custom case' }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('original input');
  await expect
    .poll(() =>
      page.evaluate(() =>
        __leetifyTest.snapshot().then((state) => state.cases['cf:4:A']?.[0]?.input)
      )
    )
    .toBe('original input');
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('pending local input');
  await page.evaluate(async () => {
    const backup = await __leetifyTest.export();
    backup.state.cases['cf:4:A'][0].input = 'incoming input';
    await __leetifyTest.import(backup, 'replace');
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        __leetifyTest
          .snapshot()
          .then((state) => state.cases['cf:4:A'].map((sample) => sample.input).sort())
      )
    )
    .toEqual(['incoming input', 'pending local input']);
  expect(
    await page.evaluate(() =>
      __leetifyTest
        .snapshot()
        .then((state) => new Set(state.cases['cf:4:A'].map((sample) => sample.id)).size)
    )
  ).toBe(2);
});

test('review: generated raw math keeps its styling on the native page after exit', async ({
  page,
}) => {
  await extension(page, { settings: { autoActivate: false } });
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.className = 'raw-math-regression';
    p.textContent = '$$$\\sqrt{x} + \\overrightarrow{AB}$$$';
    document.querySelector('#content > .problem-statement').append(p);
  });
  await page.evaluate(() => __leetifyTest.toggle());
  const geometry = await page
    .locator('.raw-math-regression .katex-html')
    .evaluate((node) => node.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Exit workspace' }).click();
  const native = page.locator('#content > .problem-statement .raw-math-regression .katex');
  await expect(native).toBeVisible();
  const math = await native.evaluate((node) => ({
    width: node.querySelector('.katex-html').getBoundingClientRect().width,
    hiddenMath: getComputedStyle(node.querySelector('.katex-mathml')).position,
  }));
  expect(math.width).toBeLessThan(geometry * 2);
  expect(math.hiddenMath).toBe('absolute');
  await page.evaluate(() => __leetifyTest.toggle());
  await expect(page.locator('.lf-description .raw-math-regression .katex')).toHaveCount(1);
});
