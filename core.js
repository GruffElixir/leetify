/*
 * Leetify shared, dependency-free helpers.
 * This file is loaded before content.js in Firefox and is also usable from
 * Node's test runner through module.exports.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LeetifyCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const LANGUAGE_FAMILIES = {
    // Codeforces currently uses labels such as "GNU G++20" and "GNU G++23".
    // Do not match "GNU GCC C11": that is a different compiler family.
    cpp: /(?:\bgnu\s*)?g\+\+|\bc\+\+/i,
    python: /python|pypy/i,
    java: /^java(?:\s|$)/i,
    javascript: /javascript|node(?:\.js)?/i,
  };

  function parseProblemUrl(input) {
    try {
      const url = new URL(input, 'https://codeforces.com');
      const host = url.hostname.toLowerCase();
      if (host !== 'codeforces.com' && host !== 'www.codeforces.com') return null;
      const parts = url.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'contest' || parts[0] === 'gym') &&
          parts[2] === 'problem' && parts[1] && parts[3]) {
        return {
          kind: parts[0],
          id: parts[1],
          index: parts[3].toUpperCase(),
          origin: url.origin,
          url: url.href,
        };
      }
      if (parts[0] === 'problemset' && parts[1] === 'problem' &&
          parts[2] && parts[3]) {
        return {
          kind: 'problemset',
          id: parts[2],
          index: parts[3].toUpperCase(),
          origin: url.origin,
          url: url.href,
        };
      }
    } catch (_) {
      // Invalid or unsupported URL.
    }
    return null;
  }

  function problemKey(route) {
    if (!route) return 'unknown:default';
    return `${route.kind}:${route.id}:${route.index}`;
  }

  function problemUrl(route, origin) {
    if (!route) return null;
    const base = origin || route.origin || 'https://codeforces.com';
    if (route.kind === 'problemset') {
      return `${base}/problemset/problem/${encodeURIComponent(route.id)}/${encodeURIComponent(route.index)}`;
    }
    return `${base}/${route.kind}/${encodeURIComponent(route.id)}/problem/${encodeURIComponent(route.index)}`;
  }

  function normalizeNewlines(value) {
    return String(value == null ? '' : value).replace(/\r\n?/g, '\n');
  }

  function normalizeSampleText(value) {
    return normalizeNewlines(value).replace(/^\n/, '').replace(/\n$/, '');
  }

  function normalizeOutput(value) {
    return normalizeNewlines(value).trim().split(/\s+/).filter(Boolean).join(' ');
  }

  function compareOutputs(actual, expected) {
    const actualText = normalizeNewlines(actual);
    const expectedText = normalizeNewlines(expected);
    if (actualText.trimEnd() === expectedText.trimEnd()) {
      return { passed: true, mode: 'exact', actual: actualText, expected: expectedText };
    }
    const tokenEqual = normalizeOutput(actualText) === normalizeOutput(expectedText);
    return {
      passed: tokenEqual,
      mode: tokenEqual ? 'tokens' : 'different',
      actual: actualText,
      expected: expectedText,
    };
  }

  function stageFailed(stage) {
    if (!stage) return false;
    return (typeof stage.code === 'number' && stage.code !== 0) || !!stage.signal || !!stage.status;
  }

  function summarizeExecution(response) {
    const compile = response && response.compile ? response.compile : null;
    const run = response && response.run ? response.run : null;
    const actual = run ? String(run.stdout || '') : String(response?.stdout || '');
    const diagnostics = [];
    if (compile?.stdout) diagnostics.push(`Compiler output:\n${compile.stdout}`);
    if (compile?.stderr) diagnostics.push(`Compile error:\n${compile.stderr}`);
    if (compile?.message) diagnostics.push(`Compile status: ${compile.message}`);
    if (run?.stderr) diagnostics.push(`Runtime error:\n${run.stderr}`);
    if (run?.message) diagnostics.push(`Runtime status: ${run.message}`);
    if (response?.error && !diagnostics.length) diagnostics.push(String(response.error));
    if (response?.message && !response?.ok && !diagnostics.includes(String(response.message))) diagnostics.push(String(response.message));
    const display = actual ? [actual, ...diagnostics].filter(Boolean).join('\n\n') : diagnostics.filter(Boolean).join('\n\n');
    return {
      actual,
      display,
      cancelled: !!response?.cancelled,
      successful: !!response?.ok && !stageFailed(compile) && !stageFailed(run),
    };
  }

  function languageMatches(label, language) {
    const rule = LANGUAGE_FAMILIES[language];
    return !!rule && rule.test(String(label || ''));
  }

  return {
    LANGUAGE_FAMILIES,
    parseProblemUrl,
    problemKey,
    problemUrl,
    normalizeNewlines,
    normalizeSampleText,
    normalizeOutput,
    compareOutputs,
    summarizeExecution,
    languageMatches,
  };
});
