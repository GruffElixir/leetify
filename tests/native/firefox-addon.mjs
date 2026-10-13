import { firefox } from 'playwright';
import net from 'node:net';
import path from 'node:path';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
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
  const addons = await request({ to: 'root', type: 'listAddons' });
  const addon = addons.addons.find((addon) => addon.id === 'leetify-cf@yourdomain.com');
  const watcher = await request({ to: addon.actor, type: 'getWatcher' });
  await request({ to: watcher.actor, type: 'watchTargets', targetType: 'frame' });
  const background = (
    await receive(
      (packet) =>
        packet.type === 'target-available-form' &&
        packet.target.url.endsWith('/_generated_background_page.html')
    )
  ).target;
  const evaluate = async (actor, text) => {
    const reply = await request({ to: actor, type: 'evaluateJSAsync', text, eager: false });
    const result = await receive(
      (packet) => packet.type === 'evaluationResult' && packet.resultID === reply.resultID
    );
    if (result.hasException) throw new Error(result.exceptionMessage);
    return result.result;
  };
  await evaluate(background.consoleActor, 'browser.runtime.openOptionsPage(); "opened"');
  const options = (
    await receive(
      (packet) =>
        packet.type === 'target-available-form' && packet.target.url.endsWith('/options.html')
    )
  ).target;
  const payload = {
    runnerMode: 'local',
    language: 'cpp',
    requestId: 'native-probe',
    code: '#include <bits/stdc++.h>\nint main(){int n;std::cin>>n;std::cout<<n*2;}',
    stdin: '21',
  };
  await evaluate(
    options.consoleActor,
    `globalThis.__nativeResult = "pending"; browser.runtime.sendMessage(${JSON.stringify({ type: 'RUNNER_EXECUTE', payload })}).then(result => globalThis.__nativeResult=JSON.stringify(result), error => globalThis.__nativeResult=JSON.stringify({error:error.message})); "started"`
  );
  let value = 'pending';
  for (let i = 0; i < 60 && value === 'pending'; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    value = await evaluate(options.consoleActor, 'globalThis.__nativeResult');
  }
  const result = JSON.parse(value);
  console.log('Native result', JSON.stringify(result));
  if (!result.ok || result.run?.stdout !== '42')
    throw new Error('Native extension execution failed');
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
