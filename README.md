# Leetify Codeforces

Leetify turns Codeforces problem pages into a focused, split-pane coding workspace for Firefox. It keeps the problem statement visible while providing a persistent editor, contest navigation, templates, sample execution, and submission helpers.

## Features

- Side-by-side or stacked problem/editor layouts.
- C++, Python, Java, and JavaScript editing with lightweight syntax highlighting.
- Per-problem, per-language autosave using Firefox extension storage.
- Named templates with an active template per language.
- Sample extraction from Codeforces and Run selected / Run all test cases.
- Optional debounced auto-run of all samples after editing stops.
- Configurable Piston-compatible runner endpoint, with runtime discovery and an explicit health check.
- Contest and gym problem navigation without leaving the workspace.
- Safer submission preparation using the current Codeforces submit form and language list.
- Submission status polling and a link to the relevant status page.
- Resizable panes with pointer and keyboard controls.
- Focus mode, word wrap, font controls, themes, responsive layout, and backup/restore.
- Toolbar action and `Ctrl+Shift+L` / `Cmd+Shift+L` split-view shortcut.

## Installation in Firefox

Firefox 128 or newer is required.

1. Clone or download this repository.
2. Open Firefox and navigate to `about:debugging`.
3. Select **This Firefox**.
4. Select **Load Temporary Add-on…**.
5. Choose this project's `manifest.json`.
6. Open a Codeforces contest, gym, or problemset problem page.

The extension opens split view automatically by default. Disable automatic activation under the extension's options page if you prefer the floating **Split View** button.

## Sample runner

The default endpoint is the local Piston service at `http://127.0.0.1:2000/api/v2/execute`. The extension discovers an installed runtime from the endpoint's `/runtimes` route before executing code, so it does not depend on stale compiler versions. Start a self-hosted Piston instance or configure another trusted Piston-compatible endpoint in Options, then use **Test runner** to verify access.

The previously shared public Piston API is not a dependable default: its maintainers now require authorization for public access. See the [Piston public API notice](https://github.com/engineer-man/piston#public-api) and [self-hosting API documentation](https://github.com/engineer-man/piston#api) for current requirements.

The extension never executes arbitrary source code inside the Codeforces page. The background worker sends it to the configured sandbox and returns separate compile/run diagnostics, stdout, stderr, exit status, and a sample comparison. Auto-run is opt-in and disabled by default.

## Keyboard shortcuts

When the editor is focused:

- `Ctrl+/` or `Cmd+/`: Toggle line comments.
- `Ctrl+D` or `Cmd+D`: Duplicate the current line.
- `Tab`: Indent by four spaces.
- `Shift+Tab`: Dedent by up to four spaces or one tab.
- `Home`: Toggle between line start and first non-space character.

Global:

- `Ctrl+Shift+L` or `Cmd+Shift+L`: Toggle split view.

## Development

This project intentionally has no runtime dependency bundle. Node.js is used only for static checks and unit tests:

```text
npm test
npm run check
```

The tests cover URL parsing, problem identity, output comparison, Codeforces language labels, runner discovery and failure responses, manifest permissions, and CSS invariants. Browser testing should cover logged-in and logged-out states, contest/gym/problemset routes, navigation history, MathJax, images, large files, responsive pane resizing, runner failures, and submission failures.

## Privacy and permissions

The extension needs access to Codeforces problem pages and its configured runner host. Solutions are stored as independent per-problem records and templates/settings/history use separate storage records, reducing cross-tab overwrites. Source code is sent to the runner only when the user chooses to run it. Submitting remains an explicit user action and uses the user's active Codeforces session.

## License

MIT. See [LICENSE](LICENSE).
