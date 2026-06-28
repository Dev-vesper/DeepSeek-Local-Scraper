const TurndownService = require('turndown');
const cheerio = require('cheerio');

class MarkdownConverter {
  constructor() {
    this.turndownService = new TurndownService({
      codeBlockStyle: 'fenced',
      headingStyle: 'atx'
    });
  }

  convert(html) {
    const normalizedHtml = this.normalizeCodeBlocks(html);
    return this.turndownService.turndown(normalizedHtml);
  }

  normalizeCodeBlocks(html) {
    const $ = cheerio.load(html, null, false);

    const codeContainers = $('div[class*="code"], div[class*="highlight"], pre, code').toArray();

    for (const el of codeContainers) {
      const element = $(el);

      if (element.parents('pre, div[class*="code"], div[class*="highlight"]').length > 0) {
        continue;
      }

      const language = this.extractLanguage(element.attr('class') || '');

      element.find('button, [role="button"], span:contains("Copy"), span:contains("Download"), .copy-button, .download-button').remove();

      const codeText = element.text().trim();
      if (!codeText) continue;

      const pre = $('<pre></pre>');
      const code = $('<code></code>').text(codeText);
      if (language) {
        code.addClass(`language-${language}`);
      }
      pre.append(code);
      element.replaceWith(pre);
    }

    return $.html();
  }

  extractLanguage(classAttr) {
    const match = classAttr.match(/language-(\w+)/);
    if (match) return match[1];
    const match2 = classAttr.match(/lang(?:uage)?-(\w+)/i);
    if (match2) return match2[1];
    return '';
  }
}

module.exports = MarkdownConverter;