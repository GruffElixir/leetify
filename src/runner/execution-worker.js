import {
  WASI,
  File,
  OpenFile,
  ConsoleStdout,
  wasi as wasiConstants,
} from '@bjorn3/browser_wasi_shim';
import { LOCAL_LIMITS, localStage } from './wasm-runtime.js';

// The upstream read-only File blocks writes, but its OpenFile resize/allocation methods
// still allocate host-side buffers. Deny those operations on stdin as well.
class ReadOnlyInput extends OpenFile {
  fd_allocate() {
    return wasiConstants.ERRNO_BADF;
  }
  fd_filestat_set_size() {
    return wasiConstants.ERRNO_BADF;
  }
}

globalThis.onmessage = async ({ data: { id, module, stdin } }) => {
  let stdout = '';
  let stderr = '';
  let bytes = 0;
  let outputLimited = false;
  const decoders = [new TextDecoder(), new TextDecoder()];
  const output = (index) =>
    new ConsoleStdout((data) => {
      const remaining = Math.max(0, LOCAL_LIMITS.outputBytes - bytes);
      const text = decoders[index].decode(data.subarray(0, remaining), { stream: true });
      if (index === 0) stdout += text;
      else stderr += text;
      bytes += data.length;
      if (bytes > LOCAL_LIMITS.outputBytes) {
        outputLimited = true;
        throw new Error('Program output exceeded 256 KiB.');
      }
    });
  const finish = (code, extra = {}) => {
    stdout += decoders[0].decode();
    stderr += decoders[1].decode();
    globalThis.postMessage({ id, run: localStage(code, stdout, stderr, extra) });
  };
  try {
    const wasi = new WASI(
      ['main'],
      [],
      [
        new ReadOnlyInput(new File(new TextEncoder().encode(stdin), { readonly: true })),
        output(0),
        output(1),
      ]
    );
    const instance = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    // Start the watchdog only after instantiation, so slow startup isn't charged to user code.
    globalThis.postMessage({ id, ready: true });
    finish(wasi.start(instance));
  } catch (error) {
    finish(1, {
      status: outputLimited ? 'OL' : 'RE',
      message: outputLimited
        ? 'Program output exceeded 256 KiB.'
        : `WebAssembly runtime error: ${error.message}`,
    });
  }
};
