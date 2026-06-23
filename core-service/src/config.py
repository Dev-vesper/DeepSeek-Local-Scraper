import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BROWSER_SERVICE_URL = os.getenv('BROWSER_SERVICE_URL', 'http://localhost:3000')
    PORT = int(os.getenv('PORT', 5000))
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))
    RETRY_DELAY = int(os.getenv('RETRY_DELAY', 1))