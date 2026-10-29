import json
import logging
from typing import Optional, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = None

try:
    if getattr(settings, "UPSTASH_REDIS_URL", None) and "dummy" not in settings.UPSTASH_REDIS_URL:
        from upstash_redis import Redis
        redis_client = Redis(url=settings.UPSTASH_REDIS_URL, token=settings.UPSTASH_REDIS_TOKEN)
        logger.info("[Cache] Upstash Redis connected.")
except Exception as e:
    logger.warning("[Cache] Redis unavailable, using in-memory fallback: %s", e)

# In-memory fallback for development / when Redis is down
_local_cache: dict[str, tuple[str, Optional[float]]] = {}


def cache_get(key: str) -> Optional[str]:
    if redis_client:
        try:
            return redis_client.get(key)
        except Exception:
            pass
    val_ttl = _local_cache.get(key)
    return val_ttl[0] if val_ttl else None


def cache_set(key: str, value: Any, ex: Optional[int] = None) -> bool:
    if not isinstance(value, str):
        value = json.dumps(value)
    if redis_client:
        try:
            if ex:
                redis_client.setex(key, ex, value)
            else:
                redis_client.set(key, value)
            return True
        except Exception:
            pass
    _local_cache[key] = (value, None)
    return True


def cache_delete(key: str) -> bool:
    if redis_client:
        try:
            redis_client.delete(key)
            return True
        except Exception:
            pass
    _local_cache.pop(key, None)
    return True


# Cache key patterns (for consistency across codebase)
class CacheKeys:
    RESOURCE_SEARCH = "search:{query_hash}"          # TTL 60s
    AVAILABILITY    = "avail:{resource_id}:{month}"  # TTL 120s
    ELIGIBILITY     = "elig:{user_id}:{resource_id}" # TTL 300s
    DAMAGE_RESULT   = "damage:{booking_id}"          # TTL 86400s
    CONTRACT_PDF    = "contract_pdf:{contract_id}"   # TTL 3600s
    NOTIF_DEDUP     = "notify:{user_id}:{type}:{booking_id}"  # TTL 60s
    FAIRUSE         = "fairuse:{user_id}:{resource_id}:{week}"  # TTL 300s
    WAITLIST_TTL    = "waitlist_ttl:{booking_id}"    # TTL 1800s (30 min)
    NOTIF_COUNT     = "notif_count:{user_id}"        # TTL 30s
