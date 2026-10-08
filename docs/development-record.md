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
