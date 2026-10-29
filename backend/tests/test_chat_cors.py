from starlette.testclient import TestClient

from backend.app.core.deps import get_current_user
from backend.app.main import app
from backend.app.routers import chat


def test_unhandled_chat_error_keeps_cors_headers(monkeypatch):
    async def authenticated_user():
        return {"id": "44444444-4444-4444-4444-444444444444"}

    def unavailable_supabase():
        raise RuntimeError("Supabase test failure")

    fastapi_app = app.app
    fastapi_app.dependency_overrides[get_current_user] = authenticated_user
    monkeypatch.setattr(chat, "get_supabase_admin", unavailable_supabase)

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.get(
                "/chat/conversations",
                headers={"Origin": "http://localhost:3000"},
            )
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.json()["detail"] == "Internal server error: Supabase test failure"
