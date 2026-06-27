const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

const { chromium } = require('playwright');
const BrowserManager = require('../src/BrowserManager');

describe('BrowserManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('launches a browser and loads cookies when present', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-manager-'));
    const cookiePath = path.join(tempDir, 'cookies.json');
    fs.writeFileSync(cookiePath, JSON.stringify([{ name: 'token', value: 'abc' }]))

    const browser = { newContext: jest.fn(), close: jest.fn() };
    const context = {
      addCookies: jest.fn().mockResolvedValue(undefined),
      cookies: jest.fn().mockResolvedValue([]),
      newPage: jest.fn().mockResolvedValue({}),
    };
    browser.newContext.mockResolvedValue(context);
    chromium.launch.mockResolvedValue(browser);

    process.env.COOKIE_PATH = cookiePath;
    const manager = new BrowserManager();
    await manager.launch();

    expect(chromium.launch).toHaveBeenCalled();
    expect(context.addCookies).toHaveBeenCalledWith([{ name: 'token', value: 'abc' }]);
  });

  test('saves cookies to disk', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-manager-'));
    const cookiePath = path.join(tempDir, 'cookies.json');

    const manager = new BrowserManager();
    manager.context = {
      cookies: jest.fn().mockResolvedValue([{ name: 'token', value: 'abc' }]),
    };

    await manager.saveCookies(cookiePath);

    const saved = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
    expect(saved).toHaveLength(1);
  });
});
