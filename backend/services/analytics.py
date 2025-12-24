import time
from datetime import datetime, timedelta
from collections import Counter
import math
from .cache_manager import CacheManager

class AnalyticsService:
    def __init__(self, lastfm_service):
        self.lastfm = lastfm_service
        self.cache = CacheManager(ttl=86400)

    def get_chart_data(self, user: str, period: str = "1month", artist: str = None, track: str = None):
        start_ts, all_tracks = self.lastfm.get_cached_recent_tracks(user, period)
        now = int(time.time())
        day_seconds = 86400
        
        filtered_tracks = []
        for t in all_tracks:
            if artist and t.get("artist", {}).get("#text").lower() != artist.lower():
                continue
            if track and t.get("name").lower() != track.lower():
                continue
            filtered_tracks.append(t)

        daily_counts = {}
        current_ts = start_ts
        while current_ts <= now:
            date_str = datetime.fromtimestamp(current_ts).strftime('%Y-%m-%d')
            daily_counts[date_str] = 0
            current_ts += day_seconds

        for t in filtered_tracks:
            if "date" in t:
                ts = int(t["date"]["uts"])
                date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                if date_str in daily_counts:
                        daily_counts[date_str] += 1
        
        return [{"date": k, "count": v} for k, v in sorted(daily_counts.items())]

    def get_listening_clock_data(self, user: str, period: str = "1month"):
        start_ts, all_tracks = self.lastfm.get_cached_recent_tracks(user, period)
        hour_counts = {h: 0 for h in range(24)}
        
        for t in all_tracks:
            if "date" in t:
                ts = int(t["date"]["uts"])
                dt = datetime.fromtimestamp(ts)
                hour_counts[dt.hour] += 1
                
        return [{"hour": h, "count": c} for h, c in hour_counts.items()]

    def get_genre_breakdown(self, user: str, period: str = "1month"):
        cache_key = f"genres_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Use LastFMService to get top artists, so we don't access client directly if possible
        # LastFMService.get_top_artists returns simple dicts {name, playcount, url}
        # But here we need to tag them.
        
        artists = self.lastfm.get_top_artists(user, period, limit=20)
        
        tag_counts = Counter()
        for artist in artists:
            name = artist.get("name")
            playcount = int(artist.get("playcount", 1))
            
            if name:
                tags = self.lastfm.get_artist_tags(name)
                for tag in tags[:3]: 
                    tag_counts[tag] += playcount
        
        result = [{"name": tag, "value": count} for tag, count in tag_counts.most_common(15)]
        self.cache.set(cache_key, result)
        return result

    def get_artist_diversity(self, user: str, period: str = "1month"):
        cache_key = f"diversity_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
            
        artists = self.lastfm.get_top_artists(user, period, limit=50)
        
        if not artists: return {"score": 0, "label": "No Data"}

        playcounts = [int(a.get("playcount", 1)) for a in artists]
        total_plays = sum(playcounts)
        
        if total_plays == 0: return {"score": 0, "label": "No Data"}
        
        entropy = 0
        for count in playcounts:
            p = count / total_plays
            if p > 0:
                entropy -= p * math.log2(p)
        
        n = len(playcounts)
        max_entropy = math.log2(n) if n > 1 else 1
        normalized_score = (entropy / max_entropy) * 100 if max_entropy > 0 else 0
        
        if normalized_score >= 90: label = "Explorer"
        elif normalized_score >= 70: label = "Eclectic"
        elif normalized_score >= 50: label = "Balanced"
        elif normalized_score >= 30: label = "Focused"
        else: label = "Obsessive"
        
        result = {"score": round(normalized_score), "label": label}
        self.cache.set(cache_key, result)
        return result

    def get_mainstream_score(self, user: str, period: str = "1month"):
        cache_key = f"mainstream_{user}_{period}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
            
        artists = self.lastfm.get_top_artists(user, period, limit=50)
        
        if not artists: return {"score": 0, "label": "No Data"}

        top_10 = artists[:10]
        total_pop_score = 0
        total_weight = 0
        
        for a in top_10:
            name = a.get("name")
            user_playcount = int(a.get("playcount", 1))
            
            listeners = self.lastfm.get_artist_listeners(name)
            
            if listeners > 0:
                log_pop = math.log10(listeners)
                max_log = 6.7
                score = (log_pop / max_log) * 100
                score = max(0, min(100, score))
            else:
                score = 0
                
            total_pop_score += score * user_playcount
            total_weight += user_playcount
            
        final_score = total_pop_score / total_weight if total_weight > 0 else 0
        
        if final_score >= 85: label = "Mainstream"
        elif final_score >= 70: label = "Popular"
        elif final_score >= 50: label = "Trendy"
        elif final_score >= 30: label = "Underground"
        else: label = "Obscure"
        
        result = {"score": round(final_score), "label": label}
        self.cache.set(cache_key, result)
        return result

    def get_chart_data_db(self, user: str, period: str = "1month"):
        from database import get_scrobbles_in_range
        
        # Calculate time range
        now = int(time.time())
        day_seconds = 86400
        period_map = {
            "7day": 7, "1month": 30, "3month": 90, 
            "6month": 180, "12month": 365, "overall": 365*10
        }
        days = period_map.get(period, 30)
        start_ts = now - (days * day_seconds)
        
        scrobbles = get_scrobbles_in_range(user, start_ts, now)
        
        daily_counts = {}
        current_ts = start_ts
        while current_ts <= now:
            date_str = datetime.fromtimestamp(current_ts).strftime('%Y-%m-%d')
            daily_counts[date_str] = 0
            current_ts += day_seconds
            
        for s in scrobbles:
            ts = s['timestamp']
            date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
            if date_str in daily_counts:
                daily_counts[date_str] += 1
        
        return [{"date": k, "count": v} for k, v in sorted(daily_counts.items())]

    def get_listening_streak_db(self, user: str):
        from database import get_scrobbles_from_db
        
        scrobbles = get_scrobbles_from_db(user, limit=5000)
        
        if not scrobbles:
            return {"current_streak": 0}
            
        active_days = set()
        for s in scrobbles:
            ts = s['timestamp']
            date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
            active_days.add(date_str)
            
        streak = 0
        check_date = datetime.now()
        today_str = check_date.strftime('%Y-%m-%d')
        
        if today_str in active_days:
            streak += 1
            
        while True:
            check_date -= timedelta(days=1)
            date_str = check_date.strftime('%Y-%m-%d')
            if date_str in active_days:
                if streak == 0 and date_str != today_str: 
                    streak += 1
                elif streak > 0:
                    streak += 1
            else:
                if streak == 0:
                    pass 
                break
                
            if streak > 3650: # Safety break 10 years
                break
        
        return {"current_streak": streak}

    def get_listening_streak(self, user: str):
        cache_key = f"streak_{user}" 
        cached = self.cache.get(cache_key)
        if cached:
             return cached

        start_ts, all_tracks = self.lastfm.get_cached_recent_tracks(user, "3month")
        
        if not all_tracks:
            return {"current_streak": 0}
            
        active_days = set()
        for t in all_tracks:
            if "date" in t:
                ts = int(t["date"]["uts"])
                date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                active_days.add(date_str)
        
        streak = 0
        check_date = datetime.now()
        today_str = check_date.strftime('%Y-%m-%d')
        
        if today_str in active_days:
            streak += 1
        
        while True:
            check_date -= timedelta(days=1)
            date_str = check_date.strftime('%Y-%m-%d')
            if date_str in active_days:
                if streak == 0 and date_str != today_str: 
                    streak += 1
                elif streak > 0:
                    streak += 1
            else:
                if streak == 0:
                    pass 
                break
                
            if streak > 100: 
                break
        
        result = {"current_streak": streak}
        self.cache.set(cache_key, result)
        return result

    def generate_sonic_diary(self, user: str):
        top_tracks = self.lastfm.get_top_tracks(user, period="7day", limit=5)
        try:
            top_artists = self.lastfm.get_top_artists(user, period="7day", limit=3)
        except:
            top_artists = []

        if not top_tracks:
            return None
            
        top_track = top_tracks[0]
        top_artist = top_artists[0] if top_artists else {"name": top_track['artist']}
        
        import random
        
        intros = [
            f"This week, your world revolved around {top_artist['name']}.",
            f"You've been obsessing over {top_artist['name']} lately.",
            f"The soundtrack of your week? Definitely {top_artist['name']}."
        ]
        
        middles = [
            f"'{top_track['title']}' was on repeat.",
            f"You couldn't stop listening to '{top_track['title']}'.",
            f"'{top_track['title']}' by {top_track['artist']} really hit the spot this week."
        ]
        
        outros = [
            "Keep the vibe going!",
            "Wonder what next week will sound like?",
            "A solid week of discovery."
        ]
        
        story = f"{random.choice(intros)} {random.choice(middles)} {random.choice(outros)}"
        
        return {
            "title": "Weekly Sonic Diary",
            "content": story,
            "stats": {
                "top_artist": top_artist,
                "top_track": top_track
            }
        }

    def get_forgotten_gems(self, user: str, threshold_months: int = 3, min_plays: int = 5):
        from database.repositories.scrobbles import get_top_tracks_from_db, get_scrobbles_in_range
        from database.repositories.playlists import find_local_song
        from database import get_download_info
        
        # 1. Get overall top tracks from DB (no time limit)
        # Increase limit to 200 to have a larger pool of candidates to filter from
        top_tracks = get_top_tracks_from_db(user, limit=200, start_ts=0)
        
        # 2. Get scrobbles from the last threshold_months
        now = int(time.time())
        threshold_ts = now - (threshold_months * 30 * 86400)
        recent_scrobbles = get_scrobbles_in_range(user, threshold_ts, now)
        
        # Create a set of (artist, title) for fast lookup of recently played tracks
        # Use lower() to ensure case-insensitive matching
        recently_played = set()
        for s in recent_scrobbles:
            recently_played.add((s['artist'].lower(), s['title'].lower()))
            
        forgotten_gems = []
        for t in top_tracks:
            # Check if this top track has enough plays and wasn't played recently
            if t['playcount'] >= min_plays:
                artist_key = t['artist'].lower()
                title_key = t['title'].lower()
                
                if (artist_key, title_key) not in recently_played:
                    # Enriched with local download info if available
                    gem = dict(t)
                    local_query = find_local_song(t['artist'], t['title'])
                    if local_query:
                        d_info = get_download_info(local_query)
                        if d_info:
                            gem['downloaded'] = (d_info['status'] == 'completed')
                            if d_info.get('image_url'):
                                gem['image'] = d_info['image_url']
                            
                            # Audio URL (consistent with other components)
                            from utils import sanitize_filename
                            s_artist = sanitize_filename(d_info['artist'])
                            s_album = sanitize_filename(d_info['album'] or "Unknown")
                            s_title = sanitize_filename(d_info['title'])
                            gem['audio_url'] = f"/api/audio/{s_artist}/{s_album}/{s_title}.mp3"
                    else:
                        gem['downloaded'] = False
                    
                    # If image is still missing, try to use the one from DB or fetch it
                    # But verify it's not a placeholder
                    placeholder_hash = "2a96cbd8b46e442fc41c2b86b821562f"
                    
                    # Check if the existing image is a placeholder
                    is_placeholder = False
                    if gem.get('image') and placeholder_hash in gem['image']:
                        is_placeholder = True
                        gem['image'] = None # Clear it so we fetch
                    
                    if 'image' not in gem or not gem['image']:
                        # Fetch from Last.fm as a fallback (which uses our improved ImageProvider)
                        try:
                            from core import lastfm_service
                            info = lastfm_service.get_track_info(user, t['artist'], t['title'])
                            if info and info.get('image'):
                               gem_image = info['image']
                               # Double check the fetched image isn't also a placeholder (though ImageProvider should prevent this)
                               if placeholder_hash not in gem_image:
                                   gem['image'] = gem_image
                        except Exception:
                            pass # Fail silently if we can't get the image
                    
                    forgotten_gems.append(gem)
    
        # Dynamic threshold: if we found nothing, try to be even more lenient
        if not forgotten_gems and min_plays > 1:
            return self.get_forgotten_gems(user, threshold_months, min_plays - 1)

        return forgotten_gems[:10]  # Return top 10 forgotten gems
