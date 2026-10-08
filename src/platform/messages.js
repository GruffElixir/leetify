import { fromError, LeetifyError } from '../domain/errors.js';
import { isLanguage } from '../domain/languages.js';
import { runnerUrl } from '../domain/settings.js';
import { codeforcesUrl } from '../codeforces/network.js';
const storageMethods = new Set([
  'initialize',
  'readSnapshot',
  'patchSettings',
  'saveSolution',
  'saveCases',
  'saveTemplate',
  'deleteTemplate',
  'recordSubmission',
  'exportBackup',
  'importBackup',
  'restoreSnapshot',
]);
const types = new Set([
  'STORAGE',
  'RUNNER_CHECK',
  'RUNNER_DISCOVER',
  'RUNNER_EXECUTE',
  'RUNNER_CANCEL',
  'RUNNER_CANCEL_OWNER',
  'CF_GET',
  'CF_POST',
  'CF_CANCEL',
  'CF_CANCEL_OWNER',
  'OPEN_OPTIONS',
]);
export function createMessageRouter({ repository, runner, network, extensionApi }) {
  const runnerEpochs = new Map();
  return (message, sender = {}) => {
    if (!types.has(message?.type)) return undefined;
    return (async () => {
      try {
        if (sender.id !== extensionApi.runtime.id)
          throw new LeetifyError('UNAUTHORIZED', 'This request did not come from Leetify.');
        const payload = message.payload || {};
        const owner =
          sender.tab?.id != null ? `tab:${sender.tab.id}` : `extension:${sender.url || ''}`;
        if (message.type === 'STORAGE') {
          if (!storageMethods.has(payload.method))
            throw new LeetifyError('INVALID_MESSAGE', 'Unknown storage operation.');
          return { ok: true, data: await repository[payload.method](payload.args) };
        }
        if (message.type === 'OPEN_OPTIONS') {
          await extensionApi.runtime.openOptionsPage();
          return { ok: true };
        }
        if (message.type.endsWith('CANCEL_OWNER')) {
          if (message.type.startsWith('RUNNER'))
            runnerEpochs.set(owner, (runnerEpochs.get(owner) || 0) + 1);
          (message.type.startsWith('CF') ? network : runner).cancelOwner(owner);
          return { ok: true };
        }
        if (message.type.endsWith('CANCEL')) {
          if (typeof payload.requestId !== 'string')
            throw new LeetifyError('INVALID_MESSAGE', 'A request ID is required.');
          (message.type.startsWith('CF') ? network : runner).cancel({
            owner,
            requestId: payload.requestId,
          });
          return { ok: true };
        }
        if (
          payload.requestId != null &&
          (typeof payload.requestId !== 'string' || payload.requestId.length > 200)
        )
          throw new LeetifyError('INVALID_MESSAGE', 'Invalid request ID.');
        if (message.type.startsWith('RUNNER')) {
          const url = runnerUrl(payload.endpoint);
          if (
            !url ||
            (message.type !== 'RUNNER_CHECK' && !isLanguage(payload.language)) ||
            (message.type === 'RUNNER_EXECUTE' &&
              (typeof payload.code !== 'string' || typeof payload.stdin !== 'string'))
          )
            throw new LeetifyError('INVALID_MESSAGE', 'Invalid runner request.');
          if (message.type === 'RUNNER_EXECUTE') {
            const epoch = runnerEpochs.get(owner) || 0;
            const state = await repository.readSnapshot();
            if (epoch !== (runnerEpochs.get(owner) || 0))
              throw new LeetifyError('CANCELLED', 'Run cancelled.');
            if (state.settings.runnerConsentOrigin !== url.origin)
              throw new LeetifyError(
                'CONSENT_REQUIRED',
                'Review and allow the configured runner before sending source.'
              );
          }
          const method = {
            RUNNER_CHECK: 'check',
            RUNNER_DISCOVER: 'discover',
            RUNNER_EXECUTE: 'execute',
          }[message.type];
          return runner[method]({ ...payload, owner });
        }
        if (
          !codeforcesUrl(payload.url, { submit: message.type === 'CF_POST' }) ||
          (message.type === 'CF_POST' && typeof payload.body !== 'string')
        )
          throw new LeetifyError('INVALID_MESSAGE', 'Invalid Codeforces request.');
        const data =
          message.type === 'CF_GET'
            ? await network.getPage(payload.url, { requestId: payload.requestId, owner })
            : await network.postSubmission({
                url: payload.url,
                body: payload.body,
                requestId: payload.requestId,
                owner,
              });
        return { ok: true, data };
      } catch (error) {
        return fromError(error);
      }
    })();
  };
}
export function createNetworkClient(sendMessage) {
  const request = async (type, payload) => {
    const response = await sendMessage({ type, payload });
    if (!response?.ok)
      throw new LeetifyError(
        response?.error?.code || 'CF_NETWORK',
        response?.error?.message || 'Codeforces request failed.',
        !!response?.error?.retryable
      );
    return response.data;
  };
  const call = (type, payload, signal) => {
    const requestId = payload.requestId || `cf-${Date.now()}-${Math.random()}`;
    const cancel = () => sendMessage({ type: 'CF_CANCEL', payload: { requestId } }).catch(() => {});
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) {
      signal.removeEventListener('abort', cancel);
      return Promise.reject(new LeetifyError('CANCELLED', 'Request cancelled.'));
    }
    return request(type, { ...payload, requestId }).finally(() =>
      signal?.removeEventListener('abort', cancel)
    );
  };
  return {
    getPage: (url, { signal, ...options } = {}) => call('CF_GET', { url, ...options }, signal),
    postSubmission: ({ signal, ...payload }) => call('CF_POST', payload, signal),
    cancelOwner: () => sendMessage({ type: 'CF_CANCEL_OWNER' }),
  };
}
