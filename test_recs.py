import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import get_setting
from services.recommendations import recommendations_service

user = get_setting("LASTFM_USER")
print("USER:", user)

if user:
    recs = recommendations_service.get_recommendations(2)
    print("RECS:", recs)
else:
    print("No user found in settings.")
