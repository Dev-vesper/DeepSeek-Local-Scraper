const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('./config');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async launch() {
    try {
      await this.close();
      this.browser = await chromium.launch({
        headless: config.headless,
        channel: 'msedge',
        args: ['--disable-blink-features=AutomationControlled']
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      });
      await this.loadCookies();
      this.page = await this.context.newPage();
      this.page.on('close', () => {
        logger.warn('Browser page closed, will recreate on next request');
        this.page = null;
      });
      logger.info('Browser launched successfully');
      return this.page;
    } catch (error) {
      logger.error('Failed to launch browser', { error: error.message });
      throw error;
    }
  }

  async loadCookies(cookieFilePath = null) {
    try {
      const targetPath = cookieFilePath || process.env.COOKIE_PATH || config.cookiePath;
      const cookieFile = path.resolve(targetPath);
      const data = await fs.readFile(cookieFile, 'utf8');
      const cookies = JSON.parse(data);
      if (cookies.length) {
        await this.context.addCookies(cookies);
        logger.info('Cookies loaded', { count: cookies.length });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Could not load cookies', { error: error.message });
      }
    }
  }

  async saveCookies(cookieFilePath = null) {
    try {
      if (!this.context) return;
      const cookies = await this.context.cookies();
      const targetPath = cookieFilePath || process.env.COOKIE_PATH || config.cookiePath;
      const cookieFile = path.resolve(targetPath);
      await fs.mkdir(path.dirname(cookieFile), { recursive: true });
      await fs.writeFile(cookieFile, JSON.stringify(cookies, null, 2));
      logger.info('Cookies saved', { count: cookies.length });
    } catch (error) {
      logger.error('Failed to save cookies', { error: error.message });
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('Browser closed');
      }
    } catch (error) {
      logger.warn('Error while closing browser', { error: error.message });
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  async isReady() {
    if (!this.browser || !this.context) {
      return false;
    }
    if (!this.page) {
      return false;
    }
    if (typeof this.page.isClosed === 'function' && this.page.isClosed()) {
      return false;
    }
    if (typeof this.browser.isConnected === 'function' && !this.browser.isConnected()) {
      return false;
    }
    return true;
  }

  async getPage() {
    if (await this.isReady()) {
      return this.page;
    }
    return this.launch();
  }
}

module.exports = BrowserManager;