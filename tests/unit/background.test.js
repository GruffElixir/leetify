import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessageRouter } from '../../src/platform/messages.js';
import { createBackground } from '../../src/background.js';
import { CodeforcesNetwork } from '../../src/codeforces/network.js';
const sender = {
  id: 'extension',
  tab: { id: 7 },
  url: 'https://codeforces.com/problemset/problem/4/A',
};

test('local C++ routing needs no endpoint consent and never falls back to a remote runner', async () => {
  const route = createMessageRouter({
    repository: { readSnapshot: async () => ({ settings: { runnerConsentOrigin: '' } }) },
    runner: {
      execute: () => {
        throw new Error('Source escaped to remote runner');
      },
    },
    localRunner: {
      execute: async ({ owner, code, stdin }) => ({
        ok: true,
        run: { code: 0, stdout: `${owner}:${code}:${stdin}` },
      }),
    },
    extensionApi: { runtime: { id: 'extension' } },
  });
  const payload = {
    runnerMode: 'local',
    language: 'cpp',
    code: 'source',
    stdin: 'input',
    requestId: 'local',
  };
  const result = await route({ type: 'RUNNER_EXECUTE', payload }, sender);
  assert.equal(result.ok, true);
  assert.equal(result.run.stdout, 'tab:7:source:input');
  assert.equal(
    (await route({ type: 'RUNNER_EXECUTE', payload: { ...payload, language: 'python' } }, sender))
      .ok,
    false
  );
  assert.equal(
    (await route({ type: 'RUNNER_EXECUTE', payload }, { ...sender, id: 'foreign' })).ok,
    false
  );
  assert.equal(
    (await route({ type: 'RUNNER_EXECUTE', payload: { ...payload, runnerMode: 'typo' } }, sender))
      .ok,
    false
  );
});
test('message router uses sender ownership and validates privileged payloads', async () => {
  const calls = [];
  const route = createMessageRouter({
    repository: { readSnapshot: async () => ({ version: 3 }) },
    runner: {
      cancel: (args) => calls.push(args),
      execute: async (args) => {
        calls.push(args);
        return { ok: true };
      },
    },
    network: { getPage: async () => ({ html: 'x' }) },
    extensionApi: { runtime: { id: 'extension' } },
  });
  await route({ type: 'RUNNER_CANCEL', payload: { owner: 'tab:2', requestId: 'r1' } }, sender);
  assert.deepEqual(calls[0], { owner: 'tab:7', requestId: 'r1' });
  assert.equal(
    (
      await route(
        {
          type: 'RUNNER_EXECUTE',
          payload: { endpoint: 'http://localhost/execute', language: 'fake', code: 'x', stdin: '' },
        },
        sender
      )
    ).ok,
    false
  );
  assert.equal(
    (await route({ type: 'CF_GET', payload: { url: 'https://evil.test/submit' } }, sender)).ok,
    false
  );
  assert.equal((await route({ type: 'STORAGE', payload: { method: 'mutate' } }, sender)).ok, false);
  assert.equal(
    (
      await route(
        { type: 'STORAGE', payload: { method: 'readSnapshot' } },
        { ...sender, id: 'foreign' }
      )
    ).ok,
    false
  );
  assert.equal(await route({ type: 'UNRELATED' }, sender), undefined);
});
test('toolbar and shortcut safely ignore unsupported tabs', async () => {
  const events = {};
  const event = (name) => ({ addListener: (listener) => (events[name] = listener) });
  let sent = 0;
  const extensionApi = {
    runtime: { id: 'extension', onMessage: event('message'), onInstalled: event('installed') },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    permissions: { contains: async () => true },
    tabs: {
      sendMessage: async () => {
        sent++;
        throw new Error('tab gone');
      },
      query: async () => [{ id: 1, url: 'https://example.com' }],
      onRemoved: event('removed'),
    },
    action: { onClicked: event('action') },
    commands: { onCommand: event('command') },
  };
  createBackground(extensionApi);
  await events.action({ id: 1, url: 'https://example.com' });
  await events.command('toggle-split-view');
  assert.equal(sent, 0);
  await events.action({ id: 1, url: sender.url });
  assert.equal(sent, 1);
});
test('Codeforces requests keep credentials and CSRF in POST body', async () => {
  let request;
  const network = new CodeforcesNetwork({
    fetch: async (url, init) => {
      request = { url, ...init };
      return {
        ok: true,
        status: 200,
        url: 'https://codeforces.com/problemset/status',
        text: async () => '<html></html>',
      };
    },
  });
  await network.postSubmission({
    url: 'https://codeforces.com/problemset/submit',
    body: 'csrf_token=secret&source=x',
  });
  assert.equal(request.credentials, 'include');
  assert.equal(request.body, 'csrf_token=secret&source=x');
  assert.equal(new URL(request.url).searchParams.has('csrf_token'), false);
  await assert.rejects(() =>
    network.postSubmission({ url: 'https://evil.test/submit', body: 'csrf_token=x' })
  );
});
