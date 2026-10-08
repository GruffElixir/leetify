import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunBatch } from '../../src/runner/batch.js';
const context = () => ({
  key: 'cf:4:A',
  language: 'cpp',
  code: 'original',
  endpoint: 'http://localhost/execute',
  cases: [
    { id: '1', input: 'first', expected: 'YES', hasExpected: true },
    { id: '2', input: 'second', expected: 'NO', hasExpected: true },
  ],
});
const success = (stdout) => ({ ok: true, run: { code: 0, stdout, stderr: '' } });
test('cancelled case one never starts case two or delivers its late result', async () => {
  let resolve;
  const requests = [];
  const results = [];
  const batch = createRunBatch({
    context: context(),
    execute: (request) => {
      requests.push(request);
      return new Promise((r) => {
        resolve = r;
      });
    },
    onResult: (result) => results.push(result),
  });
  const pending = batch.run();
  batch.cancel();
  resolve(success('YES'));
  const summary = await pending;
  assert.equal(requests.length, 1);
  assert.equal(results.length, 0);
  assert.equal(summary.cancelled, true);
});
test('batches capture source, language and cases once', async () => {
  const live = context();
  const requests = [];
  const results = [];
  const batch = createRunBatch({
    context: live,
    execute: async (request) => {
      requests.push(request);
      live.code = 'changed';
      live.language = 'python';
      live.cases[1].input = 'mutated';
      return success(request.stdin === 'first' ? 'YES' : 'NO');
    },
    onResult: (r) => results.push(r),
  });
  await batch.run();
  assert.equal(requests[1].code, 'original');
  assert.equal(requests[1].language, 'cpp');
  assert.equal(requests[1].stdin, 'second');
  assert.equal(results.length, 2);
  assert.equal(results[1].status, 'passed');
});
test('custom cases report ran and compiler failures cannot pass', async () => {
  const live = context();
  live.cases = [
    { id: 'c', input: '', expected: '', hasExpected: false, custom: true },
    { id: 's', input: '', expected: '', hasExpected: true },
  ];
  const results = [];
  let count = 0;
  const batch = createRunBatch({
    context: live,
    execute: async () =>
      ++count === 1 ? success('anything') : { ok: true, compile: { code: 1, stderr: 'bad' } },
    onResult: (r) => results.push(r),
  });
  const summary = await batch.run();
  assert.equal(results[0].status, 'ran');
  assert.equal(results[1].status, 'error');
  assert.equal(summary.passed, 0);
  assert.equal(results[1].diagnostics[0].text, 'bad');
});
test('run cannot be restarted after cancellation', async () => {
  let calls = 0;
  const batch = createRunBatch({
    context: context(),
    execute: async () => {
      calls++;
      return success('YES');
    },
  });
  batch.cancel();
  await batch.run();
  assert.equal(calls, 0);
});
