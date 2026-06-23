from logger import logger
from BrowserClient import BrowserClient

class DeepSeekService:
    def __init__(self):
        self.browser_client = BrowserClient()

    def chat(self, message):
        if not message or not isinstance(message, str):
            raise ValueError("message must be a non-empty string")
        logger.info(f"Processing chat message: {message[:50]}...")
        try:
            response = self.browser_client.send_message(message)
            logger.info("Chat completed successfully")
            return response
        except Exception as e:
            logger.error(f"Chat failed: {e}")
            raise