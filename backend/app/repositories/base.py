import logging
from typing import Any, Dict, List, Optional
from app.core.supabase import get_supabase_admin, check_supabase_configured

logger = logging.getLogger("resourcx.repo")

class BaseRepository:
    def __init__(self, table_name: str):
        self.table_name = table_name

    def get_client(self):
        return get_supabase_admin()

    def is_live(self) -> bool:
        import os
        if os.environ.get("TESTING") == "1":
            return False
        return check_supabase_configured() and self.get_client() is not None

