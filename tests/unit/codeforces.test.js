import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { extractSamples, readSampleText } from '../../src/codeforces/samples.js';
import { parseProblemDocument, sanitizeStatement } from '../../src/codeforces/problem.js';
import { renderRawMath } from '../../src/codeforces/math.js';
import { parseSubmitForm, buildSubmission } from '../../src/codeforces/forms.js';
import { parseStatusRecords, parseSubmissionReceipt } from '../../src/codeforces/status.js';
import { parseProblemUrl } from '../../src/domain/problem.js';
const page = (name, url = 'https://codeforces.com/problemset/problem/4/A') =>
  new JSDOM(readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8'), { url })
    .window.document;
const route = parseProblemUrl('https://codeforces.com/problemset/problem/4/A');
test('all grouped sample pairs are extracted', () => {
  const cases = extractSamples(page('problem-multiple').querySelector('.problem-statement'));
  assert.equal(cases.length, 2);
  assert.equal(cases[1].input, '3\n');
  assert.equal(cases[1].expected, 'NO\n');
});
test('sample block lines preserve spaces and blank lines', () => {
  const pre = page('problem-math').querySelector('.input pre');
  assert.equal(readSampleText(pre), '  1\n\n2  \n');
});
test('missing expected output is an executable case rather than a comparison', () => {
  const doc = new JSDOM('<div class="sample-test"><div class="input"><pre>x</pre></div></div>')
    .window.document;
  assert.equal(extractSamples(doc.body)[0].hasExpected, false);
});
test('problem parsing resolves resources and removes executable fetched markup', () => {
  const doc = page('problem-math', 'https://codeforces.com/contest/4/problem/B');
  const parsed = parseProblemDocument(doc, doc.URL);
  const safe = sanitizeStatement(parsed.statement, doc.URL);
  assert.equal(safe.querySelector('script'), null);
  assert.equal(safe.querySelector('[onerror]'), null);
  assert.equal(safe.querySelector('a').getAttribute('href'), null);
  assert.equal(
    safe.querySelector('img').getAttribute('src'),
    'https://codeforces.com/contest/4/diagram.svg'
  );
  assert.ok(safe.querySelector('.MathJax'));
});
test('raw formulas render without touching already-rendered math or literal samples', () => {
  const statement = page('problem-math').querySelector('.problem-statement');
  renderRawMath(statement);
  assert.equal(statement.querySelectorAll('.katex').length, 2);
  assert.ok(statement.querySelector('.katex-display'));
  assert.equal(statement.querySelector('.MathJax').textContent, 'existing rendered formula');
  assert.equal(statement.querySelector('pre').textContent, '$$$literal sample$$$');
});
test('login and challenge HTML cannot be accepted as a problem or form', () => {
  for (const name of ['login', 'challenge']) {
    assert.throws(() => parseProblemDocument(page(name), route.url));
    assert.throws(() => parseSubmitForm(page(name), 'https://codeforces.com/problemset/submit'));
  }
});
test('form submission captures actual compiler and successful controls without a URL token', () => {
  const form = parseSubmitForm(page('submit'), 'https://codeforces.com/problemset/submit');
  const result = buildSubmission(form, { route, compilerId: '89', code: 'int main() {}' });
  const body = new URLSearchParams(result.body);
  assert.equal(body.get('programTypeId'), '89');
  assert.equal(body.get('source'), 'int main() {}');
  assert.equal(body.get('remember'), 'yes');
  assert.equal(body.get('unchecked'), null);
  assert.equal(body.get('disabled'), null);
  assert.equal(body.get('ftaa'), 'form-nonce');
  assert.equal(body.get('submittedProblemCode'), '4A');
  assert.equal(body.get('csrf_token'), 'secret');
  assert.equal(new URL(result.url).searchParams.has('csrf_token'), false);
  assert.throws(() => buildSubmission(form, { route, compilerId: 'fake', code: 'x' }));
});
test('missing token and foreign form actions stop submission preparation', () => {
  const doc = page('submit');
  doc.querySelector('meta').remove();
  doc.querySelector('[name=csrf_token]').remove();
  assert.throws(() => parseSubmitForm(doc, 'https://codeforces.com/problemset/submit'));
  const other = page('submit');
  other.querySelector('form').action = 'https://evil.test/submit';
  assert.throws(() => parseSubmitForm(other, 'https://codeforces.com/problemset/submit'));
});
test('status parsing matches problem links instead of incidental row text', () => {
  const records = parseStatusRecords(page('status'), route);
  assert.equal(records.length, 1);
  assert.equal(records[0].submissionId, '100001');
  assert.equal(records[0].pending, true);
});
test('a receipt needs unambiguous new IDs and never accepts an old or error page', () => {
  const doc = page('status');
  assert.equal(
    parseSubmissionReceipt(doc, 'https://codeforces.com/problemset/status?my=on', {
      route,
      baselineIds: ['100001'],
    }).status,
    'unconfirmed'
  );
  assert.equal(
    parseSubmissionReceipt(doc, 'https://codeforces.com/problemset/status?my=on', {
      route,
      baselineIds: [],
    }).submissionId,
    '100001'
  );
  const row = doc.querySelector('tr:last-child').cloneNode(true);
  row.dataset.submissionId = '100003';
  row.querySelector('a').href = '/contest/4/submission/100003';
  doc.querySelector('table').append(row);
  assert.equal(
    parseSubmissionReceipt(doc, 'https://codeforces.com/problemset/status?my=on', {
      route,
      baselineIds: [],
    }).status,
    'unconfirmed'
  );
  assert.equal(
    parseSubmissionReceipt(page('challenge'), 'https://codeforces.com/problemset/submit', {
      route,
      baselineIds: [],
    }).status,
    'unconfirmed'
  );
});

test('direct receipts require matching problem/ID markup and reject known IDs', () => {
  const url = 'https://codeforces.com/contest/4/submission/100001';
  for (const html of ['', '<title>Service unavailable</title><p>Try later</p>'])
    assert.equal(
      parseSubmissionReceipt(new JSDOM(html).window.document, url, { route, baselineIds: [] })
        .status,
      'unconfirmed'
    );
  assert.equal(
    parseSubmissionReceipt(page('status'), url, { route, baselineIds: [] }).submissionId,
    '100001'
  );
  assert.equal(
    parseSubmissionReceipt(page('status'), url, { route, baselineIds: ['100001'] }).status,
    'unconfirmed'
  );
  assert.equal(
    parseSubmissionReceipt(page('status'), 'https://codeforces.com/contest/4/submission/100002', {
      route,
      baselineIds: [],
    }).status,
    'unconfirmed'
  );
});

test('public status rows cannot be attributed to an own-history submission baseline', () => {
  const doc = page('status');
  const account = doc.createElement('a');
  account.href = '/profile/another-user';
  account.textContent = 'another-user';
  doc.querySelector('tr:last-child').append(account);
  assert.equal(
    parseSubmissionReceipt(doc, 'https://codeforces.com/problemset/status', {
      route,
      baselineIds: [],
    }).status,
    'unconfirmed'
  );
  assert.equal(
    parseSubmissionReceipt(doc, 'https://codeforces.com/contest/4/status', {
      route,
      baselineIds: [],
    }).status,
    'unconfirmed'
  );
  account.remove();
  assert.equal(
    parseSubmissionReceipt(doc, 'https://codeforces.com/problemset/status?my=on', {
      route,
      baselineIds: [],
    }).submissionId,
    '100001'
  );
});
test('native sidebar links supply same-contest problems without unrelated routes', () => {
  const doc = page('problem-multiple');
  doc.querySelector('.problems').remove();
  const sidebar = doc.createElement('aside');
  sidebar.id = 'sidebar';
  sidebar.innerHTML =
    '<table class="rtable"><tr><td><a href="/contest/4/problem/A">A. First</a></td></tr><tr><td><a href="/contest/4/problem/AA">AA. Next</a></td></tr><tr><td><a href="/gym/4/problem/B">Other gym</a></td></tr><tr><td><a href="/contest/99/problem/C">Other contest</a></td></tr></table>';
  doc.body.append(sidebar);
  assert.deepEqual(
    parseProblemDocument(doc, route.url).problems.map((problem) => problem.route.index),
    ['A', 'AA']
  );
});
