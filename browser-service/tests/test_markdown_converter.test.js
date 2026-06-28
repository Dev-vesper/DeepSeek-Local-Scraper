const MarkdownConverter = require('../src/MarkdownConverter');

describe('MarkdownConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new MarkdownConverter();
  });

  test('converts code blocks to fenced markdown', () => {
    const html = '<pre><code class="language-python">print("hello")</code></pre>';
    const result = converter.convert(html);
    expect(result).toContain('```');
    expect(result).toContain('print("hello")');
  });

  test('converts plain text unchanged', () => {
    const html = '<p>سلام</p>';
    const result = converter.convert(html);
    expect(result.trim()).toBe('سلام');
  });

  test('converts nested HTML correctly', () => {
    const html = '<div class="ds-markdown"><p>مثال</p><pre><code>const x = 1;</code></pre></div>';
    const result = converter.convert(html);
    expect(result).toContain('مثال');
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });
});