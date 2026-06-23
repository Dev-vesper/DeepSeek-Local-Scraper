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
      await this.page.waitForSelector('textarea, input[placeholder*="Message"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async ensureLoggedIn(email, password) {
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
    
    if (await this.isLoggedIn()) {
      logger.info('Already logged in');
      return true;
    }

    // اگر کوکی وجود ندارد یا منقضی شده، لاگین می‌کنیم
    if (email && password) {
      await this.performLogin(email, password);
      return true;
    }

    // در غیر این صورت، منتظر لاگین دستی کاربر می‌مانیم
    logger.warn('Not logged in and no credentials. Waiting for manual login...');
    await this.waitForManualLogin();
    return true;
  }

  async waitForManualLogin() {
    // تا زمانی که کاربر لاگین کند، منتظر می‌مانیم
    await this.page.waitForFunction(
      () => {
        const input = document.querySelector('textarea, input[placeholder*="Message"]');
        return input !== null;
      },
      { timeout: 120000 } // 2 دقیقه زمان برای لاگین دستی
    );
    await this.browserManager.saveCookies();
    logger.info('Manual login detected, cookies saved');
  }

  async performLogin(email, password) {
    try {
      // کلیک روی دکمه ورود
      await this.page.click('a:has-text("Log in"), button:has-text("Log in")');
      await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      
      // پر کردن ایمیل
      const emailInput = await this.page.$('input[type="email"], input[name="email"]');
      await emailInput.fill(email);
      await this.page.click('button[type="submit"]');
      
      // منتظر فیلد پسورد
      await this.page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });
      const passInput = await this.page.$('input[type="password"], input[name="password"]');
      await passInput.fill(password);
      await this.page.click('button[type="submit"]');
      
      // منتظر ورود به صفحه چت
      await this.page.waitForSelector('textarea, input[placeholder*="Message"]', { timeout: 30000 });
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
      
      // اطمینان از لاگین بودن
      if (!await this.isLoggedIn()) {
        throw new Error('Not logged in');
      }

      const input = await this.page.waitForSelector('textarea, input[placeholder*="Message"]', { timeout: 15000 });
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
    await this.page.waitForSelector('.ds-markdown, .message-content, [class*="message"]:not([class*="user"])', { timeout: 60000 });
    await this.page.waitForFunction(
      () => {
        const el = document.querySelector('.ds-markdown, .message-content, [class*="message"]:not([class*="user"])');
        return el && el.textContent.length > 0;
      },
      { timeout: 60000 }
    );
  }

  async extractResponse() {
    const selector = '.ds-markdown, .message-content, [class*="message"]:not([class*="user"])';
    const element = await this.page.$(selector);
    if (!element) throw new Error('Response element not found');
    const text = await element.textContent();
    return text.trim();
  }
}

module.exports = DeepSeekClient;