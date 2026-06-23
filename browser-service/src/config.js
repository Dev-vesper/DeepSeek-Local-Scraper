require('dotenv').config();
module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  headless: process.env.HEADLESS === 'true',
  cookiePath: process.env.COOKIE_PATH || './cookies.json',
  logLevel: process.env.LOG_LEVEL || 'info',
  deepseekUrl: 'https://chat.deepseek.com',
  timeout: 60000,
};