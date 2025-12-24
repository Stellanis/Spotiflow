import yt_dlp
import os
import logging
import threading
import queue
import time
from database import is_downloaded, add_download

logger = logging.getLogger(__name__)

class DownloaderService:
    def __init__(self, download_path: str = "downloads"):
        self.download_path = download_path
        if not os.path.exists(self.download_path):
            os.makedirs(self.download_path)
        
        self.active_downloads = [] # List of dicts: {'query': str, 'status': str}
        self.queue = queue.Queue()
        self.active_downloads_lock = threading.Lock()
        
        # Start worker threads
        self.num_workers = 3
        self.workers = []
        for i in range(self.num_workers):
            t = threading.Thread(target=self._worker, daemon=True, name=f"DownloaderWorker-{i}")
            t.start()
            self.workers.append(t)

    def get_active_downloads(self):
        with self.active_downloads_lock:
            # Return a copy to avoid race conditions during iteration by caller
            return list(self.active_downloads)

    def queue_download(self, query: str, artist: str = None, title: str = None, album: str = None, image_url: str = None):
        job_info = {
            'query': query, 
            'artist': artist, 
            'title': title, 
            'album': album,
            'image_url': image_url,
            'status': 'queued'
        }
        
        with self.active_downloads_lock:
            # Check if already in active downloads to avoid duplicates in queue
            for job in self.active_downloads:
                if job['query'] == query:
                    logger.info(f"Skipping {query}, already in queue/downloading.")
                    return {"status": "skipped", "message": "Already in queue"}
            
            self.active_downloads.append(job_info)
        
        self.queue.put(job_info)
        logger.info(f"Queued download: {query}")
        return {"status": "queued", "query": query}

    def _worker(self):
        while True:
            job_info = self.queue.get()
            try:
                query = job_info['query']
                
                # Update status to downloading
                with self.active_downloads_lock:
                    # Find the job object in the list (it might be a different dict instance if we re-fetched, but here we use the same dict)
                    # However, to be safe, let's find it by query
                    for job in self.active_downloads:
                        if job['query'] == query:
                            job['status'] = 'downloading'
                            break
                
                self._download_song_sync(job_info)
                
            except Exception as e:
                logger.error(f"Worker error: {e}")
            finally:
                # Remove from active downloads
                with self.active_downloads_lock:
                    # We need to remove the specific job_info or find by query
                    # Using list comprehension to remove
                    self.active_downloads = [j for j in self.active_downloads if j['query'] != job_info['query']]
                
                self.queue.task_done()

    def _download_song_sync(self, job_info):
        query = job_info['query']
        artist = job_info.get('artist')
        title = job_info.get('title')
        album = job_info.get('album')
        image_url = job_info.get('image_url')

        if is_downloaded(query):
            logger.info(f"Skipping {query}, already downloaded.")
            return {"status": "skipped", "message": "Already downloaded"}

        # Use a temporary filename to avoid issues with special characters in YouTube titles
        temp_filename = f'{self.download_path}/temp_{query.replace(" ", "_")}.%(ext)s'
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                },
                {
                    'key': 'EmbedThumbnail',
                }
            ],
            'outtmpl': temp_filename,
            'default_search': 'ytsearch',
            'noplaylist': True,
            'writethumbnail': True,
            # Add quiet mode to reduce log noise, or keep it for debugging
            'quiet': True,
            'no_warnings': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(query, download=True)
                
                # Let's construct the final clean filename
                clean_artist = artist if artist else info.get('artist', 'Unknown Artist')
                clean_title = title if title else info.get('title', 'Unknown Title')
                clean_album = album if album else info.get('album', 'Unknown Album')
                
                from utils import sanitize_filename
                sanitized_artist = sanitize_filename(clean_artist)
                sanitized_album = sanitize_filename(clean_album)
                sanitized_title = sanitize_filename(clean_title)

                # Create Artist/Album directory structure
                target_dir = os.path.join(self.download_path, sanitized_artist, sanitized_album)
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir)

                final_filename = os.path.join(target_dir, f"{sanitized_title}.mp3")
                
                # Locate the temp file
                downloaded_file = ydl.prepare_filename(info).replace('.webm', '.mp3').replace('.m4a', '.mp3')
                
                if not os.path.exists(downloaded_file):
                        # Try to find it by replacing extension
                        base = os.path.splitext(downloaded_file)[0]
                        downloaded_file = f"{base}.mp3"
                
                if os.path.exists(downloaded_file):
                    # Apply metadata using mutagen
                    try:
                        from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC, error
                        
                        try:
                            audio = ID3(downloaded_file)
                        except error:
                            audio = ID3()
                        
                        # Clear all tags except APIC (Cover Art)
                        for key in list(audio.keys()):
                            if not key.startswith("APIC"):
                                del audio[key]
                        
                        # Set correct metadata
                        audio.add(TIT2(encoding=3, text=clean_title))
                        audio.add(TPE1(encoding=3, text=clean_artist))
                        audio.add(TALB(encoding=3, text=clean_album))
                        
                        # Handle Cover Art
                        if image_url:
                            try:
                                import requests
                                response = requests.get(image_url)
                                if response.status_code == 200:
                                    audio.add(APIC(
                                        encoding=3,
                                        mime='image/jpeg', 
                                        type=3, 
                                        desc=u'Cover',
                                        data=response.content
                                    ))
                                    logger.info(f"Embedded cover art from {image_url}")
                            except Exception as e:
                                logger.error(f"Failed to download/embed cover art: {e}")

                        audio.save(v2_version=3)
                        
                        # Rename/Move to final clean filename
                        if os.path.exists(final_filename):
                            os.remove(final_filename) 
                        
                        os.rename(downloaded_file, final_filename)
                        logger.info(f"Renamed to: {final_filename}")
                        
                        add_download(query, clean_artist, clean_title, clean_album, image_url=image_url, status="completed")
                        return {"status": "success", "info": info, "file": final_filename}
                    except Exception as e:
                        logger.error(f"Error tagging/renaming: {e}")
                        return {"status": "partial_success", "message": "Downloaded but failed to tag/rename"}
                else:
                        return {"status": "error", "message": "Downloaded file not found"}

            except Exception as e:
                logger.error(f"Download failed for {query}: {e}")
                return {"status": "error", "message": str(e)}
