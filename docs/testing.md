# Verification

Run from the repository root using Node 22 or newer. `npm run check` builds before running the manifest assertions, so tests inspect the current generated extension.

```sh
npm ci
npx playwright install chromium firefox
npm run check
npm run test:browser
npm run test:firefox-addon
npm run check:extension
npm run format:check
npm run package
```

CI runs the same checks on Node 24 with Chromium and Firefox. Browser tests use one worker to keep mocks, screenshots, and fixture serving deterministic. No real Codeforces POST or remote runner execution is performed.

## Coverage and boundaries

- Unit tests exercise identities, comparisons, settings, migration, atomic writes, revisions, backups/recovery, samples, sanitization, math, forms, receipt identity, runner deadlines, errors, and request ownership.
- Component tests cover undo/redo/search/comment/indent, 100 KB source, document history, silent restoration, modal focus, keyboard splitters, case results, templates/recovery, and 1440/820/390 px layouts.
- Workspace tests load the built content bundle on synthetic Codeforces-shaped pages through the real message router, storage repository, runner service, and Codeforces network service. Fetch and extension APIs are mocked; the content-script surface excludes privileged permissions APIs. Tests cover toggles, Back/Forward, formulas/images, saving, conflicts, cases, auto-run, consent, and fallback.
- Options tests load the generated page and check patches, exports, imports, recovery, permission denial, and empty runtime lists.
- Local C++ tests execute the actual packaged Clang/LLD and WASI workers in both engines. They cover C++20/STL, standard bits headers, distinct stdin, diagnostics, stderr/nonzero exit, traps, memory/output bounds, infinite loops, compile cancellation/recovery and responsive editing. Existing remote fixture cases explicitly select Piston.
- Manifest/package checks ensure referenced files/fonts exist, the original ID/minimum remain, and HTML executes only packaged scripts.

Independent review regressions cover revisions after deletion/restoration/restart, later conflict edits and failed recovery, direct receipt markup, public status attribution, disabled activation, synchronized draft/case deletions, pending case collisions, native SVG and KaTeX radical/arrow dimensions, and late POSTs after polling cancellation. Additional boundary tests cover native sidebar links, complete alphanumeric indices and their migration, and history links derived from validated identities.

Supervisor regressions additionally cover imports during source saves, case acknowledgements before/after their response, captured expectations after editing a case, persisted refreshed verdicts, stale verdict responses in both directions with later rejudges, receipt deletion during polling, and mouse/programmatic keyboard tab entry points. They also cover one Piston runtime version per batch when a health check adds or removes versions, keyboard focus across case selection and result redraws, persisted focus mode on compact layouts, run shortcuts from inside the editor, Exit and history navigation after in-workspace navigation, edits made during an auto-run, the preselected Codeforces compiler, deep recursion on the real local toolchain, automatic runs without consent or while a case is being edited, and one compilation attempt per local batch. Generated raw math is checked on the native page after exit in both browsers.

Fixtures contain short paraphrased problem statements and representative markup. Passing fixture tests does not certify current live Codeforces markup or an account's authentication/challenge behavior. Chromium supplements Firefox; this package is not a Chromium extension.

## Mozilla linter notices

`npm run check:extension` uses Mozilla's addons-linter and fails every error and every unreviewed warning. It allows only these exact reviewed findings:

1. Desktop/Android minimum-version notices for the newer `data_collection_permissions` declaration. Firefox 128 is deliberately retained; older versions ignore that key. The UI discloses source transmission before runner consent and reviewed Codeforces submission. Built-in consent is available in newer Firefox.
2. DOMPurify's upstream assignment in its inert-document fallback. A source map must locate the warning in DOMPurify's source, and the exact fallback assignment is checked. Application HTML sinks and every other vendor warning fail. Statements use in-place sanitization; generated KaTeX markup uses inert parsing with `trust:false`.

These notices remain visible. This is not general warning suppression. Review them again when changing minimum support, permissions, DOMPurify, or build tooling.

## Manual Firefox check

1. Build, load `dist/manifest.json` through `about:debugging`, and allow Codeforces access.
2. Open contest/problemset and gym problems. Toggle three times; check statement formulas (including radicals/arrows and native SVG), samples, images, sidebar navigation, and the returned native page. Disable automatic activation and check the native statement before toggling manually.
3. Write language drafts, reload, and reopen. Open the same problem in two tabs; verify both conflicting sources remain recoverable.
4. Select C++, leave the default built-in runner, and run samples/custom cases without endpoint consent. Test compilation failure, wrong output, excessive output, infinite loops and cancellation. For other languages or optional native C++, select/grant/check a Piston endpoint and install its runtimes.
5. Navigate, Back, and Forward; check the URL, draft, formulas, and native exit.
6. Export, merge, replace, and restore a backup with another clean/dirty tab open. Check deleted solutions/cases, recreated drafts, later conflict edits, and recovery before deleting a browser profile.
7. Sign in and open submission review. Check real compiler IDs and captured source. Make a real submission only if you intend to submit; confirm and poll its exact ID.
8. Test login/challenge pages and denied runner access. Check fallback and that uncertain POSTs are not repeated.

Signing/publication is separate. The ZIP supports temporary loading or subsequent signing; this workflow does not publish it.

## Native addon evidence (2026-10-13)

An isolated headless Playwright Firefox 157 profile temporarily installed the actual generated extension through Mozilla's debugger protocol. The extension opened its own Settings page and sent a real RUNNER_EXECUTE request to its background router. The bundled workers compiled a bits/stdin C++ program and returned stdout `42` with zero compile/run exits, without a Piston service or mocked extension API. This verifies extension-origin workers and manifest Wasm CSP on Firefox 157. The entire live Codeforces workspace and the Firefox 128 binary were not tested in that native profile.

The extension retains minimum Firefox 128. Real Codeforces authentication/challenges and submissions remain manual boundaries; no real solution was submitted. Playwright console color notices are test-process environment warnings, not extension diagnostics. The temporary native test used a fresh generated profile and did not alter the user's Firefox profile.
