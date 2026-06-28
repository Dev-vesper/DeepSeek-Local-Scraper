const DeepSeekClient = require('../src/DeepSeekClient');

describe('DeepSeekClient', () => {
  test('uses configured credentials when none are passed', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
    };

    const client = new DeepSeekClient(page, browserManager);
    client.isLoggedIn = jest.fn().mockResolvedValue(false);
    client.performLogin = jest.fn().mockResolvedValue();
    client.waitForManualLogin = jest.fn().mockResolvedValue();

    process.env.DEEPSEEK_EMAIL = 'email@example.com';
    process.env.DEEPSEEK_PASSWORD = 'password';
    process.env.AUTO_LOGIN_ENABLED = 'true';

    await client.ensureLoggedIn(undefined, undefined);

    expect(client.performLogin).not.toHaveBeenCalled();
  });

  test('reports a clear error when the DeepSeek page is blocked', async () => {
    const page = {
      goto: jest.fn().mockRejectedValue(new Error('Request blocked. We can not connect.')),
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      waitForTimeout: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
      getPage: jest.fn().mockResolvedValue(page),
    };

    const client = new DeepSeekClient(null, browserManager);

    await expect(client.sendMessage('hello')).rejects.toThrow('DeepSeek page is currently unavailable');
  });

  test('injects unicode text directly into editable fields without relying on keyboard typing', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
    };

    const client = new DeepSeekClient(page, browserManager);
    const locator = {
      click: jest.fn().mockResolvedValue(),
      focus: jest.fn().mockResolvedValue(),
      evaluate: jest.fn()
        .mockResolvedValueOnce({ typeFallback: false })
        .mockResolvedValueOnce('سلام'),
      type: jest.fn().mockResolvedValue(),
      pressSequentially: jest.fn().mockResolvedValue(),
      fill: jest.fn().mockResolvedValue(),
    };

    await client.setFieldValue(locator, 'سلام');

    expect(locator.click).toHaveBeenCalled();
    expect(locator.evaluate).toHaveBeenCalled();
    expect(locator.type).not.toHaveBeenCalled();
  });

  test('sendMessage uses the unicode-safe field injection path', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      keyboard: { press: jest.fn().mockResolvedValue() },
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
      getPage: jest.fn().mockResolvedValue(page),
    };

    const client = new DeepSeekClient(null, browserManager);
    client.isLoggedIn = jest.fn().mockResolvedValue(true);
    client.countResponseElements = jest.fn().mockResolvedValue(0);
    client.waitForInput = jest.fn().mockResolvedValue({ press: jest.fn().mockResolvedValue() });
    client.setFieldValue = jest.fn().mockResolvedValue();
    client.getSendButton = jest.fn().mockResolvedValue(null);
    client.waitForResponse = jest.fn().mockResolvedValue();
    client.extractResponse = jest.fn().mockResolvedValue('ok');

    const response = await client.sendMessage('سلام');

    expect(client.setFieldValue).toHaveBeenCalledWith(expect.any(Object), 'سلام');
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');
    expect(response).toBe('ok');
  });

  test('does not reload the page when the chat session is already active', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      keyboard: { press: jest.fn().mockResolvedValue() },
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com/chat'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
      getPage: jest.fn().mockResolvedValue(page),
    };

    const client = new DeepSeekClient(null, browserManager);
    client.isLoggedIn = jest.fn().mockResolvedValue(true);
    client.countResponseElements = jest.fn().mockResolvedValue(0);
    client.waitForInput = jest.fn().mockResolvedValue({ press: jest.fn().mockResolvedValue() });
    client.setFieldValue = jest.fn().mockResolvedValue();
    client.getSendButton = jest.fn().mockResolvedValue(null);
    client.waitForResponse = jest.fn().mockResolvedValue();
    client.extractResponse = jest.fn().mockResolvedValue('ok');

    await client.sendMessage('سلام');

    expect(page.goto).not.toHaveBeenCalled();
  });

  test('does not reload the main chat page when the input is already available', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      keyboard: { press: jest.fn().mockResolvedValue() },
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com/'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
      getPage: jest.fn().mockResolvedValue(page),
    };

    const client = new DeepSeekClient(null, browserManager);
    client.isLoggedIn = jest.fn().mockResolvedValue(true);
    client.countResponseElements = jest.fn().mockResolvedValue(0);
    client.waitForInput = jest.fn().mockResolvedValue({ press: jest.fn().mockResolvedValue() });
    client.setFieldValue = jest.fn().mockResolvedValue();
    client.getSendButton = jest.fn().mockResolvedValue(null);
    client.waitForResponse = jest.fn().mockResolvedValue();
    client.extractResponse = jest.fn().mockResolvedValue('ok');

    await client.sendMessage('سلام');

    expect(page.goto).not.toHaveBeenCalled();
  });

  test('replaces existing field text instead of appending duplicate content', async () => {
    const page = {
      keyboard: { type: jest.fn().mockResolvedValue() },
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
    };

    const client = new DeepSeekClient(page, browserManager);
    const element = {
      tagName: 'TEXTAREA',
      value: 'سلام',
      selectionStart: 0,
      selectionEnd: 0,
      focus: jest.fn(),
      setRangeText: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    const locator = {
      click: jest.fn().mockResolvedValue(),
      focus: jest.fn().mockResolvedValue(),
      evaluate: jest.fn((fn, value) => fn(element, value)),
    };

    client.waitForFieldValue = jest.fn().mockResolvedValue(true);

    await client.setFieldValue(locator, 'سلام');

    expect(element.value).toBe('سلام');
  });

  test('extractResponse converts HTML elements to Markdown', async () => {
    const element1 = {
      innerHTML: jest.fn().mockResolvedValue('<p>First message</p>'),
    };
    const element2 = {
      innerHTML: jest.fn().mockResolvedValue('<pre><code>code block</code></pre>'),
    };
    const page = {
      $$: jest.fn().mockResolvedValue([element1, element2]),
    };
    const browserManager = {
      saveCookies: jest.fn(),
    };
    const client = new DeepSeekClient(page, browserManager);
    const response = await client.extractResponse(0);

    expect(element1.innerHTML).toHaveBeenCalled();
    expect(element2.innerHTML).toHaveBeenCalled();
    expect(response).toContain('First message');
    expect(response).toContain('code block');
  });
});
