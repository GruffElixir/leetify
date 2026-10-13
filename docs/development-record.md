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

Leetify-generated math now has a narrowly scoped wrapper. Bundled KaTeX styles cover that wrapper on the native page after exit while preserving existing native math. Before the fix, the regression's radical/arrow markup expanded to 6400 pixels in both browsers. Afterward its normal geometry and hidden accessibility MathML survive exit/reactivation. Three storage regressions and both browser math regressions failed before implementation; the later-edit recovery regression additionally passed before and after. Full verification passed: 71/71 unit, 92/92 browser (46 each engine), actual Firefox 157 addon compilation/execution, lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, and production audit 0 vulnerabilities.

The supervisor justified no feature addition, architectural rewrite or bloat removal. Authenticated live Codeforces, real submissions, external Piston isolation, native Firefox 128 and signing/publication remain explicit external verification boundaries.

### Supervisor iteration 3

A third fresh supervisor reproduced a P2 status race in both directions: delayed Refresh could overwrite polling's Accepted verdict, and delayed polling could overwrite Refresh's Accepted verdict. Both readers now capture the stored receipt's status revision before fetching and conditionally update it inside the serialized repository mutation. A stale response receives the current stored record; polling uses that record when deciding whether to stop. Newly requested rejudges can still change a final verdict back to Pending. Replacement imports issue fresh status revisions. Refreshed status fields merge into current metadata rather than an old local copy.

The P3 tab accessibility finding was also accepted. A shared selection function updates aria-selected and the keyboard entry point together for clicks, result display and programmatic desktop/mobile view selection. Three original regressions failed first and then passed. The implementer also tested receipt deletion before/during polling: deleted history remains deleted, polling stops with a native-status message, and failed conditional saves retain the receipt shape. Both additional regressions failed before their fixes and passed afterward. The existing delayed polling-disposal test now explicitly waits for the network request to begin instead of depending on synchronous dispatch before the newly added snapshot read.

Current verification: 76/76 unit tests, lint/build and formatting pass. Full browser/native verification is running. The supervisor justified no feature addition, architectural rewrite or bloat removal. The existing external verification boundaries still apply.

Supervisor 3's full verification completed at eb89aae: 76/76 unit, 92/92 browser (46 each engine), actual Firefox 157 addon compilation/execution (stdout 42), Mozilla 0 errors/0 unreviewed warnings/3 exact notices, and production audit 0 vulnerabilities.

### Supervisor iteration 4

A fourth fresh supervisor confirmed three findings before the session paused; all were accepted after independent reproduction.

- P2: a Piston batch could switch runtime versions between cases when an options health check refreshed the cached runtime list (a real RunnerService/createRunBatch probe ran Python 3.12.0 and then 3.13.0). The batch now pins the first runtime version a Piston result reports for its remaining cases. If a health check removes that version, later cases report that it is not installed instead of silently switching. Local C++ is unaffected. Both regressions (version added, version removed) failed first and then passed.
- P3: selecting a case replaced every case button and dropped keyboard focus to the document body. The panel now restores focus to the same case after redrawing only when focus was already inside the case controls, so result redraws never steal focus from unrelated controls. The browser regression failed in both engines first and then passed.
- P2: persisted focus mode hid the statement on compact layouts, where the focus toggle itself is hidden, so the Description tab could not reveal it. Focus mode now applies only at widths of 900 px and above; compact tabs and stacked layouts control pane visibility. The browser regression (390 px tabs, 820 px stacked, 1440 px focus) failed in both engines first and then passed.

The supervisor justified no feature addition, architecture rewrite or bloat removal. Verification: 78/78 unit, 96/96 browser (48 each engine), lint/build/format.
Iteration 4 follow-up checks: actual Firefox 157 addon compilation/execution PASS (stdout 42), Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Supervisor iteration 5

A fifth fresh supervisor reviewed the whole project, reran the full suite and reported one P2 and five P3 findings. The implementer independently reproduced each with a failing regression (in both engines for the browser regressions) and accepted all six:

- P2: Ctrl+Enter from inside the editor also triggered CodeMirror's default insert-blank-line command, so every shortcut run modified (and saved) the source. The editor now claims Mod-Enter/Mod-Shift-Enter without editing, and the event still reaches the workspace shortcut.
- P3: Exit after navigating to another problem reloaded that page and auto-activation immediately reopened the workspace. Exit now leaves a one-shot, problem-specific sessionStorage marker that keeps the next load native; later loads auto-activate normally.
- P3: after exiting on the original problem, Back/Forward into workspace-pushed history entries changed the URL but kept the old native statement. While inactive, a history step to a different problem now reloads that page natively; hash changes on the same problem are ignored.
- P3: an edit made while an auto-run was in flight was never run. The edit now queues one follow-up run after the outdated batch finishes, only if the source actually changed. Queuing (rather than restarting) avoids cancelling a local compile.
- P3: submission review ignored the compiler Codeforces preselects for the account. Review now prefers the stored preference, then the form's preselected compiler if it matches the language, then the first match.
- P3: deep recursion that Codeforces accepts fails locally because the browser limits the WebAssembly call stack (a few thousand nested calls; not configurable for workers). The runtime error now explains this, and Settings and the README document it alongside the other C++ limits.

Declined: the supervisor's optional removal of unused code (RUNNER_DISCOVER/discover, network cancelOwner, the dispose chain, editor.focus). It was explicitly not required, saves little, and some of it is ordinary lifecycle API.

Verification: 79/79 unit, 106/106 browser (53 each engine), actual Firefox 157 addon compilation/execution PASS (stdout 42), lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Supervisor iteration 6

A sixth fresh supervisor reran the full suite at 2382857 and reported one P2 and two P3 findings, plus a stale "Leetify 3.0" options footer. It found no data-loss, security or race defects. The implementer reproduced each finding with a failing regression (browser regressions in both engines) and accepted all three:

- P2: auto-run with a Piston language and no runner consent opened the consent modal on every pause in typing and moved focus out of the editor. Automatic runs now never open the dialog. They show a status message instead, and consent is granted from an explicit Run.
- P3: an automatic run switched to Results and destroyed a custom-case textarea the user was typing in, losing keystrokes. Automatic runs no longer change the view while focus is inside the test panel; case tabs still show statuses.
- P3: a local compile timeout or toolchain failure was repeated for every case (three cases meant three 30-second compiler timeouts). Local C++ compiles once per source, so a batch now reports a failed compilation for the remaining cases without recompiling. The next Run still retries retryable failures.

The footer now reads Leetify 3.1. The supervisor found no justified feature addition or bloat removal and did not re-raise previously declined items.

Verification: 80/80 unit, 110/110 browser (55 each engine), actual Firefox 157 addon compilation/execution PASS (stdout 42), lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Supervisor iteration 7

A seventh fresh supervisor reran the suite at 38668b3 and reported one P2 and two P3 findings. It found no data-loss, race, security or layout defects. The implementer reproduced each finding with a failing regression in both engines and accepted all three:

- P2: local C++ didn't define ONLINE_JUDGE, unlike Codeforces. The common `#ifndef ONLINE_JUDGE freopen(...)` template compiled and exited 0 with empty output on the real toolchain. The compiler now passes -DONLINE_JUDGE, and Settings and the README say so. As on the judge, debug output guarded by `#ifndef ONLINE_JUDGE` is hidden.
- P3: Settings kept showing an out-of-range number (for example font size 5) after the clamped value (11) was saved, because the field was pending when the storage event arrived. After a save settles, the page now re-renders from a fresh snapshot, so normalized values appear.
- P3 (accessibility): each workspace message was written to two role="status" regions. The status-bar message is now the only live region. Compact layouts hide it visually instead of with display:none, so it stays available to assistive technology, and the toast remains a visual duplicate. Not verified with a physical screen reader.

The supervisor found no justified feature addition or bloat removal. It noted the KaTeX ttf/woff font formats (~0.8 MB against a ~95 MB toolchain) as not worth removing, and did not re-raise declined items.

Verification: 80/80 unit, 116/116 browser (58 each engine), actual Firefox 157 addon compilation/execution PASS (stdout 42), lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Supervisor iteration 8

An eighth fresh supervisor ran the real extension in Firefox 157 without a devtools watcher and reported one P2. The implementer accepted it after independent reproduction. Firefox suspends a non-persistent MV3 background page about 30 seconds after its last incoming event, even while a runtime.onMessage response is still pending. Compiler loading (60 seconds), compilation (30 seconds), Piston and Codeforces requests can exceed that, so long requests failed with "Could not establish connection. Receiving end does not exist." Because that result was rejected rather than a compile failure, it repeated for every case. The previous native test attached a devtools watcher, which keeps the background alive and hid the problem.

The content script now sends a tiny KEEPALIVE message every second while any request to the background is pending, and the router acknowledges it. The native test was rewritten as a real content-script workspace run with no watcher and a 3-second idle timeout. Before the fix it failed with both samples showing the connection error; afterwards both samples pass. The one-second heartbeat runs only while a request is pending, so it adds no idle traffic.

The supervisor found no justified feature addition or bloat removal. It mentioned that recovered drafts cannot be deleted, as an optional nicety; that is not required because they are created only by conflicts or imports.

Verification: 80/80 unit, 116/116 browser (58 each engine), native Firefox 157 workspace run with a 3-second background idle timeout and no watcher (2/2 samples passed through the real content script, background and Clang/WASI workers), lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Supervisor iteration 9

A ninth fresh supervisor ran the real extension in Firefox 157 and isolated editor probes. It reported one P2 and one P3, both accepted after independent reproduction in both engines:

- P2 (accessibility): the full-screen workspace covered the native page, but keyboard focus and assistive technology could still reach it. In the fixture, the first three Tab stops were hidden native links, and live pages have many more. While the workspace is open, its covered body siblings are now inert, remembering any that were already inert. Exit and dispose restore them, and dialog layers stay interactive. Firefox supports inert from version 112. A browser regression and the native Firefox test both check that the first Tab stop is inside the workspace.
- P3 (performance): every editor configure() built new EditorView.theme/HighlightStyle extensions. style-mod never removes old rules, so each autosave (via storage events) added about 15 CSS rules, and the cost of each configure grew over a session. Themes are now memoized per theme and font size. The regression measured 326 rules growing to 776 over ten theme cycles before the fix; afterwards the count stays constant.

The supervisor found no justified feature addition or bloat removal. It mentioned float-tolerant comparison, caching the Clang -### invocation and the activeTab permission as optional. None is necessary within scope.

Verification: 80/80 unit, 120/120 browser (60 each engine), native Firefox 157 workspace run with a 3-second idle timeout (first Tab stop inside the workspace, 2/2 samples passed), lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Supervisor iteration 10

A tenth fresh supervisor reran all suites, including the native Firefox test, and reported two P3 findings. Both were accepted:

- P3: verdict polling and colouring only understood English. Codeforces' Russian interface ("В очереди", "Выполняется на тесте 3") parsed as final, so polling stored a queued verdict and stopped. "Полное решение" was coloured as failed. The status parser now treats a verdict cell flagged waiting="true", or English or Russian queue/running/testing/compiling text, as pending. A shared isAcceptedVerdict recognizes English and Russian Accepted. The supervisor reproduced the polling stop with the real parser, controller and repository. The implementer's unit fixture first failed at the new export; the old English-only pattern cannot match Cyrillic. The Russian strings and the waiting attribute come from knowledge of Codeforces markup and remain part of the live-markup verification boundary.
- P3: Ctrl+Shift+Enter ignored a review that was already loading (the toolbar button was disabled). A second press loaded another review and replaced the first dialog. The shortcut now follows the Submit button's disabled state. A browser regression with a held submit page failed in both engines (two loads) and then passed.

The supervisor found no justified feature addition or bloat removal.

Verification: 81/81 unit, 122/122 browser (61 each engine), native Firefox 157 workspace run with a 3-second idle timeout PASS, lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact notices, production audit 0 vulnerabilities.

### Release decision

After iteration 10, the user decided the review loop was sufficient and asked to release. An eleventh fresh supervisor had started and was stopped before it reported, so it produced no findings or verdict. Every finding from supervisors 4–10 was reproduced, fixed with failing-first regressions, or explicitly declined with reasons recorded above. The loop ended by the user's release decision, not by a final supervisor's formal AGREE verdict.

Final verification at the release commit: 81/81 unit, 122/122 browser (61 each engine), native Firefox 157 workspace run (no devtools watcher, 3-second background idle timeout) PASS, lint/build/format, Mozilla 0 errors/0 unreviewed warnings/3 exact documented notices, production audit 0 vulnerabilities. The packaged ZIP matches the release build byte for byte, and the compiler assets match the pinned npm package. External boundaries remain uncertified: authenticated live Codeforces markup/challenges, real submissions and judging (including live verdict wording in either interface language), external Piston isolation, native Firefox 128, physical screen-reader use, and Mozilla signing/publication. The branch stays local; nothing was pushed, published or submitted.
