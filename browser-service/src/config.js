require('dotenv').config();
module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  headless: process.env.HEADLESS === 'true',
  cookiePath: process.env.COOKIE_PATH || './cookies.json',
  logLevel: process.env.LOG_LEVEL || 'info',
  deepseekUrl: 'https://chat.deepseek.com',
  deepseekEmail: process.env.DEEPSEEK_EMAIL || '',
  deepseekPassword: process.env.DEEPSEEK_PASSWORD || '',
  autoLoginEnabled: process.env.AUTO_LOGIN_ENABLED !== 'false',
  timeout: 60000,
};