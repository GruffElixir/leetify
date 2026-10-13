import { firefox } from 'playwright';
import net from 'node:net';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const selected = server.address().port;
    server.close(() => resolve(selected));
  });
});
const uuid = 'ccbdd5b1-1252-4c9f-b963-5dc183ed9d30';
const resultsRoot = path.resolve('test-results');
await mkdir(resultsRoot, { recursive: true });
const profile = await mkdtemp(path.join(resultsRoot, 'native-profile-'));
const context = await firefox.launchPersistentContext(profile, {
  headless: true,
  args: ['--start-debugger-server', String(port)],
  firefoxUserPrefs: {
    'devtools.debugger.remote-enabled': true,
    'devtools.debugger.prompt-connection': false,
    'devtools.chrome.enabled': true,
    'extensions.webextensions.uuids': JSON.stringify({ 'leetify-cf@yourdomain.com': uuid }),
    // Suspend the idle event page well before an ordinary first compile finishes. No devtools
    // watcher is attached, because one would keep the background alive.
    'extensions.background.idle.timeout': 3000,
  },
});
const browser = context.browser();
let socket;
try {
  socket = await new Promise((resolve, reject) => {
    const client = net.connect(port, '127.0.0.1', () => resolve(client));
    client.once('error', reject);
  });
  let buffer = Buffer.alloc(0);
  const inbox = [];
  let notify;
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const colon = buffer.indexOf(':');
      if (colon < 0) break;
      const size = Number(buffer.subarray(0, colon).toString());
      if (buffer.length < colon + 1 + size) break;
      inbox.push(JSON.parse(buffer.subarray(colon + 1, colon + 1 + size).toString()));
      buffer = buffer.subarray(colon + 1 + size);
      notify?.();
    }
  });
  const receive = async (predicate) => {
    const started = Date.now();
    while (Date.now() - started < 20000) {
      const index = inbox.findIndex(predicate);
      if (index >= 0) return inbox.splice(index, 1)[0];
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 500);
        notify = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
    throw new Error(`RDP timeout; inbox ${JSON.stringify(inbox).slice(0, 2000)}`);
  };
  const request = async (packet) => {
    const body = JSON.stringify(packet);
    socket.write(`${Buffer.byteLength(body)}:${body}`);
    const reply = await receive((value) => value.from === packet.to && !value.type);
    if (reply.error) throw new Error(JSON.stringify(reply));
    return reply;
  };
  const hello = await receive((packet) => packet.applicationType || packet.traits);
  const root = await request({ to: 'root', type: 'getRoot' });
  console.log(
    'RDP',
    JSON.stringify({ version: browser.version(), hello: !!hello, addonsActor: root.addonsActor })
  );
  const installed = await request({
    to: root.addonsActor,
    type: 'installTemporaryAddon',
    addonPath: path.resolve('dist'),
    openDevTools: false,
  });
  console.log('Installed', JSON.stringify(installed));
  const fixture = await readFile('tests/fixtures/problem-multiple.html', 'utf8');
  await context.route('https://codeforces.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixture })
  );
  const page = await context.newPage();
  await page.goto('https://codeforces.com/problemset/problem/4/A');
  await page.locator('#leetify-workspace').waitFor({ timeout: 20000 });
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Tab');
  if (!(await page.evaluate(() => !!document.activeElement?.closest('#leetify-workspace'))))
    throw new Error('Keyboard focus reached the covered native page');
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(
    '#include <bits/stdc++.h>\nint main(){int w;std::cin>>w;std::cout<<(w>2&&w%2==0?"YES":"NO");}'
  );
  await page.getByRole('button', { name: 'Run all', exact: true }).click();
  const summary = page.locator('.lf-test-summary');
  await page.waitForFunction(
    () => /passed ·/.test(document.querySelector('.lf-test-summary')?.textContent),
    null,
    { timeout: 120000 }
  );
  const text = await summary.textContent();
  const diagnostics = await page
    .locator('.lf-case-tabs [data-status]')
    .evaluateAll((tabs) => tabs.map((tab) => `${tab.textContent}:${tab.dataset.status}`));
  const output = await page.locator('.lf-test-body').textContent();
  console.log(
    'Native workspace run',
    JSON.stringify({ summary: text, cases: diagnostics, output: output.slice(0, 300) })
  );
  if (!text.startsWith('2 passed · 0 failed')) throw new Error('Native extension execution failed');
  console.log('NATIVE FIREFOX EXTENSION: PASS');
} finally {
  socket?.destroy();
  await context.close();
  if (
    path.dirname(profile) !== resultsRoot ||
    !path.basename(profile).startsWith('native-profile-')
  )
    throw new Error('Refusing to remove a profile outside the generated test directory.');
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
