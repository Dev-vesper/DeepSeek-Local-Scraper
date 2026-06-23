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
      // روش اول: وجود textarea مخصوص چت
      await this.page.waitForSelector('textarea, input[placeholder*="Message"]', { timeout: 3000 });
      return true;
    } catch {
      try {
        // روش دوم: عدم وجود دکمه لاگین
        const loginBtn = await this.page.$('text=Log in, text=Sign in, text=ورود, button[type="button"]:has-text("Log in")');
        if (!loginBtn) {
          // اگر دکمه لاگین وجود نداشته باشد، احتمالاً لاگین هستیم
          return true;
        }
        // روش سوم: بررسی URL
        if (this.page.url().includes('/chat')) {
          return true;
        }
        return false;
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

    // اگر کوکی وجود ندارد یا لاگین نیست، تلاش برای لاگین خودکار
    if (email && password) {
      try {
        await this.performLogin(email, password);
        return true;
      } catch (error) {
        logger.error('Automatic login failed', { error: error.message });
        // در صورت شکست، به حالت دستی می‌رویم
      }
    }

    // در غیر این صورت، منتظر لاگین دستی کاربر
    logger.warn('Not logged in and automatic login failed/unavailable. Waiting for manual login...');
    await this.waitForManualLogin();
    return true;
  }

  async waitForManualLogin() {
    await this.page.waitForFunction(
      () => {
        const input = document.querySelector('textarea, input[placeholder*="Message"]');
        return input !== null;
      },
      { timeout: 120000 } // 2 دقیقه
    );
    await this.browserManager.saveCookies();
    logger.info('Manual login detected, cookies saved');
  }

  async performLogin(email, password) {
    try {
      // یافتن دکمه لاگین با روش‌های مختلف
      const loginBtn = await this.page.getByRole('button', { name: /log in/i })
        .or(this.page.getByText('Log in'))
        .or(this.page.getByText('Sign in'))
        .or(this.page.getByText('ورود'))
        .first();
      await loginBtn.click();

      // فیلد ایمیل
      const emailInput = await this.page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email"]', { timeout: 10000 });
      await emailInput.fill(email);
      
      // دکمه ادامه (بعد از ایمیل)
      const continueBtn = await this.page.getByRole('button', { name: /continue|next|submit/i })
        .or(this.page.getByText('Continue'))
        .or(this.page.getByText('Next'))
        .first();
      await continueBtn.click();

      // فیلد پسورد
      const passInput = await this.page.waitForSelector('input[type="password"], input[name="password"], input[placeholder*="password"]', { timeout: 10000 });
      await passInput.fill(password);
      
      // دکمه نهایی ورود
      const finalBtn = await this.page.getByRole('button', { name: /sign in|log in|submit|ورود/i })
        .or(this.page.getByText('Log in'))
        .or(this.page.getByText('Sign in'))
        .or(this.page.getByText('ورود'))
        .first();
      await finalBtn.click();

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