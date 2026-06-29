const path = require('path');
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
  logLevel: process.env.LOG_LEVEL || 'info',
  deepseekUrl: 'https://chat.deepseek.com',
  deepseekEmail: process.env.DEEPSEEK_EMAIL || '',
  deepseekPassword: process.env.DEEPSEEK_PASSWORD || '',
  autoLoginEnabled: parseBoolean(process.env.AUTO_LOGIN_ENABLED, true),
  timeout: 60000,
  userDataDir: process.env.BROWSER_DATA_DIR || path.resolve(__dirname, '..', 'browser-data')
};