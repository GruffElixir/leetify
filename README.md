# Leetify Codeforces Browser Extension (Firefox Manifest V3)

A Firefox browser extension that creates a split-pane layout on Codeforces problem pages. The left pane shows the original problem statement (with all MathJax equations and formatting intact) and the right pane contains a boilerplate editor area designed to feel like a premium code editor environment.

---

## Folder Structure

```text
leetify/
├── manifest.json   # Extension metadata and permissions configured for Firefox (Manifest V3)
├── content.js      # Main JavaScript to manipulate Codeforces pages & manage the split view
├── styles.css      # CSS styling for the split grid layout, resizer, and editor components
└── README.md       # Setup instructions and documentation
```

---

## File Overview

### 1. `manifest.json`
Specifies extension details matching Manifest V3 guidelines.
- Target URL matching:
  - `*://codeforces.com/contest/*/problem/*`
  - `*://codeforces.com/problemset/problem/*`
  - (Includes `www.` subdomains for safety)
- Declares content script `content.js` and styling `styles.css`.
- Includes Firefox's required `browser_specific_settings` block for Gecko browser engines.

### 2. `content.js`
- **DOM Manipulation**: Finds the Codeforces `.problem-statement` node.
- **Split Container**: Spawns `#leetify-split-container` at the root of `body`.
- **DOM Relocation**: Moves the `.problem-statement` element into the left pane without breaking event listeners (e.g. MathJax math formulas continue rendering perfectly).
- **Interactive Resizer**: Standard JavaScript event listeners handle side-by-side resizing (mouse dragging) constrained between 20% and 80% viewport width.
- **Toggle View Mode**: Features functions to fully revert the layout to normal Codeforces standard layout (`exitSplitView`) and vice-versa, making use of a floating activate/deactivate button.

### 3. `styles.css`
- Ensures the split layout takes exactly `100vh` and `100vw`.
- Employs responsive flexbox columns with a pointer drag-resizer.
- Includes a dark theme palette (`#09090b` / `#18181b`) and elegant typography for the editor pane, contrast-matching Codeforces' default light styling in the problem description pane.
- Sets scrollbar custom styles.

---

## How to Install and Run in Firefox

To load this local extension temporarily in Firefox:

1. Open your **Firefox** browser.
2. In the URL bar, type **`about:debugging`** and press **Enter**.
3. Click on **"This Firefox"** (or "This Nightly" / "This Developer Edition") in the left sidebar.
4. Click the **"Load Temporary Add-on..."** button.
5. In the file explorer, navigate to the folder containing your extension (`C:\Games\Ref_books\projs\leetify`).
6. Select any file within that directory, such as `manifest.json`, and click **Open**.
7. The extension will now load and show up in your list of temporary extensions.

---

## How to Test

1. Navigate to any Codeforces problem page, for example:
   - `https://codeforces.com/problemset/problem/4/A` (Watermelon)
   - `https://codeforces.com/contest/1800/problem/A`
2. The page will automatically transform into a premium split-pane workspace.
3. Use the middle divider to drag and resize both windows.
4. Click **"Exit Split View"** on the bottom left to return to the default Codeforces view.
5. Click the floating **"Split Layout"** button on the bottom right to restore split-pane mode.

---

## Next Steps

To add an actual code editor, you can replace the placeholder inside `#leetify-editor-container` in `content.js` with your preferred open-source web-based editor:
- **Monaco Editor** (VS Code's editor engine)
- **CodeMirror** (Lightweight, extensible editor)
- **Ace Editor**
