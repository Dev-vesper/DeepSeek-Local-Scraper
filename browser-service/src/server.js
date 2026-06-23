const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./logger');
const BrowserManager = require('./BrowserManager');
const DeepSeekClient = require('./DeepSeekClient');

const app = express();
app.use(cors());
app.use(express.json());

let browserManager = null;
let deepSeekClient = null;

async function initBrowser() {
  browserManager = new BrowserManager();
  const page = await browserManager.launch();
  deepSeekClient = new DeepSeekClient(page, browserManager);
  const email = process.env.DEEPSEEK_EMAIL;
  const password = process.env.DEEPSEEK_PASSWORD;
  if (email && password) {
    await deepSeekClient.ensureLoggedIn(email, password);
  } else {
    await deepSeekClient.ensureLoggedIn();
  }
  logger.info('Browser service ready');
}

app.post('/send-message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (!deepSeekClient) {
      return res.status(503).json({ error: 'Browser not initialized' });
    }
    const response = await deepSeekClient.sendMessage(message);
    res.json({ success: true, response });
  } catch (error) {
    logger.error('Request failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function shutdown() {
  if (browserManager) {
    await browserManager.close();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const port = config.port;
app.listen(port, async () => {
  logger.info(`Browser service listening on port ${port}`);
  await initBrowser().catch(err => {
    logger.error('Initialization failed', { error: err.message });
    process.exit(1);
  });
});