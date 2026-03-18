# Swankdown — VS Code Extension

Bringhurst-inspired typography for your markdown preview.

## What it does

Swankdown replaces the default VS Code markdown preview with beautiful book-quality typography based on *The Elements of Typographic Style* by Robert Bringhurst.

### Two modes of operation

1. **Built-in preview styling** — Automatically applies Swankdown typography to the standard VS Code markdown preview (`markdown.previewStyles` contribution).

2. **Custom webview preview** — A dedicated command (`Cmd+Shift+V` on macOS when editing markdown) opens a full Swankdown preview panel with smart typography refinements (curly quotes, em/en dashes, ellipsis, multiplication signs).

## Typography

| Element | Font | Details |
|---------|------|---------|
| Body text | EB Garamond | 23px base, 1.58 line-height, justified, auto-hyphenation |
| h1 | Cormorant SC | 600 weight, lowercase |
| h2 | Cormorant Garamond | 600 weight |
| h3 | Cormorant Garamond | 600 weight, italic |
| h4 | Cormorant SC | 500 weight, lowercase |
| Code | Menlo | Dark background (#2c2a26) |

Features: drop caps on first paragraph, Bringhurst-style paragraph indentation (no spacing between paragraphs), ornamental horizontal rules (`* · * · *`), tabular numerals in tables.

### Smart typography (webview only)

- Straight quotes converted to curly quotes
- `--` to en-dash, `---` to em-dash
- `...` to ellipsis character
- `3x4` to `3×4` (multiplication sign)

## Installation

### From source

```sh
cd vscode
# Install vsce if you don't have it
npm install -g @vscode/vsce
# Package the extension
vsce package
# Install the .vsix
code --install-extension swankdown-0.1.0.vsix
```

### For development

1. Open the `vscode/` folder in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Open any `.md` file and press `Cmd+Shift+V`.

## Environment variables

None required.

## Requirements

- VS Code 1.75.0 or later
- Internet connection (for Google Fonts loading in the webview)
