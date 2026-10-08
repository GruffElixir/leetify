# Leetify Codeforces

A Firefox extension that turns Codeforces problem pages into a focused coding workspace. Read the statement, write a solution, run samples with your own runner, and review submissions without leaving the problem.

## What's included

- A bundled CodeMirror 6 editor for C++, Python, Java, and JavaScript, with undo, search, indentation, comments, folding, and bracket matching.
- Charcoal, light, and Monokai themes. Resizable panes and a separate test drawer, stacked layouts, focus mode, and compact phone views.
- Per-problem, per-language drafts in Firefox storage. Contest/problemset aliases share a draft; gym problems stay separate. Conflicts preserve both sources.
- Every sample pair, with spaces and blank lines preserved. Custom cases persist. Runs capture source, language, endpoint, and cases once; Cancel stops the queue.
- Compiler/runtime diagnostics separate from stdout. Token comparisons are labeled; cases without expected output report execution rather than a comparison pass.
- Fresh submission forms, real compiler choices, explicit source review, confirmed receipt IDs, and polling of that exact submission. Uncertain POSTs are never retried automatically.
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

The loadable extension is in **`dist/`**. The ZIP is `leetify-3.0.0.zip`.

1. Open `about:debugging` in Firefox and select **This Firefox**.
2. Click **Load Temporary Add-on…** and choose **`dist/manifest.json`**.
3. Open a Codeforces contest, gym, or problemset problem. Allow Codeforces access if Firefox asks.
4. Toggle with the extension toolbar action or **Ctrl+Shift+L**. Open Settings using the workspace gear or Firefox's extension menu.

Temporary add-ons disappear after Firefox restarts. Normal Firefox releases require Mozilla signing for permanent installation. Build/package commands do not publish or sign an add-on.

## Run source

Leetify does not include a compiler service. Configure a Piston-compatible service you operate or trust. The default execute endpoint is:

```text
http://127.0.0.1:2000/api/v2/execute
```

See [Piston setup and runtime installation](https://github.com/engineer-man/piston). Your service must provide the sibling `/runtimes` route and Piston `/execute` JSON API.

In Settings, enter the URL, click **Grant runner access**, then **Check connection**. A reachable service with no runtimes still needs language installation. Leetify picks the highest matching runtime and never guesses an absent version.

Running sends source and input to the configured service after explicit host consent. Auto-run is off by default. Discovery has a 15-second client deadline; execution has a 30-second client deadline, with bounded compile/run budgets sent to the service. The operator controls the sandbox and actual limits.

## Submissions

Sign in on the normal Codeforces website. **Submit** prepares a fresh form and opens a review of the problem, actual compiler choice, and captured source. **Submit solution** sends that source once using your Codeforces session.

A confirmed receipt is distinct from an accepted verdict. For challenge/login pages, rejected forms, ambiguous receipts, or connection failures, **check My submissions before retrying**. The fallback can copy source and open native Submit. Tests never make real submissions.

## Data and upgrades

Drafts, templates, cases, preferences, and history stay in local Firefox storage. Source is sent only to the approved runner or Codeforces when you run or submit. There is no Leetify backend, account, tracking, or telemetry. Codeforces requests use your session; runner requests omit browser credentials.

The original extension ID is retained. Migration reads v2 structured records, monolithic state, and supported site-local drafts without deleting originals. Unattributed source remains in **Templates & recovery**. Failed saves retain dirty source and expose Retry.

Export before uninstalling or clearing your profile. Backups contain private source. Merge preserves active drafts and recovers conflicting imported code. Replacement requires confirmation, advances revisions to protect open tabs, and saves the previous state. Imported runner consent is reset for review.

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

Source is in `src/`; `dist/` is generated. The background process owns serialized storage and privileged networking. Browser fixtures exercise the actual built bundles with mocked transports. Unit tests cover migration, failed writes, conflicts, backups, parsing, runner failures, cancellation, and receipts.

See [docs/testing.md](docs/testing.md) for boundaries, manual checks, and narrowly reviewed Mozilla linter notices. Live Codeforces markup, authentication, challenges, and actual runners still need manual verification with your account and service.

[MIT license](LICENSE). Bundled licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the ZIP. Runtime code, styles, math, and fonts are packaged locally.
