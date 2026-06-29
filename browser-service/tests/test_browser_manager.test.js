const { chromium } = require('playwright');
const BrowserManager = require('../src/BrowserManager');

jest.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: jest.fn(),
  },
}));

describe('BrowserManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('launches a persistent browser context and returns a page', async () => {
    const fakePage = { on: jest.fn() };
    const fakeContext = {
      pages: jest.fn().mockReturnValue([]),
      newPage: jest.fn().mockResolvedValue(fakePage),
      close: jest.fn(),
    };
    chromium.launchPersistentContext.mockResolvedValue(fakeContext);

    const manager = new BrowserManager();
    const page = await manager.launch();

    expect(chromium.launchPersistentContext).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headless: expect.any(Boolean),
        channel: 'msedge',
      })
    );
    expect(fakeContext.newPage).toHaveBeenCalled();
    expect(page).toBe(fakePage);
  });

  test('uses existing page from context if already open', async () => {
    const existingPage = { on: jest.fn() };
    const fakeContext = {
      pages: jest.fn().mockReturnValue([existingPage]),
      newPage: jest.fn(),
      close: jest.fn(),
    };
    chromium.launchPersistentContext.mockResolvedValue(fakeContext);

    const manager = new BrowserManager();
    const page = await manager.launch();

    expect(fakeContext.newPage).not.toHaveBeenCalled();
    expect(page).toBe(existingPage);
  });

  test('close tears down context', async () => {
    const fakeContext = {
      close: jest.fn().mockResolvedValue(),
    };
    chromium.launchPersistentContext.mockResolvedValue(fakeContext);

    const manager = new BrowserManager();
    await manager.launch();
    await manager.close();

    expect(fakeContext.close).toHaveBeenCalled();
    expect(manager.context).toBeNull();
    expect(manager.page).toBeNull();
  });
});