import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProblemUrl, problemKey} from '../../src/domain/problem.js';
import {compareOutputs, summarizeExecution} from '../../src/domain/execution.js';
import {normalizeSettings} from '../../src/domain/settings.js';

test('problem identity shares contest/problemset drafts without merging gym drafts', () => {
  assert.equal(problemKey(parseProblemUrl('https://codeforces.com/contest/4/problem/a')), 'cf:4:A');
  assert.equal(problemKey(parseProblemUrl('https://www.codeforces.com/problemset/problem/4/A')), 'cf:4:A');
  assert.equal(problemKey(parseProblemUrl('https://codeforces.com/gym/4/problem/A')), 'gym:4:A');
});
test('only complete HTTP Codeforces problem routes are accepted', () => {
  for (const url of ['https://evil.test/contest/4/problem/A', 'ftp://codeforces.com/contest/4/problem/A', 'https://codeforces.com/contest/no/problem/A', 'https://codeforces.com/contest/4/problem/A/extra', 'https://codeforces.com/contest/4/problem/!']) assert.equal(parseProblemUrl(url), null);
});
test('sample comparison distinguishes exact, token and wrong results', () => {
  assert.equal(compareOutputs('1 2\r\n', '1 2\n').mode, 'exact');
  assert.equal(compareOutputs('1\n2', '1 2').mode, 'tokens');
  assert.equal(compareOutputs('1 3', '1 2').passed, false);
});
test('execution requires a successful run stage and retains diagnostics', () => {
  assert.equal(summarizeExecution({ok:true, compile:{code:0}}).successful, false);
  assert.equal(summarizeExecution({ok:true, compile:{code:1,stderr:'bad'},run:{code:0}}).successful, false);
  assert.equal(summarizeExecution({ok:true,run:{code:139,signal:'SIGSEGV',stdout:'partial',stderr:'crash'}}).actual, 'partial');
  assert.equal(summarizeExecution({ok:true,run:{code:0,stdout:'ok'}}).successful, true);
});
test('invalid preferences normalize to a usable editor and local runner', () => {
  const settings = normalizeSettings({fontSize:999,paneWidth:-2,theme:'garbage',defaultLang:'rust',autoRunSamples:'yes',runnerEndpoint:'javascript:alert(1)'});
  assert.equal(settings.fontSize, 22);
  assert.equal(settings.paneWidth, 20);
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.defaultLang, 'cpp');
  assert.equal(settings.autoRunSamples, false);
  assert.equal(settings.runnerEndpoint, 'http://127.0.0.1:2000/api/v2/execute');
  assert.equal(normalizeSettings({}).paneWidth,44);
});
