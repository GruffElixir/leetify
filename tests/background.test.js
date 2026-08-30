const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:2000/api/v2/execute';

function responseFor(url, body, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || 200,
    redirected: !!options.redirected,
    url: String(url),
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
  };
}

function createBackgroundHarness({ runtimes, execution, executionOk = true, executionStatus = 200, executionText } = {}) {
  let listener;
  const requests = [];
  const runtimeList = runtimes || [
    { language: 'c++', version: '13.2.0', aliases: ['cpp', 'g++'] },
    { language: 'python', version: '3.12.0', aliases: ['py', 'python3'] },
    { language: 'java', version: '21.0.1', aliases: [] },
    { language: 'javascript', version: '22.0.0', aliases: ['node', 'js'] },
  ];
  const fakeBrowser = {
    action: { onClicked: { addListener() {} } },
    commands: { onCommand: { addListener() {} } },
    tabs: { sendMessage() { return Promise.resolve(); }, query: async () => [] },
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
  };
  const context = {
    browser: fakeBrowser,
    URL,
    Date,
    Math,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url).endsWith('/runtimes')) return responseFor(url, runtimeList);
      if (executionText !== undefined) return responseFor(url, executionText, { ok: executionOk, status: executionStatus });
      return responseFor(url, execution || { run: { stdout: 'ok\n', stderr: '', code: 0 } }, { ok: executionOk, status: executionStatus });
    },
  };
  vm.runInNewContext(fs.readFileSync('background.js', 'utf8'), context, { filename: 'background.js' });
  return { get listener() { return listener; }, requests, endpoint: DEFAULT_ENDPOINT };
}

test('background runner discovers a matching runtime and sends sandboxed execution requests', async () => {
  const harness = createBackgroundHarness();
  const result = await harness.listener({
    type: 'RUN_CODE',
    requestId: 'test-run',
    language: 'cpp',
    filename: 'solution.cpp',
    code: 'int main() {}',
    stdin: '1\n',
    endpoint: DEFAULT_ENDPOINT,
  });
  assert.equal(result.ok, true);
  assert.equal(result.version, '13.2.0');
  assert.equal(result.run.stdout, 'ok\n');
  const runtimeRequest = harness.requests.find(request => request.url.endsWith('/runtimes'));
  const executeRequest = harness.requests.find(request => request.options.method === 'POST');
  assert.equal(runtimeRequest.options.credentials, 'omit');
  assert.equal(executeRequest.options.credentials, 'omit');
  assert.equal(JSON.parse(executeRequest.options.body).version, '13.2.0');
});

test('runner preserves compile and runtime diagnostics even when the API returns HTTP 200', async () => {
  const harness = createBackgroundHarness({
    execution: { compile: { stdout: '', stderr: 'missing semicolon', code: 1, signal: null, status: null } },
  });
  const result = await harness.listener({ type: 'RUN_CODE', language: 'cpp', code: 'broken', endpoint: DEFAULT_ENDPOINT });
  assert.equal(result.ok, true, 'HTTP/JSON transport succeeded');
  assert.equal(result.compile.code, 1);
  assert.equal(result.compile.stderr, 'missing semicolon');
  assert.equal(result.run, null);
});

test('runner reports a whitelist or plain-text API response as an actionable error', async () => {
  const harness = createBackgroundHarness({
    executionText: 'Public Piston API is now whitelist only.',
    executionOk: true,
  });
  const result = await harness.listener({ type: 'RUN_CODE', language: 'python', code: 'print(1)', endpoint: DEFAULT_ENDPOINT });
  assert.equal(result.ok, false);
  assert.match(result.error, /whitelist only/i);
});

test('runner rejects a language that is not installed instead of guessing a version', async () => {
  const harness = createBackgroundHarness({ runtimes: [{ language: 'python', version: '3.12.0', aliases: ['py'] }] });
  const result = await harness.listener({ type: 'RUN_CODE', language: 'java', code: 'class Main {}', endpoint: DEFAULT_ENDPOINT });
  assert.equal(result.ok, false);
  assert.match(result.error, /no java runtime/i);
  assert.equal(harness.requests.some(request => request.options.method === 'POST'), false);
});

test('runner health check validates the configured runtimes endpoint', async () => {
  const harness = createBackgroundHarness();
  const result = await harness.listener({ type: 'CHECK_RUNNER', endpoint: DEFAULT_ENDPOINT });
  assert.equal(result.ok, true);
  assert.equal(result.url, DEFAULT_ENDPOINT);
  assert.equal(result.runtimeCount, 4);
});

test('background submission preserves credentials without putting CSRF in the URL', async () => {
  const harness = createBackgroundHarness();
  const result = await harness.listener({
    type: 'SUBMIT_CODE',
    url: 'https://codeforces.com/contest/1/submit',
    body: 'csrf_token=secret&source=code',
  });
  assert.equal(result.ok, true);
  assert.equal(harness.requests[0].options.credentials, 'include');
  assert.equal(harness.requests[0].url.includes('secret'), false);
});

test('background rejects non-Codeforces submission URLs', async () => {
  const harness = createBackgroundHarness();
  const result = await harness.listener({ type: 'SUBMIT_CODE', url: 'https://example.com/submit', body: '' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Codeforces URL/i);
  assert.equal(harness.requests.length, 0);
});
