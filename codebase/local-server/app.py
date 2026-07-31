from __future__ import annotations

import os
import secrets
from collections import deque
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

NotificationType = Literal["info", "reminder", "success", "warning", "error", "message"]
Priority = Literal["low", "normal", "high", "urgent"]


class NotificationInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str | None = Field(default=None, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")
    title: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=500)
    type: NotificationType = "info"
    priority: Priority = "normal"
    timestamp: datetime | None = None
    actionUrl: HttpUrl | None = None
    actionLabel: str | None = Field(default=None, max_length=40)


class Notification(NotificationInput):
    id: str
    timestamp: datetime


TOKEN = os.getenv("PIXEL_PET_TOKEN", "")
MAX_HISTORY = int(os.getenv("PIXEL_PET_MAX_HISTORY", "200"))
history: deque[Notification] = deque(maxlen=max(20, min(MAX_HISTORY, 1000)))
clients: set[WebSocket] = set()

app = FastAPI(title="Pixel Pet Local Notifier", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://[a-p]{32}|https?://(?:localhost|127\.0\.0\.1)(?::\d+)?)$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Pixel-Pet-Token"],
)


def require_token(x_pixel_pet_token: str | None = Header(default=None)) -> None:
    if TOKEN and (not x_pixel_pet_token or not secrets.compare_digest(x_pixel_pet_token, TOKEN)):
        raise HTTPException(status_code=401, detail="Invalid Pixel Pet token")


def complete(payload: NotificationInput) -> Notification:
    data = payload.model_dump()
    data["id"] = payload.id or f"notif-{uuid4().hex}"
    data["timestamp"] = payload.timestamp or datetime.now(timezone.utc)
    return Notification.model_validate(data)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "clients": len(clients), "notifications": len(history)}


@app.get("/api/notifications", dependencies=[Depends(require_token)])
async def list_notifications(since: datetime | None = Query(default=None)) -> list[Notification]:
    items = list(history)
    return [item for item in items if not since or item.timestamp > since][-100:]


@app.post("/api/notifications", dependencies=[Depends(require_token)])
async def post_notification(payload: NotificationInput) -> Notification:
    item = complete(payload)
    if any(existing.id == item.id for existing in history):
        raise HTTPException(status_code=409, detail="Duplicate notification id")
    history.append(item)
    encoded = item.model_dump(mode="json")
    stale: list[WebSocket] = []
    for client in clients:
        try:
            await client.send_json(encoded)
        except Exception:
            stale.append(client)
    for client in stale:
        clients.discard(client)
    return item


@app.websocket("/ws")
async def websocket_notifications(websocket: WebSocket, token: str = Query(default="")) -> None:
    if TOKEN and not secrets.compare_digest(token, TOKEN):
        await websocket.close(code=1008, reason="Invalid token")
        return
    await websocket.accept()
    clients.add(websocket)
    try:
        await websocket.send_json({"kind": "hello", "timestamp": datetime.now(timezone.utc).isoformat()})
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(websocket)
