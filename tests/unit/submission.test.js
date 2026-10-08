import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { SubmissionController } from '../../src/submission/controller.js';
import { parseProblemUrl } from '../../src/domain/problem.js';
const html = (name) => readFileSync(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8');
const route = parseProblemUrl('https://codeforces.com/problemset/problem/4/A');
const parseHtml = (text, url) => new JSDOM(text, { url }).window.document;
const empty = '<html><table class="status-frame-datatable"></table></html>';
function harness({ form = 'submit', receipt = 'status', failure = false } = {}) {
  const posts = [];
  const records = new Map();
  const updates = [];
  const scheduled = new Map();
  let timer = 0;
  let polling = false;
  const timers = {
    setTimeout: (fn, ms) => {
      assert.equal(ms, 1500);
      const id = ++timer;
      scheduled.set(id, () => {
        scheduled.delete(id);
        return fn();
      });
      return id;
    },
    clearTimeout: (id) => scheduled.delete(id),
  };
  const network = {
    getPage: async (url) => ({
      html: url.includes('/submit') ? html(form) : polling ? html('status') : empty,
      url,
    }),
    postSubmission: async (request) => {
      posts.push(request);
      polling = true;
      if (failure) throw new Error('connection lost');
      return { html: html(receipt), url: 'https://codeforces.com/problemset/status' };
    },
  };
  const repository = {
    recordSubmission: async (record) => {
      records.set(record.id, record);
      return record;
    },
  };
  const controller = new SubmissionController({
    network,
    repository,
    parseHtml,
    timers,
    onUpdate: (r) => updates.push(r),
  });
  return { controller, posts, records, updates, scheduled, network };
}
test('prepare rejects login, challenge and unavailable compilers before POST', async () => {
  for (const form of ['login', 'challenge']) {
    const h = harness({ form });
    await assert.rejects(() => h.controller.prepare({ route, language: 'cpp', code: 'x' }));
    assert.equal(h.posts.length, 0);
  }
  const h = harness();
  const prepared = await h.controller.prepare({ route, language: 'cpp', code: 'captured' });
  await assert.rejects(() => h.controller.submit({ ...prepared, compilerId: 'fake' }));
  assert.equal(h.posts.length, 0);
});
test('submission captures reviewed compiler and source and stores one exact receipt', async () => {
  const h = harness();
  const prepared = await h.controller.prepare({ route, language: 'cpp', code: 'captured' });
  const result = await h.controller.submit({ ...prepared, compilerId: '89' });
  assert.equal(result.status, 'confirmed');
  assert.equal(result.submissionId, '100001');
  const body = new URLSearchParams(h.posts[0].body);
  assert.equal(body.get('source'), 'captured');
  assert.equal(body.get('programTypeId'), '89');
  assert.equal(h.records.size, 1);
  const fn = h.scheduled.values().next().value;
  await fn();
  assert.equal(h.records.size, 1);
  assert.equal(h.updates.at(-1).submissionId, '100001');
  assert.notEqual(h.updates.at(-1).verdict, 'Accepted');
  h.controller.dispose();
  assert.equal(h.scheduled.size, 0);
});
test('transport failure sends one POST and cannot automatically retry', async () => {
  const h = harness({ failure: true });
  const prepared = await h.controller.prepare({ route, language: 'cpp', code: 'x' });
  assert.equal((await h.controller.submit(prepared)).status, 'unconfirmed');
  await assert.rejects(() => h.controller.submit(prepared));
  assert.equal(h.posts.length, 1);
});
test('HTML 200 challenge cannot be called submitted and polling disposal suppresses late writes', async () => {
  const challenged = harness({ receipt: 'challenge' });
  const prepared = await challenged.controller.prepare({ route, language: 'cpp', code: 'x' });
  assert.equal((await challenged.controller.submit(prepared)).status, 'unconfirmed');
  assert.equal(challenged.scheduled.size, 0);
  const h = harness();
  await h.controller.submit(await h.controller.prepare({ route, language: 'cpp', code: 'x' }));
  let resolve;
  h.network.getPage = () =>
    new Promise((r) => {
      resolve = r;
    });
  const poll = h.scheduled.values().next().value();
  h.controller.dispose();
  const count = h.updates.length;
  resolve({ html: html('status'), url: 'https://codeforces.com/problemset/status' });
  await poll;
  assert.equal(h.updates.length, count);
});
