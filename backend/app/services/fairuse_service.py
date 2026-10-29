"""
Fair Use Service with Redis Counters and Limits Enforcement.
"""
import logging
from datetime import date
from typing import Dict, Any, Callable
from app.utils.cache import cache_get, cache_set
from app.core.config import settings

logger = logging.getLogger("availo.fairuse")

MAX_ACTIVE_BOOKINGS = getattr(settings, "MAX_ACTIVE_BOOKINGS_PER_USER", 3)
MAX_BOOKINGS_PER_RESOURCE_PER_WEEK = getattr(settings, "MAX_BOOKINGS_PER_RESOURCE_PER_WEEK", 2)

async def check_fair_use(
    user_id: str,
    resource_id: str,
    get_active_bookings_fn: Callable,
    get_week_bookings_fn: Callable
) -> Dict[str, Any]:
    """
    Returns {allowed: bool, reason: str | None, active_count: int, week_count: int}
    """
    week_num = date.today().isocalendar()[1]
    cache_key = f"fairuse:{user_id}:{resource_id}:{week_num}"
    cached_week = cache_get(cache_key)

    active_count = await get_active_bookings_fn(user_id)
    week_count = int(cached_week) if cached_week else await get_week_bookings_fn(user_id, resource_id)

    if not cached_week:
        cache_set(cache_key, str(week_count), ex=300)

    if active_count >= MAX_ACTIVE_BOOKINGS:
        return {
            "allowed": False,
            "reason": f"Fair use limit reached: you have {active_count} active bookings (max {MAX_ACTIVE_BOOKINGS}).",
            "active_count": active_count,
            "week_count": week_count
        }

    if week_count >= MAX_BOOKINGS_PER_RESOURCE_PER_WEEK:
        return {
            "allowed": False,
            "reason": f"You've already booked this resource {week_count} times this week (max {MAX_BOOKINGS_PER_RESOURCE_PER_WEEK}).",
            "active_count": active_count,
            "week_count": week_count
        }

    return {
        "allowed": True,
        "reason": None,
        "active_count": active_count,
        "week_count": week_count
    }
