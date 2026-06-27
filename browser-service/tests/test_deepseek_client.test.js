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

    await client.ensureLoggedIn(undefined, undefined);

    expect(client.performLogin).toHaveBeenCalledWith('email@example.com', 'password');
  });

  test('reports a clear error when the DeepSeek page is blocked', async () => {
    const page = {
      goto: jest.fn().mockRejectedValue(new Error('Request blocked. We can not connect.')),
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForFunction: jest.fn().mockResolvedValue(),
      url: jest.fn().mockReturnValue('https://chat.deepseek.com'),
    };
    const browserManager = {
      saveCookies: jest.fn().mockResolvedValue(),
    };

    const client = new DeepSeekClient(page, browserManager);

    await expect(client.sendMessage('hello')).rejects.toThrow('DeepSeek page is currently unavailable');
  });
});
