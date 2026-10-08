import { LeetifyError } from '../domain/errors.js';
import { parseProblemUrl } from '../domain/problem.js';
export function codeforcesUrl(value, { submit = false } = {}) {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['codeforces.com', 'www.codeforces.com'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const isSubmit = /^\/(?:problemset|(?:contest|gym)\/\d+)\/submit\/?$/.test(url.pathname);
    if (
      submit
        ? !isSubmit
        : !parseProblemUrl(url.href) &&
          !isSubmit &&
          !/^\/(?:problemset\/status(?:\/\d+\/problem\/[a-z0-9]+)?|(?:contest|gym)\/\d+\/(?:my|status|submission\/\d+))\/?$/i.test(
            url.pathname
          )
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
export class CodeforcesNetwork {
  constructor({
    fetch,
    timers = {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id) => globalThis.clearTimeout(id),
    },
  }) {
    this.fetch = fetch;
    this.timers = timers;
    this.active = new Map();
  }
  async request(
    value,
    {
      method = 'GET',
      body,
      signal,
      owner = 'local',
      requestId = `cf-${Date.now()}-${Math.random()}`,
    } = {}
  ) {
    const url = codeforcesUrl(value, { submit: method === 'POST' });
    if (!url)
      throw new LeetifyError('INVALID_URL', 'Only supported Codeforces pages can be requested.');
    if (
      method === 'POST' &&
      (typeof body !== 'string' || !new URLSearchParams(body).get('csrf_token'))
    )
      throw new LeetifyError('INVALID_FORM', 'The submission is missing its CSRF token.');
    url.searchParams.delete('csrf_token');
    const controller = new AbortController();
    const key = `${owner}:${requestId}`;
    if (this.active.has(key))
      throw new LeetifyError('DUPLICATE_REQUEST', 'This request is already running.');
    this.active.set(key, controller);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    let timedOut = false;
    let rejectAbort;
    const aborted = new Promise((_resolve, reject) => {
      rejectAbort = () =>
        reject(
          new LeetifyError(
            timedOut ? 'CF_TIMEOUT' : 'CANCELLED',
            timedOut ? 'Codeforces did not respond in time.' : 'Request cancelled.',
            method === 'GET'
          )
        );
    });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    const timer = this.timers.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
    try {
      if (controller.signal.aborted) rejectAbort();
      const response = await Promise.race([
        this.fetch(url.href, {
          method,
          body,
          credentials: 'include',
          redirect: 'follow',
          signal: controller.signal,
          headers:
            method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
        }),
        aborted,
      ]);
      if (!response.ok)
        throw new LeetifyError(
          'CF_HTTP',
          `Codeforces returned HTTP ${response.status}. Open the native page to check your session.`,
          method === 'GET'
        );
      const final = new URL(response.url || url.href);
      if (final.origin !== url.origin)
        throw new LeetifyError(
          'INVALID_URL',
          'Codeforces redirected to another origin. Open the native page.'
        );
      return {
        html: await Promise.race([response.text(), aborted]),
        url: final.href,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof LeetifyError) throw error;
      throw new LeetifyError(
        'CF_NETWORK',
        method === 'POST'
          ? 'The connection ended after sending. Check My submissions before trying again.'
          : 'Could not reach Codeforces. Open the native page or try again.',
        method === 'GET'
      );
    } finally {
      this.timers.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', rejectAbort);
      this.active.delete(key);
    }
  }
  getPage(url, options = {}) {
    return this.request(url, options);
  }
  postSubmission({ url, ...options }) {
    return this.request(url, { ...options, method: 'POST' });
  }
  cancel({ owner, requestId }) {
    this.active.get(`${owner}:${requestId}`)?.abort();
  }
  cancelOwner(owner) {
    for (const [key, controller] of this.active)
      if (key.startsWith(`${owner}:`)) controller.abort();
  }
}
