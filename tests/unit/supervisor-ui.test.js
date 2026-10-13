import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { WorkspaceController } from '../../src/workspace/controller.js';
import { createSubmissions } from '../../src/ui/submissions.js';
import { createTestPanel } from '../../src/ui/test-panel.js';
import { createRunBatch } from '../../src/runner/batch.js';
import { parseProblemUrl } from '../../src/domain/problem.js';
import { StorageRepository } from '../../src/storage/repository.js';

test('refresh replaces a saved pending verdict, preserves metadata, and survives reopening', async () => {
  const dom = new JSDOM('<main></main>');
  let data = {};
  const repository = new StorageRepository({
    storage: {
      get: async () => structuredClone(data),
      set: async (changes) => {
        Object.assign(data, structuredClone(changes));
      },
    },
  });
  await repository.initialize();
  await repository.recordSubmission({
    id: '123',
    submissionId: '123',
    key: 'cf:4:A',
    language: 'cpp',
    compilerLabel: 'GNU C++20',
    createdAt: 1000,
    pending: true,
    verdict: 'Pending',
  });
  const controller = new WorkspaceController({
    window: dom.window,
    document: dom.window.document,
    storage: repository,
    network: {
      getPage: async () => ({
        html: '<table class="status-frame-datatable"><tr data-submission-id="123"><td><a href="/contest/4/problem/A">A</a></td><td class="verdict">Accepted</td></tr></table>',
      }),
    },
  });
  controller.current = { route: parseProblemUrl('https://codeforces.com/contest/4/problem/A') };
  controller.state = await repository.readSnapshot();
  controller.submissions = createSubmissions({
    parent: dom.window.document.querySelector('main'),
    nativeUrl: 'https://codeforces.com/contest/4/my',
  });
  controller.message = () => {};
  await controller.refreshSubmissions();
  assert.equal(
    dom.window.document.querySelector('.lf-submission-row strong').textContent,
    'Accepted'
  );
  assert.match(
    dom.window.document.querySelector('.lf-submission-row .lf-muted').textContent,
    /GNU C\+\+20/
  );
  controller.remoteRecords = [];
  controller.state = await repository.readSnapshot();
  controller.renderSubmissions();
  assert.equal(
    dom.window.document.querySelector('.lf-submission-row strong').textContent,
    'Accepted'
  );
  assert.equal(controller.state.submissions[0].pending, false);
});

test('editing a custom expectation during a run cannot relabel the captured verdict', async () => {
  const doc = new JSDOM('<main></main>').window.document;
  const panel = createTestPanel({ parent: doc.querySelector('main') });
  panel.setCases([
    {
      id: 'custom',
      name: 'Custom 1',
      custom: true,
      input: 'old',
      expected: '1',
      hasExpected: true,
    },
  ]);
  let finish;
  const batch = createRunBatch({
    context: { key: 'cf:4:A', language: 'cpp', code: 'source', cases: panel.getCases() },
    execute: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    onResult: (result) => panel.setResult(result),
  });
  const pending = batch.run();
  const input = doc.querySelector('textarea[aria-label="Expected output"]');
  input.value = '2';
  input.dispatchEvent(new doc.defaultView.Event('input'));
  doc.querySelector('.lf-compare-check input').click();
  finish({ ok: true, run: { code: 0, stdout: '1', stderr: '' } });
  await pending;
  panel.showResults();
  assert.equal(doc.querySelectorAll('.lf-result-fields .lf-test-field pre')[1].textContent, '1');
  assert.match(doc.querySelector('.lf-diagnostics').textContent, /Passed/);
  assert.match(doc.querySelector('.lf-result-fields').textContent, /changed since this run/i);
  assert.equal(panel.getCases()[0].expected, '2');
  assert.equal(panel.getCases()[0].hasExpected, false);
});
