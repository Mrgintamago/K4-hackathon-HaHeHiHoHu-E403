import importlib
import os

from fastapi.testclient import TestClient

os.environ["PIXEL_PET_TOKEN"] = "test-secret"
server = importlib.import_module("app")
client = TestClient(server.app)


def test_health_and_auth():
    assert client.get("/health").status_code == 200
    assert client.get("/api/notifications").status_code == 401


def test_post_list_and_duplicate():
    payload = {
        "id": "test-notif-001",
        "title": "Study",
        "message": "Lesson starts soon",
        "type": "reminder",
        "priority": "high",
    }
    headers = {"X-Pixel-Pet-Token": "test-secret"}
    created = client.post("/api/notifications", headers=headers, json=payload)
    assert created.status_code == 200
    assert client.post("/api/notifications", headers=headers, json=payload).status_code == 409
    assert client.get("/api/notifications", headers=headers).json()[-1]["id"] == payload["id"]


def test_websocket_broadcast():
    headers = {"X-Pixel-Pet-Token": "test-secret"}
    with client.websocket_connect("/ws?token=test-secret") as websocket:
        assert websocket.receive_json()["kind"] == "hello"
        response = client.post("/api/notifications", headers=headers, json={
            "title": "Live",
            "message": "Broadcast",
            "type": "info",
            "priority": "normal",
        })
        assert websocket.receive_json()["id"] == response.json()["id"]
