import logging
from logging.handlers import RotatingFileHandler
import os
from config import Config

log_dir = 'logs'
os.makedirs(log_dir, exist_ok=True)

logger = logging.getLogger('DeepSeekService')
logger.setLevel(getattr(logging, Config.LOG_LEVEL))

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

console = logging.StreamHandler()
console.setFormatter(formatter)
logger.addHandler(console)

file_handler = RotatingFileHandler(
    os.path.join(log_dir, 'app.log'),
    maxBytes=10485760,
    backupCount=5
)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

error_handler = RotatingFileHandler(
    os.path.join(log_dir, 'error.log'),
    maxBytes=10485760,
    backupCount=5
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(formatter)
logger.addHandler(error_handler)