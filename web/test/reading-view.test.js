const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function loadHTML() {
  const html = fs.readFileSync(HTML_PATH, 'utf-8');
  return html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/g, '');
}

function createApp(url) {
  const dom = new JSDOM(loadHTML(), {
    url: url || 'https://swankdown.example.com/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.marked = {
        parse: (md) => `<p>${md}</p>`,
        setOptions: () => {},
      };
      window.pako = {
        deflate: (data) => data,
        inflate: (data) => data,
      };
      window.navigator.clipboard = { writeText: () => Promise.resolve() };
    },
  });
  return dom;
}

function setTextareaAndEnable(dom, text) {
  const textarea = dom.window.document.getElementById('markdownInput');
  const btnRead = dom.window.document.getElementById('btnRead');
  textarea.value = text;
  textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  btnRead.disabled = false;
}

describe('Read button → reading view', () => {
  it('should render markdown from textarea when Read button is clicked', async () => {
    const dom = createApp();
    const { document } = dom.window;

    setTextareaAndEnable(dom, '# Hello World');
    document.getElementById('btnRead').click();

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(
      document.getElementById('readingView').classList.contains('active'),
      'Reading view should have "active" class'
    );
    const content = document.getElementById('pageContent').innerHTML;
    assert.ok(content.includes('Hello World'));
    assert.ok(!content.includes('[object'));

    dom.window.close();
  });

  it('should not pass the click event as the markdown argument', async () => {
    const dom = createApp();
    const { document } = dom.window;

    setTextareaAndEnable(dom, 'Some **bold** text');

    let parsedInput = null;
    dom.window.marked.parse = (md) => { parsedInput = md; return `<p>${md}</p>`; };

    document.getElementById('btnRead').click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.strictEqual(typeof parsedInput, 'string',
      `marked.parse should receive a string, got ${typeof parsedInput}`);
    assert.strictEqual(parsedInput, 'Some **bold** text');

    dom.window.close();
  });
});

describe('Share button colors', () => {
  it('share buttons should use ink-faint color, not ink-ghost', () => {
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    // The .share-btn rule should NOT use --ink-ghost for its color
    const shareBtnMatch = html.match(/\.share-btn\s*\{[^}]*color:\s*var\(([^)]+)\)/);
    assert.ok(shareBtnMatch, 'Should find .share-btn CSS rule with color');
    assert.notStrictEqual(shareBtnMatch[1], '--ink-ghost',
      'Share buttons should not use --ink-ghost (too light)');
  });
});

describe('Textarea autofocus on page load', () => {
  it('textarea should have autofocus attribute', () => {
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    // The textarea should have an autofocus attribute
    const textareaMatch = html.match(/<textarea[^>]*id="markdownInput"[^>]*>/);
    assert.ok(textareaMatch, 'Should find textarea');
    assert.ok(textareaMatch[0].includes('autofocus'),
      'Textarea should have autofocus attribute');
  });
});

describe('Cmd+Enter works globally', () => {
  it('Cmd+Enter on document should enter reading view when textarea has content', async () => {
    const dom = createApp();
    const { document } = dom.window;

    setTextareaAndEnable(dom, '# Test');

    // Dispatch Cmd+Enter on the document (not on the textarea)
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(
      document.getElementById('readingView').classList.contains('active'),
      'Reading view should activate on global Cmd+Enter'
    );

    dom.window.close();
  });
});

describe('Browser back button navigation', () => {
  it('entering reading view should push history state', async () => {
    const dom = createApp();
    const { document, history } = dom.window;

    const initialLength = history.length;

    setTextareaAndEnable(dom, '# Test');
    document.getElementById('btnRead').click();

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(history.length > initialLength,
      'History should have a new entry after entering reading view');

    dom.window.close();
  });

  it('popstate should exit reading view', async () => {
    const dom = createApp();
    const { document } = dom.window;

    setTextareaAndEnable(dom, '# Test');
    document.getElementById('btnRead').click();

    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok(document.getElementById('readingView').classList.contains('active'));

    // Simulate browser back
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(
      !document.getElementById('readingView').classList.contains('active'),
      'Reading view should be hidden after popstate'
    );

    dom.window.close();
  });
});

describe('H1 styling', () => {
  it('h1 should not use text-transform lowercase', () => {
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    const h1Rule = html.match(/\.page\s+h1\s*\{[^}]*\}/);
    assert.ok(h1Rule, 'Should find .page h1 CSS rule');
    assert.ok(!h1Rule[0].includes('text-transform: lowercase'),
      'H1 should not have text-transform: lowercase');
  });

  it('h1 should not use Cormorant SC (small-caps font)', () => {
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    const h1Rule = html.match(/\.page\s+h1\s*\{[^}]*\}/);
    assert.ok(h1Rule, 'Should find .page h1 CSS rule');
    assert.ok(!h1Rule[0].includes('Cormorant SC'),
      'H1 should not use Cormorant SC (renders lowercase as small capitals)');
  });
});
