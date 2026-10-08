# Leetify Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the approved Codeforces workspace overhaul with a modern editor/UI, preserved user data, corrected workflows, and a loadable extension ZIP.

**Architecture:** JavaScript ES modules separate domain rules, a serialized storage repository, Codeforces parsing, privileged network operations, run/submission controllers, and UI components. esbuild produces local extension bundles; CodeMirror 6 provides editing and KaTeX renders newly fetched raw formulas. Existing rendered statement nodes remain intact during split-view toggles.

**Tech Stack:** JavaScript ES modules, CodeMirror 6 with four language packages, KaTeX, DOMPurify, esbuild, ESLint, Node's test runner, jsdom, Playwright, and web-ext. Build/test environment: Node 22 or newer. Commit a lockfile; bundle all runtime dependencies locally.

**Spec:** `docs/superpowers/specs/2026-10-08-leetify-overhaul-design.md` (approved by the user on 8 October 2026).

## Global Constraints

- Firefox remains the supported browser; the extension remains local-first; running source uses a separately configured Piston-compatible service; no hosted account/backend is introduced.
- Existing C++, Python, Java, and JavaScript support is retained.
- Development source lives under `src/`; built extension files live under `dist/`.
- Keep the existing extension ID so the upgrade can access existing extension storage.
- Keep the supported minimum at Firefox 128 unless dependency or browser verification reveals a concrete need to raise it.
- Use a 44% statement / 56% editor starting split, a separately resizable test drawer, and a compact 52 px global toolbar.
- At widths below 900 px, use a stacked statement/editor workspace; below 600 px, provide a compact Description / Code view switcher and keep primary actions accessible.
- Auto-run remains opt-in and uses a debounced captured run context.
- Use a 15-second runtime-discovery/health-check deadline and a 30-second execute-request deadline.
- The default runner remains `http://127.0.0.1:2000/api/v2/execute`.
- Do not perform real submissions as an automated verification step without a separate instruction to submit.
- Deliver implementation in the existing clone on branch `codex/leetify-overhaul`. Local implementation, docs, screenshots, and packaging are authorized; publication is outside scope.

## Review Focus

- Two open tabs editing the same solution must preserve both drafts and show a conflict, including after delayed saves (Task 2).
- A challenge/login/error HTML page with HTTP 200 must never become an empty problem or a confirmed submission (Tasks 3 and 5).
- A cancelled request that resolves late must not alter the next problem or restart a batch (Tasks 4 and 7).
- Migrating alias routes and importing an invalid/failed backup must not discard existing or unattributed drafts (Task 2).
- Original rendered formulas and fetched raw formulas must remain readable across repeated toggles and navigation (Tasks 3 and 7).

---

## File and interface map

Source entry points are `src/content.js`, `src/background.js`, and `src/options.js`. Shared modules live under `src/domain/`, `src/storage/`, `src/codeforces/`, `src/runner/`, `src/submission/`, and `src/ui/`. All extension-owned CSS is scoped beneath the workspace or options root. Tests live under `tests/unit/`, `tests/browser/`, and `tests/fixtures/`.

Use JSDoc typedefs for `ProblemRoute`, `SampleCase`, `SolutionRecord`, `ExecutionResult`, `SubmissionRecord`, and `Settings`. A runtime request uses `{type, requestId?, payload?}`. Failed messages return `{ok:false, error:{code,message,retryable}}`; successful messages return `{ok:true, data}`. Source, input, CSRF tokens, and user credentials are never included in diagnostic logging.

The v3 storage envelope is one atomic `leetify_state_v3` value containing versioned solution/template/case/history records and settings. Only the background repository writes it, with a serialized queue and optimistic per-solution revisions. A failed write does not advance the committed cache. Snapshot replacement/import is a single storage set; legacy keys are retained. Individual record revisions provide conflict detection while the serialized envelope prevents whole-state write races.

### Task 1: Domain rules and reproducible build foundation

**Files:** Create `src/domain/problem.js`, `src/domain/languages.js`, `src/domain/settings.js`, `src/domain/execution.js`, `src/domain/errors.js`, `scripts/build.mjs`, `scripts/package.mjs`, `eslint.config.js`, `.gitignore`, and `tests/unit/domain.test.js`. Modify `package.json`, `manifest.json`; generate `package-lock.json` and `THIRD_PARTY_NOTICES.md`.

**Interfaces:** `parseProblemUrl(input:string):ProblemRoute|null`; `problemKey(route:ProblemRoute):string`; `problemUrl(route:ProblemRoute):string`; `compareOutputs(actual:string,expected:string):{passed,mode}`; `summarizeExecution(result:ExecutionResult):{successful,actual,diagnostics}`; `normalizeSettings(value:unknown):Settings`; exported `LANGUAGES`, `DEFAULT_SETTINGS`, and `errorResult(code,message,retryable=false)`.

- [x] Write `domain.test.js` with assertions: contest and problemset aliases map to `cf:4:A`; gym maps to `gym:4:A`; malformed/non-Codeforces/non-HTTP routes return null; CRLF comparisons work; whitespace token matches are marked `tokens`; missing run stages and nonzero compile/run codes cannot pass; unsupported settings values clamp/default safely. Default pane is 44, auto-run false, endpoint is the specified loopback URL.
- [x] Run `node --test tests/unit/domain.test.js`; confirm failure because the new module does not exist.
- [x] Implement the domain modules and build scripts. Use `codemirror`, `@codemirror/lang-cpp`, `@codemirror/lang-python`, `@codemirror/lang-java`, `@codemirror/lang-javascript`, `katex`, and `dompurify`; development dependencies are `esbuild`, `eslint`, `jsdom`, `@playwright/test`, `web-ext`, and a ZIP packaging library. Use separate esbuild IIFE bundles for the three entry points, copy HTML/CSS/KaTeX fonts/manifest into `dist/`, and retain Gecko ID/minimum and route permissions. Define `build`, `lint`, `test:unit`, `test:browser`, `check:extension`, `check`, and `package` scripts; later entry points join the build when their tasks land. Keep the legacy extension runnable until Task 7 replaces its entry points.
- [x] Run `node --test tests/unit/domain.test.js` and `npm.cmd run lint`; expect zero failures/errors for files implemented so far. Check `package-lock.json` and local-only dependency use.
- [x] Commit with `git add` of the task's exact files, then `git commit -m "build: add modular extension foundation"`.

### Task 2: Durable storage, migration, backup, and conflict handling

**Files:** Create `src/storage/schema.js`, `src/storage/migration.js`, `src/storage/repository.js`, `src/storage/client.js`, `tests/unit/storage.test.js`, and `tests/fixtures/legacy-storage.json`.

**Interfaces:** `StorageRepository({storage,now})` with async `initialize(legacySiteRecords={})`, `readSnapshot()`, `patchSettings(patch)`, `saveSolution({key,language,code,expectedRevision})`, `saveCases({key,cases})`, `saveTemplate({language,template})`, `deleteTemplate({language,id})`, `recordSubmission(record)`, `exportBackup()`, `importBackup({backup,mode})`, and `restoreSnapshot(id)`. `saveSolution` returns `{status:'saved'|'conflict',solution,recovered?}`. `StorageClient(sendMessage,storageEvents)` exposes the same operations plus `subscribe(listener)` and `dispose()`. The envelope has `version:3`, `settings`, `solutions`, `templates`, `cases`, `submissions`, `recoveredDrafts`, and `preImportSnapshots`.

- [x] Write named tests that assert v2 structured and monolithic migration is idempotent; newer contest/problemset draft wins with the other recovered; unkeyed site-local drafts remain recovered; rejected writes leave the committed cache/revision unchanged; settings patches preserve unrelated changes; two writes with the same expected revision preserve the second as a conflict; deleting templates updates the active template; export includes a write made after options opened; invalid import performs zero writes; merge preserves existing drafts; failed replace leaves old data readable; replacement retains a recoverable pre-import snapshot.
- [x] Run `node --test tests/unit/storage.test.js`; confirm missing-module failures.
- [x] Implement schema validation and the serialized repository. Normalize only supported settings/languages, validate the full backup before writes, and allow empty-string solutions. Legacy reads are additive and never clear old keys. Use structured cloning for snapshots/results so callers cannot mutate repository state. Create the runtime client with subscription updates; leave service wiring for Task 5. Preserve at least the latest 50 submission entries and all conflicting imported/migrated source.
- [x] Run `node --test tests/unit/storage.test.js tests/unit/domain.test.js`; expect all migration, failed-write, concurrency, and import assertions to pass.
- [x] Commit as `feat: preserve drafts with versioned durable storage`.

### Task 3: Codeforces parsing and safe statement presentation

**Files:** Create `src/codeforces/samples.js`, `src/codeforces/problem.js`, `src/codeforces/forms.js`, `src/codeforces/status.js`, `src/codeforces/math.js`, `tests/unit/codeforces.test.js`, and HTML fixtures `problem-multiple.html`, `problem-math.html`, `submit.html`, `login.html`, `challenge.html`, `status.html` under `tests/fixtures/`.

**Interfaces:** `extractSamples(statement:Element):SampleCase[]`; `readSampleText(pre:Element):string`; `parseProblemDocument(doc:Document,url:string):{route,title,limits,tags,statement,samples,problems}`; `sanitizeStatement(statement:Element,baseUrl:string):Element`; `renderRawMath(statement:Element):void`; `parseSubmitForm(doc:Document,url:string):{action,fields,compilerOptions}`; `buildSubmission(form,{route,compilerId,code}):{url,body}`; `parseStatusRecords(doc:Document,route:ProblemRoute):SubmissionRecord[]`; `parseSubmissionReceipt(doc,url,{route,baselineIds}):{status:'confirmed'|'rejected'|'unconfirmed',submissionId?,message?}`.

- [x] Write tests using jsdom: two input/output pairs inside one `.sample-test` become two cases; `<br>`, block lines, blank lines, leading spaces, and CRLF are preserved; missing expected output is not compared; both problem URLs resolve images/links correctly; script/handler/javascript URLs are removed; rendered math remains present; raw `$$$` inline/block math renders locally; logged-out/challenge pages throw a typed parsing error. Form tests preserve checked/successful hidden controls, select actual compiler IDs, reject absent CSRF/foreign form actions, and send CSRF only in the POST body. Status tests match the problem's link/identity rather than incidental row text and never confirm an ambiguous latest row.
- [x] Run `node --test tests/unit/codeforces.test.js`; confirm failures for absent modules.
- [x] Implement parsers with DOM APIs and DOMPurify. Iterate all paired input/output children; do not trim meaningful sample whitespace. Resolve relative resources before DOM adoption, preserve safe math/SVG markup, and use bundled KaTeX only for raw delimiters outside sample/code/pre or already-rendered math. Receipt confirmation requires a direct submission receipt/redirect or one unambiguous new matching ID relative to the baseline. Match exact submission IDs for subsequent verdict updates.
- [x] Run `node --test tests/unit/codeforces.test.js tests/unit/domain.test.js`; expect all sample, form, sanitizer, and math tests to pass.
- [x] Commit as `fix: parse complete samples and validate Codeforces pages`.

### Task 4: Runner deadlines, diagnostics, and immutable cancellable batches

**Files:** Create `src/runner/service.js`, `src/runner/batch.js`, `tests/unit/runner.test.js`, and `tests/unit/batch.test.js`.

**Interfaces:** `RunnerService({fetch,permissions,timers})` exposes `discover({endpoint,language,signal,owner})`, `check({endpoint,signal,owner})`, `execute({endpoint,language,version,filename,code,stdin,signal,owner})`, `cancel({owner,requestId})`, and `cancelOwner(owner)`. `createRunBatch({context,execute,onResult})` returns `{run():Promise<BatchSummary>,cancel():void,id}`. `context` captures route key, language/runtime, source, endpoint, and cloned cases once.

- [x] Write tests for runtime aliases/highest installed version, absent languages, HTTP/plain-text/malformed results, compile/runtime failures, discover-success/execute-network-failure (the audit's scope bug), 15,000 ms discovery and 30,000 ms execution deadlines, scoped cancellation, and missing permission. Batch tests assert cancelling case one issues no case-two request; editing the original context cannot change sent source/language/input; out-of-order or post-cancel responses produce no stale callback; custom cases return `ran`, not a sample comparison pass.
- [x] Run `node --test tests/unit/runner.test.js tests/unit/batch.test.js`; confirm missing-module failures.
- [x] Implement runtime discovery/cache and the batch state machine. Every abort/timeout/network/parse path returns a typed result; clean timers/controllers in `finally`. Use owner plus request ID for active requests. Cache runtime data per endpoint with a five-minute TTL, but check available language before execution. Freeze/clone captured context and check cancellation before and after each awaited execution.
- [x] Run `node --test tests/unit/runner.test.js tests/unit/batch.test.js tests/unit/domain.test.js`; expect all error-path and no-further-request assertions to pass.
- [x] Commit as `fix: make runner batches cancellable and deterministic`.

### Task 5: Background wiring and trustworthy submissions

**Files:** Create `src/background.js`, `src/codeforces/network.js`, `src/submission/controller.js`, `src/platform/messages.js`, `tests/unit/background.test.js`, and `tests/unit/submission.test.js`.

**Interfaces:** `createMessageRouter({repository,runner,network,extensionApi})` returns a listener `(message,sender)=>Promise<MessageResult>|undefined`; validates message payloads and derives tab ownership from `sender.tab.id`. `CodeforcesNetwork({fetch,timers})` exposes `getPage(url,{signal})` and `postSubmission({url,body,signal})`, returning `{html,url,status}`. `SubmissionController({network,repository,parseHtml,timers,onUpdate})` exposes `prepare({route,language,code})`, `submit(prepared)`, `cancelPolling()`, and `dispose()`.

- [x] Write tests asserting actual sender ownership prevents another tab cancelling requests; messages validate supported routes/source/types; storage writes serialize; action/shortcut toggles work without throwing on unsupported tabs. Submission tests assert login/challenge/HTML-200 errors cannot confirm success, missing compiler/token prevents POST, explicit selected compiler/source is captured, one POST is sent even after a transport failure, ambiguous IDs stay unconfirmed, only the receipt ID updates a verdict, polling cancels on disposal, and history updates one submission record rather than creating one per poll.
- [x] Run `node --test tests/unit/background.test.js tests/unit/submission.test.js`; confirm failures for absent modules.
- [x] Wire repository and runner services into the background entry point and implement validated Codeforces credentialed requests with 30,000 ms client deadlines. Prepare forms from fresh HTML; preserve the selected actual compiler ID. Poll confirmed IDs every 1,500 ms up to 60,000 ms with cancellable timers. Reject unsafe URLs and avoid automatic POST retries; return an unconfirmed result when receipt evidence is insufficient. Provide native submit/status URLs to the UI for explicit fallback actions.
- [x] Run `node --test tests/unit/background.test.js tests/unit/submission.test.js tests/unit/storage.test.js tests/unit/runner.test.js`; expect all tests to pass and no external calls.
- [x] Commit as `fix: validate privileged requests and submission receipts`.

### Task 6: CodeMirror editor and reusable workspace components

**Files:** Create `src/ui/editor.js`, `src/ui/shell.js`, `src/ui/dialog.js`, `src/ui/splitter.js`, `src/ui/test-panel.js`, `src/ui/templates.js`, `src/ui/submissions.js`, `src/ui/icons.js`, `src/ui/workspace.css`, `tests/browser/components.spec.js`, `tests/browser/helpers.js`, and `playwright.config.js`.

**Interfaces:** `createEditor({parent,language,code,settings,onChange,onCursor})` returns `{getCode,setDocument({key,language,code}),configure(settings),focus,dispose}`; programmatic restoration does not call `onChange`. `createShell({document,settings,onAction})` returns named DOM refs plus `setActiveView`, `setStatus`, and `dispose`. `openDialog({title,content,returnFocus})` returns `{close}`. `bindSplitter({element,axis,getValue,onChange})` returns a disposer. `createTestPanel({parent,onChange,onRun,onCancel})` exposes `setCases`, `setResult`, `setSummary`, and `dispose`.

- [x] Add browser component tests for CodeMirror undo/redo/search/comment/indent, 100 KB source loading/editing, document/language switch restoration, and silent settings/programmatic updates. Assert modal focus trap/Escape/return focus; arrow/Home/End splitter updates; test-result selection shows the matching case; failure diagnostics remain separate; template save/delete/reset confirmations and recovered-draft choices are real actions. Assert no horizontal page overflow at 1440×900, 820×900, and 390×844, with visible Run/Submit at each size.
- [x] Run `npx.cmd playwright test tests/browser/components.spec.js --project=chromium`; confirm failures against the absent components.
- [x] Implement the components and neutral charcoal/amber, light, and Monokai themes. Use 52 px toolbar, default 44% split, persistent independently resizable test drawer, and 900/600 px breakpoints. Bundle editor language extensions and preserve per-document editor state/undo history in memory. Use real SVG icons with labels/tooltips, focus styles, accessible live statuses, reduced motion, and scoped CSS. No decorative controls without behavior.
- [x] Run `npm.cmd run build` and the component tests in Chromium and Firefox; expect no page errors, required keyboard behavior, and the viewport assertions to pass. Review rendered screenshots once before moving on.
- [x] Commit as `feat: add modern Codeforces workspace components`.

### Task 7: Workspace lifecycle, routing, persistence, and full-flow regressions

**Files:** Create `src/workspace/controller.js`, `src/content.js`, `tests/browser/workspace.spec.js`, `tests/browser/regressions.spec.js`, and `tests/browser/mocks.js`. Replace the manifest's content entry references with built entry points; remove superseded root `content.js`, `core.js`, `styles.css`, and obsolete pattern tests after new coverage passes.

**Interfaces:** `WorkspaceController({window,document,storage,network,runner,submission})` exposes async `initialize()`, `activate()`, `deactivate()`, `navigate(url,{historyMode})`, `changeLanguage(language)`, `flush()`, and `dispose()`. User actions consume the UI APIs from Task 6. Storage conflicts/recovered drafts use explicit UI choices. Pending editor saves carry revision/key/language and are flushed before transitions. `runner` delegates batches to Task 4.

- [x] Add full-flow tests: activate/exit/reactivate three times and retain the statement; navigate A→B→Back→Forward with saved language-specific drafts and math/images; failed navigation leaves the old problem intact; navigation cancels a run and rejects its late result; change source/language during Run all and verify captured requests; cancelling stops the queue; source-save failure shows unsaved/retry until a successful write; external tab conflict preserves both drafts; custom cases persist; auto-run is off by default and does not run after restoration; logged-out Submit offers native fallback; original statement is returned to the native page on exit. Pin all seven audit bugs to named regression tests.
- [x] Run `npx.cmd playwright test tests/browser/workspace.spec.js tests/browser/regressions.spec.js --project=chromium`; confirm the initial failures are behavioral rather than fixture/harness errors.
- [x] Implement stable DOM/lifecycle with original parent/sibling tracking, a persistent statement wrapper, latest-navigation sequence and abort control, and UI event disposers. Validate fetched pages before replacing current state. Preserve the native URL and restore it on failed history navigation; exit after dynamic navigation goes to the correct native problem. Save status awaits repository success; keep dirty data through retries. Synchronize committed storage without replacing focused dirty edits. Cancel batches, polling, and debounced auto-run on navigation/disposal; ignore obsolete response IDs. Connect templates, history, settings, problem picker, previous/next, copy/download, and confirmation/fallback actions.
- [x] Run unit tests and browser workspace/regression tests in both projects; expect all seven fixes plus transition/error assertions to pass. Run the lint and build commands once new entry points are active.
- [x] Commit as `feat: integrate resilient workspace navigation and editing`.

### Task 8: Settings, verification, packaging, and delivery

**Files:** Create `src/options.js`, `src/ui/options.css`, `src/ui/options.html`, `tests/browser/options.spec.js`, `tests/unit/manifest.test.js`, `.github/workflows/ci.yml`, and `docs/testing.md`. Update `README.md`; remove superseded root background/options files after the built replacement works. Produce the ZIP/screenshots/report under the chat's `outputs/` directory, outside the repository.

**Interfaces:** Options use `StorageClient` from Task 2 and the same message router as the workspace. Package script accepts `--output <absolute path>` and produces an archive with `manifest.json` at the root. CI runs locked dependency installation, lint, unit tests, build, manifest/web-ext validation, and browser fixture tests.

- [x] Add tests: change settings while another tab changes font and preserve both patches; export includes a newer solution; invalid import leaves data untouched; merge and confirmed replacement/restore behave correctly; runner grant/check handles denial and empty/unavailable runtimes. Manifest tests assert all referenced files/fonts exist in `dist/`, original ID/minimum remain, permissions/routes are correct, and no remote executable script is packaged.
- [x] Run the new options and manifest tests; confirm initial failures before implementing their entry points/fixtures.
- [x] Implement the updated settings page with the same visual system, fresh export, validated merge/replace import and snapshot recovery, endpoint consent/permission/health controls, language/compiler preferences, themes/layout, and keyboard shortcut help. Add build/test/temporary-install/runner instructions and CI. Document live-site testing limits and package licenses. Remove legacy runtime files only after manifest/build checks pass.
- [x] Run `npm.cmd run check`, `npm.cmd run test:browser`, `npm.cmd run check:extension`, and `npm.cmd run package -- --output <outputs>/leetify-overhaul.zip`. Inspect ZIP paths and screenshot the actual built UI at desktop/mobile sizes. Confirm no real submissions occurred. Request one fresh whole-branch code review for native execution (or the selected subagent workflow's final review), fix substantiated findings, and rerun only affected checks plus the final complete check suite after changes.
- [x] Commit as `chore: verify package and document the workspace overhaul`. Verify Git diff/status, output links, and test results; deliver ZIP, screenshots, and concise report. Keep the overhaul branch local unless the user later asks to publish it.

## Plan self-review

All approved areas map to tasks: UI/editor (6–7), data preservation/backups (2, 8), statement/math/forms/status (3), samples/execution (3–4), background/submissions (5), navigation/lifecycle (7), and verification/delivery (8). The seven audit failures have explicit tests in Tasks 2–4 and 7–8. Interface names are shared consistently; each task has a failing-test step, implementation boundary, verification command, and commit boundary.

Recommended execution is **native in this chat**, because storage, message, editor, and lifecycle interfaces depend on each other. One independent review checks the complete branch before delivery. The plan requires user review and an execution-method selection before implementation.
