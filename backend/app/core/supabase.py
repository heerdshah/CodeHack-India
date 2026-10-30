"""
Supabase Client Wrapper
Provides client instances for Supabase database and storage access.
Gracefully handles missing keys by logging clear instructions and preventing application startup crashes.
"""
import logging
from typing import Optional, Any
from app.core.config import settings

logger = logging.getLogger("resourcx.supabase")

_supabase_client = None
_supabase_admin_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning(
            "[Supabase] Keys are missing (SUPABASE_URL or SUPABASE_ANON_KEY). "
            "Please configure them in backend/.env to enable live Supabase persistence."
        )
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        return _supabase_client
    except Exception as e:
        logger.error(f"[Supabase] Failed to initialize standard client: {e}")
        return None

def get_supabase_admin():
    """Returns service-role privileged client for backend services."""
    global _supabase_admin_client
    if _supabase_admin_client is not None:
        return _supabase_admin_client

    key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
    if not settings.SUPABASE_URL or not key:
        logger.warning(
            "[Supabase] Service key missing (SUPABASE_SERVICE_KEY). "
            "Backend operations requiring service_role bypass will use mock or direct DB connection."
        )
        return None

    try:
        from supabase import create_client, Client
        _supabase_admin_client = create_client(settings.SUPABASE_URL, key)
        return _supabase_admin_client
    except Exception as e:
        logger.error(f"[Supabase] Failed to initialize admin client: {e}")
        return None

def check_supabase_configured() -> bool:
    return bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY))

