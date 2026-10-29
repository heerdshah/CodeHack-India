"""
WebSocket Connection Manager for real-time notifications and updates.
Provides per-user connections and room/booking broadcast fan-out.
"""
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger("availo.ws")

class ConnectionManager:
    def __init__(self):
        # Map user_id -> list of active WebSockets (to support multiple browser tabs)
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"[WS] User {user_id} connected. Active tabs: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"[WS] User {user_id} disconnected.")

    async def send_to_user(self, user_id: str, message: dict):
        """Sends a JSON message to all active sockets of a given user."""
        if user_id in self.active_connections:
            dead_sockets = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.warning(f"[WS] Failed sending to user {user_id}: {e}")
                    dead_sockets.append(ws)
            for dead in dead_sockets:
                self.disconnect(user_id, dead)

    async def send_to_many(self, user_ids: list[str], message: dict):
        """Sends to a list of user IDs (e.g. all admins or participants)."""
        for uid in user_ids:
            await self.send_to_user(str(uid), message)

    async def broadcast_to_booking(self, booking_id: str, message: dict, get_booking_fn):
        """
        Sends a message to both the booking's user AND the resource owner.
        get_booking_fn: async callable(booking_id) -> {user_id, owner_id} or object with attrs
        """
        try:
            booking = await get_booking_fn(booking_id)
            if booking:
                user_id = str(booking.get("user_id") if isinstance(booking, dict) else getattr(booking, "user_id", ""))
                owner_id = str(booking.get("owner_id") if isinstance(booking, dict) else getattr(booking, "owner_id", ""))
                if user_id:
                    await self.send_to_user(user_id, message)
                if owner_id and owner_id != user_id:
                    await self.send_to_user(owner_id, message)
        except Exception as e:
            logger.error(f"[WS] broadcast_to_booking error: {e}")

manager = ConnectionManager()
