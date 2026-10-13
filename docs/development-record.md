# SDD ledger — plan: docs/superpowers/plans/2026-10-08-leetify-overhaul.md

Execution: Native, approved by user. Baseline 2234acf. Existing fresh clone on codex/leetify-overhaul is the user-approved workspace; no unrelated changes.
Pre-flight: Tasks 1→2–8 share canonical route/language/settings definitions; consistent.
Pre-flight: Tasks 2→5/7/8 share the storage API and v3 envelope; consistent.
Pre-flight: Tasks 3→5/7 share parsed pages/forms/status and sanitized statement nodes; consistent.
Pre-flight: Tasks 4→5/7 share immutable batches and sender-scoped runner ownership; consistent.
Pre-flight: Tasks 5→7/8 share validated runtime message envelopes; consistent.
Pre-flight: Tasks 6→7 share editor/shell/dialog/test-panel APIs; consistent.
Baseline: npm test → 21 passed, 0 failed; working tree clean before implementation.
Task 1: Ruling: Use Mozilla addons-linter directly rather than web-ext for validation — web-ext brings vulnerable mobile/debugger dependencies unrelated to packaging; addons-linter is its validation engine — cost if wrong: Firefox smoke installation uses native/manual loading rather than web-ext run.
Task 1: complete (commits 2234acf..2ced2c8, tests: npm.cmd test → ℹ duration_ms 117.3041)
Task 2: complete (commits 2ced2c8..07398a2, tests: npm.cmd test → ℹ duration_ms 165.3521)
Task 3: complete (commits 07398a2..48ca668, tests: npm.cmd test → ℹ duration_ms 915.5999)
Task 4: complete (commits 48ca668..16ba245, tests: npm.cmd test → ℹ duration_ms 936.4145)
Task 5: complete (commits 16ba245..7a2d0eb, tests: npm.cmd test → ℹ duration_ms 1342.564)
Task 6: complete (commits 7a2d0eb..a497f58, tests: npx.cmd playwright test tests/browser/components.spec.js →   18 passed (19.9s))
Task 7: complete (commits a497f58..93954ee, tests: npm.cmd test → ℹ duration_ms 965.9461)
Task 8: Ruling: Retain Firefox 128 and allow only three exact Mozilla notices: two data-consent compatibility notices and the source-map-verified upstream DOMPurify inert-document fallback — source disclosure works in the UI and every unreviewed warning/error still fails — cost if wrong: minimum-version, permissions, DOMPurify, or build changes require reviewing these notices again.
Task 8: complete (commits 93954ee..5d459e5, tests: npm.cmd run check → ℹ duration_ms 1017.6159)
Final review: One fresh gpt-6-astra reviewer, read-only, range 2234acf..5d459e5. Two Critical and five Important findings verified; no Minor findings. The fix pass is covered by reproducing regressions rather than a second review.
Final: Ruling: Actual Firefox installation/APIs, authenticated Codeforces submission, and real Piston execution were outside the offline review — preserve the explicit manual-check boundary; no real submissions or remote source execution were made — cost if wrong: live browser/site/service differences require manual diagnosis before relying on those integrations.
Final: Ruling: Native sidebar/navigation variants and indices beyond fixtures were set aside without live evidence — treat narrowed index/sidebar support as a compatibility finding, accept complete alphanumeric indices, preserve their migration, and parse same-contest sidebar links with regression coverage; retain pasted-URL navigation when no list is available — cost if wrong: unseen live markup can still require manual URL navigation and a parser adjustment.
Final: Ruling: Imported submission URLs lacked an established executable exploit — treat arbitrary navigation destinations as an Important boundary issue anyway; derive history links from validated Codeforces identities and ignore backup URLs — cost if wrong: old records without a numeric submission identity open native history rather than their original stored link.
Final: fixed deleted/recreated revision reuse — deleted and restored solutions never reuse revisions, including after restart RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed loss of later conflict edits — explicit recovery saves the latest conflicting source atomically and conflict resolution preserves later edits/failed recovery RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed URL-only/public-status receipt attribution — direct receipts require matching problem/ID markup and public status rows cannot be attributed to an own-history baseline RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed inactive initialization hiding native statement — disabled auto-activation retains the visible native statement RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed stale deleted drafts/custom cases — replacement synchronizes deleted clean drafts and imported/deleted cases; deletion retains dirty source RED→GREEN; pending case collisions additionally verified; final suite 57/57 unit, 70/70 browser.
Final: fixed SVG formula sizing — native SVG and KaTeX radical/arrow geometry survives toggling RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed late POST rearming cancelled polling — a late confirmed POST retains its receipt without restarting cancelled polling RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed compatibility boundaries — alphanumeric native indices, multi-character/numeric legacy migration, and native sidebar links RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final: fixed untrusted history navigation — submission history derives native links from identities instead of backup URLs RED→GREEN; final suite 57/57 unit, 70/70 browser.
Final verification: npm.cmd run check (lint/build/57 unit tests), npm.cmd run test:browser (70/70, Chromium/Firefox), npm.cmd run format:check, npm.cmd run check:extension (0 errors/0 unreviewed warnings/3 exact documented notices), npm.cmd run package (73 files), ZIP path/entry/license/source-map inspection, npm audit (0 production vulnerabilities). No real submission, live runner execution, native installation, push, publication, or PR performed. No deferred Minor findings.

## 2026-10-13: Built-in C++20 WebAssembly runner

User chose local WebAssembly to remove Docker and service setup from C++ Run. Native execution continued in the existing clean feature checkout. Design and plan are under docs/superpowers with the 2026-10-13-local-cpp prefix.

Bundled browsercc 0.1.1 (Clang/LLD 20.1.2, WASI SDK 25) and browser_wasi_shim 0.4.2. Compiler workers serialize jobs and cache the latest unchanged source; per-case execution workers get fresh, read-only stdin and bounded stdout/stderr, without filesystem or network capabilities. C++ defaults to local for existing/new settings. Piston remains optional for C++ and available for other languages with explicit consent. No automatic remote fallback. Program limits: 2 seconds, 256 MiB linear memory, 256 KiB output; 1 MiB source/input; 60-second load, 30-second compile and 60-second idle release.

Rulings and verified fixes:
- Use the Clang driver's actual bare wasm-ld invocation rather than assuming /bin; real browser compiler tests failed first and then passed.
- Rearm compiler idle release on cache hits; unit cleanup regression failed first and then passed.
- Expand the upstream bits convenience header using only standard includes after a real sstream compilation failure. Binary assets remain unchanged.
- Check program memory bounds with the Wasm memory.grow intrinsic: an unused malloc/free pair may be optimized away and cannot prove an allocation bound.
- The options fixture resets mocked storage on page reload. Assert repository persistence and rendered choice, with native extension APIs verified separately.
- Read-only File alone doesn't block upstream OpenFile resize/allocation. Deny those stdin methods too; real C++ syscall regression changed from 0 0 0 bc to 1 1 1 abc.
- Independent fresh review found toolchain initialization failures cached across same-source retries. Catch responses now declare retryability and release the compiler instead of caching. Unit and real missing-asset browser regressions failed first and then passed. No deferred Minor findings; no declined-to-judge findings.
- License text retains its content with trailing whitespace normalized. Package output filename follows package.json version. Localhost access is optional, rather than a mandatory host permission for local C++ users.

Verification at this stage: 65/65 unit tests; 90/90 browser tests (45 each engine); lint/build/format; Mozilla linter 0 errors, 0 unreviewed warnings and the same 3 narrowly documented notices; production npm audit 0 vulnerabilities. Actual temporary Firefox 157 installation through Mozilla RDP compiled a bits/stdin C++ program through the real extension background router and returned stdout 42 with zero exits. An isolated generated profile was used, with no user's Firefox profile changed. Firefox 128 and a complete authenticated live Codeforces workspace remain manual boundaries. No real solution was submitted and nothing was pushed or published.

User subsequently requested fresh supervisor iterations across the project until both supervisor and implementer agree. Their requested loop takes precedence over the original single-review finish workflow. Results will be recorded below.

### Supervisor iteration 1

A fresh supervisor inspected the whole project and reproduced two P2 UI issues. Both were accepted: refreshed Codeforces verdicts now update saved known receipts without discarding compiler/date metadata, and captured batch results carry input/expected/comparison intent. Results use captured values and identify a case changed since its run. Real Node/JSDOM/storage regressions failed first and then passed. The supervisor justified no additional features or bloat removal. External authentication, real submissions, Piston isolation, Mozilla signing and native Firefox 128 remain acknowledged verification boundaries.

The implementer also removed successful native-test profile leftovers from CI artifacts. The real addon check left an extra profile before the fix; afterward it returned PASS with no new profile left behind. Deletion is restricted to the exact generated test-results/native-profile directory and occurs only after Firefox closes.

### Supervisor iteration 2

A second supervisor started without conversation history and reproduced three P2 defects. All were accepted. Storage events received during a source save are reconciled after the response, using the solution clock to avoid following an older snapshot. Unchanged source follows imports; later edits remain conflicting and recoverable. Custom-case writes register their snapshots until the corresponding storage event, including events arriving after the response, so own older writes no longer manufacture other-tab copies. Flush also finishes later pending case edits and shares an in-flight save between callers. Genuine external case collisions retain their recovery behavior.

Leetify-generated math now has a narrowly scoped wrapper. Bundled KaTeX styles cover that wrapper on the native page after exit while preserving existing native math. Before the fix, the regression's radical/arrow markup expanded to 6400 pixels in both browsers. Afterward its normal geometry and hidden accessibility MathML survive exit/reactivation. Three storage regressions and both browser math regressions failed before implementation; the later-edit recovery regression additionally passed before and after. Four targeted storage tests, 14 review browser tests and the complete 71-test unit suite pass. Formatting and Mozilla validation pass. Full browser/native verification is in progress.

The supervisor justified no feature addition, architectural rewrite or bloat removal. Authenticated live Codeforces, real submissions, external Piston isolation, native Firefox 128 and signing/publication remain explicit external verification boundaries.
