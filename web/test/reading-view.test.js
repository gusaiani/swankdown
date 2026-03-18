const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, ResourceLoader } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

// Strip external script tags so JSDOM doesn't try to fetch them;
// we inject stubs via beforeParse instead.
const htmlWithoutCDN = html
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/g, '');

function createApp() {
  const dom = new JSDOM(htmlWithoutCDN, {
    url: 'https://swankdown.example.com/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      // Stub marked
      window.marked = {
        parse: (md) => `<p>${md}</p>`,
        setOptions: () => {},
      };
      // Stub pako
      window.pako = {
        deflate: (data) => data,
        inflate: (data) => data,
      };
      // Stub clipboard
      window.navigator.clipboard = { writeText: () => Promise.resolve() };
    },
  });
  return dom;
}

describe('Read button → reading view', () => {
  it('should render markdown from textarea when Read button is clicked', async () => {
    const dom = createApp();
    const { document } = dom.window;

    const textarea = document.getElementById('markdownInput');
    const btnRead = document.getElementById('btnRead');
    const readView = document.getElementById('readingView');
    const pageContent = document.getElementById('pageContent');

    // Type markdown into textarea and enable button
    textarea.value = '# Hello World';
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    btnRead.disabled = false;

    // Click read
    btnRead.click();

    // Wait for the 450ms animation timeout
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(
      readView.classList.contains('active'),
      'Reading view should have "active" class'
    );

    const content = pageContent.innerHTML;
    assert.ok(
      content.includes('Hello World'),
      `Page content should contain the markdown text, got: "${content}"`
    );

    // The bug: content should NOT contain a stringified event object
    assert.ok(
      !content.includes('[object'),
      `Page content should not contain a stringified event object, got: "${content}"`
    );

    dom.window.close();
  });

  it('should not pass the click event as the markdown argument', async () => {
    const dom = createApp();
    const { document } = dom.window;

    const textarea = document.getElementById('markdownInput');
    const btnRead = document.getElementById('btnRead');

    // Set markdown content
    textarea.value = 'Some **bold** text';
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    btnRead.disabled = false;

    // Capture what marked.parse receives
    let parsedInput = null;
    dom.window.marked.parse = (md) => {
      parsedInput = md;
      return `<p>${md}</p>`;
    };

    btnRead.click();

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.strictEqual(
      typeof parsedInput,
      'string',
      `marked.parse should receive a string, got ${typeof parsedInput}`
    );
    assert.strictEqual(
      parsedInput,
      'Some **bold** text',
      'marked.parse should receive the textarea value'
    );

    dom.window.close();
  });
});
