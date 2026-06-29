const { chromium } = require('playwright');
const logger = require('./logger');
const config = require('./config');

class BrowserManager {
  constructor() {
    this.context = null;
    this.page = null;
  }

  async launch() {
    try {
      await this.close();
      this.context = await chromium.launchPersistentContext(config.userDataDir, {
        headless: config.headless,
        channel: 'msedge',
        args: ['--disable-blink-features=AutomationControlled'],
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      });
      this.page = this.context.pages().length > 0 ? this.context.pages()[0] : await this.context.newPage();
      this.page.on('close', () => {
        logger.warn('Browser page closed, will recreate on next request');
        this.page = null;
      });
      logger.info('Browser launched successfully with persistent context');
      return this.page;
    } catch (error) {
      logger.error('Failed to launch browser', { error: error.message });
      throw error;
    }
  }

  async close() {
    try {
      if (this.context) {
        await this.context.close();
        logger.info('Browser context closed');
      }
    } catch (error) {
      logger.warn('Error while closing browser context', { error: error.message });
    } finally {
      this.context = null;
      this.page = null;
    }
  }

  async isReady() {
    if (!this.context) {
      return false;
    }
    if (!this.page) {
      return false;
    }
    if (typeof this.page.isClosed === 'function' && this.page.isClosed()) {
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