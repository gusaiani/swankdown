const vscode = require('vscode');
const path = require('path');

/**
 * Typographic refinements — smart quotes, dashes, ellipsis, multiplication sign.
 */
function refineTypography(html) {
  let s = html;
  // Straight quotes -> curly quotes
  s = s.replace(/"(\w)/g,  '\u201c$1');          // opening double
  s = s.replace(/(\w)"/g,  '$1\u201d');           // closing double
  s = s.replace(/'(\w)/g,  '\u2018$1');           // opening single
  s = s.replace(/(\w)'/g,  '$1\u2019');           // closing single / apostrophe
  // Triple dashes -> em dash (must come before double)
  s = s.replace(/---/g,    '\u2014');
  // Double dashes -> en dash
  s = s.replace(/--/g,     '\u2013');
  // Ellipsis
  s = s.replace(/\.\.\./g, '\u2026');
  // Multiplication sign for dimensions (digit x digit)
  s = s.replace(/(\d)\s*x\s*(\d)/g, '$1\u00d7$2');
  return s;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  /** @type {vscode.WebviewPanel | undefined} */
  let currentPanel = undefined;
  /** @type {vscode.TextDocument | undefined} */
  let trackedDocument = undefined;

  const command = vscode.commands.registerCommand('swankdown.preview', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showWarningMessage('Swankdown: Open a Markdown file first.');
      return;
    }

    const doc = editor.document;
    trackedDocument = doc;
    const fileName = path.basename(doc.fileName);

    if (currentPanel) {
      // If we already have a panel, reveal it
      currentPanel.reveal(vscode.ViewColumn.Beside);
      updatePanel(currentPanel, doc);
      return;
    }

    // Create a new webview panel
    currentPanel = vscode.window.createWebviewPanel(
      'swankdownPreview',
      `Swankdown: ${fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    updatePanel(currentPanel, doc);

    // Update when the document changes
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (trackedDocument && e.document.uri.toString() === trackedDocument.uri.toString()) {
        if (currentPanel) {
          updatePanel(currentPanel, e.document);
        }
      }
    });

    // Update when switching to a different markdown editor
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === 'markdown' && currentPanel) {
        trackedDocument = editor.document;
        const newFileName = path.basename(editor.document.fileName);
        currentPanel.title = `Swankdown: ${newFileName}`;
        updatePanel(currentPanel, editor.document);
      }
    });

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
      trackedDocument = undefined;
      changeDisposable.dispose();
      editorChangeDisposable.dispose();
    }, null, context.subscriptions);
  });

  context.subscriptions.push(command);
}

/**
 * Parse markdown and update the webview panel.
 */
function updatePanel(panel, document) {
  const markdown = document.getText();
  const fileName = path.basename(document.fileName);

  // We send the raw markdown to the webview for initial load via full HTML,
  // and use postMessage for subsequent updates.
  // For the initial render and full refreshes, we parse server-side with a
  // simple approach: send markdown to the webview and let marked.js handle it.

  panel.webview.html = getWebviewHTMLWithMarkdown(markdown, fileName);
}

/**
 * Build webview HTML that parses markdown client-side with marked.js.
 */
function getWebviewHTMLWithMarkdown(markdown, title) {
  // Escape backticks and backslashes for safe embedding in a JS template literal
  const escapedMarkdown = markdown
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Swankdown: ${escapeHTML(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Cormorant+SC:wght@300;400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700;1,800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<style>
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
    --leading: 1.58;
    --leading-tight: 1.15;
    --leading-display: 1.08;
    --paper: #f5f0e6;
    --paper-shadow: #ebe5d8;
    --ink: #2a1f1a;
    --ink-light: #4a3530;
    --ink-faint: #6e534a;
    --ink-ghost: #9a857a;
    --accent: #6b2a2a;
    --rule: #c9bfb0;
    --measure: 28em;
  }

  *, *::before, *::after {
    margin: 0; padding: 0; box-sizing: border-box;
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

  .page {
    max-width: var(--measure);
    width: 100%;
    margin: 0 auto;
    padding: 2rem 2rem 8rem;
  }

  .page p {
    margin-bottom: 0;
    text-align: justify;
    hyphens: auto;
    -webkit-hyphens: auto;
    hanging-punctuation: first allow-end last;
  }

  .page p + p { text-indent: 1.5em; }

  .page h1 + p, .page h2 + p, .page h3 + p,
  .page h4 + p, .page h5 + p, .page h6 + p,
  .page blockquote + p, .page ul + p, .page ol + p,
  .page pre + p, .page hr + p, .page figure + p,
  .page table + p { text-indent: 0; }

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

  .page > p:first-of-type { text-indent: 0; }

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

  .page a {
    color: var(--accent);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  .page a:hover { border-bottom-color: var(--accent); }

  .page strong { font-weight: 600; }
  .page em { font-style: italic; }

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

  .page ul, .page ol {
    margin: 1.2rem 0;
    padding-left: 1.5em;
  }

  .page li {
    margin-bottom: 0.3em;
    text-align: left;
  }

  .page li::marker { color: var(--ink-faint); }

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

  .page code {
    font-family: 'Menlo', 'Consolas', 'Monaco', monospace;
    font-size: 0.82em;
    background: var(--paper-shadow);
    padding: 0.12em 0.4em;
    border-radius: 2px;
    color: var(--ink-light);
  }

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

  .page img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 2rem auto;
    border-radius: 2px;
  }

  .page sup {
    font-size: 0.7em;
    line-height: 0;
    vertical-align: super;
  }

  .colophon {
    max-width: var(--measure);
    width: 100%;
    margin: 2rem auto 0;
    text-align: center;
    padding: 3rem 2rem 4rem;
    border-top: 1px solid var(--rule);
  }

  .colophon p {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: var(--s-2);
    color: var(--ink-ghost);
    letter-spacing: 0;
    line-height: 1.8;
  }
</style>
</head>
<body>
  <div class="page" id="page"></div>
  <div class="colophon">
    <p>Set in EB Garamond &amp; Cormorant &middot; Typeset by Swankdown</p>
  </div>
  <script>
    function refineTypography(html) {
      let s = html;
      s = s.replace(/"(\\w)/g,  '\\u201c$1');
      s = s.replace(/(\\w)"/g,  '$1\\u201d');
      s = s.replace(/'(\\w)/g,  '\\u2018$1');
      s = s.replace(/(\\w)'/g,  '$1\\u2019');
      s = s.replace(/---/g,    '\\u2014');
      s = s.replace(/--/g,     '\\u2013');
      s = s.replace(/\\.\\.\\./g, '\\u2026');
      s = s.replace(/(\\d)\\s*x\\s*(\\d)/g, '$1\\u00d7$2');
      return s;
    }

    marked.setOptions({ smartypants: false, gfm: true, breaks: false });

    const raw = \`${escapedMarkdown}\`;
    const html = refineTypography(marked.parse(raw));
    document.getElementById('page').innerHTML = html;

    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'update') {
        const updatedHtml = refineTypography(marked.parse(message.markdown));
        document.getElementById('page').innerHTML = updatedHtml;
      }
    });
  <\/script>
</body>
</html>`;
}

/**
 * Escape HTML special characters.
 */
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deactivate() {}

module.exports = { activate, deactivate };
