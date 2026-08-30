/*
 * Leetify background worker.
 * Network access belongs here so the content script only owns the UI.
 */
(function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;
  // Piston's shared public endpoint is no longer an open service. Keep the
  // default local so the extension never silently sends code to a dead or
  // third-party endpoint; users can configure another trusted host in Options.
  const DEFAULT_RUNNER_ENDPOINT = 'http://127.0.0.1:2000/api/v2/execute';
  const activeRuns = new Map();
  const runtimeCache = new Map();
  const RUNTIME_CACHE_TTL = 5 * 60 * 1000;

  const RUNNER_LANGUAGES = {
    cpp: 'c++',
    python: 'python',
    java: 'java',
    javascript: 'javascript',
  };
  const RUNTIME_ALIASES = {
    'c++': ['c++', 'cpp', 'g++', 'gnu++', 'cxx'],
    python: ['python', 'python3', 'py', 'pypy'],
    java: ['java'],
    javascript: ['javascript', 'js', 'node', 'node.js'],
  };

  function isCodeforcesUrl(value) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === 'codeforces.com' || host === 'www.codeforces.com';
    } catch (_) {
      return false;
    }
  }

  function requestId(message) {
    return message.requestId || `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function parseResponse(response) {
    const text = await response.text();
    try {
      return { data: JSON.parse(text), text };
    } catch (_) {
      return { data: null, text };
    }
  }

  function parseRunnerUrl(value) {
    const endpoint = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_RUNNER_ENDPOINT;
    let url;
    try { url = new URL(endpoint); }
    catch (_) { throw new Error('The runner endpoint is not a valid URL.'); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('The runner endpoint must use HTTP or HTTPS.');
    }
    return url;
  }

  function isLocalRunnerUrl(url) {
    if (!url) return false;
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(String(url.hostname || '').toLowerCase());
  }

  function formatRunnerError(error, endpointUrl) {
    const raw = error && error.message ? String(error.message) : '';
    const looksLikeNetworkFailure = /networkerror|failed to fetch|network request failed|connection refused|could not connect|fetch failed/i.test(raw);
    if (!looksLikeNetworkFailure) return raw || 'Runner request failed.';

    const origin = endpointUrl ? endpointUrl.origin : 'the configured runner';
    if (isLocalRunnerUrl(endpointUrl)) {
      const runtimePath = endpointUrl ? runtimesEndpoint(endpointUrl).pathname : '/api/v2/runtimes';
      return `Could not connect to the local runner at ${origin}. Start Piston and verify ${runtimePath} is available, or choose another endpoint in Leetify Options.`;
    }
    return `Could not reach the runner at ${origin}. Check that it is online, grant endpoint access in Leetify Options, and allow cross-origin requests.`;
  }

  function runtimesEndpoint(executeUrl) {
    const url = new URL(executeUrl.href || executeUrl);
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = /\/execute$/i.test(path) ? path.replace(/\/execute$/i, '/runtimes') : `${path}/runtimes`;
    url.search = '';
    url.hash = '';
    return url;
  }

  function runtimeMatches(runtime, language) {
    const wanted = new Set(RUNTIME_ALIASES[language] || [language]);
    const names = [runtime && runtime.language, ...(Array.isArray(runtime && runtime.aliases) ? runtime.aliases : [])]
      .filter(Boolean)
      .map(value => String(value).trim().toLowerCase());
    return names.some(name => wanted.has(name));
  }

  function compareVersions(left, right) {
    const parse = value => String(value || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    const a = parse(left);
    const b = parse(right);
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i++) {
      const difference = (b[i] || 0) - (a[i] || 0);
      if (difference) return difference;
    }
    return String(right || '').localeCompare(String(left || ''));
  }

  async function fetchRuntimes(endpointUrl, signal) {
    const key = endpointUrl.href;
    const cached = runtimeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.runtimes;
    const response = await fetch(runtimesEndpoint(endpointUrl).href, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    const { data, text } = await parseResponse(response);
    const runtimes = Array.isArray(data) ? data : (data && Array.isArray(data.runtimes) ? data.runtimes : null);
    if (!response.ok || !runtimes) {
      const detail = data && (data.message || data.error) || text.slice(0, 500);
      throw new Error(detail || `Runner runtimes request returned ${response.status}.`);
    }
    runtimeCache.set(key, { runtimes, expiresAt: Date.now() + RUNTIME_CACHE_TTL });
    return runtimes;
  }

  async function chooseRuntime(endpointUrl, language, signal) {
    const runtimes = await fetchRuntimes(endpointUrl, signal);
    const matches = runtimes.filter(runtime => runtimeMatches(runtime, language) && runtime.version);
    if (!matches.length) throw new Error(`The runner has no ${language} runtime installed.`);
    return matches.sort((a, b) => compareVersions(a.version, b.version))[0];
  }

  function stageResult(stage) {
    if (!stage || typeof stage !== 'object') return null;
    return {
      stdout: String(stage.stdout || ''),
      stderr: String(stage.stderr || ''),
      code: typeof stage.code === 'number' ? stage.code : null,
      signal: stage.signal ? String(stage.signal) : null,
      status: stage.status ? String(stage.status) : null,
      message: stage.message ? String(stage.message) : null,
    };
  }

  function runnerResponseMessage(data, text, response) {
    if (data && (data.message || data.error)) return String(data.message || data.error);
    if (text && text.trim()) return text.slice(0, 500);
    if (!response.ok) return text.slice(0, 500) || `Runner returned ${response.status}.`;
    return 'Runner returned no execution result. Check the configured endpoint.';
  }

  async function runCode(message) {
    const id = requestId(message);
    const controller = new AbortController();
    activeRuns.set(id, controller);

    try {
      const language = RUNNER_LANGUAGES[message.language];
      if (!language) return { ok: false, error: 'Unsupported execution language.' };

      let endpointUrl;
      try { endpointUrl = parseRunnerUrl(message.endpoint); }
      catch (error) { return { ok: false, error: error.message }; }

      let version = message.version;
      if (!version) {
        try {
          version = (await chooseRuntime(endpointUrl, language, controller.signal)).version;
        } catch (error) {
          if (error && error.name === 'AbortError') throw error;
          return { ok: false, error: formatRunnerError(error, endpointUrl) || 'Could not discover a runner runtime.' };
        }
      }

      const payload = {
        language,
        version,
        files: [{
          name: message.filename || 'solution.txt',
          content: String(message.code || ''),
        }],
        stdin: String(message.stdin || ''),
        args: [],
        compile_timeout: 10000,
        run_timeout: Math.min(Math.max(Number(message.timeoutMs) || 5000, 1000), 15000),
      };

      const response = await fetch(endpointUrl.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      const { data, text } = await parseResponse(response);
      const compile = stageResult(data && data.compile);
      const run = stageResult(data && data.run);
      const hasExecutionResult = !!(compile || run);
      const messageText = runnerResponseMessage(data, text, response);
      return {
        ok: response.ok && hasExecutionResult,
        status: response.status,
        version,
        compile,
        run,
        stdout: run ? run.stdout : '',
        stderr: run ? run.stderr : '',
        compileStdout: compile ? compile.stdout : '',
        compileStderr: compile ? compile.stderr : '',
        code: run ? run.code : null,
        signal: run ? run.signal : null,
        message: hasExecutionResult ? (data && data.message ? String(data.message) : '') : messageText,
        ...(response.ok && hasExecutionResult ? {} : { error: messageText }),
      };
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return { ok: false, cancelled: true, error: 'Run cancelled.' };
      }
      return { ok: false, error: formatRunnerError(error, endpointUrl) };
    } finally {
      activeRuns.delete(id);
    }
  }

  async function checkRunner(message) {
    let endpointUrl;
    try { endpointUrl = parseRunnerUrl(message && message.endpoint); }
    catch (error) { return { ok: false, error: error.message }; }
    try {
      const runtimes = await fetchRuntimes(endpointUrl);
      return { ok: true, url: endpointUrl.href, runtimeCount: runtimes.length };
    } catch (error) {
      return { ok: false, url: endpointUrl.href, error: formatRunnerError(error, endpointUrl) || 'Runner health check failed.' };
    }
  }

  async function submitCode(message) {
    if (!isCodeforcesUrl(message.url)) {
      return { ok: false, error: 'Submission URL is not a Codeforces URL.' };
    }
    try {
      const response = await fetch(message.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'text/html,application/xhtml+xml',
        },
        body: String(message.body || ''),
        credentials: 'include',
        redirect: 'follow',
        cache: 'no-store',
      });
      const { text } = await parseResponse(response);
      return {
        ok: response.ok,
        status: response.status,
        redirected: response.redirected,
        url: response.url || message.url,
        text: text.slice(0, 30000),
      };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : 'Submission request failed.' };
    }
  }

  async function fetchCodeforcesPage(message) {
    if (!isCodeforcesUrl(message.url)) {
      return { ok: false, error: 'Request URL is not a Codeforces URL.' };
    }
    try {
      const response = await fetch(message.url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      const { text } = await parseResponse(response);
      return { ok: response.ok, status: response.status, url: response.url || message.url, text: text.slice(0, 500000) };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : 'Codeforces request failed.' };
    }
  }

  function toggleTab(tabId) {
    if (!tabId || !api.tabs || !api.tabs.sendMessage) return;
    const request = api.tabs.sendMessage(tabId, { type: 'TOGGLE_SPLIT' });
    if (request && typeof request.catch === 'function') request.catch(() => {});
  }

  if (api.action && api.action.onClicked) {
    api.action.onClicked.addListener(tab => toggleTab(tab && tab.id));
  }

  if (api.commands && api.commands.onCommand) {
    api.commands.onCommand.addListener(async command => {
      if (command !== 'toggle-split-view' || !api.tabs) return;
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0]) toggleTab(tabs[0].id);
    });
  }

  api.runtime.onMessage.addListener(message => {
    if (!message || !message.type) return undefined;
    if (message.type === 'RUN_CODE') return runCode(message);
    if (message.type === 'CANCEL_RUN') {
      const controller = activeRuns.get(message.requestId);
      if (controller) controller.abort();
      return Promise.resolve({ ok: true });
    }
    if (message.type === 'SUBMIT_CODE') return submitCode(message);
    if (message.type === 'FETCH_CODEFORCES_PAGE') return fetchCodeforcesPage(message);
    if (message.type === 'CHECK_RUNNER') return checkRunner(message);
    return undefined;
  });
})();
