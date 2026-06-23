import requests
import time
from config import Config
from logger import logger

class BrowserClient:
    def __init__(self):
        self.base_url = Config.BROWSER_SERVICE_URL

    def send_message(self, message, max_retries=None, retry_delay=None):
        max_retries = max_retries or Config.MAX_RETRIES
        retry_delay = retry_delay or Config.RETRY_DELAY
        url = f"{self.base_url}/send-message"
        payload = {"message": message}
        for attempt in range(1, max_retries + 1):
            try:
                response = requests.post(url, json=payload, timeout=60)
                response.raise_for_status()
                data = response.json()
                if data.get('success'):
                    return data.get('response')
                else:
                    raise Exception(data.get('error', 'Unknown error'))
            except requests.exceptions.RequestException as e:
                logger.warning(f"Attempt {attempt} failed: {e}")
                if attempt == max_retries:
                    raise
                time.sleep(retry_delay * (2 ** (attempt - 1)))
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                raise