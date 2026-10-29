"""
Notification Service with WebSocket Fan-out, Resend Email, and Redis Deduplication.
Extends repository notifications to high-priority transactional emails.
"""
import logging
from typing import Optional
from app.core.config import settings
from app.utils.cache import cache_get, cache_set
from app.services.connection_manager import manager
from backend.app.repositories.notification_repo import notification_repo

logger = logging.getLogger("availo.notification")

# Email-worthy notification types
EMAIL_TYPES = {
    "BOOKING_APPROVED",
    "DAMAGE_DETECTED",
    "OVERDUE_RETURN",
    "CONTRACT_READY",
    "DISPUTE_OPENED",
    "BADGE_APPROVED",
    "BADGE_REJECTED",
    "WAITLIST_PROMOTED",
}

async def send_notification_with_email(
    user_id: str,
    user_email: Optional[str],
    notification_type: str,
    title: str,
    body: str,
    booking_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    data: Optional[dict] = None
) -> Optional[dict]:
    """
    1. Save notification to DB repository.
    2. Send WebSocket push via ConnectionManager.
    3. Send Resend email for high-priority types with Redis dedup.
    """
    # 1. DB Record
    payload = {
        "user_id": user_id,
        "type": notification_type.lower(),
        "title": title,
        "message": body,
        "data": data or {"booking_id": booking_id, "resource_id": resource_id}
    }
    notif = await notification_repo.create(payload)

    # 2. WebSocket Push
    try:
        ws_msg = {
            "type": notification_type,
            "title": title,
            "body": body,
            "booking_id": booking_id,
            "resource_id": resource_id,
            "data": data or {}
        }
        await manager.send_to_user(str(user_id), ws_msg)
    except Exception as e:
        logger.warning(f"[Notification] WS push failed: {e}")

    # 3. Resend Email with Redis Deduplication
    dedup_key = f"notify:{user_id}:{notification_type}:{booking_id or 'global'}"
    if cache_get(dedup_key):
        logger.info(f"[Notification] Email suppressed by dedup key: {dedup_key}")
        return notif

    resend_key = getattr(settings, "RESEND_API_KEY", None)
    if notification_type.upper() in EMAIL_TYPES and resend_key and user_email:
        try:
            import resend
            resend.api_key = resend_key
            from_addr = getattr(settings, "RESEND_FROM_EMAIL", "notifications@availo.app")
            
            link_html = f"<p><a href='http://localhost:3000/bookings/{booking_id}'>View Booking Details &rarr;</a></p>" if booking_id else ""
            html_content = f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                  <h2 style="color: #1e3a8a; margin-top: 0;">{title}</h2>
                  <p style="color: #334155; line-height: 1.5;">{body}</p>
                  {link_html}
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Availo Institutional Resource Sharing Network</p>
                </div>
            """
            
            resend.Emails.send({
                "from": from_addr,
                "to": user_email,
                "subject": f"Availo: {title}",
                "html": html_content
            })
            cache_set(dedup_key, "1", ex=60)
            logger.info(f"[Notification] Resend email dispatched to {user_email}")
        except Exception as e:
            logger.warning(f"[Notification] Resend email failed (non-fatal): {e}")

    return notif
