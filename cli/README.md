# Swankdown CLI

Read markdown beautifully in your browser -- Bringhurst-inspired typography, straight from the terminal.

## Install

```bash
npm install -g swankdown
```

Or link locally for development:

```bash
cd cli
npm link
```

## Usage

```bash
# Open a markdown file
swankdown README.md

# Pipe from stdin
cat notes.md | swankdown

# Watch mode -- auto-reloads on file changes
swankdown draft.md --watch

# Specify a port
swankdown README.md --port 3000
```

## Options

| Flag | Description |
|------|-------------|
| `-w`, `--watch` | Watch the file for changes and auto-reload the browser |
| `-p`, `--port` | Specify the server port (default: random available port) |
| `-h`, `--help` | Show help message |

## How It Works

Swankdown starts a local HTTP server that serves your markdown as a beautifully typeset page. It uses the same Bringhurst-inspired styles as the [web version](https://swankdown.gustavosaiani.com):

- **EB Garamond** for body text, **Cormorant SC** for headings
- 1.25 major-third typographic scale, 28em measure
- Drop caps, justified text with auto-hyphenation
- Smart quotes, em/en dashes, ellipsis, and multiplication signs
- Ornamental horizontal rules, dark code blocks, paper texture
- Scroll progress bar and print styles

No external dependencies -- uses only Node.js built-in modules. Fonts and the markdown parser are loaded from CDN.

## Environment

Requires Node.js 18 or later.
