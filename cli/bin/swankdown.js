#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// ── Argument parsing ──────────────────────────────────────────────

const args = process.argv.slice(2);
let filePath = null;
let watchMode = false;
let port = 0; // 0 = random available port

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--watch' || args[i] === '-w') {
    watchMode = true;
  } else if (args[i] === '--port' || args[i] === '-p') {
    port = parseInt(args[i + 1], 10);
    if (isNaN(port)) {
      console.error('Error: --port requires a number');
      process.exit(1);
    }
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    printUsage();
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    filePath = args[i];
  }
}

function printUsage() {
  console.log(`
  swankdown — read markdown beautifully

  Usage:
    swankdown <file.md>              Open a markdown file in the browser
    swankdown <file.md> --watch      Auto-reload on file changes
    cat README.md | swankdown        Read from stdin
    swankdown --port 3000 file.md    Use a specific port

  Options:
    -w, --watch    Watch the file for changes and auto-reload
    -p, --port     Specify the server port (default: random)
    -h, --help     Show this help message
`);
}

// ── Read markdown content ─────────────────────────────────────────

function readMarkdownFile() {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: file not found: ${resolved}`);
    process.exit(1);
  }
  return fs.readFileSync(resolved, 'utf-8');
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

// ── HTML template ─────────────────────────────────────────────────

function buildHTML(markdown, enableWatch) {
  // Escape backticks and backslashes for embedding in JS template literal
  const escaped = markdown
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const watchScript = enableWatch ? `
    <script>
    (function() {
      let lastETag = '';
      async function poll() {
        try {
          const res = await fetch('/api/content', { headers: { 'If-None-Match': lastETag } });
          if (res.status === 200) {
            lastETag = res.headers.get('ETag') || '';
            const md = await res.text();
            const html = refineTypography(marked.parse(md));
            document.getElementById('pageContent').innerHTML = html;
          }
        } catch (e) {
          // Server gone, stop polling
          return;
        }
        setTimeout(poll, 500);
      }
      // Start polling after a short delay
      setTimeout(poll, 1000);
    })();
    </script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Swankdown</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50' y='76' font-size='80' font-family='Georgia,serif' font-style='italic' font-weight='600' fill='%232c2419' text-anchor='middle'>S</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Cormorant+SC:wght@300;400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  /* ——————————————————————————————————————————————————
     CSS Custom Properties — a modular typographic scale
     based on a 1.25 (major third) ratio
     —————————————————————————————————————————————————— */
  :root {
    --base: 23px;
    --scale: 1.25;

    --s-2: calc(var(--base) / var(--scale) / var(--scale));
    --s-1: calc(var(--base) / var(--scale));
    --s0:  var(--base);
    --s1:  calc(var(--base) * var(--scale));
    --s2:  calc(var(--base) * var(--scale) * var(--scale));
    --s3:  calc(var(--base) * var(--scale) * var(--scale) * var(--scale));
    --s4:  calc(var(--base) * var(--scale) * var(--scale) * var(--scale) * var(--scale));
    --s5:  calc(var(--base) * var(--scale) * var(--scale) * var(--scale) * var(--scale) * var(--scale));

    /* Leading: Bringhurst recommends 120–145% for text */
    --leading: 1.58;
    --leading-tight: 1.15;
    --leading-display: 1.08;

    /* The page */
    --paper: #f5f0e6;
    --paper-shadow: #ebe5d8;
    --ink: #2a1f1a;
    --ink-light: #4a3530;
    --ink-faint: #6e534a;
    --ink-ghost: #9a857a;
    --accent: #6b2a2a;
    --rule: #c9bfb0;

    /* Measure: ~66 characters */
    --measure: 28em;

    --transition-smooth: 0.7s cubic-bezier(0.22, 1, 0.36, 1);
    --transition-fade: 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* ——————————————————————————————————————————————————
     Reset & Base
     —————————————————————————————————————————————————— */
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: var(--base);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1, "pnum" 1, "onum" 1;
  }

  body {
    font-family: 'EB Garamond', 'Garamond', 'Georgia', serif;
    font-size: 1rem;
    line-height: var(--leading);
    color: var(--ink);
    background: var(--paper);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Subtle paper texture via noise */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    opacity: 0.025;
    pointer-events: none;
    z-index: 9999;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
  }

  /* ——————————————————————————————————————————————————
     Reading View Layout
     —————————————————————————————————————————————————— */
  .reading-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 100vh;
    padding: 0 2rem;
    animation: pageReveal 1s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes pageReveal {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* The page surface */
  .page {
    max-width: var(--measure);
    width: 100%;
    padding: 4rem 0 8rem;
  }

  /* ——————————————————————————————————————————————————
     Typographic Styles — the heart of it
     —————————————————————————————————————————————————— */

  /* Paragraphs: Bringhurst recommends either
     indented-first-line or space-between, never both */
  .page p {
    margin-bottom: 0;
    text-align: justify;
    hyphens: auto;
    -webkit-hyphens: auto;
    hanging-punctuation: first allow-end last;
  }

  .page p + p {
    text-indent: 1.5em;
  }

  /* After headings, blockquotes, lists, etc., no indent */
  .page h1 + p, .page h2 + p, .page h3 + p,
  .page h4 + p, .page h5 + p, .page h6 + p,
  .page blockquote + p, .page ul + p, .page ol + p,
  .page pre + p, .page hr + p, .page figure + p,
  .page .table-wrap + p {
    text-indent: 0;
  }

  /* Headings — Cormorant SC for display, restrained sizing */
  .page h1 {
    font-family: 'Cormorant SC', serif;
    font-weight: 600;
    font-size: var(--s4);
    line-height: var(--leading-display);
    letter-spacing: 0;
    text-transform: lowercase;
    text-align: left;
    margin-top: 3rem;
    margin-bottom: 1.8rem;
    color: var(--ink);
  }

  .page h2 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 600;
    font-size: var(--s2);
    line-height: var(--leading-tight);
    letter-spacing: 0.02em;
    margin-top: 2.8rem;
    margin-bottom: 0.9rem;
  }

  .page h3 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 600;
    font-style: italic;
    font-size: var(--s1);
    line-height: var(--leading-tight);
    margin-top: 2.2rem;
    margin-bottom: 0.6rem;
  }

  .page h4 {
    font-family: 'Cormorant SC', serif;
    font-weight: 500;
    font-size: var(--s0);
    letter-spacing: 0.08em;
    text-transform: lowercase;
    margin-top: 2rem;
    margin-bottom: 0.5rem;
  }

  .page h5, .page h6 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 600;
    font-size: var(--s0);
    font-style: italic;
    margin-top: 1.5rem;
    margin-bottom: 0.4rem;
  }

  /* Links */
  .page a {
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  .page a:hover {
    border-bottom-color: var(--accent);
  }

  /* Strong & Em */
  .page strong {
    font-weight: 600;
  }

  .page em {
    font-style: italic;
  }

  /* Blockquotes — indented, slightly smaller, italic */
  .page blockquote {
    margin: 1.8rem 0;
    margin-left: 1.5em;
    padding-left: 1.5em;
    border-left: 2px solid var(--rule);
    font-style: italic;
    color: var(--ink-light);
  }

  .page blockquote p {
    text-indent: 0 !important;
    text-align: left;
  }

  .page blockquote p + p {
    margin-top: 0.5em;
    text-indent: 0 !important;
  }

  /* Lists */
  .page ul, .page ol {
    margin: 1.2rem 0;
    padding-left: 1.5em;
  }

  .page li {
    margin-bottom: 0.3em;
    text-align: left;
  }

  .page li::marker {
    color: var(--ink-faint);
  }

  /* Horizontal rules — a typographic ornament */
  .page hr {
    border: none;
    text-align: center;
    margin: 2.5rem 0;
  }

  .page hr::before {
    content: '* \\2003 * \\2003 *';
    font-family: 'Cormorant Garamond', serif;
    font-size: var(--s-1);
    color: var(--ink-ghost);
    letter-spacing: 0.3em;
  }

  /* Code — inline */
  .page code {
    font-family: 'Menlo', 'Consolas', 'Monaco', monospace;
    font-size: 0.82em;
    background: var(--paper-shadow);
    padding: 0.12em 0.4em;
    border-radius: 2px;
    color: var(--ink-light);
  }

  /* Code blocks */
  .page pre {
    margin: 1.8rem 0;
    padding: 1.5rem 1.75rem;
    background: #2c2a26;
    color: #d4cfc8;
    border-radius: 2px;
    overflow-x: auto;
    line-height: 1.55;
    font-size: 0.78rem;
  }

  .page pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  /* Tables */
  .page table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.8rem 0;
    font-size: var(--s-1);
    font-variant-numeric: tabular-nums lining-nums;
  }

  .page thead th {
    font-family: 'Cormorant SC', serif;
    font-weight: 500;
    font-size: var(--s-2);
    letter-spacing: 0.1em;
    text-transform: lowercase;
    text-align: left;
    padding: 0.5em 0.75em;
    border-bottom: 1.5px solid var(--ink-light);
    color: var(--ink-light);
  }

  .page tbody td {
    padding: 0.5em 0.75em;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
  }

  .page tbody tr:last-child td {
    border-bottom: 1.5px solid var(--ink-light);
  }

  /* Images */
  .page img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 2rem auto;
    border-radius: 2px;
  }

  /* Footnote-style superscripts */
  .page sup {
    font-size: 0.7em;
    line-height: 0;
    vertical-align: super;
  }

  /* ——————————————————————————————————————————————————
     Drop Cap — first letter of the first paragraph
     —————————————————————————————————————————————————— */
  .page > p:first-of-type::first-letter {
    font-family: 'Cormorant SC', serif;
    font-weight: 700;
    float: left;
    font-size: 3.6em;
    line-height: 0.78;
    padding-right: 0.08em;
    margin-top: 0.05em;
    color: var(--ink);
  }

  .page > p:first-of-type {
    text-indent: 0;
  }

  /* ——————————————————————————————————————————————————
     Colophon — bottom of the reading page
     —————————————————————————————————————————————————— */
  .colophon {
    max-width: var(--measure);
    width: 100%;
    text-align: center;
    padding: 3rem 0 4rem;
    border-top: 1px solid var(--rule);
    margin-top: 2rem;
  }

  .colophon p {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: var(--s-2);
    color: var(--ink-ghost);
    letter-spacing: 0;
    line-height: 1.8;
  }

  /* ——————————————————————————————————————————————————
     Scroll progress — a thin rule at the top
     —————————————————————————————————————————————————— */
  .scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 1px;
    background: var(--ink-faint);
    width: 0%;
    z-index: 200;
    transition: width 0.1s linear;
  }

  /* ——————————————————————————————————————————————————
     Responsive
     —————————————————————————————————————————————————— */
  @media (max-width: 600px) {
    :root { --base: 20px; }
    .page { padding: 3rem 0 5rem; }
  }

  /* Print styles — because a well-set page deserves print */
  @media print {
    body::before, .scroll-progress { display: none; }
    .page { padding: 0; }
    .reading-view { padding: 0; }
  }
</style>
</head>
<body>

<div class="scroll-progress" id="scrollProgress"></div>

<div class="reading-view">
  <div class="page" id="pageContent"></div>
  <div class="colophon">
    <p>Set in EB Garamond &amp; Cormorant &middot; Typeset by Swankdown</p>
  </div>
</div>

<script>
  /* ── Typographic refinements ── */
  function refineTypography(html) {
    let s = html;
    // Straight quotes → curly quotes
    s = s.replace(/"(\\w)/g,  '\\u201c$1');          // opening double
    s = s.replace(/(\\w)"/g,  '$1\\u201d');           // closing double
    s = s.replace(/'(\\w)/g,  '\\u2018$1');           // opening single
    s = s.replace(/(\\w)'/g,  '$1\\u2019');           // closing single / apostrophe
    // Double/triple dashes → em/en dashes
    s = s.replace(/---/g,    '\\u2014');
    s = s.replace(/--/g,     '\\u2013');
    // Ellipsis
    s = s.replace(/\\.\\.\\./g, '\\u2026');
    // Multiplication sign for dimensions
    s = s.replace(/(\\d)\\s*x\\s*(\\d)/g, '$1\\u00d7$2');
    return s;
  }

  marked.setOptions({ smartypants: false, gfm: true, breaks: false });

  const raw = \`${escaped}\`;
  const html = refineTypography(marked.parse(raw));
  document.getElementById('pageContent').innerHTML = html;

  /* ── Scroll progress ── */
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    document.getElementById('scrollProgress').style.width = pct + '%';
  });
</script>
${watchScript}
</body>
</html>`;
}

// ── Open browser ──────────────────────────────────────────────────

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      // Silently fail — the URL is already printed to stdout
    }
  });
}

// ── Server ────────────────────────────────────────────────────────

async function main() {
  let markdown;

  if (filePath) {
    markdown = readMarkdownFile();
  } else {
    markdown = await readStdin();
  }

  if (!markdown) {
    printUsage();
    process.exit(1);
  }

  const resolvedPath = filePath ? path.resolve(filePath) : null;

  // Content version tracking for watch mode
  let contentVersion = 0;
  let currentMarkdown = markdown;

  // Watch file for changes
  if (watchMode && resolvedPath) {
    let debounce = null;
    fs.watch(resolvedPath, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          currentMarkdown = fs.readFileSync(resolvedPath, 'utf-8');
          contentVersion++;
        } catch (e) {
          // File might be temporarily unavailable during writes
        }
      }, 100);
    });
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/api/content' && watchMode) {
      const clientETag = req.headers['if-none-match'];
      const serverETag = String(contentVersion);

      if (clientETag === serverETag) {
        res.writeHead(304);
        res.end();
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'ETag': serverETag,
        'Cache-Control': 'no-cache',
      });
      res.end(currentMarkdown);
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      const html = buildHTML(currentMarkdown, watchMode && !!resolvedPath);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    const addr = server.address();
    const url = `http://127.0.0.1:${addr.port}`;
    const fileName = resolvedPath ? path.basename(resolvedPath) : 'stdin';

    console.log(`\n  swankdown serving ${fileName}`);
    console.log(`  ${url}`);
    if (watchMode && resolvedPath) {
      console.log(`  watching for changes...`);
    }
    console.log(`  press ctrl+c to stop\n`);

    openBrowser(url);
  });

  // Graceful shutdown
  function shutdown() {
    console.log('\n  goodbye.\n');
    server.close();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
