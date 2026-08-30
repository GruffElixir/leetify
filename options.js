(function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;
  const STORAGE_KEY = 'leetify_state_v1';
  const SETTINGS_STORAGE_KEY = 'leetify_settings_v2';
  const HISTORY_STORAGE_KEY = 'leetify_history_v2';
  const SOLUTION_STORAGE_PREFIX = 'leetify_solution_v2:';
  const TEMPLATE_STORAGE_PREFIX = 'leetify_templates_v2:';
  const DEFAULT_RUNNER_ENDPOINT = 'http://127.0.0.1:2000/api/v2/execute';
  const DEFAULTS = {
    defaultLang: 'cpp',
    theme: 'monokai',
    layout: 'vertical',
    autoActivate: true,
    autoRunSamples: false,
    runnerEndpoint: DEFAULT_RUNNER_ENDPOINT,
  };

  let state = {
    version: 2,
    settings: { ...DEFAULTS },
    solutions: {},
    templates: {},
    submissionHistory: [],
  };

  const $ = id => document.getElementById(id);

  function runnerOriginPattern() {
    const value = $('runner-endpoint').value.trim() || DEFAULTS.runnerEndpoint;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Runner endpoint must use HTTP or HTTPS.');
    }
    return `${url.protocol}//${url.host}/*`;
  }

  async function updateRunnerAccessStatus() {
    const target = $('runner-access-status');
    if (!target || !api.permissions || typeof api.permissions.contains !== 'function') return;
    try {
      const origin = runnerOriginPattern();
      const granted = await api.permissions.contains({ origins: [origin] });
      target.textContent = granted ? 'Access granted' : 'Permission required';
      target.className = `status ${granted ? 'success' : 'warning'}`;
    } catch (error) {
      target.textContent = error.message;
      target.className = 'status warning';
    }
  }

  async function requestRunnerAccess() {
    const target = $('runner-access-status');
    try {
      if (!api.permissions || typeof api.permissions.request !== 'function') {
        throw new Error('This Firefox version cannot request runner permissions here.');
      }
      const origin = runnerOriginPattern();
      const granted = await api.permissions.request({ origins: [origin] });
      target.textContent = granted ? 'Access granted' : 'Permission was not granted';
      target.className = `status ${granted ? 'success' : 'warning'}`;
    } catch (error) {
      target.textContent = error.message;
      target.className = 'status warning';
    }
  }

  function normalizeState(value) {
    const input = value && typeof value === 'object' ? value : {};
    const settings = { ...DEFAULTS, ...(input.settings || {}) };
    if (typeof settings.runnerEndpoint !== 'string' || !settings.runnerEndpoint.trim() ||
        /emkc\.org\/api\/v2\/piston\/execute/i.test(settings.runnerEndpoint)) {
      settings.runnerEndpoint = DEFAULT_RUNNER_ENDPOINT;
    } else {
      settings.runnerEndpoint = settings.runnerEndpoint.trim();
    }
    return {
      version: 2,
      settings,
      solutions: input.solutions && typeof input.solutions === 'object' ? input.solutions : {},
      templates: input.templates && typeof input.templates === 'object' ? input.templates : {},
      submissionHistory: Array.isArray(input.submissionHistory) ? input.submissionHistory : [],
    };
  }

  function decodeStoragePart(value) {
    try { return decodeURIComponent(value); }
    catch (_) { return value; }
  }

  function stateFromStorage(all) {
    const legacy = normalizeState(all && all[STORAGE_KEY]);
    const next = {
      ...legacy,
      settings: { ...legacy.settings, ...(all && all[SETTINGS_STORAGE_KEY] || {}) },
      solutions: { ...legacy.solutions },
      templates: { ...legacy.templates },
      submissionHistory: Array.isArray(all && all[HISTORY_STORAGE_KEY])
        ? all[HISTORY_STORAGE_KEY] : legacy.submissionHistory,
    };
    Object.keys(all || {}).forEach(storageKey => {
      if (storageKey.startsWith(SOLUTION_STORAGE_PREFIX)) {
        const encoded = storageKey.slice(SOLUTION_STORAGE_PREFIX.length);
        const separator = encoded.lastIndexOf(':');
        if (separator === -1) return;
        const problem = decodeStoragePart(encoded.slice(0, separator));
        const lang = decodeStoragePart(encoded.slice(separator + 1));
        const entry = all[storageKey];
        if (!entry || typeof entry.code !== 'string') return;
        if (!next.solutions[problem]) next.solutions[problem] = {};
        next.solutions[problem][lang] = entry;
      }
      if (storageKey.startsWith(TEMPLATE_STORAGE_PREFIX)) {
        const lang = decodeStoragePart(storageKey.slice(TEMPLATE_STORAGE_PREFIX.length));
        if (Array.isArray(all[storageKey])) next.templates[lang] = all[storageKey];
      }
    });
    return normalizeState(next);
  }

  async function writeState(nextState) {
    const normalized = normalizeState(nextState);
    if (!api.storage?.local) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); }
      catch (_) {}
      return;
    }
    const all = await api.storage.local.get(null);
    const oldStructuredKeys = Object.keys(all || {}).filter(key =>
      key.startsWith(SOLUTION_STORAGE_PREFIX) || key.startsWith(TEMPLATE_STORAGE_PREFIX));
    if (oldStructuredKeys.length && api.storage.local.remove) await api.storage.local.remove(oldStructuredKeys);
    const changes = {
      [SETTINGS_STORAGE_KEY]: normalized.settings,
      [HISTORY_STORAGE_KEY]: normalized.submissionHistory,
    };
    Object.entries(normalized.solutions).forEach(([problem, languages]) => {
      Object.entries(languages || {}).forEach(([lang, entry]) => {
        changes[`${SOLUTION_STORAGE_PREFIX}${encodeURIComponent(problem)}:${encodeURIComponent(lang)}`] = entry;
      });
    });
    Object.entries(normalized.templates).forEach(([lang, templates]) => {
      changes[`${TEMPLATE_STORAGE_PREFIX}${encodeURIComponent(lang)}`] = templates;
    });
    await api.storage.local.set(changes);
  }

  async function loadState() {
    const result = await api.storage.local.get(null);
    state = stateFromStorage(result || {});
    $('default-language').value = state.settings.defaultLang;
    $('theme').value = state.settings.theme;
    $('layout').value = state.settings.layout;
    $('auto-activate').checked = state.settings.autoActivate !== false;
    $('auto-run-samples').checked = state.settings.autoRunSamples === true;
    $('runner-endpoint').value = state.settings.runnerEndpoint;
    $('save-status').textContent = 'Settings loaded';
    await updateRunnerAccessStatus();
  }

  async function saveState() {
    const runnerEndpoint = $('runner-endpoint').value.trim() || DEFAULTS.runnerEndpoint;
    try {
      const endpoint = new URL(runnerEndpoint);
      if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('protocol');
    } catch (_) {
      throw new Error('Runner endpoint must be a valid HTTP or HTTPS URL.');
    }
    state.settings = {
      ...state.settings,
      defaultLang: $('default-language').value,
      theme: $('theme').value,
      layout: $('layout').value,
      autoActivate: $('auto-activate').checked,
      autoRunSamples: $('auto-run-samples').checked,
      runnerEndpoint,
    };
    await api.storage.local.set({ [SETTINGS_STORAGE_KEY]: state.settings });
    $('save-status').textContent = 'Saved';
  }

  async function testRunner() {
    const target = $('runner-access-status');
    const button = $('test-runner');
    if (button) button.disabled = true;
    if (target) {
      target.textContent = 'Checking runner…';
      target.className = 'status';
    }
    try {
      if (!api.runtime?.sendMessage) throw new Error('The extension background worker is unavailable.');
      const endpoint = $('runner-endpoint').value.trim() || DEFAULT_RUNNER_ENDPOINT;
      const result = await api.runtime.sendMessage({ type: 'CHECK_RUNNER', endpoint });
      if (!result?.ok) throw new Error(result?.error || 'Runner health check failed.');
      target.textContent = `Runner ready (${result.runtimeCount} runtimes found)`;
      target.className = 'status success';
    } catch (error) {
      target.textContent = error.message;
      target.className = 'status warning';
    } finally {
      if (button) button.disabled = false;
    }
  }

  function download(name, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('save-settings').addEventListener('click', async () => {
    try { await saveState(); }
    catch (error) { $('save-status').textContent = `Could not save: ${error.message}`; }
  });

  $('grant-runner-access').addEventListener('click', requestRunnerAccess);
  $('test-runner').addEventListener('click', testRunner);
  $('runner-endpoint').addEventListener('change', updateRunnerAccessStatus);

  $('export-data').addEventListener('click', () => {
    download(`leetify-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2));
    $('backup-status').textContent = 'Backup exported';
  });

  $('import-data').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const imported = normalizeState(JSON.parse(await file.text()));
      state = imported;
      await writeState(state);
      await loadState();
      $('backup-status').textContent = 'Backup imported';
    } catch (error) {
      $('backup-status').textContent = `Import failed: ${error.message}`;
    } finally {
      event.target.value = '';
    }
  });

  loadState().catch(error => {
    $('save-status').textContent = `Could not load settings: ${error.message}`;
  });
  updateRunnerAccessStatus();
})();
