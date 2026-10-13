import test from 'node:test';
import assert from 'node:assert/strict';
const { LocalRunnerService } = await import('../../src/runner/local-service.js').catch(() => ({}));

function fixture({ holdCompile = false, holdRun = false } = {}) {
  const workers = [];
  let compiles = 0;
  const workerFactory = (kind) => {
    const worker = {
      kind,
      terminated: false,
      listeners: new Map(),
      messages: [],
      addEventListener(name, listener) {
        this.listeners.set(name, listener);
      },
      removeEventListener(name) {
        this.listeners.delete(name);
      },
      emit(data) {
        this.listeners.get('message')?.({ data });
      },
      terminate() {
        this.terminated = true;
      },
      postMessage(data) {
        this.messages.push(data);
        queueMicrotask(() => {
          if (kind === 'compiler') {
            compiles++;
            this.emit({ id: data.id, phase: 'compiling' });
            if (!holdCompile) this.complete();
          } else {
            this.emit({ id: data.id, ready: true });
            if (!holdRun)
              this.emit({ id: data.id, run: { code: 0, stdout: data.stdin, stderr: '' } });
          }
        });
      },
      complete() {
        this.emit({
          id: this.messages.at(-1).id,
          module: {},
          compile: { code: 0, stdout: '', stderr: '' },
        });
      },
    };
    workers.push(worker);
    return worker;
  };
  const timers = {
    entries: new Map(),
    sequence: 0,
    setTimeout(callback, ms) {
      const id = ++this.sequence;
      this.entries.set(id, { callback, ms });
      return id;
    },
    clearTimeout(id) {
      this.entries.delete(id);
    },
    fire(ms) {
      const [id, item] = [...this.entries].find(([, value]) => value.ms === ms) || [];
      if (item) {
        this.entries.delete(id);
        item.callback();
      }
    },
  };
  assert.equal(typeof LocalRunnerService, 'function', 'Local runner must exist');
  return {
    service: new LocalRunnerService({ workerFactory, timers }),
    workers,
    timers,
    compiles: () => compiles,
  };
}
const options = (patch = {}) => ({
  owner: 'tab:1',
  requestId: 'one',
  language: 'cpp',
  code: 'int main() {}',
  stdin: 'first',
  ...patch,
});
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('local runner reuses one compilation but creates fresh execution state for each input', async () => {
  const f = fixture();
  assert.equal((await f.service.execute(options())).run.stdout, 'first');
  assert.equal(
    (await f.service.execute(options({ requestId: 'two', stdin: 'second' }))).run.stdout,
    'second'
  );
  assert.equal(f.compiles(), 1);
  assert.equal(f.workers.filter((w) => w.kind === 'execution' && w.terminated).length, 2);
  f.timers.fire(60000);
  assert.ok(f.workers.every((w) => w.terminated));
});

test('queued owner cancellation cannot terminate another tab compilation', async () => {
  const f = fixture({ holdCompile: true });
  const first = f.service.execute(options());
  const second = f.service.execute(options({ owner: 'tab:2', requestId: 'two', code: 'other' }));
  await tick();
  f.service.cancelOwner('tab:2');
  assert.equal((await second).error.code, 'CANCELLED');
  assert.equal(f.workers[0].terminated, false);
  f.workers[0].complete();
  assert.equal((await first).ok, true);
  f.timers.fire(60000);
});

test('cancelled compilation and worker crashes recover on the next request', async () => {
  const f = fixture({ holdCompile: true });
  const first = f.service.execute(options());
  await tick();
  f.service.cancel({ owner: 'tab:1', requestId: 'one' });
  assert.equal((await first).error.code, 'CANCELLED');
  assert.equal(f.workers[0].terminated, true);
  const second = f.service.execute(options({ requestId: 'two' }));
  await tick();
  f.workers[1].listeners.get('error')({ message: 'crash' });
  assert.equal((await second).error.code, 'LOCAL_WORKER');
  const third = f.service.execute(options({ requestId: 'three' }));
  await tick();
  f.workers[2].complete();
  assert.equal((await third).ok, true);
  f.timers.fire(60000);
});

test('watchdog kills infinite execution and compilation with actionable results', async () => {
  const f = fixture({ holdRun: true });
  const result = f.service.execute(options());
  await tick();
  f.timers.fire(2000);
  assert.equal((await result).run.status, 'TO');
  assert.equal(f.workers.at(-1).terminated, true);
  f.timers.fire(60000);
  const g = fixture({ holdCompile: true });
  const compile = g.service.execute(options());
  await tick();
  g.timers.fire(30000);
  assert.equal((await compile).compile.status, 'TO');
  assert.ok(g.workers.every((w) => w.terminated));
});

test('validation rejects unsupported languages, oversized UTF-8 inputs, duplicates and cancelled IDs', async () => {
  const f = fixture({ holdCompile: true });
  assert.equal(
    (await f.service.execute(options({ language: 'python' }))).error.code,
    'LOCAL_LANGUAGE'
  );
  assert.equal(
    (await f.service.execute(options({ stdin: '✓'.repeat(350000) }))).error.code,
    'LOCAL_INPUT_LIMIT'
  );
  assert.equal(
    (await f.service.execute(options({ code: 'x'.repeat(1048577) }))).error.code,
    'LOCAL_SOURCE_LIMIT'
  );
  assert.equal(f.workers.length, 0);
  const first = f.service.execute(options());
  assert.equal((await f.service.execute(options())).error.code, 'DUPLICATE_REQUEST');
  f.service.cancel({ owner: 'tab:1', requestId: 'one' });
  assert.equal((await first).error.code, 'CANCELLED');
  assert.equal((await f.service.execute(options())).error.code, 'CANCELLED');
});
