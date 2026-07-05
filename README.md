# Leetify Codeforces Browser Extension

A Firefox (Manifest V3) browser extension that creates a split-pane layout on Codeforces problem pages. The left pane shows the original problem statement (with all MathJax equations and formatting intact) and the right pane contains a built-in code editor environment designed to feel like a premium code editor.

## Features

- **Split-Pane Layout**: Side-by-side view of the problem statement and your code.
- **Built-in Editor**: A lightweight, zero-dependency code editor with syntax highlighting.
- **Customizable**: Resizable panes (drag the middle divider).
- **Toggle View**: Easily switch between the standard Codeforces view and the split-pane layout.
- **Dark Theme**: Eye-friendly dark theme that contrasts well with the problem statement.

## Installation

### Firefox (Local Testing)
1. Clone or download this repository.
2. Open your **Firefox** browser.
3. In the URL bar, type **`about:debugging`** and press **Enter**.
4. Click on **"This Firefox"** in the left sidebar.
5. Click the **"Load Temporary Add-on..."** button.
6. Navigate to the folder containing this extension and select `manifest.json`.

## Usage

1. Navigate to any Codeforces problem page (e.g., `https://codeforces.com/problemset/problem/4/A`).
2. The page will automatically transform into the split-pane workspace.
3. Use the middle divider to drag and resize both windows.
4. Click **"Exit Split View"** on the bottom left to return to the default Codeforces view.
5. Click the floating **"Split Layout"** button on the bottom right to restore split-pane mode.

## Contributing

We welcome contributions from the FOSS community! If you'd like to improve Leetify, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix (`git checkout -b feature/your-feature-name`).
3. Make your changes and test them locally.
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature/your-feature-name`).
6. Open a Pull Request.

### Development Guidelines
- Keep the codebase lightweight and dependency-free where possible.
- Ensure compatibility with Firefox Manifest V3.
- Test your changes thoroughly on various Codeforces problem pages.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
