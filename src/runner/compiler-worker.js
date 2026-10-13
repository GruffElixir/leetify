import { Clang, LLD, setUpSysroot } from 'browsercc';
import { LOCAL_LIMITS, localStage } from './wasm-runtime.js';
import { CPP_HEADERS } from './cpp-headers.js';

let assets;
async function load() {
  return (assets ||= Promise.all(
    ['clang.wasm', 'lld.wasm', 'sysroot.tar'].map(async (name) => {
      const response = await fetch(new URL(name, import.meta.url));
      if (!response.ok)
        throw new Error(`Missing packaged C++ asset: ${name}. Reload or reinstall Leetify.`);
      return response.arrayBuffer();
    })
  ));
}

globalThis.onmessage = async ({ data: { id, code } }) => {
  let diagnostics = '';
  const printErr = (line) => {
    if (diagnostics.length < LOCAL_LIMITS.outputBytes) diagnostics += `${line}\n`;
  };
  try {
    globalThis.postMessage({ id, phase: 'loading' });
    const [compilerBinary, linkerBinary, sysroot] = await load();
    globalThis.postMessage({ id, phase: 'compiling' });
    const source = '/main.cpp';
    const options = { thisProgram: 'clang++', wasmBinary: compilerBinary, printErr };
    const driver = await Clang(options);
    driver.FS.writeFile(source, code);
    driver.FS.mkdirTree('/lib/wasm32-wasi');
    driver.FS.mkdirTree('/include/c++/v1');
    driver.FS.writeFile('/lib/wasm32-wasi/crt1-command.o', new Uint8Array());
    driver.FS.writeFile('/lib/wasm32-wasi/crt1-reactor.o', new Uint8Array());
    const flags = [
      '-std=c++20',
      '-O2',
      // Codeforces defines ONLINE_JUDGE; templates use it to skip local file redirection.
      '-DONLINE_JUDGE',
      '-fno-exceptions',
      `-Wl,--max-memory=${LOCAL_LIMITS.memoryBytes}`,
      '-Wl,-z,stack-size=4194304',
    ];
    const driverCode = driver.callMain([source, ...flags, '-###']);
    if (driverCode !== 0) throw new Error(diagnostics || 'Could not initialize the C++ compiler.');
    const command = (key) => {
      const line = diagnostics.split('\n').find((value) => value.includes(`"${key}"`));
      if (!line) throw new Error('The packaged compiler returned an invalid invocation.');
      const args = [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]).slice(1);
      return { args, output: args[args.indexOf('-o') + 1] };
    };
    const compileCommand = command('-cc1');
    const linkCommand = command('wasm-ld');
    diagnostics = '';
    // Each Emscripten invocation owns its filesystem and process state.
    const compiler = await Clang({ ...options });
    setUpSysroot(compiler, sysroot, { '/include/bits/stdc++.h': CPP_HEADERS });
    compiler.FS.writeFile(source, code);
    let exitCode = compiler.callMain(compileCommand.args);
    if (exitCode !== 0) {
      globalThis.postMessage({ id, module: null, compile: localStage(exitCode, '', diagnostics) });
      return;
    }
    const object = compiler.FS.readFile(compileCommand.output);
    const linker = await LLD({ thisProgram: 'wasm-ld', wasmBinary: linkerBinary, printErr });
    setUpSysroot(linker, sysroot);
    linker.FS.writeFile(compileCommand.output, object);
    exitCode = linker.callMain(linkCommand.args);
    const module =
      exitCode === 0 ? await WebAssembly.compile(linker.FS.readFile(linkCommand.output)) : null;
    globalThis.postMessage({ id, module, compile: localStage(exitCode, '', diagnostics) });
  } catch (error) {
    assets = undefined;
    globalThis.postMessage({
      id,
      module: null,
      retryable: true,
      compile: localStage(1, '', diagnostics, {
        message: error.message || 'The local C++ compiler failed. Try running again.',
      }),
    });
  }
};
