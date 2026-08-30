const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../core.js');

test('parses contest, gym, and problemset URLs', () => {
  assert.deepEqual(Core.parseProblemUrl('https://codeforces.com/contest/1900/problem/a'), {
    kind: 'contest', id: '1900', index: 'A', origin: 'https://codeforces.com',
    url: 'https://codeforces.com/contest/1900/problem/a',
  });
  assert.equal(Core.parseProblemUrl('https://www.codeforces.com/gym/123/problem/B2').kind, 'gym');
  assert.equal(Core.parseProblemUrl('https://codeforces.com/problemset/problem/4/a').kind, 'problemset');
  assert.equal(Core.parseProblemUrl('https://example.com/contest/1/problem/A'), null);
});

test('creates stable problem keys and URLs', () => {
  const route = Core.parseProblemUrl('https://codeforces.com/gym/42/problem/C');
  assert.equal(Core.problemKey(route), 'gym:42:C');
  assert.equal(Core.problemUrl(route, 'https://www.codeforces.com'), 'https://www.codeforces.com/gym/42/problem/C');
});

test('compares outputs exactly first and then by whitespace tokens', () => {
  assert.equal(Core.compareOutputs('1 2\n', '1 2').passed, true);
  assert.equal(Core.compareOutputs('1\n2\n', '1 2').mode, 'tokens');
  assert.equal(Core.compareOutputs('1 3', '1 2').passed, false);
});

test('normalizes sample text without losing line boundaries', () => {
  assert.equal(Core.normalizeSampleText('\r\n8\r\n'), '8');
  assert.equal(Core.normalizeSampleText('a\n\nb\n'), 'a\n\nb');
});

test('summarizes runner stages without treating compile/runtime failures as passes', () => {
  const compileFailure = Core.summarizeExecution({
    ok: true,
    compile: { stderr: 'missing semicolon', code: 1 },
  });
  assert.equal(compileFailure.successful, false);
  assert.match(compileFailure.display, /missing semicolon/);

  const runtimeFailure = Core.summarizeExecution({
    ok: true,
    run: { stdout: 'partial', stderr: 'segmentation fault', code: 139, signal: 'SIGSEGV' },
  });
  assert.equal(runtimeFailure.successful, false);
  assert.equal(runtimeFailure.actual, 'partial');
  assert.match(runtimeFailure.display, /segmentation fault/);

  const passed = Core.summarizeExecution({ ok: true, run: { stdout: '42\n', code: 0 } });
  assert.equal(passed.successful, true);
  assert.equal(passed.actual, '42\n');
});

test('matches submit-form language families', () => {
  assert.equal(Core.languageMatches('GNU G++20 13.2 (64 bit, winlibs)', 'cpp'), true);
  assert.equal(Core.languageMatches('GNU G++23 14.2 (64 bit, msys2)', 'cpp'), true);
  assert.equal(Core.languageMatches('GNU GCC C11 5.1.0', 'cpp'), false);
  assert.equal(Core.languageMatches('PyPy 3-64', 'python'), true);
  assert.equal(Core.languageMatches('Java 21', 'java'), true);
  assert.equal(Core.languageMatches('JavaScript V8 4.8.0', 'java'), false);
  assert.equal(Core.languageMatches('Node.js 20', 'javascript'), true);
  assert.equal(Core.languageMatches('Kotlin 1.9', 'java'), false);
});
