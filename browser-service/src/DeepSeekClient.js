const logger = require('./logger');
const config = require('./config');

class DeepSeekClient {
  constructor(page, browserManager) {
    this.page = page;
    this.browserManager = browserManager;
    this.baseUrl = config.deepseekUrl;
    this.setupAutoCookieSave();
  }

  setupAutoCookieSave() {
    if (!this.page || typeof this.page.on !== 'function') {
      return;
    }

    this.page.on('framenavigated', async () => {
      try {
        const url = this.page.url();
        if (url.includes('/chat')) {
          await this.browserManager.saveCookies();
          logger.debug('Cookies saved after navigation to chat');
        }
      } catch (error) {
        logger.warn('Cookie persistence failed', { error: error.message });
      }
    });
  }

  getChatInputSelector() {
    return 'textarea[placeholder*="Message"], input[placeholder*="Message"], [contenteditable="true"], [role="textbox"], [aria-label*="message" i], [data-testid*="message" i], .ProseMirror';
  }

  async isSignInPage() {
    const currentUrl = this.page.url ? this.page.url() : '';
    if (currentUrl.includes('/sign_in') || currentUrl.includes('/sign-in')) {
      return true;
    }

    try {
      const emailField = this.page.locator ? this.page.locator('input[placeholder*="Phone number / email" i], input[type="email"], input[placeholder*="email" i]').first() : null;
      const passwordField = this.page.locator ? this.page.locator('input[type="password"], input[placeholder*="Password" i]').first() : null;
      if (emailField && passwordField) {
        const hasEmail = await emailField.count().then((count) => count > 0);
        const hasPassword = await passwordField.count().then((count) => count > 0);
        return hasEmail && hasPassword;
      }
    } catch {
      return false;
    }

    return false;
  }

  async findInput() {
    const selector = this.getChatInputSelector();
    const candidates = selector.split(',').map((part) => part.trim()).filter(Boolean);

    for (const candidate of candidates) {
      try {
        if (this.page.locator) {
          const locator = this.page.locator(candidate).first();
          const count = await locator.count().catch(() => 0);
          if (count > 0) {
            const visible = await locator.isVisible().catch(() => false);
            if (visible) {
              return locator;
            }
          }
        }

        if (typeof this.page.waitForSelector === 'function') {
          await this.page.waitForSelector(candidate, { timeout: 1000 });
          return this.page.locator ? this.page.locator(candidate).first() : null;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async isLoggedIn() {
    try {
      if (await this.isSignInPage()) {
        return false;
      }
      const input = await this.findInput();
      return Boolean(input);
    } catch {
      try {
        const loginBtn = await this.page.$('button:has-text("Log in"), button:has-text("Sign in"), button:has-text("ورود")');
        if (loginBtn) return false;
        return this.page.url().includes('/chat');
      } catch {
        return false;
      }
    }
  }

  async waitForInput(options = {}) {
    const timeout = options.timeout || 15000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const input = await this.findInput();
      if (input) {
        const visible = await input.isVisible().catch(() => false);
        if (visible) {
          return input;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return null;
  }

  async ensureLoggedIn(email, password) {
    const resolvedEmail = email || process.env.DEEPSEEK_EMAIL || config.deepseekEmail;
    const resolvedPassword = password || process.env.DEEPSEEK_PASSWORD || config.deepseekPassword;

    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });

    if (await this.isLoggedIn()) {
      logger.info('Already logged in');
      await this.browserManager.saveCookies();
      return true;
    }

    if (config.autoLoginEnabled && resolvedEmail && resolvedPassword) {
      try {
        await this.performLogin(resolvedEmail, resolvedPassword);
        return true;
      } catch (error) {
        logger.error('Automatic login failed', { error: error.message });
      }
    }

    if (!config.autoLoginEnabled) {
      logger.warn('Automatic login is disabled by configuration. Waiting for manual login...');
    } else {
      logger.warn('Not logged in and automatic login failed or credentials are missing. Waiting for manual login...');
    }
    await this.waitForManualLogin();
    return true;
  }

  async waitForManualLogin() {
    await this.page.waitForFunction(
      () => {
        const candidates = [
          'textarea',
          'input',
          '[contenteditable="true"]',
          '[role="textbox"]',
          '[aria-label*="message" i]',
          '[data-testid*="message" i]',
          '.ProseMirror'
        ];
        return candidates.some((selector) => document.querySelector(selector));
      },
      { timeout: 120000 }
    );
    await this.browserManager.saveCookies();
    logger.info('Manual login detected, cookies saved');
  }

  async fillInput(selector, value) {
    if (this.page.locator) {
      const field = this.page.locator(selector).first();
      const count = await field.count().catch(() => 0);
      if (count > 0) {
        await field.fill(value);
        return;
      }
    }

    const input = await this.page.waitForSelector(selector, { timeout: 10000 });
    await input.fill(value);
  }

  async clickButton(textPatterns) {
    const locator = this.page.locator(textPatterns.map((pattern) => `button:has-text("${pattern}")`).join(', ')).first();
    if (await locator.count()) {
      await locator.click();
      return true;
    }
    return false;
  }

  async performLogin(email, password) {
    try {
      await this.page.goto(`${this.baseUrl}/sign_in`, { waitUntil: 'networkidle' });

      if (await this.isSignInPage()) {
        await this.fillInput('input[placeholder*="Phone number / email" i], input[type="email"], input[name="email"], input[placeholder*="email" i]', email);
        await this.fillInput('input[type="password"], input[placeholder*="Password" i], input[name="password"], input[placeholder*="password" i]', password);
        await this.page.keyboard.press('Enter');
      } else {
        const loginFound = await this.clickButton(['Log in', 'Sign in', 'ورود']);
        if (loginFound) {
          await this.fillInput('input[placeholder*="Phone number / email" i], input[type="email"], input[name="email"], input[placeholder*="email" i]', email);
          await this.fillInput('input[type="password"], input[placeholder*="Password" i], input[name="password"], input[placeholder*="password" i]', password);
          await this.page.keyboard.press('Enter');
        }
      }

      const input = await this.waitForInput({ timeout: 30000 });
      if (!input) {
        await this.page.waitForTimeout(5000);
        if (await this.isSignInPage()) {
          throw new Error('Login failed: sign-in form is still visible');
        }
        throw new Error('Chat input not found after login');
      }
      await this.browserManager.saveCookies();
      logger.info('Login successful');
    } catch (error) {
      logger.error('Login failed', { error: error.message });
      throw new Error('Login failed: ' + error.message);
    }
  }

  async sendMessage(message) {
    try {
      await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });

      if (!await this.isLoggedIn()) {
        await this.ensureLoggedIn();
      }

      const input = await this.waitForInput({ timeout: 15000 });
      if (!input) {
        throw new Error('Chat input not found');
      }
      await input.fill(message);
      await this.page.keyboard.press('Enter');

      logger.debug('Message sent', { message });

      await this.waitForResponse();
      const response = await this.extractResponse();
      return response;
    } catch (error) {
      const messageText = error.message || String(error);
      if (messageText.includes('blocked') || messageText.includes('ERR_BLOCKED') || messageText.includes('could not be satisfied') || messageText.includes('ERR_NAME_NOT_RESOLVED')) {
        const blockedError = new Error('DeepSeek page is currently unavailable');
        logger.error('Send message failed because the DeepSeek page was blocked', { error: messageText });
        throw blockedError;
      }
      logger.error('Send message failed', { error: messageText });
      throw error;
    }
  }

  async waitForResponse() {
    // سلکتورهای پاسخ (اولویت با data-testid)
    const responseSelector = '[data-testid="assistant-message"], .ds-markdown, .prose, [class*="message"][class*="assistant"]';
    
    // منتظر ظاهر شدن حداقل یک المان پاسخ با محتوای غیرخالی
    await this.page.waitForSelector(responseSelector, { timeout: 60000, state: 'visible' });
    
    // منتظر بمانیم تا محتوای آخرین المان پاسخ کامل شود (حداقل ۱۰ کاراکتر)
    // ترتیب صحیح: (predicate, arg, options)
    await this.page.waitForFunction(
      (selector) => {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) return false;
        const last = elements[elements.length - 1];
        // اطمینان از وجود متن و نبودن placeholder یا پیام کوتاه
        const text = last.textContent.trim();
        return text.length > 10;
      },
      responseSelector,  // این آرگومان به عنوان 'arg' به predicate ارسال می‌شود
      { timeout: 60000 }
    );
    
    logger.debug('Response received and complete');
  }

  async extractResponse() {
    const responseSelector = '[data-testid="assistant-message"], .ds-markdown, .prose, [class*="message"][class*="assistant"]';
    
    // دریافت تمام المان‌های پاسخ و انتخاب آخرین آنها
    const elements = await this.page.$$(responseSelector);
    if (elements.length === 0) {
      throw new Error('No response element found');
    }
    
    const lastElement = elements[elements.length - 1];
    const text = await lastElement.textContent();
    return text.trim();
  }
}

module.exports = DeepSeekClient;