import { StorageRepository } from './storage/repository.js';
import { RunnerService } from './runner/service.js';
import { LocalRunnerService } from './runner/local-service.js';
import { CodeforcesNetwork } from './codeforces/network.js';
import { createMessageRouter } from './platform/messages.js';
import { parseProblemUrl } from './domain/problem.js';
export function createBackground(extensionApi) {
  const repository = new StorageRepository({ storage: extensionApi.storage.local });
  const runner = new RunnerService({
    fetch: globalThis.fetch.bind(globalThis),
    permissions: extensionApi.permissions,
  });
  const network = new CodeforcesNetwork({ fetch: globalThis.fetch.bind(globalThis) });
  const localRunner = new LocalRunnerService({
    workerFactory: (kind) =>
      new globalThis.Worker(extensionApi.runtime.getURL(`local-cpp/${kind}-worker.js`), {
        type: 'module',
      }),
    onProgress: (payload) => {
      if (payload.owner.startsWith('tab:'))
        extensionApi.tabs
          .sendMessage(Number(payload.owner.slice(4)), { type: 'RUNNER_PROGRESS', payload })
          .catch(() => {});
    },
  });
  extensionApi.runtime.onMessage.addListener(
    createMessageRouter({ repository, runner, localRunner, network, extensionApi })
  );
  const toggle = async (tab) => {
    if (tab?.id != null && parseProblemUrl(tab.url))
      try {
        await extensionApi.tabs.sendMessage(tab.id, { type: 'TOGGLE_WORKSPACE' });
      } catch {
        /* A closed or loading tab has no content listener. */
      }
  };
  extensionApi.action.onClicked.addListener(toggle);
  extensionApi.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-split-view')
      try {
        const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
        await toggle(tab);
      } catch {
        /* The active window may have closed. */
      }
  });
  extensionApi.tabs.onRemoved?.addListener((tabId) => {
    runner.cancelOwner(`tab:${tabId}`);
    localRunner.cancelOwner(`tab:${tabId}`);
    network.cancelOwner(`tab:${tabId}`);
  });
  return { repository, runner, localRunner, network };
}
if (globalThis.browser?.runtime?.onMessage) createBackground(globalThis.browser);
