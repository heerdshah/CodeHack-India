from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.middleware.rate_limiter import limiter
from app.routers import (
    auth,
    users,
    resources,
    bookings,
    conditions,
    contracts,
    incidents,
    chat,
    notifications,
    admin,
    websocket,
    payments,
    disputes,
    agreements,
    inspections,
    verification,
)


from app.compat import friend_api
from app.database import Base, engine, is_sqlite, add_missing_sqlite_columns
import app.models  # ensure models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    if is_sqlite:
        for table in Base.metadata.tables.values():
            for column in table.columns:
                if column.server_default is not None:
                    arg_str = str(getattr(column.server_default, "arg", ""))
                    if "gen_random_uuid" in arg_str:
                        column.server_default = None
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await add_missing_sqlite_columns(conn)
    yield
    # Shutdown tasks


app = FastAPI(
    title="Availo API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# SlowAPI state & rate limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers with /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(resources.router, prefix="/api/v1/resources", tags=["resources"])
app.include_router(bookings.router, prefix="/api/v1/bookings", tags=["bookings"])
app.include_router(conditions.router, prefix="/api/v1/conditions", tags=["conditions"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(incidents.router, prefix="/api/v1/incidents", tags=["incidents"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(disputes.router, prefix="/api/v1/disputes", tags=["disputes"])

# Repository-backed flows absorbed from CodeHack-India (in-memory fallback)
app.include_router(agreements.router, prefix="/api/v1", tags=["agreements"])
app.include_router(inspections.router, prefix="/api/v1", tags=["inspections"])
app.include_router(verification.router, prefix="/api/v1", tags=["verification"])

# ResourcX (CodeHack-India) frontend contract, served at the root paths its
# client expects (cookie session, camelCase payloads) over the merged services.
app.include_router(friend_api.router)

# WebSocket router mounted at root /ws
app.include_router(websocket.router, tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Availo"}


from fastapi.responses import Response

@app.get("/storage/{bucket}/{file_path:path}")
async def serve_mock_storage(bucket: str, file_path: str):
    """Serves uploaded condition photos or dynamic SVG photo placeholders for demo/mock storage."""
    import os
    local_dir = os.path.join(os.getcwd(), "uploads", bucket)
    safe_path = os.path.normpath(os.path.join(local_dir, file_path))
    if safe_path.startswith(local_dir) and os.path.exists(safe_path):
        with open(safe_path, "rb") as f:
            return Response(content=f.read(), media_type="image/jpeg")

    # Generate visually rich canonical angle SVG preview
    filename = os.path.basename(file_path).upper()
    angle = "PHOTO"
    for a in ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"]:
        if a in filename:
            angle = a
            break

    is_return = "CHECK_OUT" in file_path.upper() or "OUT" in filename
    bg_gradient = "#1e293b" if not is_return else "#0f172a"
    accent = "#38bdf8" if not is_return else "#f59e0b"
    title_label = f"CHECK-IN BASELINE" if not is_return else f"RETURN INSPECTION"
    
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="{bg_gradient}"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
      </defs>
      <rect width="640" height="480" fill="url(#bg)"/>
      <rect x="20" y="20" width="600" height="440" rx="16" fill="none" stroke="{accent}" stroke-width="2" stroke-dasharray="6,6" opacity="0.6"/>
      <circle cx="320" cy="210" r="70" fill="#1e293b" stroke="{accent}" stroke-width="4"/>
      <circle cx="320" cy="210" r="45" fill="#0f172a" stroke="{accent}" stroke-width="2"/>
      <circle cx="305" cy="195" r="14" fill="{accent}" opacity="0.8"/>
      <path d="M 280 130 L 300 110 L 340 110 L 360 130 Z" fill="{accent}" opacity="0.7"/>
      <text x="320" y="320" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="bold" fill="#f8fafc" text-anchor="middle" letter-spacing="1.5">CANONICAL ANGLE: {angle}</text>
      <text x="320" y="350" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="{accent}" text-anchor="middle" letter-spacing="2">{title_label}</text>
      <text x="320" y="420" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Tamper-Proof Hardware Timestamp · Cryptographic SHA-256 Registered</text>
    </svg>"""
    return Response(content=svg.encode("utf-8"), media_type="image/svg+xml")

