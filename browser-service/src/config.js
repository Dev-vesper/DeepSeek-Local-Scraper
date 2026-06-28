require('dotenv').config();
const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
};

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  headless: process.env.HEADLESS === 'true',
  cookiePath: process.env.COOKIE_PATH || './cookies.json',
  logLevel: process.env.LOG_LEVEL || 'info',
  deepseekUrl: 'https://chat.deepseek.com',
  deepseekEmail: process.env.DEEPSEEK_EMAIL || '',
  deepseekPassword: process.env.DEEPSEEK_PASSWORD || '',
  autoLoginEnabled: parseBoolean(process.env.AUTO_LOGIN_ENABLED, true),
  timeout: 60000,
};