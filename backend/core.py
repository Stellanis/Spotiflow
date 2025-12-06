import logging
from logging.handlers import RotatingFileHandler
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from services.lastfm import LastFMService
from services.downloader import DownloaderService

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler("app.log", maxBytes=1000000, backupCount=3),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("spotiflow")

# Shared Instances
lastfm_service = LastFMService()
downloader_service = DownloaderService()
scheduler = BackgroundScheduler()
