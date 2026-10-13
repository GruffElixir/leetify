import { fromError, LeetifyError } from '../domain/errors.js';
import { LOCAL_LIMITS, LOCAL_RUNTIME, localStage } from './wasm-runtime.js';

const defaultTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};
const cancelled = () => new LeetifyError('CANCELLED', 'Run cancelled.');

export class LocalRunnerService {
  constructor({ workerFactory, timers = defaultTimers, onProgress = () => {} }) {
    Object.assign(this, { workerFactory, timers, onProgress });
    this.active = new Map();
    this.cancelled = new Map();
    this.queue = Promise.resolve();
    this.cache = null;
    this.compiler = null;
    this.idle = null;
  }
  progress(options, phase) {
    this.onProgress({ owner: options.owner, requestId: options.requestId, phase });
  }
  release() {
    this.timers.clearTimeout(this.idle);
    this.compiler?.terminate();
    this.compiler = null;
    this.cache = null;
  }
  rpc(worker, payload, { signal, kind, progress }) {
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (error, data) => {
        this.timers.clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        worker.removeEventListener('message', message);
        worker.removeEventListener('error', crash);
        worker.removeEventListener('messageerror', crash);
        if (error) reject(error);
        else resolve(data);
      };
      const arm = (ms, phase) => {
        this.timers.clearTimeout(timer);
        timer = this.timers.setTimeout(() => finish(new LeetifyError('LOCAL_TIMEOUT', phase)), ms);
      };
      const abort = () => finish(cancelled());
      const crash = () =>
        finish(
          new LeetifyError(
            'LOCAL_WORKER',
            'The local C++ worker stopped. Try Run again, or reload Leetify.'
          )
        );
      const message = ({ data }) => {
        if (data?.id !== payload.id) return;
        if (data.phase) {
          progress(data.phase);
          if (data.phase === 'compiling') arm(LOCAL_LIMITS.compileMs, 'compile');
        } else if (data.ready) {
          progress('running');
          arm(LOCAL_LIMITS.runMs, 'run');
        } else finish(null, data);
      };
      worker.addEventListener('message', message);
      worker.addEventListener('error', crash);
      worker.addEventListener('messageerror', crash);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      arm(LOCAL_LIMITS.loadMs, kind === 'compiler' ? 'load' : 'start');
      try {
        worker.postMessage(payload);
      } catch {
        crash();
      }
    });
  }
  async compile(options, signal) {
    this.progress(options, 'queued');
    // Cancel queued work immediately, without interrupting a different owner's worker.
    const previous = this.queue;
    let unlock;
    this.queue = new Promise((resolve) => {
      unlock = resolve;
    });
    let rejectAbort;
    const aborted = new Promise((_, reject) => {
      rejectAbort = () => reject(cancelled());
      signal.addEventListener('abort', rejectAbort, { once: true });
    });
    try {
      if (signal.aborted) throw cancelled();
      await Promise.race([previous, aborted]);
      if (signal.aborted) throw cancelled();
      this.timers.clearTimeout(this.idle);
      if (this.cache?.code === options.code) {
        this.idle = this.timers.setTimeout(() => this.release(), LOCAL_LIMITS.idleMs);
        return this.cache.result;
      }
      this.compiler ||= this.workerFactory('compiler');
      try {
        const result = await this.rpc(
          this.compiler,
          { id: options.requestId, code: options.code },
          {
            signal,
            kind: 'compiler',
            progress: (phase) => this.progress(options, phase),
          }
        );
        if (result.retryable) this.release();
        else this.cache = { code: options.code, result };
        return result;
      } catch (error) {
        this.release();
        throw error;
      } finally {
        if (this.compiler)
          this.idle = this.timers.setTimeout(() => this.release(), LOCAL_LIMITS.idleMs);
      }
    } finally {
      signal.removeEventListener('abort', rejectAbort);
      // A cancelled waiter still preserves the order of jobs behind it.
      previous.then(unlock);
    }
  }
  async execute(options) {
    if (options.language !== 'cpp')
      return fromError(
        new LeetifyError(
          'LOCAL_LANGUAGE',
          'The built-in runner supports C++ only. Choose Piston in Settings for other languages.'
        )
      );
    if (typeof options.code !== 'string' || typeof options.stdin !== 'string')
      return fromError(new LeetifyError('INVALID_SOURCE', 'Source and input must be text.'));
    const encoder = new TextEncoder();
    if (encoder.encode(options.code).length > LOCAL_LIMITS.sourceBytes)
      return fromError(
        new LeetifyError('LOCAL_SOURCE_LIMIT', 'Local C++ source must be at most 1 MiB.')
      );
    if (encoder.encode(options.stdin).length > LOCAL_LIMITS.inputBytes)
      return fromError(
        new LeetifyError('LOCAL_INPUT_LIMIT', 'Each local test input must be at most 1 MiB.')
      );
    options = {
      ...options,
      requestId: options.requestId || `local-${Date.now()}-${Math.random()}`,
    };
    const key = `${options.owner}:${options.requestId}`;
    for (const [id, at] of this.cancelled) if (Date.now() - at > 60000) this.cancelled.delete(id);
    if (options.signal?.aborted || this.cancelled.has(key)) return fromError(cancelled());
    if (this.active.has(key))
      return fromError(new LeetifyError('DUPLICATE_REQUEST', 'This request is already running.'));
    const controller = new AbortController();
    this.active.set(key, controller);
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    let worker;
    let compile;
    try {
      const result = await this.compile(options, controller.signal);
      compile = result.compile;
      if (controller.signal.aborted) throw cancelled();
      if (!result.module) return { ok: true, compile, runtime: LOCAL_RUNTIME };
      worker = this.workerFactory('execution');
      const execution = await this.rpc(
        worker,
        {
          id: options.requestId,
          module: result.module,
          stdin: options.stdin,
        },
        {
          signal: controller.signal,
          kind: 'execution',
          progress: (phase) => this.progress(options, phase),
        }
      );
      return { ok: true, compile, run: execution.run, runtime: LOCAL_RUNTIME };
    } catch (error) {
      if (error.code === 'LOCAL_TIMEOUT') {
        const running = ['run', 'start'].includes(error.message);
        const stage = localStage(1, '', '', {
          status: 'TO',
          message: running
            ? 'Local execution exceeded its time limit (2 seconds for program execution).'
            : 'The local compiler timed out. Simplify the source or try Run again.',
        });
        return {
          ok: true,
          ...(running ? { compile, run: stage } : { compile: stage }),
          runtime: LOCAL_RUNTIME,
        };
      }
      return fromError(controller.signal.aborted ? cancelled() : error);
    } finally {
      worker?.terminate();
      this.active.delete(key);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  check() {
    return Promise.resolve({
      ok: true,
      data: { runtimes: [{ ...LOCAL_RUNTIME, aliases: ['cpp', 'c++'] }] },
    });
  }
  discover() {
    return Promise.resolve({ ok: true, data: LOCAL_RUNTIME });
  }
  cancel({ owner, requestId }) {
    const key = `${owner}:${requestId}`;
    this.cancelled.set(key, Date.now());
    this.active.get(key)?.abort();
  }
  cancelOwner(owner) {
    for (const [key, controller] of this.active)
      if (key.startsWith(`${owner}:`)) controller.abort();
  }
}
