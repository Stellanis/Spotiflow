import yt_dlp
import os
from database import is_downloaded, add_download

class DownloaderService:
    def __init__(self, download_path: str = "downloads"):
        self.download_path = download_path
        if not os.path.exists(self.download_path):
            os.makedirs(self.download_path)

    def download_song(self, query: str, artist: str = None, title: str = None, album: str = None, image_url: str = None):
        if is_downloaded(query):
            print(f"Skipping {query}, already downloaded.")
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
                        from mutagen.easyid3 import EasyID3
                        from mutagen.id3 import ID3, APIC
                        
                        audio = EasyID3(downloaded_file)
                        audio['artist'] = clean_artist
                        audio['title'] = clean_title
                        audio['album'] = clean_album
                        audio.save()
                        
                        # Rename/Move to final clean filename
                        if os.path.exists(final_filename):
                            os.remove(final_filename) # Overwrite if exists (though we checked DB)
                        
                        os.rename(downloaded_file, final_filename)
                        print(f"Renamed to: {final_filename}")
                        
                        add_download(query, clean_artist, clean_title, clean_album, image_url=image_url, status="completed")
                        return {"status": "success", "info": info, "file": final_filename}
                    except Exception as e:
                        print(f"Error tagging/renaming: {e}")
                        return {"status": "partial_success", "message": "Downloaded but failed to tag/rename"}
                else:
                     return {"status": "error", "message": "Downloaded file not found"}

            except Exception as e:
                return {"status": "error", "message": str(e)}
