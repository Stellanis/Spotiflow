import time

class CacheManager:
    def __init__(self, ttl=86400):
        self._cache = {}
        self._ttl = ttl

    def get(self, key):
        """Retrieve value from cache if valid."""
        if key in self._cache:
            timestamp, data = self._cache[key]
            if time.time() - timestamp < self._ttl:
                return data
        return None

    def set(self, key, value):
        """Set value in cache with current timestamp."""
        self._cache[key] = (time.time(), value)

    def delete(self, key):
        """Remove key from cache."""
        if key in self._cache:
            del self._cache[key]

    def clear(self):
        """Clear all cache."""
        self._cache = {}

    def clear_with_prefix(self, prefix):
        """Clear all keys starting with prefix."""
        keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._cache[k]
