
def sanitize_filename(name):
    """
    Sanitizes a string to be safe for filenames and consistent across services.
    Matches the logic used for file storage and URL generation.
    """
    if not name: 
        return "Unknown"
    # Keep only alphanumeric, spaces, and basic separators
    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " -_()"]).strip()
