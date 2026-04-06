from .concerts import create_concerts_schema
from .downloads import create_downloads_schema
from .intelligence import create_intelligence_schema
from .jobs import create_jobs_schema
from .playback import create_playback_schema
from .playlists import create_playlists_schema
from .releases import create_releases_schema
from .scrobbles import create_scrobbles_schema
from .settings import create_settings_schema


SCHEMA_BUILDERS = [
    create_downloads_schema,
    create_settings_schema,
    create_playlists_schema,
    create_concerts_schema,
    create_scrobbles_schema,
    create_jobs_schema,
    create_intelligence_schema,
    create_releases_schema,
    create_playback_schema,
]
