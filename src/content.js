import { StorageClient } from './storage/client.js';
import { createNetworkClient } from './platform/messages.js';
import { SubmissionController } from './submission/controller.js';
import { WorkspaceController } from './workspace/controller.js';
import { parseProblemUrl, problemKey } from './domain/problem.js';
const extensionApi = globalThis.browser;
if (extensionApi?.runtime && parseProblemUrl(window.location.href)) {
  // Firefox suspends the idle background page even while a response is pending, so long
  // compiles and requests would fail. Any incoming message resets its idle timer.
  let pending = 0;
  let heartbeat;
  const send = (message) => {
    if (!pending++)
      heartbeat = setInterval(
        () => extensionApi.runtime.sendMessage({ type: 'KEEPALIVE' }).catch(() => {}),
        1000
      );
    return extensionApi.runtime.sendMessage(message).finally(() => {
      if (!--pending) clearInterval(heartbeat);
    });
  };
  const storage = new StorageClient(send, extensionApi.storage.onChanged);
  const network = createNetworkClient(send);
  const progressListeners = new Map();
  const runner = {
    execute: ({ signal, onProgress, ...payload }) => {
      const cancel = () =>
        send({ type: 'RUNNER_CANCEL', payload: { requestId: payload.requestId } }).catch(() => {});
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) {
        signal.removeEventListener('abort', cancel);
        return Promise.resolve({
          ok: false,
          error: { code: 'CANCELLED', message: 'Run cancelled.' },
        });
      }
      if (onProgress) progressListeners.set(payload.requestId, onProgress);
      return send({ type: 'RUNNER_EXECUTE', payload }).finally(() => {
        signal?.removeEventListener('abort', cancel);
        progressListeners.delete(payload.requestId);
      });
    },
    cancelOwner: () => send({ type: 'RUNNER_CANCEL_OWNER' }).catch(() => {}),
    grant: async (origin) => {
      const response = await send({ type: 'RUNNER_PERMISSION', payload: { endpoint: origin } });
      if (!response?.ok)
        throw new Error(response?.error?.message || 'Could not check runner permission.');
      return response.data.granted;
    },
    openOptions: () => send({ type: 'OPEN_OPTIONS' }),
  };
  let workspace;
  const submission = new SubmissionController({
    network,
    repository: storage,
    parseHtml: (html) => new DOMParser().parseFromString(html, 'text/html'),
    onUpdate: (record) => {
      if (workspace?.active && record.key === problemKey(workspace.current.route))
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
    if (message?.type === 'RUNNER_PROGRESS') {
      progressListeners.get(message.payload?.requestId)?.(message.payload.phase);
      return undefined;
    }
    if (message?.type !== 'TOGGLE_WORKSPACE') return undefined;
    return initialization
      .then(() => (workspace.active ? workspace.deactivate() : workspace.activate()))
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: { message: error.message } }));
  });
  // Report initialization failures without logging source, tokens, or request bodies.
  initialization.catch(() => {});
}
