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
    return 'textarea[placeholder*="Message"], textarea, input[placeholder*="Message"], [contenteditable="true"], [role="textbox"], [aria-label*="message" i], [data-testid*="message" i], .ProseMirror';
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

  async navigateTo(url, options = {}) {
    const timeout = options.timeout || 45000;
    const waitUntil = options.waitUntil || 'domcontentloaded';

    try {
      await this.page.goto(url, { waitUntil, timeout });
      return;
    } catch (error) {
      logger.warn('Primary navigation failed, retrying with load event', { url, message: error.message });
      try {
        await this.page.goto(url, { waitUntil: 'load', timeout });
        return;
      } catch (innerError) {
        logger.error('Navigation failed after retry', { url, message: innerError.message });
        throw innerError;
      }
    }
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

  getResponseSelector() {
    return '.ds-assistant-message-main-content, .ds-markdown.ds-assistant-message-main-content, [data-testid="assistant-message"], .prose, [class*="message"][class*="assistant"]';
  }

  async countResponseElements() {
    const responseSelector = this.getResponseSelector();

    if (this.page.locator) {
      try {
        return await this.page.locator(responseSelector).count();
      } catch {
        // fall through
      }
    }

    if (typeof this.page.$$eval === 'function') {
      try {
        return await this.page.$$eval(responseSelector, (elements) => elements.length);
      } catch {
        // fall through
      }
    }

    if (typeof this.page.$$ === 'function') {
      try {
        const elements = await this.page.$$(responseSelector);
        return elements.length;
      } catch {
        // fall through
      }
    }

    return 0;
  }

  async ensureLoggedIn(email, password) {
    const resolvedEmail = email !== undefined ? email : (process.env.DEEPSEEK_EMAIL || config.deepseekEmail || '');
    const resolvedPassword = password !== undefined ? password : (process.env.DEEPSEEK_PASSWORD || config.deepseekPassword || '');
    const autoLoginEnabled = (email !== undefined || password !== undefined) ? true : (config.autoLoginEnabled !== false);

    await this.navigateTo(this.baseUrl);

    if (await this.isLoggedIn()) {
      logger.info('Already logged in');
      await this.browserManager.saveCookies();
      return true;
    }

    if (autoLoginEnabled && resolvedEmail && resolvedPassword) {
      try {
        await this.performLogin(resolvedEmail, resolvedPassword);
        return true;
      } catch (error) {
        logger.error('Automatic login failed', { error: error.message });
      }
    }

    if (!autoLoginEnabled) {
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

  async waitForFieldValue(locator, expectedValue, timeoutMs = 2000) {
    const expected = String(expectedValue ?? '');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const currentValue = await locator.evaluate((element) => {
        if (!element) return '';
        if (element.isContentEditable || element.getAttribute?.('contenteditable')) {
          return (element.textContent || '').trim();
        }
        if ('value' in element) {
          return (element.value || '').trim();
        }
        return '';
      }).catch(() => '');

      if (currentValue === expected) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  isPageClosedError(error) {
    const message = error && error.message ? String(error.message) : '';
    return message.includes('Target page, context or browser has been closed') || message.includes('Page closed');
  }

  async setFieldValue(locator, value) {
    const normalizedValue = String(value ?? '');

    await locator.click().catch(() => undefined);
    await locator.focus?.().catch(() => undefined);

    if (typeof locator.fill === 'function') {
      try {
        await locator.fill(normalizedValue);
        logger.debug('Field value set via fill', { value: normalizedValue });
      } catch (error) {
        logger.warn('Fill failed; trying pressSequentially', { error: error.message });
      }
    }

    if (typeof locator.evaluate === 'function') {
      try {
        await locator.evaluate((element, text) => {
          const normalizedText = String(text ?? '');
          if ('value' in element && (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT')) {
            element.focus();
            element.value = normalizedText;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { method: 'valueProperty', success: true };
          }

          if (element.isContentEditable || element.getAttribute?.('contenteditable')) {
            element.focus();
            element.textContent = normalizedText;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { method: 'contenteditable', success: true };
          }

          return { method: 'unknown', success: false };
        }, normalizedValue);
        logger.debug('Field value set via evaluate fallback', { value: normalizedValue });
        return;
      } catch (error) {
        logger.warn('Evaluate fallback failed', { error: error.message });
      }
    }

    if (typeof locator.pressSequentially === 'function') {
      try {
        await locator.pressSequentially(normalizedValue, { delay: 20 });
        logger.debug('Field value set via pressSequentially', { value: normalizedValue });
        return;
      } catch (error) {
        logger.warn('pressSequentially failed; trying keyboard input', { error: error.message });
      }
    }

    try {
      await this.page.keyboard.type(normalizedValue, { delay: 20 });
      logger.debug('Field value set via keyboard input', { value: normalizedValue });
    } catch (error) {
      logger.warn('Keyboard input failed', { error: error.message });
      throw error;
    }
  }

  async fillInput(selector, value) {
    if (this.page.locator) {
      const field = this.page.locator(selector).first();
      const count = await field.count().catch(() => 0);
      if (count > 0) {
        await this.setFieldValue(field, value);
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
      await this.navigateTo(`${this.baseUrl}/sign_in`);

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

  async getSendButton() {
    const selectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("send")',
      'button[aria-label*="send" i]',
      '[data-testid*="send" i]',
      'div[role="button"][aria-label*="send" i]:not(.ds-button--disabled)',
      'div[role="button"][data-testid*="send" i]:not(.ds-button--disabled)',
      'div[role="button"].ds-button--primary:not(.ds-button--disabled)',
      'div[role="button"][class*="ds-button--primary"]:not(.ds-button--disabled)',
      'div[role="button"].ds-button--filled:not(.ds-button--disabled)'
    ];

    for (const selector of selectors) {
      try {
        const locator = this.page.locator(selector).first();
        const count = await locator.count().catch(() => 0);
        if (count > 0 && await locator.isVisible().catch(() => false)) {
          return locator;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async sendMessage(message) {
    if (!this.browserManager) {
      throw new Error('Browser manager is not initialized');
    }

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        this.page = await this.browserManager.getPage();
        logger.debug('Preparing to send message', { attempt, pageClosed: this.page.isClosed?.() });

        const initialResponseCount = await this.countResponseElements();
        const currentUrl = this.page?.url?.() || '';
        const shouldRefreshPage = !currentUrl.includes('/chat') && !currentUrl.includes('/sign_in') && !currentUrl.includes('/sign-in');

        if (shouldRefreshPage) {
          await this.navigateTo(this.baseUrl);
        }

        if (!await this.isLoggedIn()) {
          await this.ensureLoggedIn();
        }

        const input = await this.waitForInput({ timeout: 15000 });
        if (!input) {
          throw new Error('Chat input not found');
        }
        await this.setFieldValue(input, message);
        if (typeof this.page.waitForTimeout === 'function') {
          await this.page.waitForTimeout(400);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }

        const sendButton = await this.getSendButton();
        if (sendButton) {
          await sendButton.click();
        } else {
          await input.press?.('Enter') || await this.page.keyboard.press('Enter');
        }

        logger.debug('Message sent', { message });

        await this.waitForResponse(initialResponseCount);
        const response = await this.extractResponse(initialResponseCount);
        return response;
      } catch (error) {
        if (this.isPageClosedError(error) && attempt < maxAttempts) {
          logger.warn('Page closed during send attempt, recreating browser/page and retrying', { attempt, error: error.message });
          this.page = null;
          continue;
        }

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

  }

  async waitForResponse(previousCount = 0) {
    const responseSelector = this.getResponseSelector();
    const deadline = Date.now() + 60000;
    let lastSnapshot = '';
    let stableTicks = 0;

    while (Date.now() < deadline) {
      const elements = await this.page.$$(responseSelector);
      if (elements.length > previousCount) {
        const latestElement = elements[elements.length - 1];
        const text = (await latestElement.textContent().catch(() => '') || '').trim();
        if (text.length > 10) {
          if (text === lastSnapshot) {
            stableTicks += 1;
            if (stableTicks >= 2) {
              logger.debug('Response received and complete');
              return;
            }
          } else {
            lastSnapshot = text;
            stableTicks = 0;
          }
        }
      }

      await this.page.waitForTimeout(500);
    }

    logger.debug('Response wait timed out');
  }

  async extractResponse(previousCount = 0) {
    const responseSelector = this.getResponseSelector();
    const elements = await this.page.$$(responseSelector);
    if (elements.length <= previousCount) {
      throw new Error('No response element found');
    }

    const newElements = elements.slice(Math.max(previousCount, 0));
    const textValues = await Promise.all(newElements.map((element) => element.textContent()));
    const responseText = textValues
      .map((value) => (value || '').trim())
      .filter((value) => value.length > 0)
      .join('\n\n');

    return responseText;
  }
}

module.exports = DeepSeekClient;