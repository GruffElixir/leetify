import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { WorkspaceController } from '../../src/workspace/controller.js';
import { SubmissionController } from '../../src/submission/controller.js';
import { StorageRepository } from '../../src/storage/repository.js';
import { STORAGE_KEY } from '../../src/storage/schema.js';
import { parseProblemUrl } from '../../src/domain/problem.js';
import { createSubmissions } from '../../src/ui/submissions.js';
import { createTestPanel } from '../../src/ui/test-panel.js';
import { createShell } from '../../src/ui/shell.js';
import { normalizeSettings } from '../../src/domain/settings.js';

const html = (verdict) =>
  `<table class="status-frame-datatable"><tr data-submission-id="123"><td><a href="/contest/4/problem/A">A</a></td><td class="verdict">${verdict}</td></tr></table>`;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
for (const delayed of ['refresh', 'poll']) {
  test(`a delayed ${delayed} cannot replace a newer final verdict, but a later rejudge can`, async (t) => {
    const dom = new JSDOM('<main></main>');
    t.after(() => dom.window.close());
    const route = parseProblemUrl('https://codeforces.com/contest/4/problem/A');
    let workspace;
    let data = {};
    const repository = new StorageRepository({
      storage: {
        get: async () => structuredClone(data),
        set: async (changes) => {
          Object.assign(data, structuredClone(changes));
          if (workspace) {
            workspace.state = structuredClone(changes[STORAGE_KEY]);
            workspace.renderSubmissions();
          }
        },
      },
    });
    await repository.initialize();
    const initial = await repository.recordSubmission({
      id: '123',
      submissionId: '123',
      key: 'cf:4:A',
      language: 'cpp',
      compilerLabel: 'GNU C++20',
      verdict: 'Pending',
      pending: true,
    });
    const response = deferred();
    const started = deferred();
    let requests = 0;
    const network = {
      getPage: async () => {
        if (++requests === 1) {
          started.resolve();
          return response.promise;
        }
        return { html: html('Accepted') };
      },
    };
    workspace = new WorkspaceController({
      window: dom.window,
      document: dom.window.document,
      storage: repository,
      network,
    });
    workspace.current = { route };
    workspace.state = await repository.readSnapshot();
    workspace.submissions = createSubmissions({
      parent: dom.window.document.querySelector('main'),
      nativeUrl: 'https://codeforces.com/contest/4/my',
    });
    workspace.message = () => {};
    let tick;
    const poll = new SubmissionController({
      network,
      repository,
      parseHtml: (text) => new dom.window.DOMParser().parseFromString(text, 'text/html'),
      timers: {
        setTimeout: (fn) => {
          tick = fn;
          return 1;
        },
        clearTimeout() {},
      },
    });
    poll.poll(route, initial);
    const oldRequest = delayed === 'refresh' ? workspace.refreshSubmissions() : tick();
    await started.promise;
    if (delayed === 'refresh') await tick();
    else await workspace.refreshSubmissions();
    response.resolve({ html: html('Pending') });
    await oldRequest;
    let state = await repository.readSnapshot();
    assert.equal(state.submissions[0].verdict, 'Accepted');
    assert.equal(state.submissions[0].pending, false);
    assert.equal(poll.timer, null);
    assert.equal(
      dom.window.document.querySelector('.lf-submission-row strong').textContent,
      'Accepted'
    );
    assert.equal(state.submissions[0].compilerLabel, 'GNU C++20');
    network.getPage = async () => ({ html: html('Pending') });
    await workspace.refreshSubmissions();
    state = await repository.readSnapshot();
    assert.equal(state.submissions[0].pending, true);
    assert.equal(state.submissions[0].verdict, 'Pending');
  });
}

test('mouse and programmatic tab selections move the keyboard entry point', (t) => {
  const dom = new JSDOM('<main></main>');
  t.after(() => dom.window.close());
  dom.window.matchMedia = () => ({ matches: false });
  const doc = dom.window.document;
  const panel = createTestPanel({ parent: doc.querySelector('main') });
  const check = (list, label) => {
    const selected = list.querySelector('[aria-selected=true]');
    assert.equal(selected.textContent, label);
    assert.equal(selected.tabIndex, 0);
    for (const tab of list.querySelectorAll('[aria-selected=false]'))
      assert.equal(tab.tabIndex, -1);
  };
  panel.showResults();
  check(doc.querySelector('[role=tablist]'), 'Results');
  doc.querySelector('[data-view=cases]').click();
  check(doc.querySelector('[role=tablist]'), 'Test cases');
  let shell;
  shell = createShell({
    document: doc,
    settings: normalizeSettings(),
    onAction: (view) => shell.setActiveView(view),
  });
  doc.body.append(shell.root);
  shell.setActiveView('submissions');
  check(shell.root.querySelector('.lf-statement-tabs'), 'Submissions');
  shell.root.querySelector('[data-action=description]').click();
  check(shell.root.querySelector('.lf-statement-tabs'), 'Description');
  shell.setMobileView('code');
  check(shell.root.querySelector('.lf-mobile-tabs'), 'Code');
});

for (const when of ['before', 'during']) {
  test(`polling cannot recreate receipts removed ${when} its request`, async (t) => {
    const dom = new JSDOM();
    t.after(() => dom.window.close());
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
    const record = await repository.recordSubmission({
      id: '123',
      submissionId: '123',
      key: 'cf:4:A',
      language: 'cpp',
      verdict: 'Pending',
      pending: true,
    });
    const backup = await repository.exportBackup();
    backup.state.submissions = [];
    const started = deferred();
    const response = deferred();
    let requests = 0;
    let tick;
    const updates = [];
    const poll = new SubmissionController({
      repository,
      network: {
        getPage: async () => {
          requests++;
          started.resolve();
          return response.promise;
        },
      },
      parseHtml: (text) => new dom.window.DOMParser().parseFromString(text, 'text/html'),
      timers: {
        setTimeout: (fn) => {
          tick = fn;
          return 1;
        },
        clearTimeout() {},
      },
      onUpdate: (update) => updates.push(update),
    });
    poll.poll(parseProblemUrl('https://codeforces.com/contest/4/problem/A'), record);
    if (when === 'before') {
      await repository.importBackup({ backup, mode: 'replace' });
      response.resolve({ html: html('Pending') });
      await tick();
      assert.equal(requests, 0);
    } else {
      const pending = tick();
      await started.promise;
      await repository.importBackup({ backup, mode: 'replace' });
      response.resolve({ html: html('Pending') });
      await pending;
      if (poll.timer !== null) await tick();
    }
    assert.deepEqual((await repository.readSnapshot()).submissions, []);
    assert.equal(poll.timer, null);
    assert.ok(updates.every((update) => update.key === 'cf:4:A' && update.submissionId === '123'));
  });
}
