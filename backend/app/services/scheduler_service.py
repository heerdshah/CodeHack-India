import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.repositories.booking_repo import booking_repo
from app.repositories.notification_repo import notification_repo
from app.repositories.audit_repo import audit_repo

logger = logging.getLogger("resourcx.scheduler")

scheduler = AsyncIOScheduler()

async def check_overdue_bookings():
    try:
        all_active = await booking_repo.list_all(status="active")
        now = datetime.now(timezone.utc)
        for b in all_active:
            end_dt = datetime.fromisoformat(b["end_date"].replace("Z", "+00:00"))
            if now > end_dt:
                logger.info(f"[Scheduler] Marking booking {b['id']} as overdue.")
                await booking_repo.update(b["id"], {"status": "overdue"})
                
                # Notify borrower
                await notification_repo.create({
                    "user_id": b["user_id"],
                    "type": "booking_overdue",
                    "title": "Return Overdue!",
                    "message": f"Your booking for {b.get('resource_id')} is overdue. Please perform return check immediately.",
                    "data": {"booking_id": b["id"]}
                })
                
                # Flag suspicious behavior if overdue by > 2 hours
                if (now - end_dt).total_seconds() > 7200:
                    await audit_repo.flag_user(
                        user_id=b["user_id"],
                        flag_type="repeated_noshow",
                        reason=f"Booking {b['id']} overdue by more than 2 hours without return check.",
                        evidence={"booking_id": b["id"], "end_date": b["end_date"]}
                    )
    except Exception as e:
        logger.error(f"[Scheduler] Error checking overdue bookings: {e}")

async def start_scheduler():
    import os
    if os.environ.get("TESTING") == "1":
        logger.info("[Scheduler] TESTING mode: scheduler disabled.")
        return
    try:
        scheduler.add_job(check_overdue_bookings, 'interval', minutes=5, id="check_overdue")
        scheduler.start()
        logger.info("[Scheduler] Background scheduler started successfully.")
    except Exception as e:
        logger.warning(f"[Scheduler] Could not start scheduler: {e}")

async def shutdown_scheduler():
    try:
        if scheduler.running:
            scheduler.shutdown()
    except Exception:
        pass

