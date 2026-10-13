import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSubmissions } from '../../src/ui/submissions.js';

test('submission history derives native links from identities instead of backup URLs', () => {
  const doc = new JSDOM('<main></main>').window.document;
  const nativeUrl = 'https://codeforces.com/contest/4/my';
  const view = createSubmissions({ parent: doc.querySelector('main'), nativeUrl });
  for (const url of [
    'javascript:alert(1)',
    'https://evil.test/sign-in',
    'https://codeforces.com/contest/99/submission/777',
  ]) {
    view.setRecords([{ key: 'cf:4:A', submissionId: '123', language: 'cpp', url }]);
    assert.equal(
      doc.querySelector('.lf-submission-row a').href,
      'https://codeforces.com/contest/4/submission/123'
    );
  }
  view.setRecords([
    { key: 'gym:55:AA', submissionId: '789', language: 'cpp', url: 'https://evil.test' },
  ]);
  assert.equal(
    doc.querySelector('.lf-submission-row a').href,
    'https://codeforces.com/gym/55/submission/789'
  );
  view.setRecords([{ key: 'cf:4:A', language: 'cpp', url: 'javascript:alert(1)' }]);
  assert.equal(doc.querySelector('.lf-submission-row a').href, nativeUrl);
});
