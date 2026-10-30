from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import traceback

from backend.app.core.config import settings
from backend.app.services.scheduler_service import start_scheduler, shutdown_scheduler
from backend.app.routers import (
    auth,
    users,
    resources,
    bookings,
    verification,
    inspections,
    incidents,
    agreements,
    notifications,
    admin,
    chat,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resourcx")

import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[ResourcX API] Starting application services...")
    if os.environ.get("TESTING") != "1":
        await start_scheduler()
    yield
    logger.info("[ResourcX API] Shutting down application services...")
    if os.environ.get("TESTING") != "1":
        await shutdown_scheduler()

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for ResourcX: Institutional Resource Sharing Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Global 500 handler returning JSON response with detail
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    err_tb = traceback.format_exc()
    logger.error(f"[GlobalException] Unhandled error at {request.method} {request.url}: {exc}\n{err_tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(resources.router)
app.include_router(bookings.router)
app.include_router(verification.router)
app.include_router(inspections.router)
app.include_router(incidents.router)
app.include_router(agreements.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(chat.router)

@app.get("/")
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "groq_configured": bool(settings.GROQ_API_KEY),
        "supabase_configured": bool(settings.SUPABASE_URL)
    }

# Wrap the complete ASGI app so CORS headers are also present on unhandled errors.
# Include both localhost and loopback origins because Windows/browser resolution can prefer
# ::1 or 127.0.0.1 even when the app is configured for the other address.
app = CORSMiddleware(
    app=app,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        *settings.ALLOWED_ORIGINS,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
