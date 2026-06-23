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
    this.page.on('framenavigated', async () => {
      const url = this.page.url();
      if (url.includes('/chat')) {
        await this.browserManager.saveCookies();
        logger.debug('Cookies saved after navigation to chat');
      }
    });
  }

  async isLoggedIn() {
    try {
      // بررسی وجود جعبه متن چت (سلکتورهای محتمل)
      await this.page.waitForSelector('textarea[placeholder*="Message"], input[placeholder*="Message"], [contenteditable="true"]', { timeout: 5000 });
      return true;
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

  async ensureLoggedIn(email, password) {
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
    
    if (await this.isLoggedIn()) {
      logger.info('Already logged in');
      return true;
    }

    if (email && password) {
      try {
        await this.performLogin(email, password);
        return true;
      } catch (error) {
        logger.error('Automatic login failed', { error: error.message });
      }
    }

    logger.warn('Not logged in and automatic login failed/unavailable. Waiting for manual login...');
    await this.waitForManualLogin();
    return true;
  }

  async waitForManualLogin() {
    await this.page.waitForFunction(
      () => {
        const input = document.querySelector('textarea[placeholder*="Message"], input[placeholder*="Message"], [contenteditable="true"]');
        return input !== null;
      },
      { timeout: 120000 }
    );
    await this.browserManager.saveCookies();
    logger.info('Manual login detected, cookies saved');
  }

  async performLogin(email, password) {
    try {
      const loginBtn = await this.page.locator('button:has-text("Log in"), button:has-text("Sign in"), button:has-text("ورود")').first();
      await loginBtn.click();

      const emailInput = await this.page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email"]', { timeout: 10000 });
      await emailInput.fill(email);

      const continueBtn = await this.page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("ادامه")').first();
      await continueBtn.click();

      const passInput = await this.page.waitForSelector('input[type="password"], input[name="password"], input[placeholder*="password"]', { timeout: 10000 });
      await passInput.fill(password);

      const finalBtn = await this.page.locator('button:has-text("Log in"), button:has-text("Sign in"), button:has-text("ورود")').first();
      await finalBtn.click();

      await this.page.waitForSelector('textarea[placeholder*="Message"], input[placeholder*="Message"], [contenteditable="true"]', { timeout: 30000 });
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
        throw new Error('Not logged in');
      }

      const input = await this.page.waitForSelector('textarea[placeholder*="Message"], input[placeholder*="Message"], [contenteditable="true"]', { timeout: 15000 });
      await input.fill(message);
      await this.page.keyboard.press('Enter');

      logger.debug('Message sent', { message });

      await this.waitForResponse();
      const response = await this.extractResponse();
      return response;
    } catch (error) {
      logger.error('Send message failed', { error: error.message });
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