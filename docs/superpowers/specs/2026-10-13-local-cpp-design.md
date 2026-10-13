# Local C++ runner

User intent: choosing WebAssembly removes Docker, endpoint configuration and external services from ordinary C++ sample runs. The existing editor, cases, comparisons, diagnostics and Cancel flow remain the entry point. Authorization: the user chose the proposed built-in WebAssembly approach and instructed us to proceed. Continue the previously selected native execution workflow in the existing clean feature checkout.

## Behavior

C++ uses the built-in runner by default, including existing profiles. Settings offers Built-in C++20 or Piston for C++; Python, Java and JavaScript continue using the explicitly approved Piston endpoint. Local execution never falls back to a network runner. No endpoint permission or source transmission consent is needed locally. Submissions still use Codeforces' actual compiler and existing reviewed submission flow.

## Toolchain and isolation

Pin browsercc 0.1.1 (Clang/LLD 20.1.2 and WASI SDK 25) and @bjorn3/browser_wasi_shim 0.4.2. Bundle compiler binaries, JavaScript glue, sysroot and licenses in the extension. No runtime CDN, dynamic script download, eval or unsafe-eval. Allow wasm-unsafe-eval on extension pages only, preserving Firefox 128 and the original extension ID.

A lazy compiler worker runs one compile at a time across tabs. Cache only the latest source/module, compile as C++20 with optimization and exceptions disabled, and reuse the module across sample inputs. A separate disposable execution worker gets only the compiled module and stdin. Its WASI descriptors expose stdin/stdout/stderr and an empty filesystem, with no network or native process capabilities. Cap program memory at 256 MiB and output at 256 KiB. Limit compilation to 30 seconds after toolchain loading (60 seconds), and each execution to 2 seconds after worker readiness. Terminate workers on timeout, cancellation and tab closure. Release compiler resources after 60 seconds idle.

Compiler errors, traps, nonzero exits, unsupported constructs, timeouts, output limits and missing packaged assets produce actionable diagnostics in existing test results. Local startup/compilation progress is visible without logging source. Reject oversized source/input (1 MiB each), invalid languages and duplicate IDs. Cancellation must settle queued work and must not kill another tab's active job.

## Compatibility and packaging

Support standard C++20 and the toolchain's bits/stdc++.h shim, expanding the shim if needed for common standard headers. GNU PBDS, native OS APIs, threads and C++ exceptions are outside the WASI toolchain's support and must be explained in Settings/docs. Local memory/time behavior differs from Codeforces judging. No automatic rewrite of user source. The ZIP contains all assets and license notices; reproducible build reads pinned npm artifacts. Version 3.1.0.

## Evidence

Unit tests pin settings, routing, input boundaries, cancellation and watchdogs. Browser tests execute actual C++ (not a mocked compiler) in Chromium and Firefox with outbound network blocked except local packaged assets. Cover STL/bits, C++20, multiple different inputs, compile errors, stderr/nonzero exit, traps, infinite loops, output exhaustion, cancelled compile/run, recovery afterward and responsive UI. Run existing unit/browser regressions, format, build, Mozilla linter and archive integrity checks. Report native Firefox addon verification separately from fixture execution.
