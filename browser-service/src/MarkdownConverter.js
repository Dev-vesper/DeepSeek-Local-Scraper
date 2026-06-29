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
    const $ = cheerio.load(html);

    const codeBlocks = $('div.md-code-block').toArray();

    for (const el of codeBlocks) {
      const container = $(el);

      const languageSpan = container.find('span.d813de27').first();
      const language = languageSpan.length > 0 ? languageSpan.text().trim() : '';

      const preElement = container.find('pre').first();
      if (preElement.length === 0) continue;

      const codeText = preElement.text().trim();
      if (!codeText) continue;

      const newPre = $('<pre></pre>');
      const newCode = $('<code></code>').text(codeText);
      if (language) {
        newCode.addClass(`language-${language}`);
      }
      newPre.append(newCode);
      container.replaceWith(newPre);
    }

    return $.html();
  }
}

module.exports = MarkdownConverter;