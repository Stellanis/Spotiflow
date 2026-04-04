import logging
from logging.handlers import RotatingFileHandler
try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ModuleNotFoundError:
    class _FallbackJob:
        def __init__(self, job_id, next_run_time=None):
            self.id = job_id
            self.next_run_time = next_run_time

    class BackgroundScheduler:
        def __init__(self):
            self._jobs = {}
            self.running = False

        def add_job(self, func, trigger, id=None, **kwargs):
            job = _FallbackJob(id, kwargs.get("run_date"))
            if id:
                self._jobs[id] = job
            return job

        def get_job(self, job_id):
            return self._jobs.get(job_id)

        def reschedule_job(self, job_id, **kwargs):
            return self._jobs.get(job_id)

        def start(self):
            self.running = True

        def shutdown(self):
            self.running = False

from dotenv import load_dotenv
from services.lastfm import LastFMService
from services.downloader import DownloaderService
from services.analytics import AnalyticsService

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
analytics_service = AnalyticsService(lastfm_service)
downloader_service = DownloaderService()
scheduler = BackgroundScheduler()
