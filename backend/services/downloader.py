import yt_dlp
import os
import logging
import threading
from database import is_downloaded, add_download

logger = logging.getLogger(__name__)

class DownloaderService:
    def __init__(self, download_path: str = "downloads"):
        self.download_path = download_path
        if not os.path.exists(self.download_path):
            os.makedirs(self.download_path)
        # Limit concurrent downloads to 3 to prevent IP bans
        self.semaphore = threading.Semaphore(3)
        self.active_downloads = [] # List of dicts: {'query': str, 'status': str}

    def get_active_downloads(self):
        return self.active_downloads

    def download_song(self, query: str, artist: str = None, title: str = None, album: str = None, image_url: str = None):
        # Add to active downloads list (status: queued)
        job_info = {'query': query, 'artist': artist, 'title': title, 'status': 'queued'}
        self.active_downloads.append(job_info)
        
        try:
            with self.semaphore:
                # Update status to downloading
                job_info['status'] = 'downloading'
                
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
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(query, download=True)
                
                # Find the downloaded file (it should be .mp3 now)
                # yt-dlp might change the extension, so we look for the file
                base_filename = temp_filename.replace('.%(ext)s', '')
                # The actual file will have the title from the query in the temp name if we used query, 
                # but here we used a fixed temp name pattern. 
                # Wait, outtmpl uses the query variable which might be unsafe. 
                # Let's use the info dict to find the filename or just list dir?
                # Better: prepare the expected filename.
                
                # Actually, yt-dlp returns the info dict. We can find the filename there?
                # But we specified outtmpl.
                
                # Let's construct the final clean filename
                clean_artist = artist if artist else info.get('artist', 'Unknown Artist')
                clean_title = title if title else info.get('title', 'Unknown Title')
                clean_album = album if album else info.get('album', 'Unknown Album')
                
                # Sanitize filename
                def sanitize(name):
                    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " -_()"]).strip()
                
                sanitized_artist = sanitize(clean_artist)
                sanitized_album = sanitize(clean_album)
                sanitized_title = sanitize(clean_title)

                # Create Artist/Album directory structure
                target_dir = os.path.join(self.download_path, sanitized_artist, sanitized_album)
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir)

                final_filename = os.path.join(target_dir, f"{sanitized_title}.mp3")
                
                # Locate the temp file. Since we used a specific pattern, we need to find it.
                # However, yt-dlp replaces %(ext)s.
                # Let's look for the file that matches the pattern.
                # A safer way is to let yt-dlp return the filename.
                
                downloaded_file = ydl.prepare_filename(info).replace('.webm', '.mp3').replace('.m4a', '.mp3')
                
                # Wait, prepare_filename returns the name BEFORE conversion (e.g. .webm). 
                # But FFmpegExtractAudio changes it to .mp3.
                # So we take the base and add .mp3
                
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
                        # We iterate over a list of keys to avoid runtime error while deleting
                        for key in list(audio.keys()):
                            if not key.startswith("APIC"):
                                del audio[key]
                        
                        # Set correct metadata
                        audio.add(TIT2(encoding=3, text=clean_title))
                        audio.add(TPE1(encoding=3, text=clean_artist))
                        audio.add(TALB(encoding=3, text=clean_album))
                        
                        # Handle Cover Art
                        # If yt-dlp didn't embed it, or we prefer the one from Last.fm (often better quality/correct album)
                        # Let's check if we have an image_url
                        if image_url:
                            try:
                                import requests
                                response = requests.get(image_url)
                                if response.status_code == 200:
                                    audio.add(APIC(
                                        encoding=3,
                                        mime='image/jpeg', # Assume JPEG for now, or detect
                                        type=3, # Cover (front)
                                        desc=u'Cover',
                                        data=response.content
                                    ))
                                    logger.info(f"Embedded cover art from {image_url}")
                            except Exception as e:
                                logger.error(f"Failed to download/embed cover art: {e}")

                        audio.save(v2_version=3)
                        
                        # Rename/Move to final clean filename
                        if os.path.exists(final_filename):
                            os.remove(final_filename) # Overwrite if exists (though we checked DB)
                        
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
        finally:
            if job_info in self.active_downloads:
                self.active_downloads.remove(job_info)
