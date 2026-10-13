# Leetify Codeforces

A Firefox extension that turns Codeforces problem pages into a focused coding workspace. Read the statement, write a solution, run C++ samples locally, and review submissions without leaving the problem.

## What's included

- A bundled CodeMirror 6 editor for C++, Python, Java, and JavaScript, with undo, search, indentation, comments, folding, and bracket matching.
- A bundled C++20 WebAssembly compiler. Click Run with no Docker, server, separate compiler or endpoint setup. Code and input stay on your computer, including when offline.
- Charcoal, light, and Monokai themes. Resizable panes and a separate test drawer, stacked layouts, focus mode, and compact phone views.
- Per-problem, per-language drafts in Firefox storage. Contest/problemset aliases share a draft; gym problems stay separate. Conflicts preserve both sources, including later edits before choosing the stored draft.
- Every sample pair, with spaces and blank lines preserved. Custom cases persist. Runs capture source, language, endpoint, and cases once; Cancel stops the queue.
- Compiler/runtime diagnostics separate from stdout. Token comparisons are labeled; cases without expected output report execution rather than a comparison pass.
- Fresh submission forms, real compiler choices, explicit source review, confirmed receipt IDs, and polling of that exact submission. Public status rows cannot confirm an own-history receipt. Uncertain POSTs are never retried automatically.
- Templates, recovered drafts, fresh JSON backups, validated imports, and three pre-import recovery snapshots.
- Local math rendering for fetched statements. Existing statement nodes and rendered formulas survive toggles.

## Build and load

Requires Node 22 or newer and Firefox 128 or newer. Firefox is the supported extension target; Chromium is an additional fixture-test browser.

```sh
npm ci
npm run check
npm run check:extension
npm run package
```

The loadable extension is in **`dist/`**. The ZIP is `leetify-3.1.0.zip`; its compiler makes it larger than the original build (about 95 MB unpacked toolchain assets).

1. Open `about:debugging` in Firefox and select **This Firefox**.
2. Click **Load Temporary Add-on…** and choose **`dist/manifest.json`**, or select the packaged ZIP directly.
3. Open a Codeforces contest, gym, or problemset problem. Allow Codeforces access if Firefox asks.
4. Toggle with the extension toolbar action or **Ctrl+Shift+L**. Open Settings using the workspace gear or Firefox's extension menu.

Temporary add-ons disappear after Firefox restarts. Normal Firefox releases require Mozilla signing for permanent installation. Build/package commands do not publish or sign an add-on.

## Run source

C++ uses **Built-in C++20 (offline)** by default, including upgraded profiles. Select C++, write code, and click **Run all** or press **Ctrl+Enter**. The first run loads the bundled compiler; progress is shown while the editor remains usable. It compiles once per unchanged source, creates fresh runtime state for each case, and terminates work when you cancel. There is no automatic remote fallback.

The built-in toolchain is Clang/LLD 20.1.2 with libc++ targeting 32-bit WASI. It supports standard C++20 and a standard-header `bits/stdc++.h` convenience shim. GNU PBDS, threads, native OS APIs and C++ exceptions are unavailable. GNU extensions and native 64-bit platform assumptions may require the Piston option. Compiler diagnostics show unsupported constructs. Codeforces submissions still use your selected Codeforces compiler.

Local programs have a 2-second execution limit after startup, 256 MiB linear memory and 256 KiB output. Source and input are limited to 1 MiB each. Compiler loading has a 60-second deadline, followed by a 30-second compilation deadline; inactive compiler workers are released after 60 seconds. The compiler itself needs considerably more memory than the resulting program. Local timings and memory behavior do not predict Codeforces judging.

For Python, Java and JavaScript, or optional native C++ execution, configure a Piston-compatible service you operate or trust. Choose **Piston service** in the C++ runner selector if desired. The default execute endpoint is:

```text
http://127.0.0.1:2000/api/v2/execute
```

See [Piston setup and runtime installation](https://github.com/engineer-man/piston). Your service must provide the sibling `/runtimes` route and Piston `/execute` JSON API.

In Settings, enter the URL, click **Grant runner access**, then **Check connection**. A reachable service with no runtimes still needs language installation. Leetify picks the highest matching runtime and never guesses an absent version.

Piston runs send source and input to the configured service after explicit host consent. Auto-run is off by default for both runners. Piston discovery has a 15-second client deadline; execution has a 30-second client deadline, with bounded compile/run budgets sent to the service. The operator controls its sandbox and actual limits.

## Submissions

Sign in on the normal Codeforces website. **Submit** prepares a fresh form and opens a review of the problem, actual compiler choice, and captured source. **Submit solution** sends that source once using your Codeforces session.

A confirmed receipt is distinct from an accepted verdict. For challenge/login pages, rejected forms, ambiguous receipts, or connection failures, **check My submissions before retrying**. The fallback can copy source and open native Submit. Tests never make real submissions.

## Data and upgrades

Drafts, templates, cases, preferences, and history stay in local Firefox storage. Built-in C++ runs keep source and input local. Source is sent to an approved Piston runner only for Piston runs, or to Codeforces when you submit. There is no Leetify backend, account, tracking, or telemetry. Codeforces requests use your session; Piston requests omit browser credentials.

The original extension ID is retained. Migration reads v2 structured records, monolithic state, and supported site-local drafts without deleting originals. Unattributed source remains in **Templates & recovery**. Failed saves retain dirty source and expose Retry.

Export before uninstalling or clearing your profile. Backups contain private source. Merge preserves active drafts and recovers conflicting imported code. Replacement requires confirmation, advances revisions to protect open tabs, and saves the previous state. Imported runner consent is reset for review.

Deleted/recreated solutions keep distinct revisions across replacements and restarts. Clean tabs follow imported/deleted drafts and cases; pending source remains recoverable, and conflicting custom inputs are retained. Submission links are derived from Codeforces identities rather than URLs inside a backup.

Firefox 140+ displays the website-content transmission declaration during installation. Older supported versions use the runner disclosure and reviewed submission workflow. See [Mozilla's data-consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Toggle workspace | Ctrl+Shift+L (customizable in Firefox) |
| Run all cases | Ctrl+Enter |
| Review submission | Ctrl+Shift+Enter |
| Search source | Ctrl+F |
| Toggle comment | Ctrl+/ |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Resize a focused divider | Arrows, Home, End |
| Close dialog | Escape |

Use ⌘ for editor shortcuts on macOS. Firefox manages the global toggle shortcut.

## Development

```sh
npx playwright install chromium firefox
npm run check
npm run test:browser
npm run check:extension
npm run format:check
```

Source is in `src/`; `dist/` is generated. The background process owns serialized storage, privileged networking and local worker orchestration. Browser fixtures use mocked extension/Codeforces transports, while local C++ tests compile and execute real programs using the packaged compiler. Unit tests cover migration, failed writes, conflicts, backups, parsing, runner failures, cancellation, and receipts. See `vendor/README.md` for compiler provenance and licensing.

See [docs/testing.md](docs/testing.md) for boundaries, manual checks, and narrowly reviewed Mozilla linter notices. Live Codeforces markup, authentication, challenges, and actual runners still need manual verification with your account and service.

[MIT license](LICENSE). Bundled licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the ZIP. Runtime code, styles, math, and fonts are packaged locally.
