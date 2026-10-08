# Leetify overhaul: proposed design

Date: 8 October 2026. Starting point: `GruffElixir/leetify`, commit `6b2d4e3`.

## Outcome

Rebuild Leetify into a dependable Codeforces coding workspace with a clean, LeetCode-inspired interface. The user asked for a complete overhaul, correction of errors, and a substantially better UI. The existing problem-reading, editing, sample-running, navigation, template, persistence, and submission workflows remain the product scope.

Success means those workflows work together reliably, the seven reproduced audit defects have regression coverage, and existing saved solutions and templates survive the upgrade.

Assumptions for review: Firefox remains the supported browser; the extension remains local-first; running source uses a separately configured Piston-compatible service; no hosted account/backend is introduced. Existing C++, Python, Java, and JavaScript support is retained. There is no requirement to copy LeetCode's branding or exact layout.

## Approach

| Approach | Tradeoff |
| --- | --- |
| **Modular extension with a bundled CodeMirror 6 editor, recommended** | Gives the overhaul clear boundaries and a maintained editor while preserving the existing Codeforces workflow. Adds a reproducible build step. |
| Incremental repair of the existing script and textarea editor | Keeps packaging simple, but continued work must also maintain highlighting, editing history, keyboard behavior, and rendering manually. |
| Separate companion web IDE | Provides more freedom for a standalone interface, but introduces a different product surface and more integration/deployment work. |

The proposed design uses the first approach. CodeMirror and all application code are bundled into the extension; editing does not download scripts from a CDN. Its modular editor model is documented by the [CodeMirror system guide](https://codemirror.net/docs/guide/).

## Interface

The default visual direction is neutral charcoal with a restrained amber accent, readable typography, subtle borders, and green/red status indicators. Include a light theme and retain a Monokai editor theme for existing users.

Desktop layout:

```text
┌───────────────────────────────────────────────────────────────────┐
│ Leetify   Problem picker / previous / next       Run  Submit   ⚙  │
├──────────────────────────────┬────────────────────────────────────┤
│ Description   Submissions    │ Code       C++ / compiler     Tools │
│                              │                                    │
│ Problem title, limits, tags   │ CodeMirror editor                  │
│                              │                                    │
│ Original statement           │                                    │
│                              ├────────────────────────────────────┤
│ Examples / notes             │ Test cases   Results               │
│                              │ Case tabs, input, expected/actual  │
├──────────────────────────────┴────────────────────────────────────┤
│ Saved / saving / error                    Runner status   Ln, Col │
└───────────────────────────────────────────────────────────────────┘
```

Use a 44% statement / 56% editor starting split, a separately resizable test drawer, and a compact 52 px global toolbar. Keep Run and Submit visible. Put secondary font, wrap, reset, copy/download, and template actions in a labeled tools menu. Provide visible return-to-Codeforces and settings actions.

Description and submissions tabs have real content; the test drawer distinguishes editable cases from execution results and preserves the result for each case. Results show compile/runtime errors separately from stdout and identify exact or whitespace-token sample matches. Sample success is labeled as a sample result, not an official judge verdict.

At widths below 900 px, use a stacked statement/editor workspace; below 600 px, provide a compact Description / Code view switcher and keep primary actions accessible. Splitters support pointer and keyboard operation. Dialogs manage focus, support Escape, and restore focus on close. Include keyboard shortcuts, accessible labels/status announcements, visible focus states, and reduced-motion behavior.

## Editor

Replace the textarea/highlight overlay with CodeMirror 6, using bundled C++, Python, Java, and JavaScript language support. Include native undo/redo, search, indentation, bracket matching, selection-aware commenting, line numbers, active-line styling, and word wrap. Retain templates, reset, copy, font controls, and per-problem/per-language restoration.

Switching language saves the current draft before loading the other one. Restoring or changing editor configuration must not accidentally create an edit or trigger auto-run. Auto-run remains opt-in and uses a debounced captured run context.

## Architecture

Use JavaScript ES modules and a small esbuild pipeline. Avoid introducing a general application framework for this extension. Development source lives under `src/`; built extension files live under `dist/`. Commit a dependency lockfile and third-party license notices. Keep the existing extension ID so the upgrade can access existing extension storage.

| Module boundary | Responsibility |
| --- | --- |
| Domain helpers | Strict Codeforces route parsing, canonical problem identity, language definitions, defaults, output comparison, and error/result types. |
| Storage service | Versioned records, migration, durable writes, conflict handling, settings patches, templates, submission history, and fresh export/validated import. |
| Codeforces adapter | Statement/sample/form/status parsing and URL validation. Parsing can be tested using HTML fixtures. |
| Runner service | Runtime discovery, request validation, network deadlines, diagnostics, permission errors, and cancellation. |
| Submission service | Current form preparation, compiler selection, explicit submission, receipt correlation, status polling, and native-form fallback. |
| Workspace controller | Route and language transitions, immutable run contexts, lifecycle cleanup, storage synchronization, and view state. |
| UI components | Workspace shell, statement presenter, CodeMirror adapter, test/results drawer, templates, dialogs, and settings. |
| Background entry point | Extension message handlers and privileged operations, including serialized storage changes and network calls. |

Use stable workspace DOM and scoped styles. Preserve the initially rendered statement node so exiting and re-entering split view remains reversible. The statement container persists across toggles. Fetched problem markup is parsed and sanitized; its relative links/images are resolved against the fetched page. Formula rendering must work in the Firefox extension context, using a bundled renderer for fetched raw math rather than assuming direct access to page globals. Preserve existing rendered math and avoid executing fetched page scripts.

Firefox Manifest V3 uses background scripts, as documented by [MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background). Keep the supported minimum at Firefox 128 unless dependency or browser verification reveals a concrete need to raise it.

## Data preservation

Create a versioned storage schema and a single shared storage implementation. Route identity is `cf:<contestId>:<problemIndex>` for ordinary contest/problemset views and `gym:<gymId>:<problemIndex>` for gym views.

Migrate the current structured v2 records, the older monolithic extension state, and legacy site-local records where present. Migration is idempotent. Preserve legacy records until migration succeeds. If multiple legacy drafts map to one identity, use the most recently timestamped draft as active and preserve differing drafts as recoverable revisions. Legacy per-language drafts without a problem identity remain recoverable rather than silently disappearing.

Save status reflects actual storage completion. Failed writes retain pending data and show a retry action. Serialize updates in the background and detect conflicting same-solution edits using record revisions; preserve both versions and let the user choose, rather than silently replacing unsaved text. Changes to settings patch only changed fields.

Export flushes pending writes and reads fresh storage. Import validates the complete file before writing and defaults to merging. A destructive replacement is available only with a clear confirmation and a recoverable pre-import snapshot. Import does not delete the current records before the new data is safely stored. Open workspaces receive resulting updates/deletions correctly.

## Samples and execution

Extract every input/output pair, including multiple pairs inside one sample container. Preserve `<br>`, block-line markup, blank lines, and meaningful spaces. Support user-created custom cases without changing the original extracted examples. Cases persist with the problem.

Every run captures problem identity, source, language, runtime version, endpoint, and cases once. Edits and language switches do not mutate an in-progress batch. Navigation and workspace shutdown cancel the active batch; stale responses cannot update a different problem. Cancel stops both the current request and the remaining queue. Request ownership is scoped to the initiating tab/run.

Use a 15-second runtime-discovery/health-check deadline and a 30-second execute-request deadline. Preserve compile/run exit codes, signals, stderr, and transport errors. A runner permission/setup failure has a clear actionable state and does not prevent editing or submitting.

The default runner remains `http://127.0.0.1:2000/api/v2/execute`. Show the configured host before first use and provide setup/health checking in Settings. Do not automatically switch to a public third-party service. The runner remains a separate dependency; Piston's public API currently requires authorization. [Piston documentation](https://github.com/engineer-man/piston#public-api).

## Submissions and navigation

Keep submitting an explicit action with a review of problem, compiler, and source. Read the current Codeforces form and offer the actual matching compiler options; remember the chosen compiler per language. Handle expired sessions, missing tokens, unavailable languages, HTML error pages, and rejected submissions without reporting success prematurely.

Track an exact submission ID when the response/status establishes it unambiguously. Poll that record with a cancellable deadline. If concurrent submissions make attribution ambiguous, show a link to the native status page and an explicit unconfirmed state instead of assigning another submission's verdict. The submissions tab displays stored history and links to native records.

If Codeforces blocks direct submission or its form cannot be safely prepared, offer an action that copies the solution and opens the native submit page. Do not automatically retry an uncertain POST, which could duplicate a submission.

Navigation saves the draft, cancels obsolete work, validates the next statement, and then changes the active route/history. Back/forward follows the same transition. Fetch failure leaves the current problem intact with a retry/native-page action. Exiting after navigating returns to the correct native problem URL.

## Verification and delivery

Replace implementation-pattern assertions with behavior tests where appropriate. Retain useful URL, comparison, manifest, and background coverage. Add tests for:

- All seven defects reproduced in the audit.
- Save failures, concurrent edits/settings patches, migrations, import rollback, fresh backups, and open-tab synchronization.
- Multiple/empty/custom samples, line breaks, token comparisons, cancellation, delayed/out-of-order responses, and source changes during runs.
- Logged-out forms, rejected/ambiguous submissions, compiler selection, polling cancellation, and network deadlines.
- Repeated split toggles, navigation/back/forward, restored editor history/configuration, math/images, keyboard-only dialogs/splitters, narrow layouts, and a 100 KB source file.

Run unit tests, linting, build checks, extension-manifest validation, and Playwright browser fixture tests in Chromium and Firefox. Where live Codeforces requests are blocked, report that boundary explicitly. Do not perform real submissions as an automated verification step without a separate instruction to submit.

Deliver the implementation in the existing clone on an overhaul branch, a loadable built extension ZIP, a refreshed README with installation/runner/development instructions, UI screenshots, and a short verification report. Add a CI workflow for the reproducible checks. No public deployment or GitHub publication is part of this local implementation request.

## Review decision

Approve this proposed product and architecture direction before the implementation plan is written. Changes to browser targets, runner provisioning, or submission behavior should be settled at this stage because they affect module interfaces and test coverage.
