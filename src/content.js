import { StorageClient } from './storage/client.js';
import { createNetworkClient } from './platform/messages.js';
import { SubmissionController } from './submission/controller.js';
import { WorkspaceController } from './workspace/controller.js';
import { parseProblemUrl } from './domain/problem.js';
const extensionApi = globalThis.browser;
if (extensionApi?.runtime && parseProblemUrl(window.location.href)) {
  const send = (message) => extensionApi.runtime.sendMessage(message);
  const storage = new StorageClient(send, extensionApi.storage.onChanged);
  const network = createNetworkClient(send);
  const runner = {
    execute: ({ signal, ...payload }) => {
      const cancel = () =>
        send({ type: 'RUNNER_CANCEL', payload: { requestId: payload.requestId } }).catch(() => {});
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted)
        return Promise.resolve({
          ok: false,
          error: { code: 'CANCELLED', message: 'Run cancelled.' },
        });
      return send({ type: 'RUNNER_EXECUTE', payload }).finally(() =>
        signal?.removeEventListener('abort', cancel)
      );
    },
    cancelOwner: () => send({ type: 'RUNNER_CANCEL_OWNER' }).catch(() => {}),
    grant: (origin) => extensionApi.permissions.request({ origins: [`${origin}/*`] }),
    openOptions: () => send({ type: 'OPEN_OPTIONS' }),
  };
  let workspace;
  const submission = new SubmissionController({
    network,
    repository: storage,
    parseHtml: (html) => new DOMParser().parseFromString(html, 'text/html'),
    onUpdate: (record) => {
      if (workspace?.active)
        workspace.message(
          record.saveError ||
            record.message ||
            `Submission #${record.submissionId || '?'}: ${record.verdict}`
        );
    },
  });
  workspace = new WorkspaceController({ window, document, storage, network, runner, submission });
  let initialization = workspace.initialize().catch((error) => {
    console.warn('Leetify could not initialize:', error.message);
    throw error;
  });
  extensionApi.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'TOGGLE_WORKSPACE') return undefined;
    return initialization
      .then(() => (workspace.active ? workspace.deactivate() : workspace.activate()))
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: { message: error.message } }));
  });
  // Report initialization failures without logging source, tokens, or request bodies.
  initialization.catch(() => {});
}
