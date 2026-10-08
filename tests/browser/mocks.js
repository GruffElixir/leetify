import { StorageRepository } from '../../src/storage/repository.js';
import { RunnerService } from '../../src/runner/service.js';
import { CodeforcesNetwork } from '../../src/codeforces/network.js';
import { createMessageRouter } from '../../src/platform/messages.js';
import { DEFAULT_SETTINGS } from '../../src/domain/settings.js';
import { emptyState, STORAGE_KEY } from '../../src/storage/schema.js';
const config = window.__testConfig || {};
const fixtures = window.__fixtures;
const state = emptyState();
state.settings = {
  ...structuredClone(DEFAULT_SETTINGS),
  runnerConsentOrigin: 'http://127.0.0.1:2000',
  ...config.settings,
};
const data = config.storage || { [STORAGE_KEY]: state };
const storageListeners = [];
const contentListeners = [];
const test = (window.__leetifyTest = {
  failWrites: false,
  failNavigation: false,
  holdRuns: false,
  submitPage: 'submit',
  executeNetworkFailure: false,
  executionRequests: [],
  executionResolvers: [],
  writes: 0,
  posts: 0,
});
const storage = {
  get: async () => structuredClone(data),
  set: async (changes) => {
    if (test.failWrites) throw new Error('Disk unavailable');
    const events = {};
    for (const [key, value] of Object.entries(changes)) {
      events[key] = { oldValue: structuredClone(data[key]), newValue: structuredClone(value) };
      data[key] = structuredClone(value);
    }
    test.writes++;
    for (const listener of storageListeners) listener(events, 'local');
  },
};
const response = (body, url) => ({
  ok: true,
  status: 200,
  url,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const mockedFetch = async (url, init = {}) => {
  if (url.includes('/runtimes') && test.emptyRuntimes) return response([], url);
  if (url.includes('/runtimes'))
    return response(
      [
        { language: 'c++', version: '12.1.0', aliases: ['cpp'] },
        { language: 'python', version: '3.12.0' },
      ],
      url
    );
  if (url.includes('/execute')) {
    const body = JSON.parse(init.body);
    test.executionRequests.push(body);
    if (test.executeNetworkFailure) throw new TypeError('NetworkError');
    if (test.holdRuns)
      return new Promise((resolve) =>
        test.executionResolvers.push((result) =>
          resolve(
            response(
              result || {
                run: { code: 0, stdout: body.stdin.trim() === '8' ? 'YES' : 'NO', stderr: '' },
              },
              url
            )
          )
        )
      );
    return response(
      { run: { code: 0, stdout: body.stdin.trim() === '8' ? 'YES' : 'NO', stderr: '' } },
      url
    );
  }
  if (init.method === 'POST') {
    test.posts++;
    return response(fixtures.status, 'https://codeforces.com/problemset/status');
  }
  if (test.failNavigation && /\/problem\/B|\/problem\/4\/B/.test(url))
    return response(fixtures.challenge, url);
  if (url.includes('/submit')) return response(fixtures[test.submitPage], url);
  if (url.includes('/my') || url.includes('/status'))
    return response('<table class="status-frame-datatable"></table>', url);
  return response(
    /\/problem\/B|\/problem\/4\/B/.test(url)
      ? fixtures['problem-math']
      : fixtures['problem-multiple'],
    url
  );
};
const repository = new StorageRepository({ storage });
const runner = new RunnerService({
  fetch: mockedFetch,
  permissions: { contains: async () => true },
});
const network = new CodeforcesNetwork({ fetch: mockedFetch });
const extensionApi = {
  permissions: { contains: async () => !test.denyPermission },
  runtime: {
    id: 'test-extension',
    openOptionsPage: async () => {
      test.optionsOpened = true;
    },
  },
};
const router = createMessageRouter({ repository, runner, network, extensionApi });
window.browser = {
  runtime: {
    id: 'test-extension',
    getURL: (path) => `http://127.0.0.1:4173/dist/${path}`,
    sendMessage: (message) =>
      router(message, { id: 'test-extension', tab: { id: 1 }, url: location.href }),
    onMessage: {
      addListener: (listener) => contentListeners.push(listener),
      removeListener: (listener) => contentListeners.splice(contentListeners.indexOf(listener), 1),
    },
    openOptionsPage: extensionApi.runtime.openOptionsPage,
  },
  storage: {
    local: storage,
    onChanged: {
      addListener: (listener) => storageListeners.push(listener),
      removeListener: (listener) => storageListeners.splice(storageListeners.indexOf(listener), 1),
    },
  },
  permissions: { contains: async () => true, request: async () => !test.denyPermission },
};
test.snapshot = () => repository.readSnapshot();
test.externalSave = (args) => repository.saveSolution(args);
test.patchSettings = (patch) => repository.patchSettings(patch);
test.toggle = () =>
  Promise.all(contentListeners.map((listener) => listener({ type: 'TOGGLE_WORKSPACE' })));
test.resolveExecution = (index, result) => test.executionResolvers[index]?.(result);
test.export = () => repository.exportBackup();
test.import = (backup) => repository.importBackup(backup);
if (location.hostname === 'codeforces.com') delete window.browser.permissions;
