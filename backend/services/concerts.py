import requests
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from database import get_setting, add_concert, get_cached_concerts, clear_concerts, get_all_artists

class ConcertService:
    def __init__(self):
        self.tm_api_key = get_setting('tm_api_key')
        self.bit_app_id = get_setting('bit_app_id', 'demo') # Use 'demo' as default
        
    def get_all_concerts(self, city=None):
        """
        Get concerts from local cache.
        """
        return get_cached_concerts(city)



    
    def sync_concerts(self, city=None, radius=None):
        """
        Deep fetch from APIs and update cache.
        Now performs a Library-Centric Global Search.
        City/Radius are ignored for the fetch (we get everything), 
        but kept in signature for compatibility/future use.
        """
        # Get user artists (Top 150 to stay safe with rate limits)
        # 150 * 1 call = 150 calls. Safe.
        all_artists = get_all_artists()
        top_artists = all_artists[:150]
        
        # 1. Ticketmaster Global Search (Targeted)
        # We search specifically for these artists, globally.
        # Max workers=5 to be nice to API
        tm_events = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            # Pass None for coords/radius to get global events
            future_to_artist = {executor.submit(self._fetch_ticketmaster_single_artist, artist, None, None): artist for artist in top_artists}
            for future in as_completed(future_to_artist):
                result = future.result()
                if result:
                    tm_events.extend(result)
        
        # 2. Bandsintown (Fallback/Supplement)
        # We perform global search for Top 20 artists (BIT doesn't handle bulk well, strict rate limits?)
        # unique app_id "my_app" usually permits decent volume.
        bit_events = []
        # Always fetch BIT for top 20, regardless of city filter (since we want repository)
        # If city is set, we might filter in memory, but here we want VALID global data.
        # But wait, original logic was "Fetch BIT if city provided". 
        # Now we want "Fetch BIT globally for Top Artists" to catch what TM misses.
        
        # Let's fetch BIT for Top 50 to match TM roughly, or maybe Top 30?
        # Let's try Top 30 to be safe on response times.
        # User requested Fox Stevenson, who might be > 30. Increasing to 50.
        # Fox Stevenson is rank 72 (alphabetical). Increasing to 100.
        target_bit_artists = top_artists[:100]
        bit_events = self._fetch_bandsintown_bulk(target_bit_artists, city, radius=radius)
        
        # 3. Deduplicate and Save
        # Merge lists and remove duplicates based on Artist + Date
        all_events = self._deduplicate(tm_events + bit_events)
        
        count = 0
        for event in all_events:
            add_concert(
                event['id'], 
                event['artist'], 
                event['title'], 
                event['date'], 
                event['time'], 
                event['venue'], 
                event['city'], 
                event.get('country'),
                event['url'], 
                event.get('image_url') or event.get('image'), 
                event['source']
            )
            count += 1
            
        return count

    def _fetch_ticketmaster_single_artist(self, artist, coords=None, radius=None):
        """
        Fetch events for a single artist. 
        If coords/radius are None, performs a global search.
        """
        url = "https://app.ticketmaster.com/discovery/v2/events.json"
        params = {
            "apikey": self.tm_api_key,
            "keyword": artist, # Precise artist search, or use attractionId if we had it
            "classificationName": "music",
            "size": 20, # Get next 20 shows
            "sort": "date,asc"
        }
        
        if coords and radius:
            params["geoPoint"] = f"{coords[0]},{coords[1]}"
            params["radius"] = radius
            params["unit"] = "km"
        
        try:
            response = requests.get(url, params=params)
             # Rate Limit handling?
            if response.status_code == 429:
                return []
            response.raise_for_status()
            data = response.json()
            
            if "_embedded" not in data:
                return []
                
            events = []
            
            for event in data["_embedded"].get("events", []):
                # Verify exact artist match or very close? 
                # TM keyword search is fuzzy. "Pink" might return "Pink Floyd".
                # We should verify the artist name in attractions matches our artist.
                is_match = False
                artist_name = artist # Default to the query artist
                
                # Check attractions for exact match
                if "attractions" in event.get("_embedded", {}):
                    for attraction in event["_embedded"]["attractions"]:
                        if attraction.get("name", "").lower() == artist.lower():
                            is_match = True
                            artist_name = attraction["name"] # Use official casing
                            break
                            
                if not is_match:
                    # Strict check on event name?
                    # If we searched for "Metallica", and event is "Metallica World Tour", that's good.
                    # If we searched for "Pink" and got "Pink Floyd", that's bad.
                    # Let's require the artist name to be a distinct word in the event name?
                    # Or just rely on exact attraction match for now to be safe.
                    # EXCEPT: Some events might not have attractions listed properly?
                    # Let's trust attraction match mostly.
                    # If "attractions" exists but no match, it's likely a different artist.
                    pass

                if is_match:
                    image_url = event["images"][0]["url"] if event.get("images") else None
                    venue_data = event["_embedded"]["venues"][0] if "venues" in event.get("_embedded", {}) else {}
                    venue = venue_data.get("name", "Unknown Venue")
                    city = venue_data.get("city", {}).get("name", "Unknown City")
                    country = venue_data.get("country", {}).get("countryCode", "Unknown") # Use countryCode (GB, US, DE)
                    
                    concert = {
                        "id": f"tm_{event['id']}",
                        "source": "Ticketmaster",
                        "artist": artist_name,
                        "title": event["name"],
                        "date": event["dates"]["start"]["localDate"],
                        "time": event["dates"]["start"].get("localTime"),
                        "venue": venue,
                        "city": city,
                        "country": country,
                        "url": event.get("url"),
                        "image_url": image_url
                    }
                    
                    add_concert(
                        concert["id"], 
                        concert["artist"], 
                        concert["title"], 
                        concert["date"], 
                        concert["time"], 
                        concert["venue"], 
                        concert["city"],
                        concert["country"],
                        concert["url"],
                        concert["image_url"],
                        concert["source"]
                    )
                    
                    events.append(concert)
                    
            return events
            
        except Exception as e:
            print(f"Error fetching TM for {artist}: {e}")
            return []

    def _fetch_ticketmaster_city_dump(self, city, radius, artist_map):
        # Fetch pages until we find enough or hit limit
        # This is the "Deep Search"
        events = []
        page = 0
        max_pages = 5 # 5 * 200 = 1000 events scanned
        
        coords = self._get_coordinates(city)
        if not coords:
            return []

        while page < max_pages:
            url = "https://app.ticketmaster.com/discovery/v2/events.json"
            params = {
                "apikey": self.tm_api_key,
                "classificationName": "music",
                "size": 200, 
                "sort": "date,asc",
                "page": page,
                "geoPoint": f"{coords[0]},{coords[1]}",
                "radius": radius or 50,
                "unit": "km"
            }
            
            try:
                response = requests.get(url, params=params)
                if response.status_code == 429:
                     break
                response.raise_for_status()
                data = response.json()
                
                if "_embedded" not in data:
                    break
                    
                page_events = data["_embedded"].get("events", [])
                if not page_events:
                    break
                    
                for event in page_events:
                    # Check if matches ANY user artist
                    # Optimization: Check attractions first, then name
                    is_match = False
                    artist_name = "Unknown"

                    event_name_lower = event["name"].lower()
                    attractions = event.get("_embedded", {}).get("attractions", [])
                    
                    # 1. Check Attractions (Most accurate)
                    for attraction in attractions:
                        attraction_name = attraction.get("name", "")
                        if not attraction_name: continue
                        
                        attr_lower = attraction_name.lower()
                        if attr_lower in artist_map:
                            is_match = True
                            artist_name = attraction_name
                            break
                            
                    # 2. Check Event Name (Fuzzy)
                    if not is_match:
                         # Reverse check: Is any of my artists in the event title?
                         # Only do this if artist name is long enough to avoid false positives (e.g. "A")
                         # This allows matching "The Taylor Swift Tour" with "Taylor Swift"
                         for artist_lower, original_name in artist_map.items():
                             if len(artist_lower) > 2 and artist_lower in event_name_lower:
                                 is_match = True
                                 artist_name = original_name
                                 break
                         
                    if is_match:
                        image_url = event["images"][0]["url"] if event.get("images") else None
                        venue = event["_embedded"]["venues"][0] if "venues" in event.get("_embedded", {}) else {}
                        
                        concert = {
                            "id": f"tm_{event['id']}",
                            "source": "Ticketmaster",
                            "artist": artist_name,
                            "title": event["name"],
                            "date": event["dates"]["start"]["localDate"],
                            "time": event["dates"]["start"].get("localTime"),
                            "venue": venue.get("name"),
                            "city": venue.get("city", {}).get("name"),
                            "url": event.get("url"),
                            "image": image_url
                        }
                        events.append(concert)
                
                page += 1
                
            except Exception as e:
                print(f"Error fetching TM page {page}: {e}")
                break
                
        return events

    def _fetch_bandsintown_bulk(self, artists, city_filter=None, coords=None, radius=None):
        events = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_artist = {executor.submit(self._fetch_bandsintown_artist, artist, city_filter, coords, radius): artist for artist in artists}
            for future in as_completed(future_to_artist):
                result = future.result()
                if result:
                    events.extend(result)
        return events

    def _fetch_bandsintown_artist(self, artist, city_filter, coords=None, radius=None):
        # URL encode artist
        encoded_artist = urllib.parse.quote(artist)
        # Manually construct URL with app_id
        url = f"https://rest.bandsintown.com/artists/{encoded_artist}/events?app_id={self.bit_app_id}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json"
        }
        
        try:
            response = requests.get(url, headers=headers)
             # 404 means artist not found, which is fine
            if response.status_code == 404:
                return []
            response.raise_for_status()
            
            data = response.json()
            # result might be {errorMessage...} or list
            if isinstance(data, dict) and "errorMessage" in data:
                return []
                
            artist_events = []
            for event in data:
                venue = event.get("venue", {})
                
                # Filter Logic
                if radius and coords and venue.get('latitude') and venue.get('longitude'):
                    # Distance Filter
                    try:
                        event_coords = (float(venue['latitude']), float(venue['longitude']))
                        distance = geodesic(coords, event_coords).km
                        if distance > float(radius):
                            continue
                    except (ValueError, TypeError):
                         # Fallback to city string match if coords fail
                         if city_filter and venue.get("city", "").lower() != city_filter.lower():
                            continue
                elif city_filter and venue.get("city", "").lower() != city_filter.lower():
                    # Exact City Filter
                    continue
                
                # Parse
                # Date format: 2025-12-08T19:00:00
                date_str = event.get("datetime")
                date_obj = datetime.fromisoformat(date_str) if date_str else None
                
                # Attempt to map country name to code if possible, or just use name
                # BIT returns full name e.g. "Austria", "United States"
                country = venue.get("country")
                if country == "United States": country = "US"
                elif country == "United Kingdom": country = "GB"
                elif country == "Austria": country = "AT"
                elif country == "Germany": country = "DE"
                elif country == "France": country = "FR"
                elif country == "Spain": country = "ES"
                elif country == "Italy": country = "IT"
                elif country == "Netherlands": country = "NL"
                elif country == "Belgium": country = "BE"
                elif country == "Czech Republic": country = "CZ"
                
                concert = {
                    "id": f"bit_{event['id']}",
                    "source": "Bandsintown",
                    "artist": artist,
                    "title": f"{artist} at {venue.get('name')}",
                    "date": date_obj.strftime("%Y-%m-%d") if date_obj else "",
                    "time": date_obj.strftime("%H:%M:%S") if date_obj else "",
                    "venue": venue.get("name"),
                    "city": venue.get("city"),
                    "country": country,
                    "url": event.get("url"),
                    "image": None 
                }
                artist_events.append(concert)
                
            return artist_events

        except Exception as e:
            # print(f"Error fetching BIT for {artist}: {e}")
            return []

    def _deduplicate(self, events):
        # Dedupe by (Artist + Date) roughly
        unique = {}
        for e in events:
            # Key: artist_date
            key = f"{e['artist']}_{e['date']}".lower()
            if key not in unique:
                unique[key] = e
            else:
                # If we already have it, maybe merge info? 
                # Prefer Ticketmaster for links/images usually?
                if e['source'] == 'Ticketmaster':
                    unique[key] = e
        return list(unique.values())

    def _get_coordinates(self, city):
        try:
            geolocator = Nominatim(user_agent="spotify_scrobbler_app")
            location = geolocator.geocode(city)
            if location:
                return (location.latitude, location.longitude)
        except Exception as e:
            print(f"Geocoding error: {e}")
        return None
