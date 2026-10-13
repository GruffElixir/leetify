import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { WorkspaceController } from '../../src/workspace/controller.js';
import { StorageRepository } from '../../src/storage/repository.js';
import { STORAGE_KEY } from '../../src/storage/schema.js';
import { parseProblemUrl } from '../../src/domain/problem.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function harness(t) {
  const dom = new JSDOM('<main></main>');
  t.after(() => dom.window.close());
  let controller;
  let data = {};
  const repository = new StorageRepository({
    storage: {
      get: async () => structuredClone(data),
      set: async (changes) => {
        await h.beforeWrite?.(changes[STORAGE_KEY]);
        Object.assign(data, structuredClone(changes));
        const state = structuredClone(changes[STORAGE_KEY]);
        if (h.delayEvents) h.events.push(state);
        else if (controller?.state) controller.storageChanged(state);
      },
    },
  });
  const h = { repository, events: [] };
  controller = new WorkspaceController({
    window: dom.window,
    document: dom.window.document,
    storage: repository,
  });
  h.controller = controller;
  controller.current = {
    route: parseProblemUrl('https://codeforces.com/contest/4/problem/A'),
    samples: [],
  };
  controller.language = 'cpp';
  controller.shell = {
    configure() {},
    language: {},
    setStatus(_key, value) {
      h.status = value;
    },
  };
  controller.editor = {
    configure() {},
    setDocument(value) {
      h.editorCode = value.code;
    },
  };
  controller.tests = {
    setCases(cases) {
      h.cases = cases;
    },
  };
  controller.message = () => {};
  controller.cancelRun = () => {};
  controller.renderSubmissions = () => {};
  controller.state = await repository.initialize();
  controller.settings = controller.state.settings;
  return h;
}

for (const laterEdit of [false, true]) {
  test(`replacement during a save ${laterEdit ? 'preserves and recovers later edits' : 'follows the imported source'}`, async (t) => {
    const h = await harness(t);
    const gate = deferred();
    const saved = deferred();
    h.controller.storage = { recoverDraft: (args) => h.repository.recoverDraft(args) };
    h.controller.storage.saveSolution = async (args) => {
      const result = await h.repository.saveSolution(args);
      saved.resolve();
      await gate.promise;
      return result;
    };
    const draft = h.controller.draft();
    draft.code = 'saved source';
    draft.dirty = true;
    draft.version++;
    const pending = h.controller.persist(draft);
    await saved.promise;
    if (laterEdit) {
      draft.code = 'later local edit';
      draft.version++;
    }
    const backup = await h.repository.exportBackup();
    backup.state.solutions['cf:4:A'].cpp.code = 'imported source';
    await h.repository.importBackup({ backup, mode: 'replace' });
    gate.resolve();
    const okay = await pending;
    const state = await h.repository.readSnapshot();
    assert.equal(state.solutions['cf:4:A'].cpp.code, 'imported source');
    if (laterEdit) {
      assert.equal(okay, false);
      assert.equal(draft.code, 'later local edit');
      assert.equal(draft.dirty, true);
      assert.equal(draft.conflict.solution.code, 'imported source');
      assert.ok(state.recoveredDrafts.some((entry) => entry.code === 'later local edit'));
    } else {
      assert.equal(okay, true);
      assert.equal(draft.code, 'imported source');
      assert.equal(draft.revision, state.solutions['cf:4:A'].cpp.revision);
      assert.equal(draft.dirty, false);
      assert.equal(draft.conflict, null);
      assert.equal(h.editorCode, 'imported source');
    }
  });
}

const sample = (input) => ({
  id: 'custom-one',
  name: 'Custom 1',
  input,
  expected: '',
  hasExpected: false,
  custom: true,
});
for (const delayedEvent of [false, true]) {
  test(`an own older case save retains only the newer edit (${delayedEvent ? 'event after response' : 'event before response'})`, async (t) => {
    const h = await harness(t);
    const gate = deferred();
    const writing = deferred();
    h.beforeWrite = async (state) => {
      if (state.cases['cf:4:A']?.[0]?.input === 'older') {
        writing.resolve();
        await gate.promise;
      }
    };
    h.delayEvents = delayedEvent;
    h.controller.caseWrites.set('cf:4:A', { cases: [sample('older')] });
    const pending = h.controller.flush();
    await writing.promise;
    h.controller.caseWrites.set('cf:4:A', { cases: [sample('newer')] });
    gate.resolve();
    await pending;
    for (const state of h.events.splice(0)) h.controller.storageChanged(state);
    await h.controller.flush();
    const state = await h.repository.readSnapshot();
    assert.deepEqual(state.cases['cf:4:A'], [sample('newer')]);
    assert.equal(h.controller.caseWrites.size, 0);
  });
}
