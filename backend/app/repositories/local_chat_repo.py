from contextlib import contextmanager
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class LocalChatRepository:
    def __init__(self, database_path: Optional[Path] = None):
        self.database_path = database_path or (
            Path(__file__).resolve().parents[2] / "data" / "chat.sqlite3"
        )

    @contextmanager
    def _connect(self):
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS direct_conversations (
                id TEXT PRIMARY KEY,
                booking_id TEXT,
                customer_id TEXT NOT NULL,
                seller_id TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_local_direct_pair
                ON direct_conversations(customer_id, seller_id)
                WHERE booking_id IS NULL;
            CREATE TABLE IF NOT EXISTS direct_messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL
                    REFERENCES direct_conversations(id) ON DELETE CASCADE,
                sender_id TEXT NOT NULL,
                content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 4000),
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_local_messages_thread
                ON direct_messages(conversation_id, created_at);
            """
        )
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _conversation(row: sqlite3.Row) -> Dict[str, Any]:
        return dict(row)

    async def get_or_create_direct_conversation(
        self,
        user_a: str,
        user_b: str,
    ) -> Dict[str, Any]:
        customer_id, seller_id = sorted((user_a, user_b))
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM direct_conversations
                WHERE booking_id IS NULL AND customer_id = ? AND seller_id = ?
                """,
                (customer_id, seller_id),
            ).fetchone()
            if row:
                return self._conversation(row)
            conversation = {
                "id": str(uuid.uuid4()),
                "booking_id": None,
                "customer_id": customer_id,
                "seller_id": seller_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            connection.execute(
                """
                INSERT INTO direct_conversations
                    (id, booking_id, customer_id, seller_id, created_at)
                VALUES (:id, :booking_id, :customer_id, :seller_id, :created_at)
                """,
                conversation,
            )
            return conversation

    async def list_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM direct_conversations
                WHERE customer_id = ? OR seller_id = ?
                ORDER BY created_at DESC
                """,
                (user_id, user_id),
            ).fetchall()
            return [self._conversation(row) for row in rows]

    async def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM direct_conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            return self._conversation(row) if row else None

    async def list_messages(
        self,
        conversation_id: str,
        reader_id: str,
    ) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, conversation_id, sender_id, content, is_read, created_at
                FROM direct_messages
                WHERE conversation_id = ?
                ORDER BY created_at, id
                """,
                (conversation_id,),
            ).fetchall()
            connection.execute(
                """
                UPDATE direct_messages SET is_read = 1
                WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
                """,
                (conversation_id, reader_id),
            )
            return [
                {**dict(row), "is_read": bool(row["is_read"])}
                for row in rows
            ]

    async def unread_count(self, conversation_id: str, user_id: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS count FROM direct_messages
                WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
                """,
                (conversation_id, user_id),
            ).fetchone()
            return int(row["count"])

    async def create_message(
        self,
        conversation_id: str,
        sender_id: str,
        content: str,
    ) -> Dict[str, Any]:
        message = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "content": content,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO direct_messages
                    (id, conversation_id, sender_id, content, is_read, created_at)
                VALUES (:id, :conversation_id, :sender_id, :content, 0, :created_at)
                """,
                message,
            )
        return message


local_chat_repo = LocalChatRepository()
