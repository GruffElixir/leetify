import { LANGUAGES, isLanguage } from '../domain/languages.js';
import { runnerUrl } from '../domain/settings.js';
import { LeetifyError, fromError } from '../domain/errors.js';
const defaultTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};
const versionCompare = (a, b) => {
  const left = a.split(/[.-]/);
  const right = b.split(/[.-]/);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (Number(left[i]) || 0) - (Number(right[i]) || 0);
    if (diff) return diff;
  }
  return a.localeCompare(b);
};
export class RunnerService {
  constructor({ fetch, permissions, timers = defaultTimers, now = Date.now }) {
    this.fetch = fetch;
    this.permissions = permissions;
    this.timers = timers;
    this.now = now;
    this.cache = new Map();
    this.active = new Map();
    this.cancelled = new Map();
  }
  async request(options, operation) {
    const url = runnerUrl(options.endpoint);
    if (!url)
      return fromError(new LeetifyError('INVALID_ENDPOINT', 'Enter an HTTP or HTTPS runner URL.'));
    const requestId = options.requestId || `runner-${this.now()}-${Math.random()}`;
    const key = `${options.owner}:${requestId}`;
    for (const [id, at] of this.cancelled) if (this.now() - at > 60000) this.cancelled.delete(id);
    if (this.cancelled.has(key)) return fromError(new LeetifyError('CANCELLED', 'Run cancelled.'));
    if (this.active.has(key))
      return fromError(new LeetifyError('DUPLICATE_REQUEST', 'This request is already running.'));
    const controller = new AbortController();
    this.active.set(key, controller);
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    try {
      if (!(await this.permissions.contains({ origins: [`${url.origin}/*`] })))
        throw new LeetifyError(
          'PERMISSION_REQUIRED',
          'Allow access to this runner in Settings before running source.'
        );
      if (controller.signal.aborted) throw new LeetifyError('CANCELLED', 'Run cancelled.');
      return await operation(url, controller);
    } catch (error) {
      return fromError(
        controller.signal.aborted && error.code !== 'RUNNER_TIMEOUT'
          ? new LeetifyError('CANCELLED', 'Run cancelled.')
          : error
      );
    } finally {
      options.signal?.removeEventListener('abort', cancel);
      this.active.delete(key);
    }
  }
  async json(url, init, controller, deadline) {
    let timedOut = false;
    let rejectAbort;
    const aborted = new Promise((_resolve, reject) => {
      rejectAbort = () =>
        reject(
          new LeetifyError(
            timedOut ? 'RUNNER_TIMEOUT' : 'CANCELLED',
            timedOut ? 'The runner timed out. Check the service and try again.' : 'Run cancelled.',
            timedOut
          )
        );
    });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    const timer = this.timers.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, deadline);
    try {
      if (controller.signal.aborted) rejectAbort();
      const response = await Promise.race([
        this.fetch(url, {
          ...init,
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
        }),
        aborted,
      ]);
      if (!response.ok)
        throw new LeetifyError(
          'RUNNER_HTTP',
          `The runner returned HTTP ${response.status}. Check its URL and access policy.`,
          true
        );
      const text = await Promise.race([response.text(), aborted]);
      try {
        return JSON.parse(text);
      } catch {
        throw new LeetifyError(
          'RUNNER_RESPONSE',
          'The runner returned text instead of valid Piston JSON. Check its URL and access policy.'
        );
      }
    } catch (error) {
      if (error instanceof LeetifyError) throw error;
      if (controller.signal.aborted)
        throw new LeetifyError(
          timedOut ? 'RUNNER_TIMEOUT' : 'CANCELLED',
          timedOut ? 'The runner timed out.' : 'Run cancelled.',
          timedOut
        );
      throw new LeetifyError(
        'RUNNER_NETWORK',
        `Cannot reach ${new URL(url).origin}. Start your Piston service and check the address and browser permission.`,
        true
      );
    } finally {
      this.timers.clearTimeout(timer);
      controller.signal.removeEventListener('abort', rejectAbort);
    }
  }
  async runtimes(endpoint, controller, { fresh = false } = {}) {
    const cached = this.cache.get(endpoint.href);
    if (!fresh && cached && this.now() - cached.at < 300000) return cached.runtimes;
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/execute\/?$/, '/runtimes');
    if (url.pathname === endpoint.pathname)
      url.pathname = `${url.pathname.replace(/\/$/, '')}/runtimes`;
    const runtimes = await this.json(url.href, {}, controller, 15000);
    if (
      !Array.isArray(runtimes) ||
      runtimes.some(
        (r) =>
          !r ||
          typeof r.language !== 'string' ||
          typeof r.version !== 'string' ||
          (r.aliases && (!Array.isArray(r.aliases) || r.aliases.some((a) => typeof a !== 'string')))
      )
    )
      throw new LeetifyError('RUNNER_RESPONSE', 'The runner returned an invalid runtimes list.');
    this.cache.set(endpoint.href, { at: this.now(), runtimes });
    return runtimes;
  }
  runtime(runtimes, language, version) {
    if (!isLanguage(language))
      throw new LeetifyError('INVALID_LANGUAGE', 'Choose a supported language.');
    const aliases = LANGUAGES[language].aliases;
    const matching = runtimes.filter((r) =>
      [r.language, ...(r.aliases || [])].some((name) => aliases.includes(name.toLowerCase()))
    );
    const runtime = version
      ? matching.find((r) => r.version === version)
      : matching.sort((a, b) => versionCompare(b.version, a.version))[0];
    if (!runtime)
      throw new LeetifyError(
        'LANGUAGE_UNAVAILABLE',
        `${LANGUAGES[language].label} is not installed on this runner. Install it or choose another language.`
      );
    return runtime;
  }
  check(options) {
    return this.request(options, async (url, controller) => ({
      ok: true,
      data: { runtimes: await this.runtimes(url, controller, { fresh: true }) },
    }));
  }
  discover(options) {
    return this.request(options, async (url, controller) => ({
      ok: true,
      data: this.runtime(await this.runtimes(url, controller), options.language, options.version),
    }));
  }
  execute(options) {
    return this.request(options, async (url, controller) => {
      const runtime = this.runtime(
        await this.runtimes(url, controller),
        options.language,
        options.version
      );
      if (controller.signal.aborted) throw new LeetifyError('CANCELLED', 'Run cancelled.');
      if (typeof options.code !== 'string' || typeof options.stdin !== 'string')
        throw new LeetifyError('INVALID_SOURCE', 'Source and input must be text.');
      const body = {
        language: runtime.language,
        version: runtime.version,
        files: [{ name: LANGUAGES[options.language].filename, content: options.code }],
        stdin: options.stdin,
        args: [],
        compile_timeout: 10000,
        run_timeout: 2000,
        compile_memory_limit: 536870912,
        run_memory_limit: 536870912,
      };
      const result = await this.json(
        url.href,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        controller,
        30000
      );
      if (
        !result ||
        typeof result !== 'object' ||
        (!result.run && !result.compile) ||
        (result.run && typeof result.run.code !== 'number' && !result.run.signal)
      )
        throw new LeetifyError(
          'RUNNER_RESPONSE',
          'The runner did not return a compile or run result.'
        );
      return {
        ...result,
        ok: true,
        runtime: { language: runtime.language, version: runtime.version },
      };
    });
  }
  cancel({ owner, requestId }) {
    const key = `${owner}:${requestId}`;
    this.cancelled.set(key, this.now());
    this.active.get(key)?.abort();
  }
  cancelOwner(owner) {
    for (const [key, controller] of this.active)
      if (key.startsWith(`${owner}:`)) controller.abort();
  }
}
