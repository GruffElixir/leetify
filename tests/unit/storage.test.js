import test from 'node:test';
import assert from 'node:assert/strict';
import { StorageRepository } from '../../src/storage/repository.js';
import { STORAGE_KEY } from '../../src/storage/schema.js';

function harness(initial = {}) {
  let data = structuredClone(initial);
  let fail = false;
  let writes = 0;
  const storage = {
    get: async () => structuredClone(data),
    set: async (change) => {
      writes++;
      if (fail) throw new Error('disk full');
      data = { ...data, ...structuredClone(change) };
    },
  };
  return {
    repo: new StorageRepository({ storage, now: () => 1000 }),
    get data() {
      return data;
    },
    get writes() {
      return writes;
    },
    set fail(value) {
      fail = value;
    },
  };
}
const save = (repo, code, revision = 0) =>
  repo.saveSolution({ key: 'cf:4:A', language: 'cpp', code, expectedRevision: revision });
test('migration merges alias drafts and preserves their different source', async () => {
  const h = harness({
    'leetify_solution_v2:contest%3A4%3AA:cpp': { code: 'older', updatedAt: 1 },
    'leetify_solution_v2:problemset%3A4%3AA:cpp': { code: 'newer', updatedAt: 2 },
  });
  await h.repo.initialize();
  const state = await h.repo.readSnapshot();
  assert.equal(state.solutions['cf:4:A'].cpp.code, 'newer');
  assert.equal(state.recoveredDrafts[0].code, 'older');
  const second = new StorageRepository({
    storage: {
      get: async () => structuredClone(h.data),
      set: async () => {
        throw new Error('must not write');
      },
    },
  });
  await second.initialize();
  assert.equal((await second.readSnapshot()).recoveredDrafts.length, 1);
  assert.ok(h.data['leetify_solution_v2:contest%3A4%3AA:cpp']);
});
test('monolithic and unattributed site-local drafts remain available', async () => {
  const h = harness({
    leetify_state_v1: {
      solutions: { 'contest:4:A': { python: 'saved' } },
      templates: { python: [{ id: 'p', name: 'starter', code: 'pass' }] },
    },
  });
  await h.repo.initialize({ leetify_code_cpp: 'unattributed', leetify_code_python_4_A: 'keyed' });
  const state = await h.repo.readSnapshot();
  assert.equal(state.solutions['cf:4:A'].python.code, 'keyed');
  assert.ok(state.recoveredDrafts.some((d) => d.code === 'unattributed'));
  assert.equal(state.templates.python[0].code, 'pass');
});
test('a failed save retains the committed revision and can be retried', async () => {
  const h = harness();
  await h.repo.initialize();
  h.fail = true;
  await assert.rejects(save(h.repo, 'draft'), /disk full/);
  assert.equal((await h.repo.readSnapshot()).solutions['cf:4:A'], undefined);
  h.fail = false;
  assert.equal((await save(h.repo, 'draft')).solution.revision, 1);
});
test('stale concurrent edits preserve both drafts instead of overwriting', async () => {
  const h = harness();
  await h.repo.initialize();
  const [a, b] = await Promise.all([save(h.repo, 'tab A'), save(h.repo, 'tab B')]);
  assert.equal(a.status, 'saved');
  assert.equal(b.status, 'conflict');
  const state = await h.repo.readSnapshot();
  assert.equal(state.solutions['cf:4:A'].cpp.code, 'tab A');
  assert.equal(state.recoveredDrafts.at(-1).code, 'tab B');
  assert.equal((await save(h.repo, 'tab B', 1)).status, 'saved');
});
test('patches preserve concurrent unrelated settings and empty solutions', async () => {
  const h = harness();
  await h.repo.initialize();
  await Promise.all([
    h.repo.patchSettings({ fontSize: 18 }),
    h.repo.patchSettings({ theme: 'light' }),
  ]);
  const state = await h.repo.readSnapshot();
  assert.equal(state.settings.fontSize, 18);
  assert.equal(state.settings.theme, 'light');
  assert.equal((await save(h.repo, '')).solution.code, '');
});
test('template deletion clears the active template and custom cases persist', async () => {
  const h = harness();
  await h.repo.initialize();
  await h.repo.saveTemplate({ language: 'cpp', template: { id: 't', name: 'T', code: 'x' } });
  await h.repo.deleteTemplate({ language: 'cpp', id: 't' });
  await h.repo.saveCases({
    key: 'cf:4:A',
    cases: [
      { id: 'c', name: 'Custom 1', input: '\n', expected: '', hasExpected: false, custom: true },
    ],
  });
  const state = await h.repo.readSnapshot();
  assert.equal(state.settings.activeTemplateByLang.cpp, undefined);
  assert.equal(state.cases['cf:4:A'][0].input, '\n');
});
test('fresh export includes later writes and cannot mutate internal state', async () => {
  const h = harness();
  await h.repo.initialize();
  await h.repo.readSnapshot();
  await save(h.repo, 'new');
  const backup = await h.repo.exportBackup();
  assert.equal(backup.state.solutions['cf:4:A'].cpp.code, 'new');
  backup.state.solutions['cf:4:A'].cpp.code = 'mutated';
  assert.equal((await h.repo.readSnapshot()).solutions['cf:4:A'].cpp.code, 'new');
});
test('invalid import performs no writes and merge recovers different drafts', async () => {
  const h = harness();
  await h.repo.initialize();
  await save(h.repo, 'original');
  const n = h.writes;
  await assert.rejects(
    h.repo.importBackup({ backup: { version: 3, solutions: { bad: 'broken' } }, mode: 'replace' })
  );
  assert.equal(h.writes, n);
  const other = harness();
  await other.repo.initialize();
  await save(other.repo, 'imported');
  await h.repo.importBackup({ backup: await other.repo.exportBackup(), mode: 'merge' });
  const state = await h.repo.readSnapshot();
  assert.equal(state.solutions['cf:4:A'].cpp.code, 'original');
  assert.ok(state.recoveredDrafts.some((d) => d.code === 'imported'));
});
test('replacement failure leaves old storage intact and successful replacement is recoverable', async () => {
  const h = harness();
  const other = harness();
  await h.repo.initialize();
  await other.repo.initialize();
  await save(h.repo, 'original');
  const backup = await other.repo.exportBackup();
  h.fail = true;
  await assert.rejects(h.repo.importBackup({ backup, mode: 'replace' }));
  assert.equal(h.data[STORAGE_KEY].solutions['cf:4:A'].cpp.code, 'original');
  h.fail = false;
  await h.repo.importBackup({ backup, mode: 'replace' });
  const state = await h.repo.readSnapshot();
  assert.equal(state.solutions['cf:4:A'], undefined);
  await h.repo.restoreSnapshot(state.preImportSnapshots.at(-1).id);
  assert.equal((await h.repo.readSnapshot()).solutions['cf:4:A'].cpp.code, 'original');
});
test('compiler patches preserve independent language preferences', async () => {
  const h = harness();
  await h.repo.initialize();
  await Promise.all([
    h.repo.patchSettings({ compilerByLang: { cpp: '89' } }),
    h.repo.patchSettings({ compilerByLang: { python: '70' } }),
  ]);
  assert.deepEqual((await h.repo.readSnapshot()).settings.compilerByLang, {
    cpp: '89',
    python: '70',
  });
});
test('malformed legacy templates are rejected before any backup write', async () => {
  const h = harness();
  await h.repo.initialize();
  const writes = h.writes;
  await assert.rejects(
    h.repo.importBackup({
      backup: {
        version: 2,
        settings: {},
        solutions: {},
        templates: { cpp: [{ id: 'x', code: 42 }] },
      },
      mode: 'replace',
    })
  );
  assert.equal(h.writes, writes);
});
test('replacement advances revisions so an open tab cannot overwrite the imported draft', async () => {
  const h = harness();
  await h.repo.initialize();
  await save(h.repo, 'before');
  const backup = await h.repo.exportBackup();
  backup.state.solutions['cf:4:A'].cpp.code = 'imported';
  await h.repo.importBackup({ backup, mode: 'replace' });
  assert.equal((await save(h.repo, 'stale tab', 1)).status, 'conflict');
  assert.equal((await h.repo.readSnapshot()).solutions['cf:4:A'].cpp.code, 'imported');
});
test('merging backups retains distinct custom cases with colliding IDs', async () => {
  const h = harness();
  await h.repo.initialize();
  const sample = {
    id: 'same',
    name: 'Custom 1',
    input: 'local',
    expected: '',
    hasExpected: false,
    custom: true,
  };
  await h.repo.saveCases({ key: 'cf:4:A', cases: [sample] });
  const backup = await h.repo.exportBackup();
  backup.state.cases['cf:4:A'][0].input = 'imported';
  await h.repo.importBackup({ backup, mode: 'merge' });
  const cases = (await h.repo.readSnapshot()).cases['cf:4:A'];
  assert.deepEqual(
    cases.map((c) => c.input),
    ['local', 'imported']
  );
  assert.notEqual(cases[0].id, cases[1].id);
});
