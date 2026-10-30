import asyncio
from types import SimpleNamespace

from app.core.deps import get_current_user
from app.repositories.local_chat_repo import LocalChatRepository
from backend.app.main import app as asgi_app
from app.routers import chat


CURRENT_USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"
CONVERSATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


class FakeQuery:
    def __init__(self, table):
        self.table = table
        self.filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def neq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, _limit):
        return self

    def in_(self, field, values):
        self.filters[field] = values
        return self

    def execute(self):
        if self.table == "users" and "username" in self.filters:
            data = [{"id": OTHER_USER_ID}]
        elif self.table == "users":
            data = [
                {"id": CURRENT_USER_ID, "username": "current", "full_name": "Current User"},
                {"id": OTHER_USER_ID, "username": "mira", "full_name": "Mira"},
            ]
        else:
            data = []
        return SimpleNamespace(data=data, count=0)


class FakeRpc:
    def execute(self):
        return SimpleNamespace(
            data=[
                {
                    "id": CONVERSATION_ID,
                    "booking_id": None,
                    "customer_id": CURRENT_USER_ID,
                    "seller_id": OTHER_USER_ID,
                }
            ]
        )


class FakeSupabase:
    def table(self, name):
        return FakeQuery(name)

    def rpc(self, _name, _params):
        return FakeRpc()


def test_authenticated_user_can_start_direct_chat_by_username(client, monkeypatch):
    fastapi_app = asgi_app.app
    fastapi_app.dependency_overrides[get_current_user] = lambda: {
        "id": CURRENT_USER_ID,
        "username": "current",
    }
    monkeypatch.setattr(chat, "_client", lambda: FakeSupabase())

    try:
        response = client.post("/chat/direct", json={"username": "@mira"})
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.json()["id"] == CONVERSATION_ID
    assert response.json()["booking_id"] is None
    assert response.json()["other_user"]["username"] == "mira"


def test_local_direct_chat_can_send_and_receive_messages(client, monkeypatch, tmp_path):
    fastapi_app = asgi_app.app
    active_user = {"id": CURRENT_USER_ID, "username": "current"}
    fastapi_app.dependency_overrides[get_current_user] = lambda: active_user
    monkeypatch.setattr(chat, "_client", lambda: None)
    local_repo = LocalChatRepository(tmp_path / "chat.sqlite3")
    monkeypatch.setattr(chat, "local_chat_repo", local_repo)

    try:
        started = client.post("/chat/direct", json={"username": "mira_okafor"})
        assert started.status_code == 200, started.text
        conversation_id = started.json()["id"]

        sent = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            json={"content": "Hello there"},
        )
        assert sent.status_code == 201, sent.text
        assert sent.json()["content"] == "Hello there"

        active_user = {"id": OTHER_USER_ID, "username": "mira_okafor"}
        inbox = client.get("/chat/conversations")
        received = client.get(f"/chat/conversations/{conversation_id}/messages")
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)

    assert received.status_code == 200
    assert received.json()[0]["content"] == "Hello there"
    assert inbox.status_code == 200
    assert inbox.json()[0]["id"] == conversation_id
    assert inbox.json()[0]["unread_count"] == 1

    restarted_repo = LocalChatRepository(tmp_path / "chat.sqlite3")
    persisted_messages = asyncio.run(
        restarted_repo.list_messages(conversation_id, OTHER_USER_ID)
    )
    assert persisted_messages[0]["content"] == "Hello there"
