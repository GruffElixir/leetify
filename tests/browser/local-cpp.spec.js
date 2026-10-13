import { test, expect } from '@playwright/test';
import { extension, replaceCode } from './helpers.js';

test.setTimeout(120000);

async function toolchain(page) {
  await page.goto('/health');
  await page.evaluate(() => {
    window.runWorker = (kind, payload) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(`/dist/local-cpp/${kind}-worker.js`, { type: 'module' });
        const deadline = setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker deadline'));
        }, 90000);
        worker.onerror = (event) => {
          clearTimeout(deadline);
          worker.terminate();
          reject(new Error(event.message));
        };
        worker.onmessage = ({ data }) => {
          if (data.phase || data.ready) return;
          clearTimeout(deadline);
          worker.terminate();
          resolve(data);
        };
        worker.postMessage({ id: 'test', ...payload });
      });
  });
}

test('packaged C++20 compiler runs STL, bits and fresh stdin entirely locally', async ({
  page,
}) => {
  await toolchain(page);
  const external = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url());
  });
  const results = await page.evaluate(async () => {
    const compiled = await runWorker('compiler', {
      code: `
      #include <bits/stdc++.h>
      #include <ranges>
      using namespace std;
      int main() {
        int n; cin >> n; vector<int> v(n);
        for (int &x : v) cin >> x;
        ranges::sort(v);
        cout << "✓ " << accumulate(v.begin(), v.end(), 0) << " " << v.front();
      }`,
    });
    if (!compiled.module) return compiled;
    const first = await runWorker('execution', { module: compiled.module, stdin: '3\n9 1 5\n' });
    const second = await runWorker('execution', { module: compiled.module, stdin: '2\n8 2\n' });
    return { compile: compiled.compile, first, second };
  });
  expect(results.compile?.code, JSON.stringify(results)).toBe(0);
  expect(results.first.run).toMatchObject({ code: 0, stdout: '✓ 15 1', stderr: '' });
  expect(results.second.run).toMatchObject({ code: 0, stdout: '✓ 10 2', stderr: '' });
  expect(external).toEqual([]);
});

test('compiler errors and unsupported GNU headers are readable diagnostics', async ({ page }) => {
  await toolchain(page);
  const result = await page.evaluate(() =>
    runWorker('compiler', { code: '#include <ext/pb_ds/assoc_container.hpp>\nint main() {}' })
  );
  expect(result.module).toBeNull();
  expect(result.compile.code).not.toBe(0);
  expect(result.compile.stderr, JSON.stringify(result)).toContain('ext/pb_ds/assoc_container.hpp');
});

test('bits header includes common contest helpers and program memory stays bounded', async ({
  page,
}) => {
  await toolchain(page);
  const result = await page.evaluate(async () => {
    const compiled = await runWorker('compiler', {
      code: `
      #include <bits/stdc++.h>
      int main() {
        std::bitset<8> bits(7); std::stringstream s; s << std::get<0>(std::make_tuple(9));
        auto previous = __builtin_wasm_memory_grow(0, 4096);
        std::cout << bits.count() << " " << s.str() << " " << INT_MAX << " " << (previous == size_t(-1));
      }`,
    });
    if (!compiled.module) return compiled;
    return runWorker('execution', { module: compiled.module, stdin: '' });
  });
  expect(result.compile?.code ?? 0, JSON.stringify(result)).toBe(0);
  expect(result.run, JSON.stringify(result)).toMatchObject({ code: 0, stdout: '3 9 2147483647 1' });
});

test('WASI keeps stderr separate and bounds output with a readable error', async ({ page }) => {
  await toolchain(page);
  const results = await page.evaluate(async () => {
    const compiled = await runWorker('compiler', {
      code: `
      #include <iostream>
      int main() { int n; std::cin >> n;
        if (n == 0) { std::cout << "out"; std::cerr << "diagnostic"; return 7; }
        if (n == 1) { for (int i=0; i<300000; ++i) std::cout << 'x'; }
        if (n == 2) __builtin_trap();
      }`,
    });
    if (!compiled.module) return compiled;
    return {
      exit: await runWorker('execution', { module: compiled.module, stdin: '0' }),
      output: await runWorker('execution', { module: compiled.module, stdin: '1' }),
      trap: await runWorker('execution', { module: compiled.module, stdin: '2' }),
    };
  });
  expect(results.exit?.run, JSON.stringify(results)).toMatchObject({
    code: 7,
    stdout: 'out',
    stderr: 'diagnostic',
  });
  expect(results.output?.run.status).toBe('OL');
  expect(results.output.run.stdout.length).toBeLessThanOrEqual(262144);
  expect(results.trap?.run.status).toBe('RE');
  expect(results.trap.run.message).toContain('WebAssembly');
});

test('programs cannot write or resize the input descriptor outside their Wasm memory limit', async ({
  page,
}) => {
  await toolchain(page);
  const result = await page.evaluate(async () => {
    const compiled = await runWorker('compiler', {
      code: `
      #include <iostream>
      #include <unistd.h>
      #include <wasi/api.h>
      int main(){ char x='X'; auto write_result=write(0,&x,1);
        auto resize_result=__wasi_fd_filestat_set_size(0,8);
        auto allocate_result=__wasi_fd_allocate(0,0,8);
        std::string input; std::cin>>input;
        std::cout<<(write_result==-1)<<" "<<(resize_result!=0)<<" "<<(allocate_result!=0)<<" "<<input;
      }`,
    });
    if (!compiled.module) return compiled;
    return runWorker('execution', { module: compiled.module, stdin: 'abc\n' });
  });
  expect(result.compile?.code ?? 0, JSON.stringify(result)).toBe(0);
  expect(result.run?.stdout).toBe('1 1 1 abc');
});

test('default C++ Run compiles real samples without remote consent and keeps the editor responsive', async ({
  page,
}) => {
  await extension(page, {
    actualLocalRunner: true,
    settings: { cppRunner: 'local', runnerConsentOrigin: '' },
  });
  await replaceCode(
    page,
    '#include <bits/stdc++.h>\nint main(){int n;std::cin>>n;std::cout<<(n%2==0 && n>2 ? "YES" : "NO");}'
  );
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Allow runner access' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel run', exact: true })).toBeVisible();
  // Keyboard editing must remain available while Wasm compilation is busy in a worker.
  await replaceCode(page, '// later draft');
  await expect(page.locator('.cm-content')).toContainText('// later draft');
  await expect(page.locator('.lf-test-summary')).toContainText('2/2', { timeout: 60000 });
  expect(await page.evaluate(() => __leetifyTest.executionRequests.length)).toBe(0);
  await expect(page.locator('[data-status=runner]')).toContainText('local');
});

test('cancel local compilation and recover with a fresh source', async ({ page }) => {
  await extension(page, {
    actualLocalRunner: true,
    settings: { cppRunner: 'local', runnerConsentOrigin: '' },
  });
  await replaceCode(page, '#include <bits/stdc++.h>\nint main(){while(true){}}');
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('Cancelled');
  await replaceCode(
    page,
    '#include <iostream>\nint main(){int n; std::cin>>n;std::cout<<(n==8?"YES":"NO");}'
  );
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2/2', { timeout: 60000 });
});

test('retrying unchanged C++ source recovers after a packaged asset fails to load', async ({
  page,
}) => {
  await extension(page, {
    actualLocalRunner: true,
    settings: { cppRunner: 'local', runnerConsentOrigin: '' },
  });
  let fail = true;
  await page.route('https://codeforces.com/__leetify/sysroot.tar', async (route) => {
    if (fail) return route.fulfill({ status: 404, body: '' });
    return route.fallback();
  });
  await replaceCode(
    page,
    '#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<(n==8?"YES":"NO");}'
  );
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2 failed', { timeout: 60000 });
  await expect(page.locator('.lf-tests')).toContainText('Missing packaged C++ asset');
  fail = false;
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2 passed', { timeout: 60000 });
});

test('a real infinite loop times out and a subsequent run still works', async ({ page }) => {
  await extension(page, {
    actualLocalRunner: true,
    settings: { cppRunner: 'local', runnerConsentOrigin: '' },
  });
  await replaceCode(page, '#include <iostream>\nint main(){volatile int n=0;while(true){n=n+1;}}');
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2 failed', { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Run all', exact: true })).toBeEnabled();
  await expect(page.locator('.lf-tests')).toContainText('time limit');
  await replaceCode(
    page,
    '#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<(n==8?"YES":"NO");}'
  );
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  await expect(page.locator('.lf-test-summary')).toContainText('2/2', { timeout: 60000 });
});
